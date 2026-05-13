<?php

namespace App\Entity;

use App\Repository\ArticleRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\ORM\Mapping as ORM;
use ApiPlatform\Metadata\ApiResource;
use ApiPlatform\Metadata\ApiFilter;
use ApiPlatform\Metadata\Get;
use ApiPlatform\Metadata\GetCollection;
use ApiPlatform\Metadata\Post;
use ApiPlatform\Metadata\Patch;
use ApiPlatform\Metadata\Delete;
use ApiPlatform\Doctrine\Orm\Filter\BooleanFilter;
use ApiPlatform\Doctrine\Orm\Filter\OrderFilter;
use Symfony\Component\Serializer\Attribute\Groups;
use Symfony\Component\Validator\Constraints as Assert;
use ApiPlatform\Doctrine\Orm\Filter\SearchFilter;
use App\State\AuthorProcessor;

#[ORM\Entity(repositoryClass: ArticleRepository::class)]
#[ORM\HasLifecycleCallbacks]
#[ApiResource(
    operations: [
        new GetCollection(),
        new Get(),
        new Post(processor: AuthorProcessor::class, security: "is_granted('ROLE_ADMIN')"),
        new Patch(processor: AuthorProcessor::class, security: "is_granted('ROLE_ADMIN')"),
        new Delete(security: "is_granted('ROLE_ADMIN')"),
    ],
    normalizationContext: ['groups' => ['article:read']],
    denormalizationContext: ['groups' => ['article:write']],
    description: 'Articles, actualités et promotions de MadaFit.'
)]
// ✅ Filtres : ?isPublished=true et ?order[publishedAt]=desc pour l'APK
#[ApiFilter(BooleanFilter::class, properties: ['isPublished'])]
#[ApiFilter(OrderFilter::class, properties: ['publishedAt', 'createdAt'], arguments: ['orderParameterName' => 'order'])]
#[ApiFilter(SearchFilter::class, properties: ['title' => 'partial', 'category' => 'exact'])]
class Article implements AuthoredInterface
{
    public const CATEGORY_NEWS   = 'news';
    public const CATEGORY_PROMO  = 'promo';
    public const CATEGORY_EVENT  = 'event';
    public const CATEGORY_TIPS   = 'tips';

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    #[Groups(['article:read'])]
    private ?int $id = null;

    #[ORM\Column(length: 255)]
    #[Groups(['article:read', 'article:write'])]
    #[Assert\NotBlank]
    #[Assert\Length(min: 5, max: 255)]
    private string $title;

    #[ORM\Column(type: Types::TEXT)]
    #[Groups(['article:read', 'article:write'])]
    #[Assert\NotBlank]
    private string $content;

    #[ORM\Column(length: 500, nullable: true)]
    #[Groups(['article:read', 'article:write'])]
    #[Assert\Url]
    private ?string $imageUrl = null;

    #[ORM\Column(length: 50, nullable: true)]
    #[Groups(['article:read', 'article:write'])]
    private ?string $category = null;

    #[ORM\Column]
    #[Groups(['article:read', 'article:write'])]
    private bool $isPublished = false;

    #[ORM\Column(nullable: true)]
    #[Groups(['article:read', 'article:write'])]
    private ?\DateTimeImmutable $publishedAt = null;

    #[ORM\Column]
    #[Groups(['article:read'])]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(nullable: true)]
    #[Groups(['article:read'])]
    private ?\DateTimeImmutable $updatedAt = null;

    #[ORM\ManyToOne(targetEntity: User::class, fetch: 'EAGER')]
    #[ORM\JoinColumn(nullable: true, onDelete: 'SET NULL')]
    #[Groups(['article:read'])]
    private ?User $author = null;

    #[ORM\PrePersist]
    public function onPrePersist(): void
    {
        $this->createdAt = new \DateTimeImmutable();
        if ($this->isPublished && !$this->publishedAt) {
            $this->publishedAt = new \DateTimeImmutable();
        }
    }

    #[ORM\PreUpdate]
    public function onPreUpdate(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
        if ($this->isPublished && !$this->publishedAt) {
            $this->publishedAt = new \DateTimeImmutable();
        }
    }

    public function getId(): ?int { return $this->id; }
    public function getTitle(): string { return $this->title; }
    public function setTitle(string $title): static { $this->title = $title; return $this; }
    public function getContent(): string { return $this->content; }
    public function setContent(string $content): static { $this->content = $content; return $this; }
    public function getImageUrl(): ?string { return $this->imageUrl; }
    public function setImageUrl(?string $imageUrl): static { $this->imageUrl = $imageUrl; return $this; }
    public function getCategory(): ?string { return $this->category; }
    public function setCategory(?string $category): static { $this->category = $category; return $this; }
    public function isPublished(): bool { return $this->isPublished; }
    public function setIsPublished(bool $isPublished): static { $this->isPublished = $isPublished; return $this; }
    public function getPublishedAt(): ?\DateTimeImmutable { return $this->publishedAt; }
    public function setPublishedAt(?\DateTimeImmutable $publishedAt): static { $this->publishedAt = $publishedAt; return $this; }
    public function getCreatedAt(): \DateTimeImmutable { return $this->createdAt; }
    public function getUpdatedAt(): ?\DateTimeImmutable { return $this->updatedAt; }
    public function getAuthor(): ?User { return $this->author; }
    public function setAuthor(?User $author): static { $this->author = $author; return $this; }
}
