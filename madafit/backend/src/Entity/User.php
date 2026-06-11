<?php

namespace App\Entity;

use App\Repository\UserRepository;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use Symfony\Bridge\Doctrine\Validator\Constraints\UniqueEntity;
use Symfony\Component\Security\Core\User\PasswordAuthenticatedUserInterface;
use Symfony\Component\Security\Core\User\UserInterface;
use ApiPlatform\Metadata\ApiResource;
use App\State\UserPasswordProcessor;
use Symfony\Component\Serializer\Attribute\Groups;

use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Delete;

use Symfony\Component\Validator\Constraints as Assert;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\UniqueConstraint(name: 'UNIQ_IDENTIFIER_EMAIL', fields: ['email'])]
#[UniqueEntity(fields: ['email'], message: 'Cet email est déjà utilisé.')]
#[ApiResource(
    operations: [
        new GetCollection(
            security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION')"
        ),
        new Get(
            security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION') or object == user"
        ),
        new Post(processor: UserPasswordProcessor::class, validationContext: ['groups' => ['Default', 'user:create']]),
        new Patch(
            processor: UserPasswordProcessor::class, 
            security: "is_granted('ROLE_ADMIN') or is_granted('ROLE_RECEPTION') or object == user",
            validationContext: ['groups' => ['Default', 'user:update']]
        ),
        new Delete(security: "is_granted('ROLE_ADMIN')"),
    ],
    normalizationContext: ['groups' => ['user:read']],
    denormalizationContext: ['groups' => ['user:write']],
    description: 'Gestion des utilisateurs et membres de MadaFit.'
)]
#[ApiFilter(SearchFilter::class, properties: ['email' => 'partial', 'firstName' => 'partial', 'lastName' => 'partial', 'memberId' => 'exact'])]
class User implements UserInterface, PasswordAuthenticatedUserInterface
{
    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['user:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 180)]
    #[Groups(['user:read', 'user:write'])]
    #[Assert\NotBlank]
    #[Assert\Email]
    private ?string $email = null;

    /**
     * @var list<string> The user roles
     */
    #[ORM\Column]
    #[Groups(['user:read', 'admin:write'])]
    private array $roles = [];

    /**
     * @var string The hashed password
     */
    #[ORM\Column]
    #[Groups(['user:write'])]
    #[Assert\NotBlank(groups: ['user:create'])]
    #[Assert\Length(min: 6)]
    private ?string $password = null;

    #[ORM\Column(length: 50, unique: true, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $memberId = null;

    #[ORM\Column(length: 100, unique: true, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $rfidCard = null;

    #[ORM\Column(length: 255, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $photo = null;

    #[ORM\Column(length: 100)]
    #[Groups(['user:read', 'user:write'])]
    #[Assert\NotBlank]
    #[Assert\Length(max: 100)]
    private ?string $firstName = null;

    #[ORM\Column(length: 100)]
    #[Groups(['user:read', 'user:write'])]
    #[Assert\NotBlank]
    #[Assert\Length(max: 100)]
    private ?string $lastName = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $phone = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?\DateTimeImmutable $dob = null;

    #[ORM\Column(length: 1, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $gender = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $address = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $emergencyContact = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $emergencyPhone = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $medicalNotes = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?\DateTimeImmutable $joinDate = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $subscription = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $status = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?\DateTimeImmutable $expiryDate = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?\DateTimeImmutable $startDate = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $coach = null;

    #[ORM\Column(length: 100, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $program = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?float $totalPayments = null;

    #[ORM\Column(type: Types::DATE_IMMUTABLE, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?\DateTimeImmutable $lastVisit = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?int $visitCount = null;

    #[ORM\Column(nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?bool $inGym = null;

    #[ORM\Column(type: Types::TEXT, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $notes = null;

    // ═══════════════════════════════════════════════════════════════════════
    // INJECTION : Champ activities (tableau JSON) + conservation de activity
    // ═══════════════════════════════════════════════════════════════════════
    #[ORM\Column(type: Types::JSON, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?array $activities = null;

    // Gardé pour compatibilité legacy — sera rempli automatiquement
    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $activity = null;
    // ═══════════════════════════════════════════════════════════════════════

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $accessType = null;

    #[ORM\Column(length: 20, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $cardStatus = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['user:read', 'user:write'])]
    private ?string $promotion = null;

    /**
     * @var Collection<int, VisitRecord>
     */
    #[ORM\OneToMany(targetEntity: VisitRecord::class, mappedBy: 'user', cascade: ['remove'], orphanRemoval: true)]
    #[Groups(['user:read'])]
    private Collection $visitRecords;

    /**
     * @var Collection<int, PaymentRecord>
     */
    #[ORM\OneToMany(targetEntity: PaymentRecord::class, mappedBy: 'user', cascade: ['remove'], orphanRemoval: true)]
    #[Groups(['user:read'])]
    private Collection $paymentRecords;

    /**
     * @var Collection<int, AttendanceRecord>
     */
    #[ORM\OneToMany(targetEntity: AttendanceRecord::class, mappedBy: 'user', cascade: ['remove'], orphanRemoval: true)]
    #[Groups(['user:read'])]
    private Collection $attendanceRecords;

    #[ORM\Column(length: 255, nullable: true)]
    private ?string $resetToken = null;

    #[ORM\Column(type: Types::DATETIME_IMMUTABLE, nullable: true)]
    private ?\DateTimeImmutable $resetTokenExpiresAt = null;

    public function __construct()
    {
        $this->visitRecords = new ArrayCollection();
        $this->paymentRecords = new ArrayCollection();
        $this->attendanceRecords = new ArrayCollection();
    }

    #[Groups(['user:read'])]
    public function getId(): ?int
    {
        return $this->id;
    }

    #[Groups(['user:read'])]
    public function getEmail(): ?string
    {
        return $this->email;
    }

    public function setEmail(string $email): static
    {
        $this->email = $email;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getUserIdentifier(): string
    {
        return (string) $this->email;
    }

    #[Groups(['user:read'])]
    public function getRoles(): array
    {
        $roles = $this->roles;
        $roles[] = 'ROLE_USER';
        return array_unique($roles);
    }

    public function setRoles(array $roles): static
    {
        $this->roles = $roles;
        return $this;
    }

    public function getPassword(): ?string
    {
        return $this->password;
    }

    public function setPassword(string $password): static
    {
        $this->password = $password;
        return $this;
    }

    public function __serialize(): array
    {
        $data = (array) $this;
        $data["\0" . self::class . "\0password"] = hash('crc32c', $this->password);
        return $data;
    }

    #[\Deprecated]
    public function eraseCredentials(): void
    {
        // @deprecated, to be removed when upgrading to Symfony 8
    }

    #[Groups(['user:read'])]
    public function getMemberId(): ?string
    {
        return $this->memberId;
    }

    public function setMemberId(?string $memberId): static
    {
        $this->memberId = $memberId;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getRfidCard(): ?string
    {
        return $this->rfidCard;
    }

    public function setRfidCard(?string $rfidCard): static
    {
        $this->rfidCard = $rfidCard;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getPhoto(): ?string
    {
        return $this->photo;
    }

    public function setPhoto(?string $photo): static
    {
        $this->photo = $photo;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getFirstName(): ?string
    {
        return $this->firstName;
    }

    public function setFirstName(string $firstName): static
    {
        $this->firstName = $firstName;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getLastName(): ?string
    {
        return $this->lastName;
    }

    public function setLastName(string $lastName): static
    {
        $this->lastName = $lastName;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getFullName(): string
    {
        return $this->firstName . ' ' . $this->lastName;
    }

    #[Groups(['user:read'])]
    public function getPhone(): ?string
    {
        return $this->phone;
    }

    public function setPhone(?string $phone): static
    {
        $this->phone = $phone;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getDob(): ?\DateTimeImmutable
    {
        return $this->dob;
    }

    public function setDob(?\DateTimeImmutable $dob): static
    {
        $this->dob = $dob;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getGender(): ?string
    {
        return $this->gender;
    }

    public function setGender(?string $gender): static
    {
        $this->gender = $gender;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getAddress(): ?string
    {
        return $this->address;
    }

    public function setAddress(?string $address): static
    {
        $this->address = $address;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getEmergencyContact(): ?string
    {
        return $this->emergencyContact;
    }

    public function setEmergencyContact(?string $emergencyContact): static
    {
        $this->emergencyContact = $emergencyContact;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getEmergencyPhone(): ?string
    {
        return $this->emergencyPhone;
    }

    public function setEmergencyPhone(?string $emergencyPhone): static
    {
        $this->emergencyPhone = $emergencyPhone;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getMedicalNotes(): ?string
    {
        return $this->medicalNotes;
    }

    public function setMedicalNotes(?string $medicalNotes): static
    {
        $this->medicalNotes = $medicalNotes;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getJoinDate(): ?\DateTimeImmutable
    {
        return $this->joinDate;
    }

    public function setJoinDate(?\DateTimeImmutable $joinDate): static
    {
        $this->joinDate = $joinDate;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getSubscription(): ?string
    {
        return $this->subscription;
    }

    public function setSubscription(?string $subscription): static
    {
        $this->subscription = $subscription;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getStatus(): ?string
    {
        return $this->status;
    }

    public function setStatus(?string $status): static
    {
        $this->status = $status;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getExpiryDate(): ?\DateTimeImmutable
    {
        return $this->expiryDate;
    }

    public function setExpiryDate(?\DateTimeImmutable $expiryDate): static
    {
        $this->expiryDate = $expiryDate;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getStartDate(): ?\DateTimeImmutable
    {
        return $this->startDate;
    }

    public function setStartDate(?\DateTimeImmutable $startDate): static
    {
        $this->startDate = $startDate;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getCoach(): ?string
    {
        return $this->coach;
    }

    public function setCoach(?string $coach): static
    {
        $this->coach = $coach;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getProgram(): ?string
    {
        return $this->program;
    }

    public function setProgram(?string $program): static
    {
        $this->program = $program;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getTotalPayments(): ?float
    {
        return $this->totalPayments;
    }

    public function setTotalPayments(?float $totalPayments): static
    {
        $this->totalPayments = $totalPayments;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getLastVisit(): ?\DateTimeImmutable
    {
        return $this->lastVisit;
    }

    public function setLastVisit(?\DateTimeImmutable $lastVisit): static
    {
        $this->lastVisit = $lastVisit;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getVisitCount(): ?int
    {
        return $this->visitCount;
    }

    public function setVisitCount(?int $visitCount): static
    {
        $this->visitCount = $visitCount;
        return $this;
    }

    #[Groups(['user:read'])]
    public function isInGym(): ?bool
    {
        return $this->inGym;
    }

    public function setInGym(?bool $inGym): static
    {
        $this->inGym = $inGym;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getNotes(): ?string
    {
        return $this->notes;
    }

    public function setNotes(?string $notes): static
    {
        $this->notes = $notes;
        return $this;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INJECTION : Getters/Setters pour activities + sync automatique activity
    // ═══════════════════════════════════════════════════════════════════════
    #[Groups(['user:read'])]
    public function getActivities(): ?array
    {
        return $this->activities ?? [];
    }

    public function setActivities(?array $activities): static
    {
        $this->activities = $activities;
        // Sync automatique : activity = première activité (compatibilité legacy)
        $this->activity = $activities[0] ?? null;
        return $this;
    }

    // Getter/Setter legacy — délégué vers activities
    #[Groups(['user:read'])]
    public function getActivity(): ?string
    {
        // Si activity est vide mais activities existe, retourne la première
        return $this->activity ?? ($this->activities[0] ?? null);
    }

    public function setActivity(?string $activity): static
    {
        $this->activity = $activity;
        // Si on set activity manuellement, on l'ajoute aussi dans activities
        if ($activity !== null) {
            $this->activities = array_unique(array_merge($this->activities ?? [], [$activity]));
        }
        return $this;
    }
    // ═══════════════════════════════════════════════════════════════════════

    #[Groups(['user:read'])]
    public function getAccessType(): ?string
    {
        return $this->accessType;
    }

    public function setAccessType(?string $accessType): static
    {
        $this->accessType = $accessType;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getCardStatus(): ?string
    {
        return $this->cardStatus;
    }

    public function setCardStatus(?string $cardStatus): static
    {
        $this->cardStatus = $cardStatus;
        return $this;
    }

    #[Groups(['user:read'])]
    public function getPromotion(): ?string
    {
        return $this->promotion;
    }

    public function setPromotion(?string $promotion): static
    {
        $this->promotion = $promotion;
        return $this;
    }

    /**
     * @return Collection<int, VisitRecord>
     */
    #[Groups(['user:read'])]
    public function getVisitRecords(): Collection
    {
        return $this->visitRecords;
    }

    public function addVisitRecord(VisitRecord $visitRecord): static
    {
        if (!$this->visitRecords->contains($visitRecord)) {
            $this->visitRecords->add($visitRecord);
            $visitRecord->setUser($this);
        }
        return $this;
    }

    public function removeVisitRecord(VisitRecord $visitRecord): static
    {
        if ($this->visitRecords->removeElement($visitRecord)) {
            if ($visitRecord->getUser() === $this) {
                $visitRecord->setUser(null);
            }
        }
        return $this;
    }

    /**
     * @return Collection<int, PaymentRecord>
     */
    #[Groups(['user:read'])]
    public function getPaymentRecords(): Collection
    {
        return $this->paymentRecords;
    }

    public function addPaymentRecord(PaymentRecord $paymentRecord): static
    {
        if (!$this->paymentRecords->contains($paymentRecord)) {
            $this->paymentRecords->add($paymentRecord);
            $paymentRecord->setUser($this);
        }
        return $this;
    }

    public function removePaymentRecord(PaymentRecord $paymentRecord): static
    {
        if ($this->paymentRecords->removeElement($paymentRecord)) {
            if ($paymentRecord->getUser() === $this) {
                $paymentRecord->setUser(null);
            }
        }
        return $this;
    }

    /**
     * @return Collection<int, AttendanceRecord>
     */
    #[Groups(['user:read'])]
    public function getAttendanceRecords(): Collection
    {
        return $this->attendanceRecords;
    }

    public function addAttendanceRecord(AttendanceRecord $attendanceRecord): static
    {
        if (!$this->attendanceRecords->contains($attendanceRecord)) {
            $this->attendanceRecords->add($attendanceRecord);
            $attendanceRecord->setUser($this);
        }
        return $this;
    }

    public function removeAttendanceRecord(AttendanceRecord $attendanceRecord): static
    {
        if ($this->attendanceRecords->removeElement($attendanceRecord)) {
            if ($attendanceRecord->getUser() === $this) {
                $attendanceRecord->setUser(null);
            }
        }
        return $this;
    }

    public function getResetToken(): ?string
    {
        return $this->resetToken;
    }

    public function setResetToken(?string $resetToken): static
    {
        $this->resetToken = $resetToken;

        return $this;
    }

    public function getResetTokenExpiresAt(): ?\DateTimeImmutable
    {
        return $this->resetTokenExpiresAt;
    }

    public function setResetTokenExpiresAt(?\DateTimeImmutable $resetTokenExpiresAt): static
    {
        $this->resetTokenExpiresAt = $resetTokenExpiresAt;

        return $this;
    }

    public function isResetTokenValid(): bool
    {
        if (!$this->resetToken || !$this->resetTokenExpiresAt) {
            return false;
        }

        return $this->resetTokenExpiresAt > new \DateTimeImmutable();
    }
}