import { TestBed } from '@angular/core/testing';
import { StorageService } from '../../../../core/services/storage.service';
import { ProductFormModalComponent } from './product-form-modal';

describe('ProductFormModalComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductFormModalComponent],
      providers: [{ provide: StorageService, useValue: { uploadProductImage: async () => ({ publicUrl: '', path: '' }) } }],
    }).compileComponents();
  });

  it('advances and saves when there are no categories or brands', () => {
    const fixture = TestBed.createComponent(ProductFormModalComponent);
    const component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('categories', []);
    fixture.componentRef.setInput('brands', []);
    fixture.detectChanges();

    component.form.patchValue({
      name: 'Remera prueba',
      sku: 'REM-001',
      internalCode: 'INT-001',
      barcode: '200000000001',
      categoryId: '',
      brandId: '',
      purchasePrice: 100,
      salePrice: 250,
      minStock: 1,
      maxStock: 10,
    });

    component.nextOrSubmit();
    fixture.detectChanges();
    expect(component.step()).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Variantes del producto');
    expect(component.variantsArray.at(0).get('barcode')?.value).toBe('200000000001');

    component.addVariant();
    const secondVariant = component.variantsArray.at(1);
    expect(secondVariant.get('sku')?.value).toBe('REM-001-V02');
    expect(secondVariant.get('barcode')?.value).toBe('200000000002');
    expect(secondVariant.get('cost')?.value).toBe(100);
    expect(secondVariant.get('price')?.value).toBe(250);
    secondVariant.patchValue({ color: 'Blanco', size: 'L' });

    secondVariant.get('barcode')?.setValue('200000000001');
    component.nextOrSubmit();
    expect(component.step()).toBe(2);
    expect(component.validationError()).toContain('otro código de barras');
    secondVariant.get('barcode')?.setValue('200000000002');

    component.nextOrSubmit();
    fixture.detectChanges();
    expect(component.step()).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Al guardar se crearán las etiquetas CODE128');

    let savedName = '';
    component.saved.subscribe(value => savedName = value.name);
    component.nextOrSubmit();
    expect(savedName).toBe('Remera prueba');
  });

  it('generates SKU, internal code and barcode', () => {
    const fixture = TestBed.createComponent(ProductFormModalComponent);
    const component = fixture.componentInstance;
    component.form.controls.name.setValue('Camisa lino');
    component.generateCodes();
    expect(component.form.controls.sku.value).toContain('CAMISA-LINO');
    expect(component.form.controls.internalCode.value).toContain('CAMISA-LINO');
    expect(component.form.controls.barcode.value).toMatch(/^2\d{12}$/);
  });
});
