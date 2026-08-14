import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Business, BusinessFormValue } from '../../../../core/models/business.model';
import { StorageService } from '../../../../core/services/storage.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal';

@Component({
  selector: 'app-business-form-modal',
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './business-form-modal.html',
  styleUrl: './business-form-modal.css',
})
export class BusinessFormModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly storageService = inject(StorageService);

  @Input() open = false;
  @Input() loading = false;
  @Input() business: Business | null = null;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<BusinessFormValue>();

  readonly previewUrl = signal<string | null>(null);
  readonly uploadError = signal<string | null>(null);
  readonly uploadLoading = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    legalName: ['', [Validators.required, Validators.minLength(2)]],
    taxId: ['', [Validators.required, Validators.minLength(8)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.minLength(6)]],
    address: ['', [Validators.required, Validators.minLength(6)]],
    logoUrl: [''],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['business']) {
      this.patchForm();
    }

    if (changes['open'] && !this.open) {
      this.uploadError.set(null);
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    this.previewUrl.set(objectUrl);
    this.uploadLoading.set(true);
    this.uploadError.set(null);

    try {
      const slugBase = this.form.controls.name.getRawValue() || this.business?.slug || 'vestia-business';
      const upload = await this.storageService.uploadBusinessLogo(file, slugBase.toLowerCase().replace(/\s+/g, '-'));
      this.form.controls.logoUrl.setValue(upload.publicUrl);
    } catch {
      this.uploadError.set('No se pudo subir el logo. Verificá el bucket y los permisos de Supabase Storage.');
    } finally {
      this.uploadLoading.set(false);
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saved.emit({
      ...this.form.getRawValue(),
      logoUrl: this.form.controls.logoUrl.getRawValue() || null,
    });
  }

  private patchForm(): void {
    this.form.reset({
      name: this.business?.name ?? '',
      legalName: this.business?.legalName ?? '',
      taxId: this.business?.taxId ?? '',
      email: this.business?.email ?? '',
      phone: this.business?.phone ?? '',
      address: this.business?.address ?? '',
      logoUrl: this.business?.logoUrl ?? '',
    });

    this.previewUrl.set(this.business?.logoUrl ?? null);
  }
}
