<?php

namespace App\Dto;

class StockReportRow
{
    public function __construct(
        public readonly int $productId,
        public readonly string $productName,
        public readonly string $category,
        public readonly int $initialStock,
        public readonly int $totalEntries,
        public readonly int $totalSales,
        public readonly int $totalCredits,
        public readonly int $totalNonSaleExits,
        public readonly int $totalExits,
        public readonly int $finalStock,
        public readonly float $totalCost,
        public readonly float $revenue,
        public readonly float $profit,
    ) {}
}
