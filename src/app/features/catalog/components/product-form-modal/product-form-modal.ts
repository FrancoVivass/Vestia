import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Brand } from '../../../../core/models/brand.model';
import { Category } from '../../../../core/models/category.model';
import { Product, ProductFormValue, ProductImage, ProductVariant } from '../../../../core/models/product.model';
import { StorageService } from '../../../../core/services/storage.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal';

export interface ProductOwnerOption { id:string; name:string }

@Component({
  selector: 'app-product-form-modal',
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './product-form-modal.html',
  styleUrl: './product-form-modal.css',
})
export class ProductFormModalComponent implements OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly storageService = inject(StorageService);

  @Input() open = false;
  @Input() product: Product | null = null;
  @Input() categories: Category[] = [];
  @Input() brands: Brand[] = [];
  @Input() owners: ProductOwnerOption[] = [];
  @Input() saving = false;
  @Output() readonly closed = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<ProductFormValue>();

  readonly uploadLoading = signal(false);
  readonly uploadError = signal<string | null>(null);
  readonly validationError = signal<string | null>(null);
  readonly step = signal(1);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    sku: ['', [Validators.required]],
    internalCode: ['', [Validators.required]],
    barcode: ['', [Validators.required]],
    description: [''],
    categoryId: [''],
    brandId: [''],
    purchasePrice: [0, [Validators.required, Validators.min(0)]],
    salePrice: [0, [Validators.required, Validators.min(0)]],
    promotionalPrice: [0],
    minStock: [0, [Validators.required, Validators.min(0)]],
    maxStock: [0, [Validators.required, Validators.min(0)]],
    status: ['active'],
    images: this.fb.array([]),
    variants: this.fb.array([]),
  });

  readonly margin = computed(() => {
    const purchase = this.form.controls.purchasePrice.getRawValue();
    const sale = this.form.controls.salePrice.getRawValue();

    if (!purchase) {
      return 0;
    }

    return Number((((sale - purchase) / purchase) * 100).toFixed(2));
  });

  get imagesArray(): FormArray {
    return this.form.controls.images;
  }

  get variantsArray(): FormArray {
    return this.form.controls.variants;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['product'] || changes['open']?.currentValue === true) {
      this.patchForm();
      this.step.set(1);
      this.validationError.set(null);
    }
  }

  nextOrSubmit(): void {
    if (this.step() === 1) {
      const controls = ['name','sku','internalCode','barcode','purchasePrice','salePrice','minStock','maxStock'] as const;
      controls.forEach(key => this.form.controls[key].markAsTouched());
      if (controls.some(key => this.form.controls[key].invalid)) {
        this.validationError.set('Revisá los campos obligatorios marcados en rojo.');
        return;
      }
      this.validationError.set(null);
      this.prepareDefaultVariant();
      this.step.set(2);
      return;
    }
    if (this.step() === 2) {
      if (!this.variantsArray.length) this.addVariant();
      this.variantsArray.markAllAsTouched();
      if (!this.validateVariants()) return;
      this.validationError.set(null);
      this.step.set(3);
      return;
    }
    this.onSubmit();
  }

  backOrClose(): void {
    if (this.step() > 1) this.step.update(value => value - 1);
    else this.closed.emit();
  }

  generateCodes(): void {
    const unique = `${Date.now().toString(36).slice(-5)}${crypto.randomUUID().replace(/-/g,'').slice(0,3)}`.toUpperCase();
    const randomDigits = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const normalized = this.form.controls.name.value.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,12) || 'PROD';
    if (!this.form.controls.sku.value) this.form.controls.sku.setValue(`${normalized}-${unique}`);
    if (!this.form.controls.internalCode.value) this.form.controls.internalCode.setValue(`INT-${normalized}-${unique}`);
    if (!this.form.controls.barcode.value) this.form.controls.barcode.setValue(`2${Date.now().toString().slice(-9)}${randomDigits}`);
  }

  addVariant(variant?: ProductVariant): void {
    const position = this.variantsArray.length + 1;
    const canGenerateCodes = !variant && Boolean(this.form.controls.sku.value.trim()) && Boolean(this.form.controls.barcode.value.trim());
    this.variantsArray.push(
      this.fb.nonNullable.group({
        id: [variant?.id ?? crypto.randomUUID()],
        name: [variant?.name ?? ''],
        color: [variant?.color ?? '', [Validators.required]],
        size: [variant?.size ?? '', [Validators.required]],
        sku: [variant?.sku ?? (canGenerateCodes ? this.nextVariantSku(position) : ''), [Validators.required]],
        barcode: [variant?.barcode ?? (canGenerateCodes ? this.nextVariantBarcode(position) : ''), [Validators.required]],
        stock: [variant?.stock ?? 0, [Validators.required, Validators.min(0)]],
        ownerId: [variant?.ownerId ?? ''],
        cost: [variant?.cost ?? this.form.controls.purchasePrice.getRawValue(), [Validators.required, Validators.min(0)]],
        price: [variant?.price ?? this.form.controls.salePrice.getRawValue(), [Validators.required, Validators.min(0)]],
        status: [variant?.status ?? 'active'],
      })
    );
  }

  removeVariant(index: number): void {
    this.variantsArray.removeAt(index);
  }

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    if (!files.length) {
      return;
    }

    this.uploadLoading.set(true);
    this.uploadError.set(null);

    try {
      for (const file of files) {
        const productSlug = this.form.controls.name.getRawValue() || this.product?.name || 'producto';
        const uploaded = await this.storageService.uploadProductImage(file, productSlug.toLowerCase().replace(/\s+/g, '-'));
        this.addImage({
          id: crypto.randomUUID(),
          url: uploaded.publicUrl,
          order: this.imagesArray.length + 1,
          path: uploaded.path,
        });
      }
    } catch {
      this.uploadError.set('No se pudo subir una o más imágenes. Verificá la configuración de Supabase Storage.');
    } finally {
      this.uploadLoading.set(false);
    }
  }

  addImage(image: ProductImage): void {
    this.imagesArray.push(
      this.fb.nonNullable.group({
        id: [image.id],
        url: [image.url, [Validators.required]],
        order: [image.order],
        path: [image.path ?? null],
      })
    );
  }

  removeImage(index: number): void {
    this.imagesArray.removeAt(index);
    this.reorderImages();
  }

  moveImage(index: number, direction: 'up' | 'down'): void {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= this.imagesArray.length) {
      return;
    }

    const current = this.imagesArray.at(index);
    const target = this.imagesArray.at(targetIndex);
    this.imagesArray.setControl(index, target);
    this.imagesArray.setControl(targetIndex, current);
    this.reorderImages();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.validationError.set('No se puede guardar: revisá los campos marcados en rojo.');
      return;
    }

    const value = this.form.getRawValue();

    this.saved.emit({
      ...value,
      promotionalPrice: value.promotionalPrice || null,
      purchasePrice: Number(value.purchasePrice),
      salePrice: Number(value.salePrice),
      minStock: Number(value.minStock),
      maxStock: Number(value.maxStock),
      status: value.status as 'active' | 'inactive',
      images: value.images as ProductImage[],
      variants: value.variants as ProductVariant[],
    });
  }

  private patchForm(): void {
    this.form.reset({
      name: this.product?.name ?? '',
      sku: this.product?.sku ?? '',
      internalCode: this.product?.internalCode ?? '',
      barcode: this.product?.barcode ?? '',
      description: this.product?.description ?? '',
      categoryId: this.product?.categoryId ?? '',
      brandId: this.product?.brandId ?? '',
      purchasePrice: this.product?.purchasePrice ?? 0,
      salePrice: this.product?.salePrice ?? 0,
      promotionalPrice: this.product?.promotionalPrice ?? 0,
      minStock: this.product?.minStock ?? 0,
      maxStock: this.product?.maxStock ?? 0,
      status: this.product?.status ?? 'active',
      images: [],
      variants: [],
    });

    this.imagesArray.clear();
    this.variantsArray.clear();

    this.product?.images.forEach((image) => this.addImage(image));
    this.product?.variants.forEach((variant) => this.addVariant(variant));

    if (!this.product) {
      this.addVariant();
    }
  }

  private prepareDefaultVariant(): void {
    if (!this.variantsArray.length) this.addVariant();
    const first = this.variantsArray.at(0);
    const sku = this.form.controls.sku.value;
    const barcode = this.form.controls.barcode.value;
    first.patchValue({
      color: first.get('color')?.value || 'Sin color',
      size: first.get('size')?.value || 'Único',
      sku: first.get('sku')?.value || sku,
      barcode: first.get('barcode')?.value || barcode,
      cost: Number(first.get('cost')?.value || this.form.controls.purchasePrice.value),
      price: Number(first.get('price')?.value || this.form.controls.salePrice.value),
    });
  }

  private validateVariants(): boolean {
    const controls = this.variantsArray.controls;
    const fields = ['sku','barcode','color','size'];

    for (const group of controls) {
      for (const field of fields) {
        const control = group.get(field);
        if (!control?.errors?.['duplicate']) continue;
        const errors = { ...control.errors };
        delete errors['duplicate'];
        control.setErrors(Object.keys(errors).length ? errors : null);
      }
    }

    for (const field of ['sku','barcode'] as const) {
      const seen = new Map<string, number[]>();
      controls.forEach((group,index) => {
        const value = String(group.get(field)?.value ?? '').trim().toLowerCase();
        if (value) seen.set(value,[...(seen.get(value) ?? []),index]);
      });
      for (const indexes of seen.values()) {
        if (indexes.length < 2) continue;
        indexes.forEach(index => {
          const control = controls[index].get(field);
          control?.setErrors({ ...(control.errors ?? {}), duplicate: true });
        });
      }
    }

    const combinations = new Map<string, number[]>();
    controls.forEach((group,index) => {
      const color = String(group.get('color')?.value ?? '').trim().toLowerCase();
      const size = String(group.get('size')?.value ?? '').trim().toLowerCase();
      const key = `${color}|${size}`;
      if (color && size) combinations.set(key,[...(combinations.get(key) ?? []),index]);
    });
    for (const indexes of combinations.values()) {
      if (indexes.length < 2) continue;
      indexes.forEach(index => {
        for (const field of ['color','size']) {
          const control = controls[index].get(field);
          control?.setErrors({ ...(control.errors ?? {}), duplicate: true });
        }
      });
    }

    if (this.variantsArray.invalid) {
      const hasDuplicates = controls.some(group => fields.some(field => group.get(field)?.errors?.['duplicate']));
      this.validationError.set(hasDuplicates
        ? 'Cada variante debe tener otro SKU, otro código de barras y una combinación diferente de color y talle.'
        : 'Completá los campos de las variantes marcados en rojo.');
      return false;
    }
    return true;
  }

  private nextVariantSku(position: number): string {
    const base = this.form.controls.sku.value.trim() || 'PRODUCTO';
    const used = new Set(this.variantsArray.controls.map(control => String(control.get('sku')?.value ?? '').toUpperCase()));
    let index = Math.max(1, position);
    let candidate = `${base}-V${String(index).padStart(2, '0')}`;
    while (used.has(candidate.toUpperCase())) {
      index += 1;
      candidate = `${base}-V${String(index).padStart(2, '0')}`;
    }
    return candidate;
  }

  private nextVariantBarcode(position: number): string {
    const base = this.form.controls.barcode.value.trim();
    const used = new Set(this.variantsArray.controls.map(control => String(control.get('barcode')?.value ?? '')));
    let index = Math.max(1, position);
    let candidate: string;

    if (/^\d+$/.test(base)) {
      const originalLength = base.length;
      candidate = (BigInt(base) + BigInt(Math.max(1, index - 1))).toString().padStart(originalLength, '0');
      while (used.has(candidate) || candidate === base) {
        candidate = (BigInt(candidate) + 1n).toString().padStart(originalLength, '0');
      }
    } else {
      candidate = `${base || `20${Date.now().toString().slice(-10)}`}-V${String(index).padStart(2, '0')}`;
      while (used.has(candidate)) {
        index += 1;
        candidate = `${base || `20${Date.now().toString().slice(-10)}`}-V${String(index).padStart(2, '0')}`;
      }
    }

    return candidate;
  }

  private reorderImages(): void {
    this.imagesArray.controls.forEach((control, index) => {
      control.patchValue({ order: index + 1 });
    });
  }
}
