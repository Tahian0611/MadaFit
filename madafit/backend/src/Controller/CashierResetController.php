<?php
// Fichier créé pour faire fonctionner l'effacement d'historique dans le Dashboard pour la Caisse 1

namespace App\Controller;

use Doctrine\DBAL\Connection;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/cashier_resets')]
class CashierResetController extends AbstractController
{
    #[Route('', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function getLatest(Request $request, Connection $db): JsonResponse
    {
        $register = $request->query->get('cashRegister', 'caisse1');

        $row = $db->fetchAssociative(
            'SELECT reset_month FROM cashier_reset WHERE cash_register = ? ORDER BY created_at DESC LIMIT 1',
            [$register]
        );

        return $this->json(['month' => $row['reset_month'] ?? null]);
    }

    #[Route('', methods: ['POST'])]
    #[IsGranted('ROLE_ADMIN')]
    public function create(Request $request, Connection $db): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $month = $data['resetMonth'] ?? $data['month'] ?? null;

        if (!$month || !preg_match('/^\d{4}-\d{2}$/', $month)) {
            return $this->json(['error' => 'Format invalide (YYYY-MM attendu)'], 400);
        }

        $db->executeStatement(
            'INSERT INTO cashier_reset (cash_register, reset_month, created_at) VALUES (?, ?, NOW())',
            ['caisse1', $month]
        );

        return $this->json(['month' => $month]);
    }
}
