<?php

namespace App\EventSubscriber;

use App\Entity\Article;
use App\Entity\Payment;
use App\Entity\Transaction;
use App\Entity\User;
use App\Service\NotificationService;
use Doctrine\Bundle\DoctrineBundle\Attribute\AsEntityListener;
use Doctrine\ORM\Events;
use Doctrine\Persistence\Event\LifecycleEventArgs;

#[AsEntityListener(event: Events::postPersist, entity: User::class,         method: 'onUserCreated')]
#[AsEntityListener(event: Events::postPersist, entity: Payment::class,       method: 'onPaymentCreated')]
#[AsEntityListener(event: Events::postPersist, entity: Transaction::class,   method: 'onTransactionCreated')]
// ✅ Article : notifier lors de la création et du passage en publié
#[AsEntityListener(event: Events::postPersist, entity: Article::class,       method: 'onArticleCreated')]
#[AsEntityListener(event: Events::postUpdate,  entity: Article::class,       method: 'onArticleUpdated')]
class NotificationSubscriber
{
    public function __construct(
        private NotificationService $notificationService
    ) {}

    public function onUserCreated(User $user, LifecycleEventArgs $args): void
    {
        $this->notificationService->notifyNewMember($user);
    }

    public function onPaymentCreated(Payment $payment, LifecycleEventArgs $args): void
    {
        try {
            $em   = $args->getObjectManager();
            $user = null;

            if ($payment->getMemberId()) {
                $user = $em->getRepository(User::class)
                    ->findOneBy(['memberId' => $payment->getMemberId()]);
            }

            if ($user instanceof User) {
                $this->notificationService->notifyPaymentReceived($user, $payment->getAmount() ?? 0);
            }
        } catch (\Exception) {
            // Non-critique
        }
    }

    public function onTransactionCreated(Transaction $transaction, LifecycleEventArgs $args): void
    {
        $product = $transaction->getProduct();
        if (!$product) return;

        $this->notificationService->notifyMovement(
            $product,
            $transaction->getType(),
            $transaction->getQuantity()
        );

        $isExit = in_array($transaction->getType(), ['sale', 'credit', 'non_sale_exit', 'loss', 'damage'], true);
        if ($product->getCurrentStock() <= 5 && $isExit) {
            $this->notificationService->notifyLowStock($product->getName(), $product->getCurrentStock());
        }
    }

    /**
     * ✅ Nouvel article créé directement en publié → notifier tous les membres
     */
    public function onArticleCreated(Article $article, LifecycleEventArgs $args): void
    {
        try {
            if ($article->isPublished()) {
                $this->notificationService->notifyArticlePublished($article);
            }
        } catch (\Exception) {}
    }

    /**
     * ✅ Article mis à jour : notifier seulement si isPublished vient de passer false → true
     */
    public function onArticleUpdated(Article $article, LifecycleEventArgs $args): void
    {
        try {
            $em      = $args->getObjectManager();
            $changes = $em->getUnitOfWork()->getEntityChangeSet($article);

            if (isset($changes['isPublished'])
                && $changes['isPublished'][0] === false
                && $changes['isPublished'][1] === true
            ) {
                $this->notificationService->notifyArticlePublished($article);
            }
        } catch (\Exception) {}
    }
}