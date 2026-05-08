<?php

namespace App\Service;

use App\Entity\Article;
use App\Entity\Notification;
use App\Entity\User;
use App\Entity\Product;
use Doctrine\ORM\EntityManagerInterface;

class NotificationService
{
    public function __construct(
        private EntityManagerInterface $em
    ) {}

    public function create(
        string $title,
        string $message,
        string $type = Notification::TYPE_SYSTEM,
        ?User $user = null,
        string $priority = Notification::PRIORITY_NORMAL,
        ?string $link = null,
        ?string $icon = null,
        ?string $actionText = null,
        ?string $actionLink = null
    ): Notification {
        $notification = new Notification();
        $notification->setTitle($title)
            ->setMessage($message)
            ->setType($type)
            ->setUser($user)
            ->setPriority($priority)
            ->setLink($link)
            ->setIcon($icon)
            ->setActionText($actionText)
            ->setActionLink($actionLink);

        $this->em->persist($notification);
        $this->em->flush();

        return $notification;
    }

    public function delete(int $id): void
    {
        $notification = $this->em->getRepository(Notification::class)->find($id);
        if ($notification) {
            $this->em->remove($notification);
            $this->em->flush();
        }
    }

    /**
     * Notifications pour un user normal (membres APK) :
     * - Ses propres notifications (user = $user)
     * - Notifications globales de type 'article' uniquement (user IS NULL AND type = 'article')
     */
    public function getUserNotifications(?User $user, int $page = 1, int $limit = 20): array
    {
        $offset = ($page - 1) * $limit;

        $qb = $this->em->getRepository(Notification::class)->createQueryBuilder('n');

        if ($user === null) {
            $qb->where('n.user IS NULL');
        } else {
            // User reçoit : ses propres notifs (abonnement) + les articles globaux
            $qb->where(
                $qb->expr()->orX(
                    $qb->expr()->eq('n.user', ':user'),
                    $qb->expr()->andX(
                        $qb->expr()->isNull('n.user'),
                        $qb->expr()->eq('n.type', ':articleType')
                    )
                )
            )
            ->setParameter('user', $user)
            ->setParameter('articleType', Notification::TYPE_ARTICLE);
        }

        $items = $qb
            ->orderBy('n.createdAt', 'DESC')
            ->setFirstResult($offset)
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();

        $countQb = $this->em->getRepository(Notification::class)->createQueryBuilder('n')
            ->select('COUNT(n.id)');

        if ($user === null) {
            $countQb->where('n.user IS NULL');
        } else {
            $countQb->where(
                $countQb->expr()->orX(
                    $countQb->expr()->eq('n.user', ':user'),
                    $countQb->expr()->andX(
                        $countQb->expr()->isNull('n.user'),
                        $countQb->expr()->eq('n.type', ':articleType')
                    )
                )
            )
            ->setParameter('user', $user)
            ->setParameter('articleType', Notification::TYPE_ARTICLE);
        }

        $total = (int) $countQb->getQuery()->getSingleScalarResult();

        return [
            'items' => $items,
            'total' => $total,
            'page'  => $page,
            'limit' => $limit,
        ];
    }

    /**
     * Admin : toutes les notifications sans restriction
     */
    public function getAllNotifications(int $page = 1, int $limit = 20): array
    {
        $offset = ($page - 1) * $limit;

        $items = $this->em->getRepository(Notification::class)
            ->createQueryBuilder('n')
            ->orderBy('n.createdAt', 'DESC')
            ->setFirstResult($offset)
            ->setMaxResults($limit)
            ->getQuery()
            ->getResult();

        $total = (int) $this->em->getRepository(Notification::class)
            ->createQueryBuilder('n')
            ->select('COUNT(n.id)')
            ->getQuery()
            ->getSingleScalarResult();

        return [
            'items' => $items,
            'total' => $total,
            'page'  => $page,
            'limit' => $limit,
        ];
    }

    public function countUnreadForUser(?User $user): int
    {
        return $this->em->getRepository(Notification::class)->countUnreadForUser($user);
    }

    /**
     * Admin : compte toutes les notifications non lues
     */
    public function countAllUnread(): int
    {
        return (int) $this->em->getRepository(Notification::class)
            ->createQueryBuilder('n')
            ->select('COUNT(n.id)')
            ->where('n.isRead = :false')
            ->setParameter('false', false)
            ->getQuery()
            ->getSingleScalarResult();
    }

