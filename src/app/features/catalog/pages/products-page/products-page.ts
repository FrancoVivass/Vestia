import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Brand } from '../../../../core/models/brand.model';
import { Category } from '../../../../core/models/category.model';
import { Product, ProductFormValue } from '../../../../core/models/product.model';
import { BrandService } from '../../../../core/services/brand.service';
import { BusinessContextService } from '../../../../core/services/business-context.service';
import { CategoryService } from '../../../../core/services/category.service';
import { DataAccessService } from '../../../../core/services/data-access.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ProductService } from '../../../../core/services/product.service';
import { ToastService } from '../../../../core/services/toast.service';
import { BadgeComponent } from '../../../../shared/ui/badge/badge';
import { ButtonComponent } from '../../../../shared/ui/button/button';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state';
import { SkeletonComponent } from '../../../../shared/ui/skeleton/skeleton';
import { ProductDetailDrawerComponent } from '../../components/product-detail-drawer/product-detail-drawer';
import { ProductFormModalComponent } from '../../components/product-form-modal/product-form-modal';
import { ProductLabelModalComponent } from '../../components/product-label-modal/product-label-modal';
import { ProductImportDraft, ProductImportModalComponent } from '../../components/product-import-modal/product-import-modal';

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
    ProductImportModalComponent,
    ProductLabelModalComponent,
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
  private readonly data = inject(DataAccessService);

  readonly loading = signal(false);
  readonly modalOpen = signal(false);
  readonly detailOpen = signal(false);
  readonly editingProduct = signal<Product | null>(null);
  readonly detailProduct = signal<Product | null>(null);
  readonly labelOpen = signal(false);
  readonly labelProduct = signal<Product | null>(null);
  readonly importOpen = signal(false);
  readonly owners = signal<Array<{id:string;name:string}>>([]);

  constructor() { void this.loadOwners(); }

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

  openImport(): void {
    if (this.canCreate()) this.importOpen.set(true);
  }

  closeImport(): void {
    if (!this.loading()) this.importOpen.set(false);
  }

  private async loadOwners(): Promise<void> {
    try {
      const result = await this.data.list<{id:string;first_name:string;last_name:string}>('owners',{pageSize:100,active:true});
      this.owners.set(result.items.map(owner=>({id:owner.id,name:`${owner.first_name} ${owner.last_name}`.trim()})));
    } catch {
      this.owners.set([]);
    }
  }

  openLabels(product: Product): void {
    this.labelProduct.set(product);
    this.labelOpen.set(true);
  }

  closeLabels(): void {
    this.labelOpen.set(false);
    this.labelProduct.set(null);
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
        const productId = await this.productService.create({
          id: crypto.randomUUID(), businessId, ...value,
          margin: this.productService.calculateMargin(value.purchasePrice, value.salePrice),
          createdAt: new Date().toISOString(),
        });
        const created = this.productService.getById(productId);
        this.toast.show({ title: 'Producto y etiquetas creados', description: 'Ahora podés imprimir los códigos en la comandera.', variant: 'success' });
        if (created) {
          this.labelProduct.set(created);
          this.labelOpen.set(true);
        }
      }
      this.closeModal();
      await this.loadOwners();
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

  async importProducts(drafts: ProductImportDraft[]): Promise<void> {
    const businessId = this.businessContext.activeBusiness()?.id;
    if (!businessId || !drafts.length) return;
    this.loading.set(true);
    try {
      const categoryMap = new Map(this.categoryService.categories().filter(item=>item.businessId===businessId).map(item=>[item.name.trim().toLowerCase(),item.id]));
      for (const name of [...new Set(drafts.map(item=>item.categoryName.trim()).filter(Boolean))]) {
        if (!categoryMap.has(name.toLowerCase())) {
          await this.categoryService.create({businessId,name,description:'Creada desde importación Excel',status:'active'});
          const created = this.categoryService.categories().find(item=>item.businessId===businessId&&item.name.trim().toLowerCase()===name.toLowerCase());
          if (created) categoryMap.set(name.toLowerCase(),created.id);
        }
      }
      const brandMap = new Map(this.brandService.brands().filter(item=>item.businessId===businessId).map(item=>[item.name.trim().toLowerCase(),item.id]));
      for (const name of [...new Set(drafts.map(item=>item.brandName.trim()).filter(Boolean))]) {
        if (!brandMap.has(name.toLowerCase())) {
          await this.brandService.create({businessId,name,description:'Creada desde importación Excel',status:'active'});
          const created = this.brandService.brands().find(item=>item.businessId===businessId&&item.name.trim().toLowerCase()===name.toLowerCase());
          if (created) brandMap.set(name.toLowerCase(),created.id);
        }
      }
      const ownerMap = new Map(this.owners().map(owner=>[owner.name.trim().toLowerCase(),owner.id]));
      for (const name of [...new Set(drafts.flatMap(item=>item.variants.map(variant=>variant.ownerName.trim())).filter(Boolean))]) {
        if (!ownerMap.has(name.toLowerCase())) {
          const [firstName,...lastParts] = name.split(/\s+/);
          const created = await this.data.create<{id:string}>('owners',{
            first_name:firstName||'Stock',last_name:lastParts.join(' ')||'Principal',participation_percentage:null,active:true,
          });
          ownerMap.set(name.toLowerCase(),created.id);
        }
      }
      const products: Product[] = drafts.map(draft=>({
        id:crypto.randomUUID(),businessId,name:draft.name,sku:draft.sku,internalCode:draft.internalCode,barcode:draft.barcode,
        description:draft.description,categoryId:categoryMap.get(draft.categoryName.trim().toLowerCase())??'',brandId:brandMap.get(draft.brandName.trim().toLowerCase())??'',
        purchasePrice:draft.purchasePrice,salePrice:draft.salePrice,promotionalPrice:draft.promotionalPrice,
        margin:this.productService.calculateMargin(draft.purchasePrice,draft.salePrice),minStock:draft.minStock,maxStock:draft.maxStock,status:draft.status,
        images:[],createdAt:new Date().toISOString(),variants:draft.variants.map(variant=>({...variant,name:`${variant.color} / ${variant.size}`,ownerId:ownerMap.get(variant.ownerName.trim().toLowerCase())??''})),
      }));
      const result = await this.productService.importMany(products);
      if (result.created) {
        this.importOpen.set(false);
        await this.loadOwners();
        this.toast.show({title:`${result.created} producto(s) importado(s)`,description:'Se generaron variantes, códigos de barras y etiquetas automáticamente.',variant:result.errors.length?'warning':'success'});
      }
      if (result.errors.length) this.toast.show({title:`${result.errors.length} producto(s) no se importaron`,description:result.errors.slice(0,3).join(' · '),variant:'danger'});
    } catch (error) {
      this.toast.show({title:'No se pudo completar la importación',description:error instanceof Error?error.message:'Error inesperado',variant:'danger'});
    } finally {
      this.loading.set(false);
    }
  }

  async deleteProduct(product: Product): Promise<void> {
    if (!this.canDelete()) return;
    if (!confirm(`¿Borrar “${product.name}” del catálogo? Sus operaciones históricas se conservarán.`)) return;

    this.loading.set(true);
    try {
      await this.productService.remove(product.id);
      this.toast.show({
        title: 'Producto borrado',
        description: `${product.name} ya no aparece en el catálogo. Su historial quedó conservado.`,
        variant: 'success',
      });
    } catch (error) {
      this.toast.show({
        title: 'No se pudo borrar el producto',
        description: error instanceof Error ? error.message : 'Error inesperado',
        variant: 'danger',
      });
    } finally {
      this.loading.set(false);
    }
  }

  categoryName(categoryId: string): string {
    return this.categories().find((item) => item.id === categoryId)?.name ?? 'Sin categoría';
  }

  brandName(brandId: string): string {
    return this.brands().find((item) => item.id === brandId)?.name ?? 'Sin marca';
  }
}
