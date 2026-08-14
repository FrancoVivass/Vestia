import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Business } from '../../../../core/models/business.model';
import { BusinessContextService } from '../../../../core/services/business-context.service';
import { BusinessService } from '../../../../core/services/business.service';
import { ToastService } from '../../../../core/services/toast.service';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';

@Component({
  selector: 'app-admin-businesses-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, BadgeComponent],
  templateUrl: './admin-businesses-page.html',
  styleUrl: './admin-businesses-page.css',
})
export class AdminBusinessesPageComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly businessService = inject(BusinessService);
  private readonly businessContext = inject(BusinessContextService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly loading = signal(false);

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

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      await this.businessService.load();
    } catch (error) {
      this.toast.show({
        title: 'No se pudieron cargar los comercios',
        description: error instanceof Error ? error.message : 'Error inesperado',
        variant: 'danger',
      });
    } finally {
      this.loading.set(false);
    }
  }

  async toggleStatus(business: Business): Promise<void> {
    try {
      const updated = await this.businessService.setActive(business.id, !business.isActive);
      if (updated) {
        this.toast.show({
          title: updated.isActive ? 'Comercio activado' : 'Comercio desactivado',
          description: `${updated.name} ahora está ${updated.isActive ? 'activo' : 'inactivo'}.`,
          variant: updated.isActive ? 'success' : 'warning',
        });
      }
    } catch (error) {
      this.toast.show({
        title: 'No se pudo cambiar el estado',
        description: error instanceof Error ? error.message : 'Error inesperado',
        variant: 'danger',
      });
    }
  }

  accessBusiness(business: Business): void {
    this.businessContext.setBusiness(business);
    this.toast.show({
      title: 'Contexto actualizado',
      description: `Ahora estás administrando ${business.name}.`,
      variant: 'success',
    });
    void this.router.navigate(['/app']);
  }
}
