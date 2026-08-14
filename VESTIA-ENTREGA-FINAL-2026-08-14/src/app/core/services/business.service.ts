import { Injectable, computed, signal } from '@angular/core';
import {
  Business,
  BusinessActivityItem,
  BusinessFormValue,
  BusinessMetrics,
} from '../models/business.model';

@Injectable({
  providedIn: 'root',
})
export class BusinessService {
  private readonly businessesState = signal<Business[]>([
    {
      id: 'b-001',
      name: 'Tienda A',
      slug: 'tienda-a',
      legalName: 'Tienda A S.R.L.',
      taxId: '30-71234567-1',
      email: 'contacto@tiendaa.com',
      phone: '+54 11 4000 1111',
      address: 'Av. Principal 123, Buenos Aires',
      logoUrl: null,
      logoPath: null,
      status: 'active',
      isActive: true,
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-10T12:40:00.000Z',
    },
    {
      id: 'b-002',
      name: 'Tienda B',
      slug: 'tienda-b',
      legalName: 'Comercial B S.A.',
      taxId: '30-74567891-0',
      email: 'admin@tiendab.com',
      phone: '+54 11 4000 2222',
      address: 'Calle 25 456, Córdoba',
      logoUrl: null,
      logoPath: null,
      status: 'inactive',
      isActive: false,
      createdAt: '2026-07-25T09:10:00.000Z',
      updatedAt: '2026-08-09T17:15:00.000Z',
    },
    {
      id: 'b-003',
      name: 'Tienda C',
      slug: 'tienda-c',
      legalName: 'Grupo Tienda C SAS',
      taxId: '30-79876543-2',
      email: 'hola@tiendac.com',
      phone: '+54 351 555 1212',
      address: 'Belgrano 890, Rosario',
      logoUrl: null,
      logoPath: null,
      status: 'active',
      isActive: true,
      createdAt: '2026-08-03T14:25:00.000Z',
      updatedAt: '2026-08-11T08:35:00.000Z',
    },
  ]);

  readonly businesses = computed(() => this.businessesState());
  readonly metrics = computed<BusinessMetrics>(() => ({
    activeBusinesses: this.businessesState().filter((business) => business.isActive).length,
    inactiveBusinesses: this.businessesState().filter((business) => !business.isActive).length,
    totalUsers: 34,
    totalSales: 18452350,
    totalProducts: 2480,
  }));

  readonly activity = computed<BusinessActivityItem[]>(() => [
    {
      id: 'a-001',
      title: 'Nuevo comercio creado',
      description: 'Tienda C fue incorporada al ecosistema VESTIA.',
      createdAt: 'Hace 2 horas',
    },
    {
      id: 'a-002',
      title: 'Comercio desactivado',
      description: 'Tienda B quedó inactiva por decisión administrativa.',
      createdAt: 'Hace 1 día',
    },
    {
      id: 'a-003',
      title: 'Ventas consolidadas',
      description: 'Se actualizó el resumen global de ventas de todos los comercios.',
      createdAt: 'Hace 2 días',
    },
  ]);

  getById(id: string): Business | undefined {
    return this.businessesState().find((business) => business.id === id);
  }

  create(value: BusinessFormValue): Business {
    const slug = this.createSlug(value.name);
    const business: Business = {
      id: crypto.randomUUID(),
      slug,
      name: value.name,
      legalName: value.legalName,
      taxId: value.taxId,
      email: value.email,
      phone: value.phone,
      address: value.address,
      logoUrl: value.logoUrl ?? null,
      logoPath: null,
      status: 'active',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.businessesState.update((current) => [business, ...current]);
    return business;
  }

  update(id: string, value: BusinessFormValue): Business | null {
    let updatedBusiness: Business | null = null;

    this.businessesState.update((current) =>
      current.map((business) => {
        if (business.id !== id) {
          return business;
        }

        updatedBusiness = {
          ...business,
          name: value.name,
          legalName: value.legalName,
          taxId: value.taxId,
          email: value.email,
          phone: value.phone,
          address: value.address,
          logoUrl: value.logoUrl ?? business.logoUrl ?? null,
          updatedAt: new Date().toISOString(),
        };

        return updatedBusiness;
      })
    );

    return updatedBusiness;
  }

  setActive(id: string, isActive: boolean): Business | null {
    let updatedBusiness: Business | null = null;

    this.businessesState.update((current) =>
      current.map((business) => {
        if (business.id !== id) {
          return business;
        }

        updatedBusiness = {
          ...business,
          isActive,
          status: isActive ? 'active' : 'inactive',
          updatedAt: new Date().toISOString(),
        };

        return updatedBusiness;
      })
    );

    return updatedBusiness;
  }

  private createSlug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[^\w\s-]/g, '')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
