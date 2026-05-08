import { createContext, useContext, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationApi } from '@/services/api';
import type { Notification } from '@/types/entities';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  deleteNotification: (id: number) => void;
  refetch: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationApi.getAll({ itemsPerPage: 50 }),
    enabled: !!localStorage.getItem("madafit_token"),
    staleTime: 0,
  });

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationApi.getUnreadCount(),
    enabled: !!localStorage.getItem("madafit_token"),
    staleTime: 0,
  });

  // Polling intelligent adaptatif
  useEffect(() => {
    const hasToken = !!localStorage.getItem("madafit_token");
    if (!hasToken) return;

    const startPolling = () => {
      const interval = (countData?.count ?? data?.unreadCount ?? 0) > 0 ? 5000 : 30000;

      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      }, interval);
    };

    startPolling();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }
    };

    const handleFocus = () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [refetch, queryClient, countData?.count, data?.unreadCount]);

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => notificationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const rawNotifications = (data?.items ?? []).map((n: any): Notification => ({
    ...n,
    id:         n.id,
    type:       n.type,
    title:      n.title,
    message:    n.message,
    read:       n.isRead ?? n.read ?? false,
    date:       n.createdAt ?? n.date ?? new Date().toISOString(),
    isRead:     n.isRead ?? n.read ?? false,
    createdAt:  n.createdAt ?? n.date ?? new Date().toISOString(),
    priority:   n.priority ?? 'normal',
    link:       n.link,
    icon:       n.icon,
    actionText: n.actionText,
    actionLink: n.actionLink,
    user:       n.user,
    memberId:   n.memberId,
    memberName: n.memberName,
  }));

  // ❌ Filtre 'system' (existant) + 'access' (retiré suite à suppression de la notif accès)
  const notifications = rawNotifications.filter(
    (n) => n.type !== 'system' && n.type !== 'access'
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = useCallback((id: number) => {
    markReadMutation.mutate(id);
  }, [markReadMutation]);

  const markAllAsRead = useCallback(() => {
    markAllReadMutation.mutate();
  }, [markAllReadMutation]);

  const deleteNotification = useCallback((id: number) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      isLoading,
      markAsRead,
      markAllAsRead,
      deleteNotification,
      refetch,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotificationContext must be used within NotificationProvider');
  return context;
}