    public function markAsRead(int $id): void
    {
        $notification = $this->em->getRepository(Notification::class)->find($id);
        if ($notification && !$notification->isRead()) {
            $notification->setIsRead(true);
            $this->em->flush();
        }
    }

    public function markAllAsRead(?User $user): void
    {
        $qb = $this->em->createQueryBuilder()
            ->update(Notification::class, 'n')
            ->set('n.isRead', ':read')
            ->set('n.readAt', ':now')
            ->where('n.isRead = :false');

        if ($user === null) {
            $qb->andWhere('n.user IS NULL');
        } else {
            $qb->andWhere('n.user IS NULL OR n.user = :user')
               ->setParameter('user', $user);
        }

        $qb->setParameter('read', true)
           ->setParameter('now', new \DateTimeImmutable())
           ->setParameter('false', false)
           ->getQuery()
           ->execute();
    }

    public function cleanupOldNotifications(int $days = 90): int
    {
        return $this->em->getRepository(Notification::class)->deleteOldNotifications($days);
    }

    // ── Méthodes métier ──────────────────────────────────────────────────────

    public function notifyNewMember(User $member): void
    {
        $this->create(
            'Nouvelle inscription',
            sprintf('%s %s vient de s\'inscrire (%s).', $member->getFirstName(), $member->getLastName(), $member->getMemberId()),
            Notification::TYPE_MEMBER,
            null, // global admin
            Notification::PRIORITY_NORMAL,
            '/members',
            'UserPlus',
            'Voir le profil',
            '/members'
        );
    }

    public function notifyPaymentReceived(User $member, float $amount): void
    {
        $this->create(
            'Paiement reçu',
            sprintf('%s a payé %s Ar.', $member->getFirstName(), number_format($amount, 0, ',', ' ')),
            Notification::TYPE_PAYMENT,
            null, // global admin
            Notification::PRIORITY_NORMAL,
            '/subscriptions',
            'DollarSign'
        );
    }

    public function notifyAccessDenied(User $member, string $reason): void
    {
        $this->create(
            'Accès refusé',
            sprintf('%s — %s', $member->getFullName() ?? $member->getMemberId(), $reason),
            Notification::TYPE_ACCESS,
            null,
            Notification::PRIORITY_URGENT,
            '/access-control',
            'ShieldAlert'
        );
    }

    public function notifyAccessGranted(User $member): void
    {
        $this->create(
            'Passage enregistré',
            sprintf('Votre entrée à MadaFit a été enregistrée à %s.', (new \DateTimeImmutable())->format('H:i')),
            Notification::TYPE_ACCESS,
            $member,
            Notification::PRIORITY_LOW
        );
    }

    /**
     * ✅ Alerte expiration — user = $member (user-specific, visible APK du membre uniquement)
     * Admin voit via getAllNotifications
     */
    public function notifySubscriptionExpiring(User $member, int $daysLeft): void
    {
        $labels = [10 => 'dans 10 jours', 3 => 'dans 3 jours', 1 => 'demain'];
        $label = $labels[$daysLeft] ?? "dans {$daysLeft} jours";

        $priority = $daysLeft <= 1 ? Notification::PRIORITY_URGENT :
                   ($daysLeft <= 3 ? Notification::PRIORITY_HIGH : Notification::PRIORITY_NORMAL);

        $this->create(
            'Abonnement à renouveler',
            sprintf('Votre abonnement expire %s. Pensez à le renouveler à l\'accueil.', $label),
            Notification::TYPE_SUBSCRIPTION,
            $member, // ✅ user-specific — le membre voit seulement SA propre alerte
            $priority,
            '/subscriptions',
            'CalendarClock'
        );
    }

    /**
     * ✅ Expiration confirmée — user = $member (user-specific)
     */
    public function notifySubscriptionExpired(User $member): void
    {
        $this->create(
            'Abonnement expiré',
            sprintf('Votre abonnement a expiré le %s. Renouvelez-le à l\'accueil MadaFit.',
                $member->getExpiryDate()?->format('d/m/Y') ?? 'date inconnue'
            ),
            Notification::TYPE_SUBSCRIPTION,
            $member, // ✅ user-specific
            Notification::PRIORITY_URGENT,
            '/subscriptions',
            'AlertTriangle'
        );
    }

