<?php

namespace App\Service;

use App\Dto\StockReportRow;
use App\Dto\StockReportSummary;
use App\Entity\Product;
use App\Entity\Transaction;
use App\Repository\ProductRepository;
use App\Repository\TransactionRepository;
use DateTimeImmutable;

class StockReportService
{
    public function __construct(
        private readonly ProductRepository $productRepository,
        private readonly TransactionRepository $transactionRepository,
    ) {}

    public function generateSummary(
        DateTimeImmutable $from,
        DateTimeImmutable $to
    ): StockReportSummary {
        $products = $this->productRepository->findAll();

        $rows = [];
        $totals = [
            'initialStock'      => 0,
            'totalEntries'      => 0,
            'totalSales'        => 0,
            'totalCredits'      => 0,
            'totalNonSaleExits' => 0,
            'totalExits'        => 0,
            'finalStock'        => 0,
            'totalCost'         => 0.0,
            'revenue'           => 0.0,
            'profit'            => 0.0,
        ];

        $activeProductsCount = 0;

        foreach ($products as $product) {
            $row = $this->calculateProductRow($product, $from, $to);

            if ($row->totalEntries > 0 || $row->totalExits > 0 || $row->revenue > 0) {
                $activeProductsCount++;
            }

            $rows[] = $row;

            $totals['initialStock']      += $row->initialStock;
            $totals['totalEntries']      += $row->totalEntries;
            $totals['totalSales']        += $row->totalSales;
            $totals['totalCredits']      += $row->totalCredits;
            $totals['totalNonSaleExits'] += $row->totalNonSaleExits;
            $totals['totalExits']        += $row->totalExits;
            $totals['finalStock']        += $row->finalStock;
            $totals['totalCost']         += $row->totalCost;
            $totals['revenue']           += $row->revenue;
            $totals['profit']            += $row->profit;
        }

        return new StockReportSummary(
            rows: $rows,
            totals: $totals,
            period: [
                'from'           => $from->format('Y-m-d'),
                'to'             => $to->format('Y-m-d'),
                'fromFormatted'  => $this->formatDateFr($from),
                'toFormatted'    => $this->formatDateFr($to),
            ],
            activeProductsCount: $activeProductsCount,
        );
    }

    private function calculateProductRow(
        Product $product,
        DateTimeImmutable $from,
        DateTimeImmutable $to
    ): StockReportRow {
        $transactions = $this->transactionRepository->findByProductAndDateRange(
            $product,
            $from,
            $to
        );

        $totalEntries      = 0;
        $totalSales        = 0;
        $totalCredits      = 0;
        $totalNonSaleExits = 0;
        $totalCost         = 0.0;
        $revenue           = 0.0;

        foreach ($transactions as $transaction) {
            $quantity  = $transaction->getQuantity() ?? 0;
            $unitPrice = $transaction->getUnitPrice();

            match ($transaction->getType()) {
                'entry' => [
                    $totalEntries += $quantity,
                    $totalCost    += ($quantity * ($unitPrice ?? $product->getPurchasePrice() ?? 0)),
                ],
                'sale' => [
                    $totalSales += $quantity,
                    $revenue    += ($quantity * ($unitPrice ?? $product->getSalePrice() ?? 0)),
                ],
                'credit' => [
                    $totalCredits += $quantity,
                    $revenue      += ($quantity * ($unitPrice ?? $product->getSalePrice() ?? 0)),
                ],
                'non_sale_exit' => [
                    $totalNonSaleExits += $quantity,
                ],
                default => null,
            };
        }

        $currentStock = $product->getCurrentStock() ?? 0;
        $totalExits   = $totalSales + $totalCredits + $totalNonSaleExits;
        $initialStock = $currentStock - $totalEntries + $totalExits;
        $finalStock   = $currentStock;

        $purchasePrice   = $product->getPurchasePrice() ?? 0.0;
        $costOfGoodsSold = ($totalSales + $totalCredits) * $purchasePrice;
        $profit          = $revenue - $costOfGoodsSold;

        return new StockReportRow(
            productId:          $product->getId(),
            productName:        $product->getName(),
            category:           $product->getCategory() ?? 'Non catégorisé',
            initialStock:       $initialStock,
            totalEntries:       $totalEntries,
            totalSales:         $totalSales,
            totalCredits:       $totalCredits,
            totalNonSaleExits:  $totalNonSaleExits,
            totalExits:         $totalExits,
            finalStock:         $finalStock,
            totalCost:          round($totalCost, 2),
            revenue:            round($revenue, 2),
            profit:             round($profit, 2),
        );
    }

    private function formatDateFr(DateTimeImmutable $date): string
    {
        $months = [
            '01' => 'janvier',  '02' => 'février',  '03' => 'mars',
            '04' => 'avril',    '05' => 'mai',       '06' => 'juin',
            '07' => 'juillet',  '08' => 'août',      '09' => 'septembre',
            '10' => 'octobre',  '11' => 'novembre',  '12' => 'décembre',
        ];

        return $date->format('d') . ' ' . $months[$date->format('m')] . ' ' . $date->format('Y');
    }
}
