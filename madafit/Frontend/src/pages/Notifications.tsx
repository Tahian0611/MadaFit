import { useState } from 'react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import NotificationItem from '@/components/notifications/NotificationItem';
import { 
  Bell, Filter, CheckCheck, Loader2, 
  UserPlus, DollarSign, Shield, Package, CalendarClock
} from 'lucide-react';

const TYPE_FILTERS = [
  { value: 'all', label: 'Toutes', icon: Bell },
  { value: 'member', label: 'Membres', icon: UserPlus },
  { value: 'payment', label: 'Paiements', icon: DollarSign },
  { value: 'access', label: 'Acces', icon: Shield },
  { value: 'stock', label: 'Stock', icon: Package },
  { value: 'subscription', label: 'Abonnements', icon: CalendarClock },
];

const PRIORITY_FILTERS = [
  { value: 'all', label: 'Toutes priorites' },
  { value: 'urgent', label: 'Urgente', color: 'text-destructive' },
  { value: 'high', label: 'Haute', color: 'text-amber-500' },
  { value: 'normal', label: 'Normal', color: 'text-primary' },
  { value: 'low', label: 'Basse', color: 'text-muted-foreground' },
];

export default function NotificationsPage() {
  const { notifications, isLoading, markAllAsRead, deleteNotification } = useNotificationContext();
  const [typeFilter, setTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all');

  const filtered = notifications.filter(n => {
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    if (priorityFilter !== 'all' && n.priority !== priorityFilter) return false;
    if (readFilter === 'read' && !n.isRead) return false;
    if (readFilter === 'unread' && n.isRead) return false;
    return true;
  });

  const stats = {
    total: notifications.length,
    unread: notifications.filter(n => !n.isRead).length,
    urgent: notifications.filter(n => n.priority === 'urgent' && !n.isRead).length,
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 px-2 sm:px-4 lg:px-0 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground uppercase tracking-tight">
            Centre de Notifications
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-1">
            Surveillance en temps reel de votre salle
          </p>
        </div>
        {stats.unread > 0 && (
          <button
            onClick={markAllAsRead}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/20 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
          >
            <CheckCheck size={14} />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/5 rounded-full" />
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Total</p>
          <p className="text-3xl font-black text-foreground mt-1">{stats.total}</p>
        </div>
        <div className="stat-card relative overflow-hidden border-primary/20 bg-primary/5">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-primary/10 rounded-full" />
          <p className="text-xs text-primary font-bold uppercase tracking-wider">Non lues</p>
          <p className="text-3xl font-black text-primary mt-1">{stats.unread}</p>
        </div>
        <div className="stat-card relative overflow-hidden border-destructive/20 bg-destructive/5">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-destructive/10 rounded-full" />
          <p className="text-xs text-destructive font-bold uppercase tracking-wider">Urgentes</p>
          <p className="text-3xl font-black text-destructive mt-1">{stats.urgent}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border p-4 space-y-4" style={{ borderColor: 'hsl(var(--border))' }}>
        <div className="flex items-center gap-2 mb-2">
          <Filter size={14} className="text-muted-foreground" />
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filtres</span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {TYPE_FILTERS.map(f => {
            const Icon = f.icon;
            const active = typeFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setTypeFilter(f.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  active 
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <Icon size={12} />
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-muted rounded-lg p-1">
            {(['all', 'unread', 'read'] as const).map(r => (
              <button
                key={r}
                onClick={() => setReadFilter(r)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  readFilter === r ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {r === 'all' ? 'Tout' : r === 'unread' ? 'Non lues' : 'Lues'}
              </button>
            ))}
          </div>
          
          <div className="h-4 w-px bg-border" />
          
          <div className="flex items-center gap-1.5">
            {PRIORITY_FILTERS.map(p => (
              <button
                key={p.value}
                onClick={() => setPriorityFilter(p.value)}
                className={`text-xs font-bold transition-all ${
                  priorityFilter === p.value ? p.color || 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-2xl border border-dashed" style={{ borderColor: 'hsl(var(--border))' }}>
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Bell size={28} className="text-muted-foreground/40" />
            </div>
            <p className="text-lg font-bold text-muted-foreground">Aucune notification</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Les filtres actuels ne retournent aucun resultat</p>
          </div>
        ) : (
          filtered.map(notification => (
            <NotificationItem 
              key={notification.id} 
              notification={notification} 
              onDelete={() => deleteNotification(notification.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}