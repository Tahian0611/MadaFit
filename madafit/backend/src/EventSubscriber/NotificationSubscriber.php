<?php

namespace App\EventSubscriber;

use App\Entity\AttendanceRecord;
use App\Entity\PaymentRecord;
use App\Entity\Transaction;
use App\Entity\User;
use App\Service\NotificationService;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsEntityListener;
use Doctrine\ORM\Events;
use Doctrine\Persistence\Event\LifecycleEventArgs;

#[AsEntityListener(event: Events::postPersist, entity: User::class, method: 'onUserCreated')]
#[AsEntityListener(event: Events::postPersist, entity: AttendanceRecord::class, method: 'onAttendanceRecorded')]
#[AsEntityListener(event: Events::postPersist, entity: Transaction::class, method: 'onTransactionCreated')]
#[AsEntityListener(event: Events::postPersist, entity: PaymentRecord::class, method: 'onPaymentRecorded')]
class NotificationSubscriber
{
    public function __construct(
        private NotificationService $notificationService
    ) {}

    public function onUserCreated(User $user, LifecycleEventArgs $args): void
    {
        $this->notificationService->notifyNewMember($user);
    }

    public function onAttendanceRecorded(AttendanceRecord $record, LifecycleEventArgs $args): void
    {
        $user = $record->getUser();

        if (!$user instanceof User) {
            return;
        }

        $status = $user->getStatus();

        if ($status !== 'active') {
            $reason = match($status) {
                'expired' => 'Abonnement expire',
                'suspended' => 'Compte suspendu',
                default => 'Statut inactif'
            };
            $this->notificationService->notifyAccessDenied($user, $reason);
        } else {
            $this->notificationService->notifyAccessGranted($user);
        }
    }

    public function onTransactionCreated(Transaction $transaction, LifecycleEventArgs $args): void
    {
        $product = $transaction->getProduct();

        if (!$product) {
            return;
        }

        $this->notificationService->notifyMovement(
            $product,
            $transaction->getType(),
            $transaction->getQuantity()
        );

        $isExit = in_array($transaction->getType(), ['sale', 'credit', 'non_sale_exit', 'loss', 'damage'], true);

        if ($product->getCurrentStock() <= 5 && $isExit) {
            $this->notificationService->notifyLowStock(
                $product->getName(),
                $product->getCurrentStock()
            );
        }
    }

    public function onPaymentRecorded(PaymentRecord $record, LifecycleEventArgs $args): void
    {
        $user = $record->getUser();

        if (!$user instanceof User) {
            return;
        }

        $this->notificationService->notifyPaymentReceived($user, $record->getAmount());
    }
}
