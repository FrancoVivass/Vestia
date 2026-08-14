import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Category } from '../../../../core/models/category.model';
import { BusinessContextService } from '../../../../core/services/business-context.service';
import { CategoryService } from '../../../../core/services/category.service';
import { ToastService } from '../../../../core/services/toast.service';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';
import { ButtonComponent } from '../../../../shared/ui/button/button';
import { CategoryFormModalComponent } from '../../components/category-form-modal/category-form-modal';

@Component({
  selector: 'app-categories-page',
  imports: [DatePipe, BadgeComponent, ButtonComponent, CategoryFormModalComponent],
  templateUrl: './categories-page.html',
  styleUrl: './categories-page.css',
})
export class CategoriesPageComponent {
  private readonly categoryService = inject(CategoryService);
  private readonly businessContext = inject(BusinessContextService);
  private readonly toast = inject(ToastService);

  readonly modalOpen = signal(false);
  readonly editing = signal<Category | null>(null);
  readonly categories = computed(() => {
    const businessId = this.businessContext.activeBusiness()?.id;
    if (!businessId) return [];
    return this.categoryService.categories().filter((item) => item.businessId === businessId);
  });

  openCreate(): void {
    this.editing.set(null);
    this.modalOpen.set(true);
  }

  openEdit(category: Category): void {
    this.editing.set(category);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editing.set(null);
  }

  async saveCategory(value: { name: string; description: string }): Promise<void> {
    const editing = this.editing();
    const businessId = this.businessContext.activeBusiness()?.id;
    if (!businessId) return;
    try {
      if (editing) {
        await this.categoryService.update(editing.id, value);
        this.toast.show({ title: 'Categoría actualizada', variant: 'success' });
      } else {
        await this.categoryService.create({ ...value, businessId, status: 'active' });
        this.toast.show({ title: 'Categoría creada', variant: 'success' });
      }
      this.closeModal();
    } catch (error) {
      this.toast.show({ title: 'No se pudo guardar la categoría', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'danger' });
    }
  }

  async toggleStatus(category: Category): Promise<void> {
    await this.categoryService.toggleStatus(category.id);
    this.toast.show({
      title: category.status === 'active' ? 'Categoría desactivada' : 'Categoría activada',
      variant: category.status === 'active' ? 'warning' : 'success',
    });
  }
}
