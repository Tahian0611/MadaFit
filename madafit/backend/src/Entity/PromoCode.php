<?php

namespace App\Entity;

use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use App\Repository\PromoCodeRepository;
use App\Controller\ValidatePromoCodeController;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Component\Serializer\Annotation\Groups;
use Symfony\Component\Validator\Constraints as Assert;

#[ORM\Entity(repositoryClass: PromoCodeRepository::class)]
#[ApiResource(
    operations: [
        new GetCollection(
            security: "is_granted('ROLE_ADMIN')"
        ),
        new Get(
            security: "is_granted('ROLE_ADMIN')"
        ),
        new Post(
            security: "is_granted('ROLE_ADMIN')"
        ),
        new Post(
            uriTemplate: '/promo_codes/validate',
            controller: ValidatePromoCodeController::class,
            read: false,
            write: false,
            name: 'validate_promo_code'
        )
    ],
    normalizationContext: ['groups' => ['promocode:read']],
    denormalizationContext: ['groups' => ['promocode:write']],
)]
class PromoCode
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['promocode:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 50, unique: true)]
    #[Groups(['promocode:read', 'promocode:write'])]
    #[Assert\NotBlank]
    private ?string $code = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['promocode:read', 'promocode:write'])]
    private ?float $discountPercentage = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['promocode:read', 'promocode:write'])]
    private ?float $discountAmount = null;

    #[ORM\Column(type: 'datetime_immutable')]
    #[Groups(['promocode:read', 'promocode:write'])]
    private ?\DateTimeImmutable $expiryDate = null;

    #[ORM\Column]
    #[Groups(['promocode:read', 'promocode:write'])]
    private ?bool $isActive = true;

    #[ORM\Column(nullable: true)]
    #[Groups(['promocode:read', 'promocode:write'])]
    private ?int $maxUses = null;

    #[ORM\Column]
    #[Groups(['promocode:read'])]
    private ?int $currentUses = 0;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getCode(): ?string
    {
        return $this->code;
    }

    public function setCode(string $code): static
    {
        $this->code = strtoupper($code);
        return $this;
    }

    public function getDiscountPercentage(): ?float
    {
        return $this->discountPercentage;
    }

    public function setDiscountPercentage(?float $discountPercentage): static
    {
        $this->discountPercentage = $discountPercentage;
        return $this;
    }

    public function getDiscountAmount(): ?float
    {
        return $this->discountAmount;
    }

    public function setDiscountAmount(?float $discountAmount): static
    {
        $this->discountAmount = $discountAmount;
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

    public function isActive(): ?bool
    {
        return $this->isActive;
    }

    public function setIsActive(bool $isActive): static
    {
        $this->isActive = $isActive;
        return $this;
    }

    public function getMaxUses(): ?int
    {
        return $this->maxUses;
    }

    public function setMaxUses(?int $maxUses): static
    {
        $this->maxUses = $maxUses;
        return $this;
    }

    public function getCurrentUses(): ?int
    {
        return $this->currentUses;
    }

    public function setCurrentUses(int $currentUses): static
    {
        $this->currentUses = $currentUses;
        return $this;
    }

    public function incrementUses(): static
    {
        $this->currentUses++;
        return $this;
    }

    public function isValid(): bool
    {
        if (!$this->isActive) {
            return false;
        }

        if ($this->expiryDate !== null && $this->expiryDate < new \DateTimeImmutable()) {
            return false;
        }

        if ($this->maxUses !== null && $this->currentUses >= $this->maxUses) {
            return false;
        }

        return true;
    }
}
