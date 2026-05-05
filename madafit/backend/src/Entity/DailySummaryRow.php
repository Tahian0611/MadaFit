<?php

namespace App\Entity;

use App\Repository\DailySummaryRowRepository;
use Doctrine\ORM\Mapping as ORM;
use ApiPlatform\Metadata\ApiResource;

#[ORM\Entity(repositoryClass: DailySummaryRowRepository::class)]
#[ApiResource]
class DailySummaryRow
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\OneToOne(cascade: ['persist', 'remove'])]
    private ?Product $product = null;

    #[ORM\Column]
    private ?int $initialStock = null;

    #[ORM\Column]
    private ?int $totalEntries = null;

    #[ORM\Column]
    private ?int $totalSales = null;

    #[ORM\Column]
    private ?int $totalNonSaleExits = null;

    #[ORM\Column]
    private ?int $totalExits = null;

    #[ORM\Column]
    private ?int $finalStock = null;

    #[ORM\Column]
    private ?float $totalCost = null;

    #[ORM\Column]
    private ?float $revenue = null;

    #[ORM\Column]
    private ?float $profit = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getProduct(): ?Product
    {
        return $this->product;
    }

    public function setProduct(?Product $product): static
    {
        $this->product = $product;
        return $this;
    }

    public function getInitialStock(): ?int
    {
        return $this->initialStock;
    }

    public function setInitialStock(int $initialStock): static
    {
        $this->initialStock = $initialStock;
        return $this;
    }

    public function getTotalEntries(): ?int
    {
        return $this->totalEntries;
    }

    public function setTotalEntries(int $totalEntries): static
    {
        $this->totalEntries = $totalEntries;
        return $this;
    }

    public function getTotalSales(): ?int
    {
        return $this->totalSales;
    }

    public function setTotalSales(int $totalSales): static
    {
        $this->totalSales = $totalSales;
        return $this;
    }

    public function getTotalNonSaleExits(): ?int
    {
        return $this->totalNonSaleExits;
    }

    public function setTotalNonSaleExits(int $totalNonSaleExits): static
    {
        $this->totalNonSaleExits = $totalNonSaleExits;
        return $this;
    }

    public function getTotalExits(): ?int
    {
        return $this->totalExits;
    }

    public function setTotalExits(int $totalExits): static
    {
        $this->totalExits = $totalExits;
        return $this;
    }

    public function getFinalStock(): ?int
    {
        return $this->finalStock;
    }

    public function setFinalStock(int $finalStock): static
    {
        $this->finalStock = $finalStock;
        return $this;
    }

    public function getTotalCost(): ?float
    {
        return $this->totalCost;
    }

    public function setTotalCost(float $totalCost): static
    {
        $this->totalCost = $totalCost;
        return $this;
    }

    public function getRevenue(): ?float
    {
        return $this->revenue;
    }

    public function setRevenue(float $revenue): static
    {
        $this->revenue = $revenue;
        return $this;
    }

    public function getProfit(): ?float
    {
        return $this->profit;
    }

    public function setProfit(float $profit): static
    {
        $this->profit = $profit;
        return $this;
    }
}

