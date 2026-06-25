<?php

namespace App\Controller;

use App\Entity\User;
use App\Form\UserType;
use App\Repository\UserRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\Filesystem\Filesystem;

#[Route('/user')]
final class UserController extends AbstractController
{
    #[Route(name: 'app_user_index', methods: ['GET'])]
    public function index(UserRepository $userRepository): Response
    {
        return $this->render('user/index.html.twig', [
            'users' => $userRepository->findAll(),
        ]);
    }

    #[Route('/new', name: 'app_user_new', methods: ['GET', 'POST'])]
    public function new(
        Request $request, 
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher
    ): Response {
        $user = new User();
        $form = $this->createForm(UserType::class, $user);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            // Fusion : Hachage du mot de passe si présent dans le formulaire
            $plainPassword = $form->get('password')->getData();
            if ($plainPassword) {
                $user->setPassword($passwordHasher->hashPassword($user, $plainPassword));
            }

            // Fusion : Attribution du rôle par défaut
            if (empty($user->getRoles())) {
                $user->setRoles(['ROLE_USER']);
            }

            $entityManager->persist($user);
            $entityManager->flush();

            return $this->redirectToRoute('app_user_index', [], Response::HTTP_SEE_OTHER);
        }

        return $this->render('user/new.html.twig', [
            'user' => $user,
            'form' => $form,
        ]);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // UPLOAD PHOTO - AVANT show() pour éviter le conflit de route
    // ═══════════════════════════════════════════════════════════════════════
    #[Route('/{id}/photo', name: 'app_user_upload_photo', methods: ['POST'])]
    public function uploadPhoto(
        Request $request,
        User $user,
        EntityManagerInterface $entityManager
    ): JsonResponse {
        $file = $request->files->get('photo');

        if (!$file instanceof UploadedFile) {
            return new JsonResponse(['error' => 'Aucun fichier reçu.'], 400);
        }

        if ($file->getSize() > 5 * 1024 * 1024) {
            return new JsonResponse(['error' => 'Fichier trop grand (max 5MB).'], 400);
        }

        $mimeType = $file->getMimeType();
        $allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!in_array($mimeType, $allowedTypes, true)) {
            return new JsonResponse(['error' => 'Format invalide (JPEG, PNG, WebP uniquement).'], 400);
        }

        $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/photos';
        $filesystem = new Filesystem();
        if (!$filesystem->exists($uploadDir)) {
            $filesystem->mkdir($uploadDir, 0755);
        }

        $oldPhoto = $user->getPhoto();
        if ($oldPhoto) {
            $oldPath = $uploadDir . '/' . basename($oldPhoto);
            if ($filesystem->exists($oldPath)) {
                $filesystem->remove($oldPath);
            }
        }

        $extension = $file->guessExtension() ?: 'jpg';
        $filename = sprintf('user_%d_%s.%s', $user->getId(), uniqid(), $extension);
        
        $file->move($uploadDir, $filename);

        $this->resizeImage($uploadDir . '/' . $filename, 300, 300);

        $photoUrl = '/uploads/photos/' . $filename;
        $user->setPhoto($photoUrl);
        $entityManager->flush();

        return new JsonResponse([
            'photoUrl' => $photoUrl,
            'message' => 'Photo mise à jour avec succès.',
        ]);
    }

    #[Route('/{id}', name: 'app_user_show', methods: ['GET'])]
    public function show(User $user): Response
    {
        return $this->render('user/show.html.twig', [
            'user' => $user,
        ]);
    }

    #[Route('/{id}/edit', name: 'app_user_edit', methods: ['GET', 'POST'])]
    public function edit(
        Request $request, 
        User $user, 
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher
    ): Response {
        $form = $this->createForm(UserType::class, $user);
        $form->handleRequest($request);

        if ($form->isSubmitted() && $form->isValid()) {
            // Fusion : Mise à jour du mot de passe haché si modifié
            $plainPassword = $form->get('password')->getData();
            if ($plainPassword) {
                $user->setPassword($passwordHasher->hashPassword($user, $plainPassword));
            }

            $entityManager->flush();

            return $this->redirectToRoute('app_user_index', [], Response::HTTP_SEE_OTHER);
        }

        return $this->render('user/edit.html.twig', [
            'user' => $user,
            'form' => $form,
        ]);
    }

    #[Route('/{id}', name: 'app_user_delete', methods: ['POST'])]
    public function delete(Request $request, User $user, EntityManagerInterface $entityManager): Response
    {
        if ($this->isCsrfTokenValid('delete'.$user->getId(), $request->getPayload()->getString('_token'))) {
            $entityManager->remove($user);
            $entityManager->flush();
        }

        return $this->redirectToRoute('app_user_index', [], Response::HTTP_SEE_OTHER);
    }

    private function resizeImage(string $filepath, int $width, int $height): void
    {
        if (!extension_loaded('gd')) {
            return;
        }

        $info = getimagesize($filepath);
        if ($info === false) {
            return;
        }

        [$origWidth, $origHeight, $type] = $info;

        $source = match ($type) {
            IMAGETYPE_JPEG => imagecreatefromjpeg($filepath),
            IMAGETYPE_PNG => imagecreatefrompng($filepath),
            IMAGETYPE_WEBP => imagecreatefromwebp($filepath),
            default => null,
        };

        if (!$source) {
            return;
        }

        $dest = imagecreatetruecolor($width, $height);

        if ($type === IMAGETYPE_PNG || $type === IMAGETYPE_WEBP) {
            imagealphablending($dest, false);
            imagesavealpha($dest, true);
            $transparent = imagecolorallocatealpha($dest, 0, 0, 0, 127);
            imagefill($dest, 0, 0, $transparent);
        }

        $ratio = min($origWidth / $width, $origHeight / $height);
        $newWidth = (int)($width * $ratio);
        $newHeight = (int)($height * $ratio);
        $srcX = (int)(($origWidth - $newWidth) / 2);
        $srcY = (int)(($origHeight - $newHeight) / 2);

        imagecopyresampled(
            $dest, $source,
            0, 0, $srcX, $srcY,
            $width, $height, $newWidth, $newHeight
        );

        match ($type) {
            IMAGETYPE_JPEG => imagejpeg($dest, $filepath, 85),
            IMAGETYPE_PNG => imagepng($dest, $filepath, 6),
            IMAGETYPE_WEBP => imagewebp($dest, $filepath, 85),
            default => null,
        };
    }
}