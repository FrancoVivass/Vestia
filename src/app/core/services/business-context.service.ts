import { Injectable, computed, inject, signal } from '@angular/core';
import { Business } from '../models/business.model';
import { StorageService } from './storage.service';
import { SupabaseService } from './supabase.service';

const BUSINESS_STORAGE_KEY = 'vestia_active_business_id';

@Injectable({ providedIn: 'root' })
export class BusinessContextService {
  private readonly client = inject(SupabaseService).client;
  private readonly storage = inject(StorageService);
  readonly activeBusiness = signal<Business | null>(null);
  readonly isScoped = computed(() => this.activeBusiness() !== null);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    const savedId = localStorage.getItem(BUSINESS_STORAGE_KEY);

    let query = this.client.from('businesses').select('*');
    if (savedId) {
      query = query.eq('id', savedId);
    }
    const { data, error } = await query.maybeSingle();

    if (!error && data) {
      const logoUrl = data.logo_path
        ? await this.storage.signedUrl('business-assets', data.logo_path)
        : null;
      this.activeBusiness.set({
        id: data.id,
        name: data.name,
        slug: data.id,
        legalName: data.legal_name ?? '',
        taxId: data.tax_id ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        address: data.address ?? '',
        logoUrl,
        logoPath: data.logo_path,
        status: data.active ? 'active' : 'inactive',
        isActive: data.active,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      });
    } else if (!savedId) {
      const { data: fallback } = await this.client
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (fallback) {
        const logoUrl = fallback.logo_path
          ? await this.storage.signedUrl('business-assets', fallback.logo_path)
          : null;
        this.activeBusiness.set({
          id: fallback.id,
          name: fallback.name,
          slug: fallback.id,
          legalName: fallback.legal_name ?? '',
          taxId: fallback.tax_id ?? '',
          email: fallback.email ?? '',
          phone: fallback.phone ?? '',
          address: fallback.address ?? '',
          logoUrl,
          logoPath: fallback.logo_path,
          status: fallback.active ? 'active' : 'inactive',
          isActive: fallback.active,
          createdAt: fallback.created_at,
          updatedAt: fallback.updated_at,
        });
        localStorage.setItem(BUSINESS_STORAGE_KEY, fallback.id);
      }
    }
  }

  setBusiness(business: Business | null): void {
    this.activeBusiness.set(business);
    if (business) {
      localStorage.setItem(BUSINESS_STORAGE_KEY, business.id);
    } else {
      localStorage.removeItem(BUSINESS_STORAGE_KEY);
    }
  }

  clear(): void {
    this.activeBusiness.set(null);
    localStorage.removeItem(BUSINESS_STORAGE_KEY);
  }
}
