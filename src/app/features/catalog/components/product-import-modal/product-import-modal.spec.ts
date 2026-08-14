import { TestBed } from '@angular/core/testing';
import { ProductImportModalComponent } from './product-import-modal';

describe('ProductImportModalComponent', () => {
  it('groups Excel rows into products and generates unique codes', async () => {
    await TestBed.configureTestingModule({ imports: [ProductImportModalComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ProductImportModalComponent);
    const component = fixture.componentInstance;
    const header = [
      'Grupo producto *','Nombre producto *','Descripción','Categoría (opcional)','Marca (opcional)',
      'Precio compra','Precio venta *','Precio promocional','Stock mínimo','Stock máximo','Stock inicial','Dueño mercadería (opcional)','Color','Talle',
      'SKU producto (auto)','Código interno (auto)','Código barras producto (auto)','SKU variante (auto)','Código barras variante (auto)','Estado',
    ];
    (component as any).parseRows([
      header,
      ['REM-OVER','Remera Oversize','','','',100,250,'',1,10,5,'Stock Principal','Negro','M','','','','','','ACTIVO'],
      ['REM-OVER','Remera Oversize','','','',100,250,'',1,10,3,'Stock Principal','Blanco','L','','','','','','ACTIVO'],
    ]);

    expect(component.errors()).toEqual([]);
    expect(component.drafts()).toHaveLength(1);
    expect(component.drafts()[0].variants).toHaveLength(2);
    expect(component.drafts()[0].variants[0].stock).toBe(5);
    expect(component.drafts()[0].sku).toContain('REM-OVER');
    expect(component.drafts()[0].variants[0].sku).not.toBe(component.drafts()[0].variants[1].sku);
    expect(component.drafts()[0].variants[0].barcode).not.toBe(component.drafts()[0].variants[1].barcode);
  });
});
