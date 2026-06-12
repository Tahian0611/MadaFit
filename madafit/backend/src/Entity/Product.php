<?php

namespace App\Entity;

use App\Repository\ProductRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use ApiPlatform\Metadata\ApiResource;

use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;

#[ORM\Entity(repositoryClass: ProductRepository::class)]
#[ApiResource(
    normalizationContext: ['groups' => ['product:read']],
    denormalizationContext: ['groups' => ['product:write']],
    security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION')",
    description: 'Produits en stock (boissons, barres protéinées, etc.).'
)]
#[ApiFilter(SearchFilter::class, properties: ['name' => 'partial', 'category' => 'exact'])]
#[ApiFilter(OrderFilter::class, properties: ['name', 'salePrice'])]
class Product
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['product:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 200)]
    #[Groups(['product:read', 'product:write'])]
    #[Assert\NotBlank]
    private ?string $name = null;

    #[ORM\Column(length: 100)]
    #[Groups(['product:read', 'product:write'])]
    #[Assert\NotBlank]
    private ?string $category = null;

    #[ORM\Column]
    #[Groups(['product:read', 'product:write'])]
    #[Assert\PositiveOrZero]
    private ?float $purchasePrice = null;

    #[ORM\Column]
    #[Groups(['product:read', 'product:write'])]
    #[Assert\PositiveOrZero]
    private ?float $salePrice = null;

    #[ORM\Column]
    #[Groups(['product:read', 'product:write'])]
    #[Assert\PositiveOrZero]
    private ?int $initialStock = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    #[Groups(['product:read', 'product:write'])]
    private ?\DateTimeImmutable $registrationDate = null;

    #[ORM\Column]
    #[Groups(['product:read', 'product:write'])]
    #[Assert\PositiveOrZero]
    private ?int $currentStock = null;

    #[ORM\Column(options: ['default' => 0])]
    #[Groups(['product:read', 'product:write'])]
    #[Assert\PositiveOrZero]
    private int $totalSales = 0;

    /**
     * @var Collection<int, Transaction>
     */
    #[ORM\OneToMany(targetEntity: Transaction::class, mappedBy: 'product', cascade: ['remove'])]
    private Collection $transactions;

    public function __construct()
    {
        $this->transactions = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): static
    {
        $this->name = $name;
        return $this;
    }

    public function getCategory(): ?string
    {
        return $this->category;
    }

    public function setCategory(string $category): static
    {
        $this->category = $category;
        return $this;
    }

    public function getPurchasePrice(): ?float
    {
        return $this->purchasePrice;
    }

    public function setPurchasePrice(float $purchasePrice): static
    {
        $this->purchasePrice = $purchasePrice;
        return $this;
    }

    public function getSalePrice(): ?float
    {
        return $this->salePrice;
    }

    public function setSalePrice(float $salePrice): static
    {
        $this->salePrice = $salePrice;
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

    public function getRegistrationDate(): ?\DateTimeImmutable
    {
        return $this->registrationDate;
    }

    public function setRegistrationDate(?\DateTimeImmutable $registrationDate): static
    {
        $this->registrationDate = $registrationDate;
        return $this;
    }

    public function getCurrentStock(): ?int
    {
        return $this->currentStock;
    }

    public function setCurrentStock(int $currentStock): static
    {
        $this->currentStock = $currentStock;
        return $this;
    }

    /**
     * @return Collection<int, Transaction>
     */
    public function getTransactions(): Collection
    {
        return $this->transactions;
    }

    public function addTransaction(Transaction $transaction): static
    {
        if (!$this->transactions->contains($transaction)) {
            $this->transactions->add($transaction);
            $transaction->setProduct($this);
        }
        return $this;
    }

    public function removeTransaction(Transaction $transaction): static
    {
        if ($this->transactions->removeElement($transaction)) {
            if ($transaction->getProduct() === $this) {
                $transaction->setProduct(null);
            }
        }
        return $this;
    }

    public function getTotalSales(): int
    {
        return $this->totalSales;
    }

    public function setTotalSales(int $totalSales): static
    {
        $this->totalSales = $totalSales;
        return $this;
    }
}

