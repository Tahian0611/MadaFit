<?php

namespace App\Command;

use App\Entity\Notification;
use App\Entity\User;
use App\Service\NotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;

#[AsCommand(
    name: 'app:check-expiring-subscriptions',
    description: 'Vérifie les abonnements expirant bientôt et crée des notifications'
)]
class CheckExpiringSubscriptionsCommand extends Command
{
    public function __construct(
        private EntityManagerInterface $em,
        private NotificationService $notificationService
    ) {
        parent::__construct();
    }

    private function notificationExistsToday(User $member, string $type): bool
    {
        $todayStart = new \DateTimeImmutable('today 00:00:00');
        $todayEnd = new \DateTimeImmutable('today 23:59:59');

        $existing = $this->em->getRepository(Notification::class)
            ->createQueryBuilder('n')
            ->where('n.user = :user')
            ->andWhere('n.type = :type')
            ->andWhere('n.createdAt >= :start')
            ->andWhere('n.createdAt <= :end')
            ->setParameter('user', $member)
            ->setParameter('type', $type)
            ->setParameter('start', $todayStart)
            ->setParameter('end', $todayEnd)
            ->setMaxResults(1)
            ->getQuery()
            ->getOneOrNullResult();

        return $existing !== null;
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $now = new \DateTimeImmutable();
        $alerts = [10, 3, 1];

        foreach ($alerts as $days) {
            $targetDate = $now->modify("+{$days} days")->setTime(0, 0);

            $members = $this->em->getRepository(User::class)
                ->createQueryBuilder('u')
                ->where('u.expiryDate >= :start')
                ->andWhere('u.expiryDate < :end')
                ->setParameter('start', $targetDate->format('Y-m-d 00:00:00'))
                ->setParameter('end', $targetDate->format('Y-m-d 23:59:59'))
                ->getQuery()
                ->getResult();

            foreach ($members as $member) {
                if ($this->notificationExistsToday($member, Notification::TYPE_SUBSCRIPTION)) {
                    $output->writeln("⏭️ Notif J-{$days} déjà existante pour {$member->getFullName()}");
                    continue;
                }
                $this->notificationService->notifySubscriptionExpiring($member, $days);
                $output->writeln("✅ Notif J-{$days} créée pour {$member->getFullName()}");
            }
        }

        $todayStart = $now->setTime(0, 0);
        $todayEnd = $now->setTime(23, 59, 59);

        $expiredToday = $this->em->getRepository(User::class)
            ->createQueryBuilder('u')
            ->where('u.expiryDate >= :start')
            ->andWhere('u.expiryDate < :end')
            ->setParameter('start', $todayStart->format('Y-m-d H:i:s'))
            ->setParameter('end', $todayEnd->format('Y-m-d H:i:s'))
            ->getQuery()
            ->getResult();

        foreach ($expiredToday as $member) {
            if ($member->getStatus() !== 'expired') {
                $member->setStatus('expired');
                $this->em->persist($member);

                $this->notificationService->notifySubscriptionExpired($member);
                $output->writeln("🔴 Expiration traitée pour {$member->getFullName()}");
            }
        }

        $this->em->flush();

        return Command::SUCCESS;
    }
}