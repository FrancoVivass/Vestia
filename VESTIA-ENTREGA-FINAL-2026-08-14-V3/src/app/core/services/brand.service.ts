import { Injectable, computed, inject, signal } from '@angular/core';
import { Brand } from '../models/brand.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class BrandService {
  private readonly client = inject(SupabaseService).client;
  private readonly state = signal<Brand[]>([]);
  readonly brands = computed(() => this.state());

  constructor() { void this.load(); }

  async load(): Promise<void> {
    const { data, error } = await this.client.from('brands').select('*').order('name');
    if (error) throw this.asError(error);
    this.state.set((data ?? []).map((value: any) => ({
      id: value.id,
      name: value.name,
      description: value.description ?? '',
      businessId: value.business_id,
      status: value.active ? 'active' : 'inactive',
      createdAt: value.created_at,
    })));
  }

  async create(value: Omit<Brand, 'id' | 'createdAt'>): Promise<void> {
    const { error } = await this.client.from('brands').insert({
      business_id: value.businessId,
      name: value.name,
      description: value.description,
      active: value.status === 'active',
    });
    if (error) throw this.asError(error);
    await this.load();
  }

  async update(id: string, value: Partial<Brand>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (value.name !== undefined) payload['name'] = value.name;
    if (value.description !== undefined) payload['description'] = value.description;
    if (value.status !== undefined) payload['active'] = value.status === 'active';
    const { error } = await this.client.from('brands').update(payload).eq('id', id);
    if (error) throw this.asError(error);
    await this.load();
  }

  async toggleStatus(id: string): Promise<void> {
    const item = this.state().find(value => value.id === id);
    if (item) await this.update(id, { status: item.status === 'active' ? 'inactive' : 'active' });
  }

  private asError(error: any): Error {
    return new Error([error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(' · ') || 'Error inesperado de Supabase');
  }
}
