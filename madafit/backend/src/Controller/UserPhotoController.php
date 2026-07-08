<?php

namespace App\Controller;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Filesystem\Filesystem;

#[Route('/api/users')]
class UserPhotoController extends AbstractController
{
    #[Route('/{id}/photo', name: 'api_user_upload_photo', methods: ['POST'])]
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
