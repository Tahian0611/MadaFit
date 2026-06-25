<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

/**
 * Ce contrôleur est désactivé en production.
 * Accès réservé aux admins uniquement pour débogage.
 */
#[Route('/api/debug')]
#[IsGranted('ROLE_ADMIN')]
class DebugController extends AbstractController
{
    #[Route('/headers', methods: ['GET'])]
    public function headers(): JsonResponse
    {
        // Désactivé : ne jamais exposer les headers en production.
        return $this->json(['error' => 'Debug endpoint désactivé.'], 404);
    }
}