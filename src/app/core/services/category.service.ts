import { Injectable, computed, inject, signal } from '@angular/core';
import { Category } from '../models/category.model';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly client = inject(SupabaseService).client;
  private readonly state = signal<Category[]>([]);
  readonly categories = computed(() => this.state());

  constructor() { void this.load(); }

  async load(): Promise<void> {
    const { data, error } = await this.client.from('categories').select('*').order('name');
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

  async create(value: Omit<Category, 'id' | 'createdAt'>): Promise<void> {
    const { error } = await this.client.from('categories').insert({
      business_id: value.businessId,
      name: value.name,
      description: value.description,
      active: value.status === 'active',
    });
    if (error) throw this.asError(error);
    await this.load();
  }

  async update(id: string, value: Partial<Category>): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (value.name !== undefined) payload['name'] = value.name;
    if (value.description !== undefined) payload['description'] = value.description;
    if (value.status !== undefined) payload['active'] = value.status === 'active';
    const { error } = await this.client.from('categories').update(payload).eq('id', id);
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
