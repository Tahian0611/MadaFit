<?php

namespace App\Repository;

use App\Entity\Notification;
use App\Entity\User;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<Notification>
 */
class NotificationRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Notification::class);
    }

    public function findUnreadForUser(?User $user, int $limit = 50): array
    {
        $qb = $this->createQueryBuilder('n')
            ->where('n.isRead = :read')
            ->setParameter('read', false)
            ->orderBy('n.createdAt', 'DESC')
            ->setMaxResults($limit);

        if ($user === null) {
            $qb->andWhere('n.user IS NULL');
        } else {
            $qb->andWhere('n.user = :user')
               ->setParameter('user', $user);
        }

        return $qb->getQuery()->getResult();
    }

    public function countUnreadForUser(?User $user): int
    {
        $qb = $this->createQueryBuilder('n')
            ->select('COUNT(n.id)')
            ->where('n.isRead = :read')
            ->setParameter('read', false);

        if ($user === null) {
            $qb->andWhere('n.user IS NULL');
        } else {
            $qb->andWhere('n.user = :user')
               ->setParameter('user', $user);
        }

        return (int) $qb->getQuery()->getSingleScalarResult();
    }

    public function findRecentForUser(?User $user, int $limit = 100): array
    {
        $qb = $this->createQueryBuilder('n')
            ->orderBy('n.createdAt', 'DESC')
            ->setMaxResults($limit);

        if ($user === null) {
            $qb->where('n.user IS NULL');
        } else {
            $qb->where('n.user = :user')
               ->setParameter('user', $user);
        }

        return $qb->getQuery()->getResult();
    }

    public function deleteOldNotifications(int $days = 90): int
    {
        $date = new \DateTimeImmutable("-{$days} days");

        return $this->createQueryBuilder('n')
            ->delete()
            ->where('n.createdAt < :date')
            ->setParameter('date', $date)
            ->getQuery()
            ->execute();
    }
}
