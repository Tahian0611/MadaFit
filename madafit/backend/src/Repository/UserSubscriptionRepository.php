<?php

namespace App\Repository;

use App\Entity\UserSubscription;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\Persistence\ManagerRegistry;

/**
 * @extends ServiceEntityRepository<UserSubscription>
 */
class UserSubscriptionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, UserSubscription::class);
    }

    /**
     * @return UserSubscription[] Returns an array of UserSubscription objects
     */
    public function findByUser(int $userId): array
    {
        return $this->createQueryBuilder('us')
            ->andWhere('us.user = :userId')
            ->setParameter('userId', $userId)
            ->orderBy('us.id', 'DESC')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return UserSubscription[] Returns pending subscriptions for a user
     */
    public function findPendingByUser(int $userId): array
    {
        return $this->createQueryBuilder('us')
            ->andWhere('us.user = :userId')
            ->andWhere('us.status = :status')
            ->setParameter('userId', $userId)
            ->setParameter('status', 'pending')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return UserSubscription[] Returns active subscriptions for a user
     */
    public function findActiveByUser(int $userId): array
    {
        return $this->createQueryBuilder('us')
            ->andWhere('us.user = :userId')
            ->andWhere('us.status = :status')
            ->setParameter('userId', $userId)
            ->setParameter('status', 'active')
            ->getQuery()
            ->getResult();
    }

    /**
     * @return UserSubscription[] Returns expired subscriptions for a user
     */
    public function findExpiredByUser(int $userId): array
    {
        return $this->createQueryBuilder('us')
            ->andWhere('us.user = :userId')
            ->andWhere('us.status = :status')
            ->setParameter('userId', $userId)
            ->setParameter('status', 'expired')
            ->getQuery()
            ->getResult();
    }
}
