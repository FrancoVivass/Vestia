import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { BusinessContextService } from './business-context.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class CatalogRealtimeService {
  private readonly client = inject(SupabaseService).client;
  private readonly business = inject(BusinessContextService);

  subscribe(onChange: () => void | Promise<void>): () => void {
    const businessId = this.business.activeBusiness()?.id;
    const filter = businessId ? `business_id=eq.${businessId}` : undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let refreshing = false;
    let pending = false;

    const refresh = async () => {
      if (refreshing) {
        pending = true;
        return;
      }
      refreshing = true;
      try {
        await onChange();
      } finally {
        refreshing = false;
        if (pending) {
          pending = false;
          void refresh();
        }
      }
    };

    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => void refresh(), 150);
    };

    let channel: RealtimeChannel = this.client.channel(`catalog-${crypto.randomUUID()}`);
    const tables = [
      { name: 'products', businessScoped: true },
      { name: 'product_variants', businessScoped: true },
      { name: 'product_images', businessScoped: false },
      { name: 'inventory_balances', businessScoped: true },
      { name: 'owners', businessScoped: true },
    ];
    for (const table of tables) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table.name, ...(filter && table.businessScoped ? { filter } : {}) },
        scheduleRefresh,
      );
    }
    channel.subscribe();

    // Respaldo si Realtime está temporalmente desconectado o la publicación aún no se aplicó.
    const pollTimer = setInterval(() => void refresh(), 15000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(pollTimer);
      void this.client.removeChannel(channel);
    };
  }
}
