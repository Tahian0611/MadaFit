<?php

namespace App\Entity;

use App\Repository\PaymentRecordRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Delete;

#[ORM\Entity(repositoryClass: PaymentRecordRepository::class)]
#[ApiResource(
    operations: [
        new GetCollection(security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION')"),
        new Get(security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION')"),
        new Post(security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION')"),
        new Patch(security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION')"),
        new Delete(security: "is_granted('ROLE_ADMIN')"),
    ]
)]
class PaymentRecord
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE)]
    private ?\DateTimeImmutable $date = null;

    #[ORM\Column]
    private ?float $amount = null;

    #[ORM\Column(length: 50)]
    private ?string $method = null;

    #[ORM\Column(length: 50, nullable: true)]
    private ?string $subscription = null;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $receiptNo = null;

    #[ORM\ManyToOne(inversedBy: 'paymentRecords')]
    #[ORM\JoinColumn(onDelete: 'CASCADE')]
    private ?User $user = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getDate(): ?\DateTimeImmutable
    {
        return $this->date;
    }

    public function setDate(\DateTimeImmutable $date): static
    {
        $this->date = $date;
        return $this;
    }

    public function getAmount(): ?float
    {
        return $this->amount;
    }

    public function setAmount(float $amount): static
    {
        $this->amount = $amount;
        return $this;
    }

    public function getMethod(): ?string
    {
        return $this->method;
    }

    public function setMethod(string $method): static
    {
        $this->method = $method;
        return $this;
    }

    public function getSubscription(): ?string
    {
        return $this->subscription;
    }

    public function setSubscription(?string $subscription): static
    {
        $this->subscription = $subscription;
        return $this;
    }

    public function getReceiptNo(): ?string
    {
        return $this->receiptNo;
    }

    public function setReceiptNo(?string $receiptNo): static
    {
        $this->receiptNo = $receiptNo;
        return $this;
    }

    public function getUser(): ?User
    {
        return $this->user;
    }

    public function setUser(?User $user): static
    {
        $this->user = $user;
        return $this;
    }
}

