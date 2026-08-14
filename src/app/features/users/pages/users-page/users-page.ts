import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AppUser, AppUserFormValue } from '../../../../core/models/app-user.model';
import { BusinessContextService } from '../../../../core/services/business-context.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import { UserService } from '../../../../core/services/user.service';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';
import { ButtonComponent } from '../../../../shared/ui/button/button';
import { UserFormModalComponent } from '../../components/user-form-modal/user-form-modal';

@Component({
  selector: 'app-users-page',
  imports: [ReactiveFormsModule, DatePipe, BadgeComponent, ButtonComponent, UserFormModalComponent],
  templateUrl: './users-page.html',
  styleUrl: './users-page.css',
})
export class UsersPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly permissionService = inject(PermissionService);
  private readonly businessContext = inject(BusinessContextService);
  private readonly toast = inject(ToastService);

  readonly canCreate = computed(() => this.permissionService.hasPermission('users.create'));
  readonly canEdit = computed(() => this.permissionService.hasPermission('users.update'));
  readonly canDelete = computed(() => this.permissionService.hasPermission('users.delete'));
  readonly canView = computed(() => this.permissionService.hasPermission('users.read'));

  readonly modalOpen = signal(false);
  readonly editingUser = signal<AppUser | null>(null);
  readonly saving = signal(false);

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    role: ['all'],
    status: ['all'],
  });

  readonly users = computed(() => {
    const currentBusinessId = this.businessContext.activeBusiness()?.id;
    if (!currentBusinessId) return [];
    return this.userService.users().filter((user) => user.businessId === currentBusinessId);
  });

  readonly filteredUsers = computed(() => {
    const search = this.filtersForm.controls.search.getRawValue().trim().toLowerCase();
    const role = this.filtersForm.controls.role.getRawValue();
    const status = this.filtersForm.controls.status.getRawValue();

    return this.users().filter((user) => {
      const matchesSearch =
        !search ||
        user.fullName.toLowerCase().includes(search) ||
        user.email.toLowerCase().includes(search);
      const matchesRole = role === 'all' || user.role === role;
      const matchesStatus = status === 'all' || user.status === status;

      return matchesSearch && matchesRole && matchesStatus;
    });
  });

  openCreateModal(): void {
    if (!this.canCreate()) {
      return;
    }

    this.editingUser.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(user: AppUser): void {
    if (!this.canEdit()) {
      return;
    }

    this.editingUser.set(user);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingUser.set(null);
  }

  async saveUser(value: AppUserFormValue): Promise<void> {
    const editing = this.editingUser();
    this.saving.set(true);
    try {
      if (editing) {
        await this.userService.update(editing.id, value);
        this.toast.show({ title: 'Usuario actualizado', description: 'Los datos y permisos quedaron sincronizados.', variant: 'success' });
      } else {
        await this.userService.create(value);
        this.toast.show({ title: 'Usuario creado', description: 'Ya puede ingresar con el email y la contraseña indicada.', variant: 'success' });
      }
      this.closeModal();
    } catch (error) {
      this.toast.show({ title: 'No se pudo guardar el usuario', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'danger' });
    } finally {
      this.saving.set(false);
    }
  }

  async toggleUserStatus(user: AppUser): Promise<void> {
    if (!this.canDelete()) {
      return;
    }

    try {
      await this.userService.toggleStatus(user.id);
      this.toast.show({
        title: user.status === 'active' ? 'Usuario desactivado' : 'Usuario activado',
        description: `${user.fullName} cambió su estado de acceso.`,
        variant: user.status === 'active' ? 'warning' : 'success',
      });
    } catch (error) {
      this.toast.show({ title: 'No se pudo cambiar el acceso', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'danger' });
    }
  }

  permissionLabel(permission: string): string {
    return permission.replace('.', ' · ');
  }
}
