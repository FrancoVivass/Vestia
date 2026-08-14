import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Category } from '../../../../core/models/category.model';
import { Brand } from '../../../../core/models/brand.model';
import { Product } from '../../../../core/models/product.model';
import { DrawerComponent } from '../../../../shared/ui/drawer/drawer';

@Component({
  selector: 'app-product-detail-drawer',
  imports: [DrawerComponent],
  templateUrl: './product-detail-drawer.html',
  styleUrl: './product-detail-drawer.css',
})
export class ProductDetailDrawerComponent {
  @Input() open = false;
  @Input() product: Product | null = null;
  @Input() categories: Category[] = [];
  @Input() brands: Brand[] = [];
  @Output() readonly closed = new EventEmitter<void>();

  get categoryName(): string {
    return this.categories.find((item) => item.id === this.product?.categoryId)?.name ?? 'Sin categoría';
  }

  get brandName(): string {
    return this.brands.find((item) => item.id === this.product?.brandId)?.name ?? 'Sin marca';
  }
}
