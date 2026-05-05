<?php

namespace App\Dto;

class StockReportSummary
{
    /**
     * @param StockReportRow[] $rows
     */
    public function __construct(
        public readonly array $rows,
        public readonly array $totals,
        public readonly array $period,
        public readonly int $activeProductsCount,
    ) {}
}
