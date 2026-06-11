<?php

namespace App\Entity;

use App\Repository\VisitRecordRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use ApiPlatform\Metadata\ApiResource;
use Symfony\Component\Serializer\Attribute\Groups;


#[ORM\Entity(repositoryClass: VisitRecordRepository::class)]
#[ApiResource]
class VisitRecord
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['user:read'])]
    private ?int $id = null;


    #[ORM\Column(type: Types::DATE_IMMUTABLE)]
    #[Groups(['user:read'])]
    private ?\DateTimeImmutable $date = null;


    #[ORM\Column(type: Types::TIME_IMMUTABLE, nullable: true)]
    #[Groups(['user:read'])]
    private ?\DateTimeImmutable $checkIn = null;


    #[ORM\Column(type: Types::TIME_IMMUTABLE, nullable: true)]
    #[Groups(['user:read'])]
    private ?\DateTimeImmutable $checkOut = null;


    #[ORM\ManyToOne(inversedBy: 'visitRecords')]
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

    public function getCheckIn(): ?\DateTimeImmutable
    {
        return $this->checkIn;
    }

    public function setCheckIn(?\DateTimeImmutable $checkIn): static
    {
        $this->checkIn = $checkIn;
        return $this;
    }

    public function getCheckOut(): ?\DateTimeImmutable
    {
        return $this->checkOut;
    }

    public function setCheckOut(?\DateTimeImmutable $checkOut): static
    {
        $this->checkOut = $checkOut;
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

