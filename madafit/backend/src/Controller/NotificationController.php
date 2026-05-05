<?php

namespace App\Controller;

use App\Service\NotificationService;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\Security\Http\Attribute\IsGranted;

#[Route('/api/notifications')]
#[IsGranted('ROLE_USER')]
class NotificationController extends AbstractController
{
    #[Route('', name: 'api_notifications_list', methods: ['GET'])]
    #[Route('/', name: 'api_notifications_list_slash', methods: ['GET'])]
    public function list(Request $request, NotificationService $service): JsonResponse
    {
        $user = $this->getUser();
        $page = $request->query->getInt('page', 1);
        $itemsPerPage = $request->query->getInt('itemsPerPage', 20);

        $result = $service->getUserNotifications($user, $page, $itemsPerPage);
        $unreadCount = $service->countUnreadForUser($user);

        return $this->json([
            'items' => $result['items'],
            'total' => $result['total'],
            'page' => $result['page'],
            'itemsPerPage' => $itemsPerPage,
            'unreadCount' => $unreadCount,
        ], 200, [], ['groups' => 'notification:read']);
    }

    #[Route('/unread-count', name: 'api_notifications_unread_count', methods: ['GET'])]
    public function unreadCount(NotificationService $service): JsonResponse
    {
        $count = $service->countUnreadForUser($this->getUser());
        return $this->json(['count' => $count]);
    }

    #[Route('/mark-all-read', name: 'api_notifications_mark_all_read', methods: ['POST'])]
    public function markAllRead(NotificationService $service): JsonResponse
    {
        $service->markAllAsRead($this->getUser());
        return $this->json(['success' => true]);
    }

    #[Route('/{id}/read', name: 'api_notification_read', methods: ['PATCH'])]
    public function markRead(int $id, NotificationService $service): JsonResponse
    {
        $service->markAsRead($id);
        return $this->json(['success' => true]);
    }

    #[Route('/{id}', name: 'api_notification_delete', methods: ['DELETE'])]
    public function delete(int $id, NotificationService $service): JsonResponse
    {
        $service->delete($id);
        return $this->json(['success' => true]);
    }
}