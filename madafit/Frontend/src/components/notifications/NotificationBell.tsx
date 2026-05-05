import { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { createPortal } from 'react-dom';
import api from '@/services/api';
import { refreshNotifications } from '@/services/api';
import {
  Bell,
  CheckCheck,
  Loader2,
  ShoppingCart,
  Package,
  UserPlus,
  ShieldAlert,
  CalendarClock,
  AlertTriangle,
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowDown,
  ArrowUp,
  CreditCard,
  Gift,
  SlidersHorizontal,
  Undo2,
  Trash2,
  OctagonX,
  AlertCircle,
  DollarSign,
  Clock,
  Check,
} from 'lucide-react';

// ─── Mapping icônes dynamiques ────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  ShoppingCart,
  Package,
  UserPlus,
  ShieldAlert,
  CalendarClock,
  AlertTriangle,
  ArrowLeftRight,
  ArrowDownToLine,
  ArrowDown,
  ArrowUp,
  CreditCard,
  Gift,
  SlidersHorizontal,
  Undo2,
  Trash2,
  OctagonX,
  AlertCircle,
  DollarSign,
  Clock,
  CheckCircle: Check,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface NotificationItem {
  id: number;
  title: string;
  message: string;
  type: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  isRead: boolean;
  createdAt: string;
  link?: string | null;
  icon?: string | null;
  actionText?: string | null;
  actionLink?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'urgent': return 'bg-destructive text-destructive-foreground';
    case 'high': return 'bg-amber-500 text-white';
    case 'normal': return 'bg-primary text-primary-foreground';
    case 'low': return 'bg-muted text-muted-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
}

function getPriorityBorder(priority: string): string {
  switch (priority) {
    case 'urgent': return 'border-l-destructive';
    case 'high': return 'border-l-amber-500';
    case 'normal': return 'border-l-primary';
    default: return 'border-l-transparent';
  }
}

// ─── Sub-component : ligne de notification ────────────────────────────────────
function NotificationRow({
  item,
  onRead,
  onClose,
}: {
  item: NotificationItem;
  onRead: (id: number) => void;
  onClose: () => void;
}) {
  const Icon = item.icon ? ICON_MAP[item.icon] || Bell : Bell;
  const timeAgo = formatDistanceToNow(new Date(item.createdAt), {
    addSuffix: true,
    locale: fr,
  });

  const content = (
    <div
      className={`relative flex gap-3 p-3.5 transition-colors hover:bg-primary/5 border-l-2 ${getPriorityBorder(
        item.priority
      )} ${item.isRead ? 'opacity-60' : 'opacity-100'}`}
    >
      {/* Indicateur non-lu */}
      {!item.isRead && (
        <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-primary shrink-0 ring-2 ring-background" />
      )}

      {/* Icône */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${getPriorityColor(
          item.priority
        )}`}
      >
        <Icon className="w-4 h-4" />
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0 pr-5">
        <p className="text-sm font-semibold leading-tight">{item.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {item.message}
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">{timeAgo}</p>
      </div>
    </div>
  );

  if (item.link) {
    return (
      <Link
        to={item.link}
        onClick={() => {
          !item.isRead && onRead(item.id);
          onClose();
        }}
        className="block outline-none focus:bg-primary/5"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      onClick={() => {
        !item.isRead && onRead(item.id);
        onClose();
      }}
      className="w-full text-left outline-none focus:bg-primary/5"
    >
      {content}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.notifications.getAll({ page: 1, itemsPerPage: 50 }),
    refetchInterval: 30000,
  });

  const notifications: NotificationItem[] = data?.items || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: (id: number) => api.notifications.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      refreshNotifications();
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.notifications.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      refreshNotifications();
    },
  });

  // ── Click outside ──────────────────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // ── Tri : non-lus d'abord, puis date, max 8 ────────────────────────────────
  const recentNotifications = useMemo(() => {
    return [...notifications]
      .sort((a, b) => {
        if (a.isRead === b.isRead) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.isRead ? 1 : -1;
      })
      .slice(0, 8);
  }, [notifications]);

  // ── Positionnement ─────────────────────────────────────────────────────────
  const dropdownStyle = useMemo(() => {
    if (!bellRef.current) return { top: 60, right: 20 };
    const rect = bellRef.current.getBoundingClientRect();
    return {
      top: rect.bottom + 12,
      right: window.innerWidth - rect.right - 8,
    };
  }, [open]);

  return (
    <div className="relative">
      {/* ─── Cloche ─────────────────────────────────────────────────────── */}
      <button
        ref={bellRef}
        onClick={() => setOpen(!open)}
        className="relative p-2.5 rounded-xl hover:bg-primary/10 transition-all duration-300 group"
        aria-label="Notifications"
      >
        <Bell
          size={20}
          className={`transition-all duration-300 ${
            unreadCount > 0
              ? 'text-primary animate-pulse'
              : 'text-muted-foreground group-hover:text-primary'
          }`}
        />

        {unreadCount > 0 && (
          <>
            <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white shadow-lg shadow-destructive/30 animate-in zoom-in duration-300">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-ping" />
          </>
        )}
      </button>

      {/* ─── Dropdown (Portal) ──────────────────────────────────────────── */}
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed z-[9999] w-[420px] max-w-[calc(100vw-2rem)]"
            style={dropdownStyle}
          >
            <div className="rounded-2xl border bg-card/95 backdrop-blur-xl shadow-2xl shadow-black/10 overflow-hidden ring-1 ring-primary/5 flex flex-col max-h-[70vh] md:max-h-[480px]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent shrink-0">
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-foreground">
                    Notifications
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {unreadCount > 0
                      ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                      : 'Tout est à jour'}
                  </p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllReadMutation.mutate()}
                    disabled={markAllReadMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    <CheckCheck size={12} />
                    Tout lire
                  </button>
                )}
              </div>

              {/* Corps scrollable */}
              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  </div>
                ) : recentNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Bell size={20} className="text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Aucune notification
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                      Les alertes apparaîtront ici
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {recentNotifications.map((item) => (
                      <NotificationRow
                        key={item.id}
                        item={item}
                        onRead={(id) => markReadMutation.mutate(id)}
                        onClose={() => setOpen(false)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {recentNotifications.length > 0 && (
                <div className="shrink-0 px-5 py-3 border-t bg-muted/30">
                  <Link
                    to="/notifications"
                    onClick={() => setOpen(false)}
                    className="block text-center text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider"
                  >
                    Voir tout l'historique
                  </Link>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}