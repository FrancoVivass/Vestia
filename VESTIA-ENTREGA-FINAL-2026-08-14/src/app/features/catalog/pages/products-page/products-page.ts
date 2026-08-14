import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Brand } from '../../../../core/models/brand.model';
import { Category } from '../../../../core/models/category.model';
import { Product, ProductFormValue } from '../../../../core/models/product.model';
import { BrandService } from '../../../../core/services/brand.service';
import { BusinessContextService } from '../../../../core/services/business-context.service';
import { CategoryService } from '../../../../core/services/category.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ProductService } from '../../../../core/services/product.service';
import { ToastService } from '../../../../core/services/toast.service';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';
import { ButtonComponent } from '../../../../shared/ui/button/button';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton';
import { ProductDetailDrawerComponent } from '../../components/product-detail-drawer/product-detail-drawer';
import { ProductFormModalComponent } from '../../components/product-form-modal/product-form-modal';

@Component({
  selector: 'app-products-page',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    BadgeComponent,
    ButtonComponent,
    EmptyStateComponent,
    SkeletonComponent,
    ProductFormModalComponent,
    ProductDetailDrawerComponent,
  ],
  templateUrl: './products-page.html',
  styleUrl: './products-page.css',
})
export class ProductsPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly brandService = inject(BrandService);
  private readonly permissionService = inject(PermissionService);
  private readonly businessContext = inject(BusinessContextService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly modalOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly editingProduct = signal<Product | null>(null);
  readonly detailProduct = signal<Product | null>(null);

  readonly filtersForm = this.fb.nonNullable.group({
    search: [''],
    categoryId: ['all'],
    brandId: ['all'],
    status: ['all'],
    sort: ['newest'],
  });

  readonly canCreate = computed(() => this.permissionService.hasPermission('products.create'));
  readonly canEdit = computed(() => this.permissionService.hasPermission('products.update'));
  readonly canDelete = computed(() => this.permissionService.hasPermission('products.delete'));
  readonly canView = computed(() => this.permissionService.hasPermission('products.read'));

  readonly categories = computed<Category[]>(() => {
    const businessId = this.businessContext.activeBusiness()?.id;
    if (!businessId) return [];
    return this.categoryService.categories().filter((item) => item.businessId === businessId);
  });

  readonly brands = computed<Brand[]>(() => {
    const businessId = this.businessContext.activeBusiness()?.id;
    if (!businessId) return [];
    return this.brandService.brands().filter((item) => item.businessId === businessId);
  });

  readonly products = computed<Product[]>(() => {
    const businessId = this.businessContext.activeBusiness()?.id;
    if (!businessId) return [];
    return this.productService.products().filter((item) => item.businessId === businessId);
  });

  readonly filteredProducts = computed(() => {
    const search = this.filtersForm.controls.search.getRawValue().trim().toLowerCase();
    const categoryId = this.filtersForm.controls.categoryId.getRawValue();
    const brandId = this.filtersForm.controls.brandId.getRawValue();
    const status = this.filtersForm.controls.status.getRawValue();
    const sort = this.filtersForm.controls.sort.getRawValue();

    const filtered = this.products().filter((product) => {
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search) ||
        product.sku.toLowerCase().includes(search) ||
        product.internalCode.toLowerCase().includes(search) ||
        product.barcode.toLowerCase().includes(search);
      const matchesCategory = categoryId === 'all' || product.categoryId === categoryId;
      const matchesBrand = brandId === 'all' || product.brandId === brandId;
      const matchesStatus = status === 'all' || product.status === status;

      return matchesSearch && matchesCategory && matchesBrand && matchesStatus;
    });

    return [...filtered].sort((a, b) => {
      if (sort === 'name') {
        return a.name.localeCompare(b.name);
      }
      if (sort === 'price-desc') {
        return b.salePrice - a.salePrice;
      }
      if (sort === 'price-asc') {
        return a.salePrice - b.salePrice;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  openCreate(): void {
    if (!this.canCreate()) {
      return;
    }

    this.editingProduct.set(null);
    this.modalOpen.set(true);
  }

  openEdit(product: Product): void {
    if (!this.canEdit()) {
      return;
    }

    this.editingProduct.set(product);
    this.modalOpen.set(true);
  }

  openDetail(product: Product): void {
    this.detailProduct.set(product);
    this.detailOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingProduct.set(null);
  }

  closeDetail(): void {
    this.detailOpen.set(false);
    this.detailProduct.set(null);
  }

  async saveProduct(value: ProductFormValue): Promise<void> {
    const editing = this.editingProduct();
    const businessId = this.businessContext.activeBusiness()?.id;
    if (!businessId) {
      this.toast.show({ title: 'No existe un comercio activo', variant: 'danger' });
      return;
    }
    this.loading.set(true);
    try {
      if (editing) {
        await this.productService.update(editing.id, value);
        this.toast.show({ title: 'Producto actualizado', description: 'Producto, variantes e imágenes quedaron sincronizados.', variant: 'success' });
      } else {
        await this.productService.create({
          id: crypto.randomUUID(), businessId, ...value,
          margin: this.productService.calculateMargin(value.purchasePrice, value.salePrice),
          createdAt: new Date().toISOString(),
        });
        this.toast.show({ title: 'Producto creado', description: 'El producto fue agregado al catálogo.', variant: 'success' });
      }
      this.closeModal();
    } catch (error) {
      this.toast.show({ title: 'No se pudo guardar el producto', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'danger' });
    } finally {
      this.loading.set(false);
    }
  }

  async duplicateProduct(product: Product): Promise<void> {
    const duplicated = await this.productService.duplicate(product.id);
    if (!duplicated) {
      return;
    }

    this.toast.show({ title: 'Producto duplicado', description: `${duplicated.name} fue creado como copia.`, variant: 'success' });
  }

  async toggleStatus(product: Product): Promise<void> {
    if (!this.canDelete()) {
      return;
    }

    try {
      await this.productService.toggleStatus(product.id);
      this.toast.show({
        title: product.status === 'active' ? 'Producto desactivado' : 'Producto activado',
        description: `${product.name} cambió su estado.`,
        variant: product.status === 'active' ? 'warning' : 'success',
      });
    } catch (error) {
      this.toast.show({ title: 'No se pudo cambiar el producto', description: error instanceof Error ? error.message : 'Error inesperado', variant: 'danger' });
    }
  }

  categoryName(categoryId: string): string {
    return this.categories().find((item) => item.id === categoryId)?.name ?? 'Sin categoría';
  }

  brandName(brandId: string): string {
    return this.brands().find((item) => item.id === brandId)?.name ?? 'Sin marca';
  }
}