    public function notifyLowStock(string $productName, int $currentStock): void
    {
        [$title, $priority, $icon, $suffix] = match(true) {
            $currentStock <= 0 => ['Stock épuisé', Notification::PRIORITY_URGENT, 'OctagonX', 'Aucune unité disponible.'],
            $currentStock === 1 => ['Dernière unité', Notification::PRIORITY_URGENT, 'AlertCircle', 'Il ne reste qu\'une seule unité.'],
            $currentStock <= 3  => ['Stock critique', Notification::PRIORITY_HIGH,   'AlertTriangle', 'Niveau d\'alerte critique.'],
            default             => ['Stock faible',   Notification::PRIORITY_HIGH,   'Package', 'Pensez à réapprovisionner.'],
        };

        $this->create(
            $title,
            sprintf('« %s » — %d unité(s) restante(s). %s', $productName, $currentStock, $suffix),
            Notification::TYPE_STOCK,
            null,
            $priority,
            '/products',
            $icon
        );
    }

    public function notifyMovement(Product $product, string $movementType, int $quantity): void
    {
        $definitions = [
            'entry'        => ['title' => 'Approvisionnement', 'action' => 'Entrée de stock',     'direction' => 'up',      'icon' => 'ArrowDownToLine'],
            'sale'         => ['title' => 'Vente confirmée',   'action' => 'Sortie par vente',    'direction' => 'down',    'icon' => 'ShoppingCart'],
            'credit'       => ['title' => 'Vente à crédit',    'action' => 'Sortie à crédit',     'direction' => 'down',    'icon' => 'CreditCard'],
            'non_sale_exit'=> ['title' => 'Sortie sans encaissement', 'action' => 'Sortie S/E',  'direction' => 'down',    'icon' => 'Gift'],
            'adjustment'   => ['title' => 'Ajustement',        'action' => 'Ajustement',          'direction' => 'neutral', 'icon' => 'SlidersHorizontal'],
            'return'       => ['title' => 'Retour client',     'action' => 'Retour client',       'direction' => 'up',      'icon' => 'Undo2'],
            'loss'         => ['title' => 'Perte / Casse',     'action' => 'Perte',               'direction' => 'down',    'icon' => 'Trash2'],
            'damage'       => ['title' => 'Produit endommagé', 'action' => 'Détérioration',       'direction' => 'down',    'icon' => 'AlertTriangle'],
        ];

        $def = $definitions[$movementType] ?? ['title' => 'Mouvement', 'action' => 'Mouvement', 'direction' => 'neutral', 'icon' => 'ArrowLeftRight'];

        $currentStock = $product->getCurrentStock();
        $previousStock = match($def['direction']) {
            'up'    => $currentStock - $quantity,
            'down'  => $currentStock + $quantity,
            default => $currentStock,
        };

        $parts = [];
        $parts[] = sprintf('%s : %d unité(s) de « %s »', $def['action'], $quantity, $product->getName());
        $parts[] = sprintf('Évolution du stock : %d → %d', $previousStock, $currentStock);

        if ($currentStock <= 0)      $parts[] = '⚠️ STOCK ÉPUISÉ';
        elseif ($currentStock === 1) $parts[] = '🔴 Dernière unité';
        elseif ($currentStock <= 3)  $parts[] = '🟡 Stock critique';

        $priority = match(true) {
            $currentStock <= 0 => Notification::PRIORITY_URGENT,
            $currentStock <= 3 => Notification::PRIORITY_HIGH,
            in_array($movementType, ['loss', 'damage', 'non_sale_exit'], true) => Notification::PRIORITY_HIGH,
            default => Notification::PRIORITY_NORMAL,
        };

        $this->create(
            $def['title'],
            implode('. ', $parts) . '.',
            Notification::TYPE_STOCK,
            null,
            $priority,
            '/movements',
            $def['icon']
        );
    }

    /**
     * ✅ NOUVEAU : Notification article publié — user = null (global, APK + web)
     */
    public function notifyArticlePublished(Article $article): void
    {
        $this->create(
            'Nouvel article',
            sprintf('"%s" vient d\'être publié sur MadaFit.', $article->getTitle()),
            Notification::TYPE_ARTICLE,
            null, // global — visible par tous les utilisateurs
            Notification::PRIORITY_NORMAL,
            null,
            'Newspaper'
        );
    }
}
