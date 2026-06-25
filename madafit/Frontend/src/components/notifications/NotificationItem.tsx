import { useNotificationContext } from '@/contexts/NotificationContext';
import type { Notification } from '@/types/entities';
import { 
  UserPlus, DollarSign, ShieldCheck, Package, 
  CalendarClock, AlertTriangle, Info, Check, ArrowRight, Trash2, Newspaper
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const TYPE_CONFIG = {
  member:       { icon: UserPlus,      color: 'text-blue-500',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20'    },
  payment:      { icon: DollarSign,    color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  access:       { icon: ShieldCheck,   color: 'text-violet-500',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20'  },
  stock:        { icon: Package,       color: 'text-amber-500',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20'   },
  subscription: { icon: CalendarClock, color: 'text-rose-500',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20'    },
  system:       { icon: Info,          color: 'text-slate-500',   bg: 'bg-slate-500/10',   border: 'border-slate-500/20'   },
  // ✅ Nouveau type article
  article:      { icon: Newspaper,     color: 'text-sky-500',     bg: 'bg-sky-500/10',     border: 'border-sky-500/20'     },
};

const PRIORITY_INDICATOR = {
  low:    'bg-muted',
  normal: 'bg-primary',
  high:   'bg-amber-500',
  urgent: 'bg-destructive animate-pulse',
};

interface Props {
  notification: Notification;
  compact?: boolean;
  onClose?: () => void;
  onDelete?: () => void;
}

export default function NotificationItem({ notification, compact, onClose, onDelete }: Props) {
  const { markAsRead } = useNotificationContext();
  const config = TYPE_CONFIG[notification.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.system;
  const Icon = config.icon;
  
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt || notification.date), { 
    addSuffix: true, 
    locale: fr 
  });

  const handleClick = () => {
    if (!notification.isRead) {
      markAsRead(notification.id!);
    }
    if (notification.link && onClose) {
      onClose();
      window.location.href = notification.link;
    }
  };

  if (compact) {
    return (
      <div
        onClick={handleClick}
        className={`relative flex items-start gap-3 px-5 py-3.5 cursor-pointer transition-all duration-200 hover:bg-primary/5 group ${
          !notification.isRead ? 'bg-primary/[0.02]' : ''
        }`}
      >
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-full ${PRIORITY_INDICATOR[notification.priority as keyof typeof PRIORITY_INDICATOR] || 'bg-muted'}`} />
        
        <div className={`flex-shrink-0 w-9 h-9 rounded-xl ${config.bg} ${config.color} flex items-center justify-center border ${config.border}`}>
          <Icon size={16} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={`text-sm font-semibold leading-tight ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
              {notification.title}
            </p>
            {!notification.isRead && (
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-1.5" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
            {notification.message}
          </p>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-muted-foreground/60 font-medium">{timeAgo}</span>
            {notification.actionText && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                {notification.actionText} <ArrowRight size={10} />
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`relative flex items-start gap-4 p-5 rounded-2xl border transition-all duration-200 cursor-pointer hover:shadow-md hover:border-primary/20 ${
        !notification.isRead 
          ? 'bg-card border-primary/10 shadow-sm' 
          : 'bg-card/50 border-border'
      }`}
    >
      <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${!notification.isRead ? 'bg-primary' : 'bg-transparent'}`} />
      
      <div className={`flex-shrink-0 w-11 h-11 rounded-xl ${config.bg} ${config.color} flex items-center justify-center border ${config.border}`}>
        <Icon size={18} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${config.bg} ${config.color} border ${config.border}`}>
            {notification.type}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
            notification.priority === 'urgent' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
            notification.priority === 'high'   ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
            'bg-muted text-muted-foreground border border-border'
          }`}>
            {notification.priority}
          </span>
        </div>
        
        <h4 className={`text-base font-bold ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
          {notification.title}
        </h4>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
          {notification.message}
        </p>
        
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground/60 font-medium">{timeAgo}</span>
          <div className="flex items-center gap-2">
            {!notification.isRead && (
              <button
                onClick={(e) => { e.stopPropagation(); markAsRead(notification.id!); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
              >
                <Check size={12} /> Marquer comme lu
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 size={12} /> Supprimer
              </button>
            )}
            {notification.link && (
              <a
                href={notification.link}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Voir <ArrowRight size={12} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}