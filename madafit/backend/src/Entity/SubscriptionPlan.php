<?php

namespace App\Entity;

use App\Repository\SubscriptionPlanRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use ApiPlatform\Metadata\ApiResource;
use Symfony\Component\Serializer\Attribute\Groups;

#[ORM\Entity(repositoryClass: SubscriptionPlanRepository::class)]
#[ApiResource(
    normalizationContext: ['groups' => ['subscription:read']],
)]
class SubscriptionPlan
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['subscription:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 100)]
    #[Groups(['subscription:read'])]
    private ?string $name = null;

    #[ORM\Column(length: 50)]
    #[Groups(['subscription:read'])]
    private ?string $type = null;

    #[ORM\Column]
    #[Groups(['subscription:read'])]
    private ?int $duration = null;

    #[ORM\Column]
    #[Groups(['subscription:read'])]
    private ?float $price = null;

    #[ORM\Column(type: Types::JSON, nullable: true)]
    #[Groups(['subscription:read'])]
    private ?array $features = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['subscription:read'])]
    private ?string $color = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['subscription:read'])]
    private ?bool $popular = null;

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

    public function getType(): ?string
    {
        return $this->type;
    }

    public function setType(string $type): static
    {
        $this->type = $type;
        return $this;
    }

    public function getDuration(): ?int
    {
        return $this->duration;
    }

    public function setDuration(int $duration): static
    {
        $this->duration = $duration;
        return $this;
    }

    public function getPrice(): ?float
    {
        return $this->price;
    }

    public function setPrice(float $price): static
    {
        $this->price = $price;
        return $this;
    }

    public function getFeatures(): ?array
    {
        return $this->features;
    }

    public function setFeatures(?array $features): static
    {
        $this->features = $features;
        return $this;
    }

    public function getColor(): ?string
    {
        return $this->color;
    }

    public function setColor(?string $color): static
    {
        $this->color = $color;
        return $this;
    }

    public function isPopular(): ?bool
    {
        return $this->popular;
    }

    public function setPopular(?bool $popular): static
    {
        $this->popular = $popular;
        return $this;
    }
}

