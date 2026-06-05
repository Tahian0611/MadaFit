<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;
use Symfony\Component\String\Slugger\SluggerInterface;

#[Route('/api/uploads')]
#[IsGranted('ROLE_USER')]
class UploadController extends AbstractController
{
    // Messages d'erreur PHP upload → JSON lisible côté frontend
    private const UPLOAD_ERRORS = [
        UPLOAD_ERR_INI_SIZE   => 'Fichier trop volumineux (limite serveur : 10 Mo max)',
        UPLOAD_ERR_FORM_SIZE  => 'Fichier trop volumineux',
        UPLOAD_ERR_PARTIAL    => 'Upload incomplet, réessayez',
        UPLOAD_ERR_NO_FILE    => 'Aucun fichier reçu',
        UPLOAD_ERR_NO_TMP_DIR => 'Dossier temporaire manquant côté serveur',
        UPLOAD_ERR_CANT_WRITE => 'Impossible d\'écrire le fichier sur le serveur',
        UPLOAD_ERR_EXTENSION  => 'Upload bloqué par une extension PHP',
    ];

    #[Route('/image', name: 'upload_image', methods: ['POST'])]
    public function uploadImage(Request $request, SluggerInterface $slugger): JsonResponse
    {
        /** @var UploadedFile|null $file */
        $file = $request->files->get('file');

        if (!$file) {
            return new JsonResponse(['error' => 'Aucun fichier reçu'], 400);
        }

        // ── Vérification du code d'erreur PHP (taille, tmp, etc.) ──────────
        if ($file->getError() !== UPLOAD_ERR_OK) {
            $message = self::UPLOAD_ERRORS[$file->getError()] ?? 'Erreur lors de l\'upload';
            return new JsonResponse(['error' => $message], 400);
        }

        // ── Validation extension (sans fileinfo) ───────────────────────────
        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true)) {
            return new JsonResponse(['error' => 'Extension non autorisée (jpg, png, gif, webp)'], 400);
        }

        // ── Validation MIME réelle (contenu du fichier) ────────────────────
        $allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (function_exists('finfo_open')) {
            $finfo = finfo_open(FILEINFO_MIME_TYPE);
            $realMime = finfo_file($finfo, $file->getPathname());
            finfo_close($finfo);
            if (!in_array($realMime, $allowedMimes, true)) {
                return new JsonResponse(['error' => 'Type de fichier non autorisé'], 400);
            }
        }

        if ($file->getSize() > 10 * 1024 * 1024) {
            return new JsonResponse(['error' => 'Fichier trop volumineux (max 10 Mo)'], 400);
        }

        // ── Dossier de destination ─────────────────────────────────────────
        $uploadDir = $this->getParameter('kernel.project_dir') . '/public/uploads/articles';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // ── Nom unique ─────────────────────────────────────────────────────
        $originalFilename = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $safeFilename = $slugger->slug($originalFilename);
        $newFilename  = $safeFilename . '-' . uniqid() . '.' . $ext;

        // ── Déplacement ────────────────────────────────────────────────────
        try {
            $file->move($uploadDir, $newFilename);
        } catch (\Exception $e) {
            return new JsonResponse(['error' => 'Impossible de sauvegarder l\'image : ' . $e->getMessage()], 500);
        }

        return new JsonResponse(['url' => '/uploads/articles/' . $newFilename]);
    }
}