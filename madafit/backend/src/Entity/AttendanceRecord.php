<?php

namespace App\Entity;

use App\Repository\AttendanceRecordRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use ApiPlatform\Metadata\ApiResource;

#[ORM\Entity(repositoryClass: AttendanceRecordRepository::class)]
#[ApiResource]
class AttendanceRecord
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 50, nullable: true)]
    private ?string $memberId = null;

    #[ORM\Column(length: 200, nullable: true)]
    private ?string $memberName = null;

    #[ORM\Column(length: 100, nullable: true)]
    private ?string $rfidCard = null;

    #[ORM\Column(type: Types::TIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $checkIn = null;

    #[ORM\Column(type: Types::TIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $checkOut = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE)]
    private ?\DateTimeImmutable $date = null;

    #[ORM\ManyToOne(inversedBy: 'attendanceRecords')]
    private ?User $user = null;

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

    public function getRfidCard(): ?string
    {
        return $this->rfidCard;
    }

    public function setRfidCard(?string $rfidCard): static
    {
        $this->rfidCard = $rfidCard;
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

    public function getDate(): ?\DateTimeImmutable
    {
        return $this->date;
    }

    public function setDate(\DateTimeImmutable $date): static
    {
        $this->date = $date;
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

