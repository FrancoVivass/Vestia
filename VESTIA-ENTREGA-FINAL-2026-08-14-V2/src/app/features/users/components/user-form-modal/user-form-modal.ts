import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppUser, AppUserFormValue, UserStatus } from '../../../../core/models/app-user.model';
import { PermissionService } from '../../../../core/services/permission.service';
import { RoleCode } from '../../../../core/models/role.model';
import { ModalComponent } from '../../../../shared/ui/modal/modal';
import { DataAccessService } from '../../../../core/services/data-access.service';

interface OwnerOption { id:string; first_name:string; last_name:string; active:boolean }

@Component({
  selector: 'app-user-form-modal',
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './user-form-modal.html',
  styleUrl: './user-form-modal.css',
})
export class UserFormModalComponent implements OnChanges, OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly permissionService = inject(PermissionService);
  private readonly data = inject(DataAccessService);

  @Input() open = false;
  @Input() loading = false;
  @Input() user: AppUser | null = null;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<AppUserFormValue>();

  readonly roles = this.permissionService.roles;
  readonly groupedPermissions = this.permissionService.groupedPermissions;
  readonly groupKeys = computed(() => Object.keys(this.groupedPermissions()));
  readonly owners = signal<OwnerOption[]>([]);

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    role: ['CASHIER'],
    status: ['active'],
    permissions: this.fb.nonNullable.control<string[]>([]),
    ownerId: [''],
  });

  async ngOnInit(): Promise<void> {
    try { const result=await this.data.list<OwnerOption>('owners',{pageSize:200,active:true});this.owners.set(result.items); } catch { this.owners.set([]); }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['user']) {
      this.patchForm();
    }
  }

  onRoleChange(roleCode: string): void {
    this.form.controls.role.setValue(roleCode);
    this.form.controls.permissions.setValue(this.permissionService.getRolePermissions(roleCode));
  }

  togglePermission(permissionCode: string, checked: boolean): void {
    const permissions = new Set(this.form.controls.permissions.getRawValue());

    if (checked) {
      permissions.add(permissionCode);
    } else {
      permissions.delete(permissionCode);
    }

    this.form.controls.permissions.setValue([...permissions]);
  }

  hasPermission(permissionCode: string): boolean {
    return this.form.controls.permissions.getRawValue().includes(permissionCode);
  }

  onSubmit(): void {
    if (!this.user && this.form.controls.password.value.length < 8) {
      this.form.controls.password.setErrors({ minlength: true });
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();

    this.saved.emit({
      fullName: value.fullName,
      email: value.email,
      role: value.role as RoleCode,
      status: value.status as UserStatus,
      permissions: value.permissions,
      ownerId: value.role === 'OWNER' ? value.ownerId || null : null,
      password: value.password || undefined,
    });
  }

  private patchForm(): void {
    const user = this.user;

    if (!user) {
      this.form.reset({
        fullName: '',
        email: '',
        password: '',
        role: 'CASHIER',
        status: 'active',
        permissions: this.permissionService.getRolePermissions('CASHIER'),
        ownerId: '',
      });
      return;
    }

    this.form.reset({
      fullName: user.fullName,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status,
      permissions: user.permissions,
      ownerId: user.ownerId ?? '',
    });
  }
}
