import { Injectable, computed, inject, signal, OnDestroy } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private readonly client = inject(SupabaseService).client;

  readonly items = signal<Notification[]>([]);
  readonly unreadCount = computed(() => this.items().filter(n => !n.read).length);
  readonly hasUnread = computed(() => this.unreadCount() > 0);

  private loaded = false;
  private channel: RealtimeChannel | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  async load(limit = 20): Promise<void> {
    const { data, error } = await this.client.rpc('get_notifications', {
      p_limit: limit,
      p_offset: 0,
    });
    if (error) throw error;
    this.items.set((data ?? []) as Notification[]);
    this.loaded = true;

    if (!this.channel) {
      this.subscribeRealtime();
    }
  }

  private subscribeRealtime(): void {
    const userId = this.client.auth.getUser?.() ?? null;

    this.channel = this.client
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => {
          void this.load();
        }
      )
      .subscribe();

    // Fallback: poll every 30s in case realtime misses
    this.pollTimer = setInterval(() => {
      void this.load();
    }, 30000);
  }

  async markRead(id: string): Promise<void> {
    const { error } = await this.client.rpc('mark_notification_read', {
      p_notification_id: id,
    });
    if (error) throw error;
    this.items.update(list =>
      list.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }

  async markAllRead(): Promise<void> {
    const { error } = await this.client.rpc('mark_all_notifications_read');
    if (error) throw error;
    this.items.update(list => list.map(n => ({ ...n, read: true })));
  }

  async refresh(): Promise<void> {
    if (!this.loaded) return;
    await this.load();
  }

  ngOnDestroy(): void {
    if (this.channel) {
      this.client.removeChannel(this.channel);
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }
}
