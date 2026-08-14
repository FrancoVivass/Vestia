import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Business,
  BusinessActivityItem,
  BusinessFormValue,
  BusinessMetrics,
} from '../models/business.model';
import { StorageService } from './storage.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class BusinessService {
  private readonly client = inject(SupabaseService).client;
  private readonly storage = inject(StorageService);
  private readonly businessesState = signal<Business[]>([]);
  private loaded = false;

  readonly businesses = computed(() => this.businessesState());
  readonly metrics = computed<BusinessMetrics>(() => {
    const list = this.businessesState();
    return {
      activeBusinesses: list.filter((b) => b.isActive).length,
      inactiveBusinesses: list.filter((b) => !b.isActive).length,
      totalUsers: 0,
      totalSales: 0,
      totalProducts: 0,
    };
  });

  readonly activity = computed<BusinessActivityItem[]>(() => []);

  async load(): Promise<void> {
    if (this.loaded) return;
    const { data, error } = await this.client
      .from('businesses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const businesses = await Promise.all(
      (data ?? []).map(async (row: any): Promise<Business> => {
        const logoUrl = row.logo_path
          ? await this.storage.signedUrl('business-assets', row.logo_path)
          : null;
        return {
          id: row.id,
          name: row.name,
          slug: row.id,
          legalName: row.legal_name ?? '',
          taxId: row.tax_id ?? '',
          email: row.email ?? '',
          phone: row.phone ?? '',
          address: row.address ?? '',
          logoUrl,
          logoPath: row.logo_path,
          status: row.active ? 'active' : 'inactive',
          isActive: row.active,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      })
    );
    this.businessesState.set(businesses);
    this.loaded = true;
  }

  getById(id: string): Business | undefined {
    return this.businessesState().find((b) => b.id === id);
  }

  async refresh(): Promise<void> {
    this.loaded = false;
    await this.load();
  }

  async setActive(id: string, isActive: boolean): Promise<Business | null> {
    const { error } = await this.client
      .from('businesses')
      .update({ active: isActive })
      .eq('id', id);
    if (error) throw error;
    await this.refresh();
    return this.getById(id) ?? null;
  }
}
