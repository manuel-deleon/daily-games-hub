import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Bell, 
  UserPlus, 
  ThumbsUp, 
  MessageSquare, 
  CheckCheck, 
  Trash2, 
  Loader2, 
  User as UserIcon,
  ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { 
  fetchNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead, 
  deleteNotification 
} from '../lib/notifications';
import type { AppNotification, Profile } from '../types';

export function Notifications() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Fetch current user profile for quick profile banner
  const { data: profile } = useQuery<Profile | null>({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      return data;
    },
  });

  // Fetch notifications
  const { data: notifications = [], isLoading } = useQuery<AppNotification[]>({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
  });

  // Mark all as read
  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
  };

  // Click on a notification
  const handleNotificationClick = async (notif: AppNotification) => {
    if (!notif.is_read) {
      await markNotificationAsRead(notif.id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
    }

    if (notif.type === 'follow') {
      navigate('/friends');
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
        return 'bg-blue-500/10 border-blue-500/20';
      case 'suggestion_like':
        return 'bg-amber-500/10 border-amber-500/20';
      case 'suggestion_comment':
        return 'bg-emerald-500/10 border-emerald-500/20';
      default:
        return 'bg-primary/10 border-primary/20';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Quick Profile Access Banner */}
      {profile && (
        <Link
          to="/profile"
          className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:border-primary/40 shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">@{profile.username}</span>
                {profile.is_admin && (
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full border border-primary/20">
                    Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Manage profile, theme & settings</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
            <span>View Profile</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </Link>
      )}

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
                  <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border ${getTypeBadgeClass(item.type)} bg-card shadow-xs`}>
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
