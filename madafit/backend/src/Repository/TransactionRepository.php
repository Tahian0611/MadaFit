<?php

namespace App\Repository;

use App\Entity\Product;
use App\Entity\Transaction;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Doctrine\DBAL\Types\Types;
use Doctrine\Persistence\ManagerRegistry;
use DateTimeImmutable;

/**
 * @extends ServiceEntityRepository<Transaction>
 */
class TransactionRepository extends ServiceEntityRepository
{
    public function __construct(ManagerRegistry $registry)
    {
        parent::__construct($registry, Transaction::class);
    }

    /**
     * Récupère les transactions d'un produit sur une période donnée.
     *
     * @return Transaction[]
     */
    public function findByProductAndDateRange(
        Product $product,
        DateTimeImmutable $from,
        DateTimeImmutable $to
    ): array {
        return $this->createQueryBuilder('t')
            ->andWhere('t.product = :productId')
            ->andWhere('t.date >= :from')
            ->andWhere('t.date <= :to')
            ->setParameter('productId', $product->getId())
            ->setParameter('from', $from, Types::DATETIME_IMMUTABLE)
            ->setParameter('to', $to, Types::DATETIME_IMMUTABLE)
            ->orderBy('t.date', 'ASC')
            ->getQuery()
            ->getResult();
    }
}
