<?php

namespace App\Controller;

use App\Service\StockReportService;
use DateTimeImmutable;
use DateTimeZone;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[AsController]
class StockReportController extends AbstractController
{
    public function __construct(
        private readonly StockReportService $stockReportService,
    ) {}

    /**
     * GET /api/stock_summary?from=YYYY-MM-DD&to=YYYY-MM-DD
     */
    #[Route('/api/stock_summary', methods: ['GET'])]
    #[IsGranted('ROLE_USER')]
    public function getSummary(Request $request): JsonResponse
    {
        $fromStr = $request->query->get('from');
        $toStr   = $request->query->get('to');

        if (!$fromStr || !$toStr) {
            return $this->json([
                'error' => 'Les paramètres "from" et "to" sont obligatoires (format: YYYY-MM-DD)',
            ], 400);
        }

        try {
            // ✅ FIX timezone : Madagascar = UTC+3 (Indian/Antananarivo)
            // Avant : UTC → à 1h du matin Madagascar (= 22h UTC la veille),
            // les transactions tombaient hors de la fenêtre "aujourd'hui UTC".
            // Maintenant : les bornes sont calculées en heure locale Madagascar.
            $tz   = new DateTimeZone('Indian/Antananarivo');
            $from = new DateTimeImmutable($fromStr . ' 00:00:00', $tz);
            $to   = new DateTimeImmutable($toStr   . ' 23:59:59', $tz);
        } catch (\Exception $e) {
            return $this->json([
                'error' => 'Format de date invalide. Utilisez YYYY-MM-DD',
            ], 400);
        }

        if ($from > $to) {
            return $this->json([
                'error' => 'La date "from" doit être antérieure ou égale à "to"',
            ], 400);
        }

        $oneYearLater = $from->modify('+12 months');
        if ($to > $oneYearLater) {
            return $this->json([
                'error' => 'La période ne peut pas dépasser 12 mois',
            ], 400);
        }

        try {
            $summary = $this->stockReportService->generateSummary($from, $to);
        } catch (\Exception $e) {
            return $this->json([
                'error'  => 'Erreur lors du calcul du rapport',
                'detail' => $e->getMessage(),
            ], 500);
        }

        return $this->json([
            'period' => $summary->period,
            'totals' => $summary->totals,
            'activeProductsCount' => $summary->activeProductsCount,
            'rows'   => array_map(fn($row) => [
                'product' => [
                    'id'       => $row->productId,
                    'name'     => $row->productName,
                    'category' => $row->category,
                ],
                'initialStock'      => $row->initialStock,
                'totalEntries'      => $row->totalEntries,
                'totalSales'        => $row->totalSales,
                'totalCredits'      => $row->totalCredits,
                'totalNonSaleExits' => $row->totalNonSaleExits,
                'totalExits'        => $row->totalExits,
                'finalStock'        => $row->finalStock,
                'totalCost'         => $row->totalCost,
                'revenue'           => $row->revenue,
                'profit'            => $row->profit,
            ], $summary->rows),
        ]);
    }
}
