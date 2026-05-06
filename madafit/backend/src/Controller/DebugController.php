<?php

namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/debug')]
class DebugController extends AbstractController
{
    #[Route('/headers', methods: ['GET'])]
    public function headers(Request $request): JsonResponse
    {
        return $this->json([
            'authorization' => $request->headers->get('Authorization'),
            'all_headers' => $request->headers->all(),
        ]);
    }
}