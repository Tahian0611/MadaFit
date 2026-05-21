<?php

namespace App\Controller;

use App\Service\BackupService;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\Routing\Annotation\Route;

#[Route('/api/backups', name: 'api_backups_')]
class BackupController extends AbstractController
{
    private $backupService;

    public function __construct(BackupService $backupService)
    {
        $this->backupService = $backupService;
    }

    #[Route('', name: 'list', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $backups = $this->backupService->listBackups();
        return $this->json($backups);
    }

    #[Route('', name: 'generate', methods: ['POST'])]
    public function generate(): JsonResponse
    {
        try {
            $filename = $this->backupService->generateBackup();
            return $this->json([
                'success' => true,
                'message' => 'Sauvegarde générée avec succès',
                'filename' => $filename
            ]);
        } catch (\Exception $e) {
            return $this->json([
                'success' => false,
                'message' => 'Erreur lors de la sauvegarde : ' . $e->getMessage()
            ], 500);
        }
    }

    #[Route('/download/{filename}', name: 'download', methods: ['GET'])]
    public function download(string $filename): BinaryFileResponse|JsonResponse
    {
        $filepath = $this->backupService->getBackupPath($filename);

        if (!$filepath) {
            return $this->json(['error' => 'Fichier introuvable'], 404);
        }

        $response = new BinaryFileResponse($filepath);
        $response->setContentDisposition(
            ResponseHeaderBag::DISPOSITION_ATTACHMENT,
            basename($filepath)
        );

        return $response;
    }

    #[Route('/{filename}', name: 'delete', methods: ['DELETE'])]
    public function delete(string $filename): JsonResponse
    {
        $success = $this->backupService->deleteBackup($filename);

        if ($success) {
            return $this->json(['success' => true, 'message' => 'Sauvegarde supprimée']);
        }

        return $this->json(['error' => 'Impossible de supprimer la sauvegarde'], 404);
    }
}
