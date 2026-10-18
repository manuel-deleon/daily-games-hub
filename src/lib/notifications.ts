import { supabase } from './supabase';
import type { AppNotification } from '../types';

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select(`
      id,
      user_id,
      actor_id,
      type,
      title,
      message,
      entity_id,
      is_read,
      created_at,
      actor:profiles!actor_id(id, username, avatar_url)
    `)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    // If the table doesn't exist yet, return empty array gracefully
    console.warn('Could not fetch notifications:', error.message);
    return [];
  }

  return (data || []).map((item: any) => ({
    ...item,
    actor: Array.isArray(item.actor) ? item.actor[0] : item.actor,
  }));
}

export async function fetchUnreadCount(): Promise<number> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .eq('is_read', false);

  if (error) {
    return 0;
  }

  return count || 0;
}

export async function markNotificationAsRead(id: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', session.user.id)
    .eq('is_read', false);
}

export async function deleteNotification(id: string): Promise<void> {
  await supabase
    .from('notifications')
    .delete()
    .eq('id', id);
}

export async function createNotification(params: {
  userId: string;
  actorId: string;
  type: 'follow' | 'suggestion_like' | 'suggestion_comment';
  title: string;
  message?: string | null;
  entityId?: string | null;
}): Promise<void> {
  if (params.userId === params.actorId) return; // Don't notify self

  try {
    await supabase.from('notifications').insert({
      user_id: params.userId,
      actor_id: params.actorId,
      type: params.type,
      title: params.title,
      message: params.message || null,
      entity_id: params.entityId || null,
    });
  } catch (err) {
    console.warn('Could not insert client notification:', err);
  }
}
