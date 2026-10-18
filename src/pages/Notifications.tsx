import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Bell, 
  UserPlus, 
  ThumbsUp, 
  MessageSquare, 
  CheckCheck, 
  Trash2, 
  Loader2
} from 'lucide-react';
import { 
  fetchNotifications, 
  markAllNotificationsAsRead, 
  deleteNotification 
} from '../lib/notifications';
import type { AppNotification } from '../types';

export function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  });

  // Automatically mark all notifications as read upon entering the Alerts section
  useEffect(() => {
    let isMounted = true;
    const markSeen = async () => {
      try {
        await markAllNotificationsAsRead();
        if (isMounted) {
          // Immediately clear the unread badge in the layout navbar
          queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
        }
      } catch (err) {
        console.warn('Could not auto-mark notifications as read:', err);
      }
    };
    markSeen();
    return () => {
      isMounted = false;
      // Invalidate on exit so next visit has fresh read status
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    };
  }, [queryClient]);

  // Mark all as read manually if desired
  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
  };

  // Click on a notification: Navigate directly without needing individual mark-as-read
  const handleNotificationClick = (notif: AppNotification) => {
    if (notif.type === 'follow') {
      navigate(`/friends?userId=${notif.actor_id}`);
    } else if (notif.type === 'suggestion_like' || notif.type === 'suggestion_comment') {
      navigate('/suggestions');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteNotification(id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  const filtered = notifications.filter(n => filter === 'all' || !n.is_read);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'follow':
        return <UserPlus className="w-3.5 h-3.5 text-blue-500" />;
      case 'suggestion_like':
        return <ThumbsUp className="w-3.5 h-3.5 text-amber-500" />;
      case 'suggestion_comment':
        return <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Bell className="w-3.5 h-3.5 text-primary" />;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'follow':
        return 'border-blue-500/30';
      case 'suggestion_like':
        return 'border-amber-500/30';
      case 'suggestion_comment':
        return 'border-emerald-500/30';
      default:
        return 'border-primary/30';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Main Notifications Card */}
      <div className="bg-card rounded-3xl border border-border shadow-sm p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-primary/10 text-primary">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground">Notifications</h1>
              <p className="text-xs text-muted-foreground">
                Stay updated on follows, likes, and feedback discussions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 border border-border transition-all cursor-pointer"
              >
                <CheckCheck className="w-4 h-4" />
                <span>Mark all read</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'unread'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:text-foreground border border-border'
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                filter === 'unread' ? 'bg-primary-foreground text-primary' : 'bg-primary/20 text-primary'
              }`}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Notification List */}
        {isLoading ? (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-14 h-14 rounded-3xl bg-muted border border-border flex items-center justify-center mx-auto mb-3 text-muted-foreground">
              <Bell className="w-7 h-7 opacity-40" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              When people follow you, like your suggestions, or reply to discussions you're in, they will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                className={`py-4 px-3 sm:px-4 rounded-2xl flex items-start gap-3 transition-colors cursor-pointer group ${
                  item.is_read ? 'hover:bg-muted/40' : 'bg-primary/5 hover:bg-primary/10 border border-primary/15 my-1.5'
                }`}
              >
                {/* Actor Avatar with Icon Badge */}
                <div className="relative flex-shrink-0 mt-0.5">
                  <div className="w-10 h-10 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center text-xs font-bold text-foreground">
                    {item.actor?.avatar_url ? (
                      <img src={item.actor.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      item.actor?.username?.[0]?.toUpperCase() ?? '?'
                    )}
                  </div>
                  <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border bg-white dark:bg-card shadow-xs ${getTypeBadgeClass(item.type)}`}>
                    {getTypeIcon(item.type)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground leading-snug">
                      {item.title}
                    </p>
                    <span className="text-[11px] text-muted-foreground/60 whitespace-nowrap flex-shrink-0 mt-0.5">
                      {formatRelativeTime(item.created_at)}
                    </span>
                  </div>

                  {item.message && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 bg-background/50 px-2.5 py-1.5 rounded-xl border border-foreground/5">
                      "{item.message}"
                    </p>
                  )}
                </div>

                {/* Status Dot / Delete Action */}
                <div className="flex items-center gap-1.5 flex-shrink-0 mt-1">
                  {!item.is_read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" title="Unread" />
                  )}
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all cursor-pointer"
                    title="Delete"
                    aria-label="Delete notification"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
