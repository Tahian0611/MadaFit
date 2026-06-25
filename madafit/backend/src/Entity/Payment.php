<?php

namespace App\Entity;

use App\Repository\PaymentRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use ApiPlatform\Metadata\ApiResource;

use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: PaymentRepository::class)]
#[ApiResource(
    normalizationContext: ['groups' => ['payment:read']],
    denormalizationContext: ['groups' => ['payment:write']],
    security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION')",
    description: 'Historique des paiements des membres.'
)]
class Payment
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['payment:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['payment:read', 'payment:write'])]
    private ?string $memberId = null;

    #[ORM\Column(length: 200, nullable: true)]
    #[Groups(['payment:read', 'payment:write'])]
    private ?string $memberName = null;

    #[ORM\Column]
    #[Groups(['payment:read', 'payment:write'])]
    #[Assert\PositiveOrZero]
    private ?float $amount = null;

    #[ORM\Column(length: 50)]
    #[Groups(['payment:read', 'payment:write'])]
    #[Assert\NotBlank]
    private ?string $method = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE)]
    #[Groups(['payment:read', 'payment:write'])]
    private ?\DateTimeImmutable $date = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['payment:read', 'payment:write'])]
    private ?string $subscription = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['payment:read', 'payment:write'])]
    private ?string $receiptNo = null;

    #[ORM\Column(length: 20, options: ['default' => 'caisse2'])]
    #[Groups(['payment:read', 'payment:write'])]
    private string $cashRegister = 'caisse2';

    #[ORM\ManyToOne(targetEntity: UserSubscription::class)]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['payment:read', 'payment:write'])]
    private ?UserSubscription $userSubscription = null;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getMemberId(): ?string
    {
        return $this->memberId;
    }

    public function setMemberId(?string $memberId): static
    {
        $this->memberId = $memberId;
        return $this;
    }

    public function getMemberName(): ?string
    {
        return $this->memberName;
    }

    public function setMemberName(?string $memberName): static
    {
        $this->memberName = $memberName;
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

    public function getDate(): ?\DateTimeImmutable
    {
        return $this->date;
    }

    public function setDate(\DateTimeImmutable $date): static
    {
        $this->date = $date;
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

    public function getCashRegister(): string
    {
        return $this->cashRegister;
    }

    public function setCashRegister(?string $cashRegister): static
    {
        $this->cashRegister = $cashRegister ?: 'caisse2';
        return $this;
    }

    public function getUserSubscription(): ?UserSubscription
    {
        return $this->userSubscription;
    }

    public function setUserSubscription(?UserSubscription $userSubscription): static
    {
        $this->userSubscription = $userSubscription;
        return $this;
    }
}
