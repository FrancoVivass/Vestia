import { Component, computed, inject, signal } from '@angular/core';
import { AppUser } from '../../../../core/models/app-user.model';
import { PERMISSIONS } from '../../../../core/models/permission.model';
import { BusinessContextService } from '../../../../core/services/business-context.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ToastService } from '../../../../core/services/toast.service';
import { UserService } from '../../../../core/services/user.service';
import { UserFormModalComponent } from '../../components/user-form-modal/user-form-modal';

const PERM_MAP = new Map(PERMISSIONS.map(p => [p.code, p.name]));

@Component({
  selector: 'app-users-page',
  imports: [UserFormModalComponent],
  templateUrl: './users-page.html',
  styleUrl: './users-page.css',
})
export class UsersPageComponent {
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

  private readonly search = signal('');
  private readonly roleFilter = signal<string>('all');
  private readonly statusFilter = signal<string>('all');

  readonly users = computed(() => {
    const currentBusinessId = this.businessContext.activeBusiness()?.id;
    if (!currentBusinessId) return [];
    return this.userService.users().filter(u => u.businessId === currentBusinessId);
  });

  readonly filteredUsers = computed(() => {
    const q = this.search().toLowerCase();
    const role = this.roleFilter();
    const status = this.statusFilter();

    return this.users().filter(u => {
      const matchSearch = !q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchRole = role === 'all' || u.role === role;
      const matchStatus = status === 'all' || u.status === status;
      return matchSearch && matchRole && matchStatus;
    });
  });

  readonly activeCount = computed(() => this.users().filter(u => u.status === 'active').length);
  readonly inactiveCount = computed(() => this.users().filter(u => u.status === 'inactive').length);

  onSearch(e: Event): void {
    this.search.set((e.target as HTMLInputElement).value);
  }

  onRoleFilter(e: Event): void {
    this.roleFilter.set((e.target as HTMLSelectElement).value);
  }

  onStatusFilter(e: Event): void {
    this.statusFilter.set((e.target as HTMLSelectElement).value);
  }

  getInitial(name: string): string {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1 ? parts[1].charAt(0) : '';
  }

  getPermNames(permissions: string[]): string[] {
    return permissions.map(p => PERM_MAP.get(p) ?? p).slice(0, 8);
  }

  formatDate(date: string): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('es-AR', { month: 'short', year: 'numeric' });
  }

  openCreateModal(): void {
    if (!this.canCreate()) return;
    this.editingUser.set(null);
    this.modalOpen.set(true);
  }

  openEditModal(user: AppUser): void {
    if (!this.canEdit()) return;
    this.editingUser.set(user);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingUser.set(null);
  }

  async saveUser(value: any): Promise<void> {
    const editing = this.editingUser();
    this.saving.set(true);
    try {
      if (editing) {
        await this.userService.update(editing.id, value);
        this.toast.show({ title: 'Usuario actualizado', description: 'Datos y permisos sincronizados.', variant: 'success' });
      } else {
        await this.userService.create(value);
        this.toast.show({ title: 'Usuario creado', description: 'Ya puede ingresar con el email y contraseña.', variant: 'success' });
      }
      this.closeModal();
    } catch (error) {
      this.toast.show({ title: 'No se pudo guardar', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'danger' });
    } finally {
      this.saving.set(false);
    }
  }

  async toggleUserStatus(user: AppUser): Promise<void> {
    if (!this.canDelete()) return;
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
}
