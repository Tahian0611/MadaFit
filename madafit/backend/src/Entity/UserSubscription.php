<?php

namespace App\Entity;

use App\Repository\UserSubscriptionRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Delete;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: UserSubscriptionRepository::class)]
#[ApiResource(
    operations: [
        new GetCollection(
            security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION')",
            normalizationContext: ['groups' => ['user_subscription:read']]
        ),
        new Get(
            security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION') or object.user == user",
            normalizationContext: ['groups' => ['user_subscription:read']]
        ),
        new Post(
            security: "is_granted('ROLE_USER') or is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION')",
            denormalizationContext: ['groups' => ['user_subscription:write']],
            normalizationContext: ['groups' => ['user_subscription:read']]
        ),
        new Patch(
            security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION')",
            denormalizationContext: ['groups' => ['user_subscription:write']],
            normalizationContext: ['groups' => ['user_subscription:read']]
        ),
        new Delete(security: "is_granted('ROLE_ADMIN')"),
    ],
    normalizationContext: ['groups' => ['user_subscription:read']],
    denormalizationContext: ['groups' => ['user_subscription:write']]
)]
class UserSubscription
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['user_subscription:read', 'user:read'])]
    private ?int $id = null;

    #[ORM\ManyToOne(inversedBy: 'userSubscriptions')]
    #[ORM\JoinColumn(nullable: false, onDelete: 'CASCADE')]
    #[Groups(['user_subscription:read', 'user_subscription:write'])]
    private ?User $user = null;

    #[ORM\Column(length: 100)]
    #[Groups(['user_subscription:read', 'user_subscription:write', 'user:read'])]
    private ?string $planName = null;

    #[ORM\Column(length: 20)]
    #[Groups(['user_subscription:read', 'user_subscription:write', 'user:read'])]
    private ?string $status = 'pending';

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    #[Groups(['user_subscription:read', 'user_subscription:write', 'user:read'])]
    private ?\DateTimeImmutable $startDate = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    #[Groups(['user_subscription:read', 'user_subscription:write', 'user:read'])]
    private ?\DateTimeImmutable $expiryDate = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['user_subscription:read', 'user_subscription:write', 'user:read'])]
    private ?float $totalPaid = 0;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['user_subscription:read', 'user_subscription:write'])]
    private ?string $validatedBy = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    #[Groups(['user_subscription:read'])]
    private ?\DateTimeImmutable $validatedAt = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['user_subscription:read', 'user_subscription:write', 'user:read'])]
    private ?string $promotion = null;

    public function getId(): ?int
    {
        return $this->id;
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

    public function getPlanName(): ?string
    {
        return $this->planName;
    }

    public function setPlanName(string $planName): static
    {
        $this->planName = $planName;
        return $this;
    }

    public function getStatus(): ?string
    {
        return $this->status;
    }

    public function setStatus(?string $status): static
    {
        $this->status = $status;
        return $this;
    }

    public function getStartDate(): ?\DateTimeImmutable
    {
        return $this->startDate;
    }

    public function setStartDate(?\DateTimeImmutable $startDate): static
    {
        $this->startDate = $startDate;
        return $this;
    }

    public function getExpiryDate(): ?\DateTimeImmutable
    {
        return $this->expiryDate;
    }

    public function setExpiryDate(?\DateTimeImmutable $expiryDate): static
    {
        $this->expiryDate = $expiryDate;
        return $this;
    }

    public function getTotalPaid(): ?float
    {
        return $this->totalPaid;
    }

    public function setTotalPaid(?float $totalPaid): static
    {
        $this->totalPaid = $totalPaid;
        return $this;
    }

    public function getValidatedBy(): ?string
    {
        return $this->validatedBy;
    }

    public function setValidatedBy(?string $validatedBy): static
    {
        $this->validatedBy = $validatedBy;
        return $this;
    }

    public function getValidatedAt(): ?\DateTimeImmutable
    {
        return $this->validatedAt;
    }

    public function setValidatedAt(?\DateTimeImmutable $validatedAt): static
    {
        $this->validatedAt = $validatedAt;
        return $this;
    }

    public function getPromotion(): ?string
    {
        return $this->promotion;
    }

    public function setPromotion(?string $promotion): static
    {
        $this->promotion = $promotion;
        return $this;
    }
}
