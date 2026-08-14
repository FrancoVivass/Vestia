import { InventoryRow } from '../models/domain.model';
import { filterInventoryRows } from './inventory.service';

describe('POS inventory search', () => {
  const row: InventoryRow = {
    variantId: 'variant',
    productName: 'Remera Oversize',
    internalCode: 'INT-REM-01',
    productBarcode: '200000000001',
    sku: 'REM-OVERS-V02',
    barcode: '200000000002',
    size: 'L',
    color: 'Bordó',
    ownerId: 'owner',
    ownerName: 'Dueño Principal',
    quantity: 5,
    minimumStock: 1,
    price: 25000,
  };

  it('finds a product through every supported POS search mode', () => {
    expect(filterInventoryRows([row], 'remera oversize', 'name')).toEqual([row]);
    expect(filterInventoryRows([row], 'REM-OVERS-V02', 'sku')).toEqual([row]);
    expect(filterInventoryRows([row], 'INT-REM-01', 'internal')).toEqual([row]);
    expect(filterInventoryRows([row], '200000000002', 'barcode')).toEqual([row]);
    expect(filterInventoryRows([row], 'bordo L', 'all')).toEqual([row]);
    expect(filterInventoryRows([row], 'inexistente', 'all')).toEqual([]);
  });
});
