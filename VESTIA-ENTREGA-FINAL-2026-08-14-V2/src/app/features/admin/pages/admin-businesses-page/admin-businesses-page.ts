import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Business, BusinessFormValue } from '../../../../core/models/business.model';
import { BusinessContextService } from '../../../../core/services/business-context.service';
import { BusinessService } from '../../../../core/services/business.service';
import { ToastService } from '../../../../core/services/toast.service';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';
import { ButtonComponent } from '../../../../shared/ui/button/button';
import { BusinessFormModalComponent } from '../../components/business-form-modal/business-form-modal';

@Component({
  selector: 'app-admin-businesses-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, BadgeComponent, ButtonComponent, BusinessFormModalComponent],
  templateUrl: './admin-businesses-page.html',
  styleUrl: './admin-businesses-page.css',
})
export class AdminBusinessesPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly businessService = inject(BusinessService);
  private readonly businessContext = inject(BusinessContextService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly modalOpen = signal(false);
  readonly modalLoading = signal(false);
  readonly editingBusiness = signal<Business | null>(null);

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    status: ['all'],
  });

  readonly businesses = this.businessService.businesses;
  readonly filteredBusinesses = computed(() => {
    const search = this.filtersForm.controls.search.getRawValue().trim().toLowerCase();
    const status = this.filtersForm.controls.status.getRawValue();

    return this.businesses().filter((business) => {
      const matchesSearch =
        !search ||
        business.name.toLowerCase().includes(search) ||
        business.legalName.toLowerCase().includes(search) ||
        business.taxId.toLowerCase().includes(search) ||
        business.email.toLowerCase().includes(search);

      const matchesStatus = status === 'all' || business.status === status;

      return matchesSearch && matchesStatus;
    });
  });

  openCreateModal(): void {
    this.editingBusiness.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(business: Business): void {
    this.editingBusiness.set(business);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.modalLoading.set(false);
    this.editingBusiness.set(null);
  }

  saveBusiness(value: BusinessFormValue): void {
    this.modalLoading.set(true);

    const editing = this.editingBusiness();
    if (editing) {
      this.businessService.update(editing.id, value);
      this.toast.show({
        title: 'Comercio actualizado',
        description: 'Los datos del comercio se guardaron correctamente.',
        variant: 'success',
      });
    } else {
      this.businessService.create(value);
      this.toast.show({
        title: 'Comercio creado',
        description: 'El comercio fue agregado al panel global de VESTIA.',
        variant: 'success',
      });
    }

    this.closeModal();
  }

  toggleStatus(business: Business): void {
    const updated = this.businessService.setActive(business.id, !business.isActive);

    if (!updated) {
      return;
    }

    this.toast.show({
      title: updated.isActive ? 'Comercio activado' : 'Comercio desactivado',
      description: `${updated.name} ahora está ${updated.isActive ? 'activo' : 'inactivo'}.`,
      variant: updated.isActive ? 'success' : 'warning',
    });
  }

  accessBusiness(business: Business): void {
    this.businessContext.setBusiness(business);
    this.toast.show({
      title: 'Contexto actualizado',
      description: `Ahora estás administrando ${business.name}.`,
      variant: 'success',
    });
    void this.router.navigate(['/app/admin']);
  }
}
