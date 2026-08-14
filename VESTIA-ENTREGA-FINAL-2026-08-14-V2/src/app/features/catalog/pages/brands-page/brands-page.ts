import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Brand } from '../../../../core/models/brand.model';
import { BrandService } from '../../../../core/services/brand.service';
import { BusinessContextService } from '../../../../core/services/business-context.service';
import { ToastService } from '../../../../core/services/toast.service';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';
import { ButtonComponent } from '../../../../shared/ui/button/button';
import { BrandFormModalComponent } from '../../components/brand-form-modal/brand-form-modal';

@Component({
  selector: 'app-brands-page',
  imports: [DatePipe, BadgeComponent, ButtonComponent, BrandFormModalComponent],
  templateUrl: './brands-page.html',
  styleUrl: './brands-page.css',
})
export class BrandsPageComponent {
  private readonly brandService = inject(BrandService);
  private readonly businessContext = inject(BusinessContextService);
  private readonly toast = inject(ToastService);

  readonly modalOpen = signal(false);
  readonly editing = signal<Brand | null>(null);
  readonly brands = computed(() => {
    const businessId = this.businessContext.activeBusiness()?.id;
    if (!businessId) return [];
    return this.brandService.brands().filter((item) => item.businessId === businessId);
  });

  openCreate(): void {
    this.editing.set(null);
    this.modalOpen.set(true);
  }

  openEdit(brand: Brand): void {
    this.editing.set(brand);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editing.set(null);
  }

  async saveBrand(value: { name: string; description: string }): Promise<void> {
    const editing = this.editing();
    const businessId = this.businessContext.activeBusiness()?.id;
    if (!businessId) return;
    try {
      if (editing) {
        await this.brandService.update(editing.id, value);
        this.toast.show({ title: 'Marca actualizada', variant: 'success' });
      } else {
        await this.brandService.create({ ...value, businessId, status: 'active' });
        this.toast.show({ title: 'Marca creada', variant: 'success' });
      }
      this.closeModal();
    } catch (error) {
      this.toast.show({ title: 'No se pudo guardar la marca', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'danger' });
    }
  }

  async toggleStatus(brand: Brand): Promise<void> {
    await this.brandService.toggleStatus(brand.id);
    this.toast.show({
      title: brand.status === 'active' ? 'Marca desactivada' : 'Marca activada',
      variant: brand.status === 'active' ? 'warning' : 'success',
    });
  }
}
