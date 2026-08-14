import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SaleDetail, SaleListRow } from '../../../../core/models/domain.model';
import { PermissionService } from '../../../../core/services/permission.service';
import { SaleService } from '../../../../core/services/sale.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({selector:'app-sales-page',imports:[FormsModule,CurrencyPipe,DatePipe],templateUrl:'./sales-page.html',styleUrl:'./sales-page.css'})
export class SalesPageComponent implements OnInit {
  private readonly service=inject(SaleService);private readonly permissions=inject(PermissionService);private readonly toast=inject(ToastService);
  readonly rows=signal<SaleListRow[]>([]);readonly detail=signal<SaleDetail|null>(null);readonly loading=signal(false);readonly canCancel=computed(()=>this.permissions.hasPermission('sales.cancel'));
  search='';status='ALL';from=new Date(new Date().setDate(1)).toISOString().slice(0,10);to=new Date().toISOString().slice(0,10);
  readonly filtered=computed(()=>{const term=this.search.trim().toLowerCase(),fromTime=new Date(`${this.from}T00:00:00`).getTime(),toTime=new Date(`${this.to}T23:59:59`).getTime();return this.rows().filter(row=>{const created=new Date(row.created_at).getTime();return(!term||String(row.sale_number).includes(term)||`${row.customers?.first_name??''} ${row.customers?.last_name??''}`.toLowerCase().includes(term))&&(this.status==='ALL'||row.status===this.status)&&created>=fromTime&&created<=toTime;});});
  async ngOnInit(){await this.load();}
  async load(){this.loading.set(true);try{this.rows.set(await this.service.recent());}catch(error){this.fail('No se pudieron cargar las ventas',error);}finally{this.loading.set(false);}}
  async open(row:SaleListRow){this.loading.set(true);try{this.detail.set(await this.service.detail(row.id));}catch(error){this.fail('No se pudo cargar el comprobante',error);}finally{this.loading.set(false);}}
  close(){this.detail.set(null);}
  async cancel(){const sale=this.detail();if(!sale||sale.status!=='COMPLETED')return;const reason=window.prompt('Indicá el motivo de la anulación:')?.trim();if(!reason)return;if(!confirm(`¿Confirmás la anulación de la venta #${sale.sale_number}? Se restituirá el stock y se revertirán los pagos.`))return;this.loading.set(true);try{await this.service.cancel(sale.id,reason);this.detail.set(await this.service.detail(sale.id));await this.load();this.toast.show({title:'Venta anulada',description:'Stock, caja y auditoría fueron actualizados.',variant:'success'});}catch(error){this.fail('No se pudo anular la venta',error);}finally{this.loading.set(false);}}
  print(){window.print();}
  statusLabel(status:SaleListRow['status']){return({COMPLETED:'Completada',CANCELLED:'Anulada',RETURNED:'Devuelta',PARTIALLY_RETURNED:'Devolución parcial'})[status];}
  private fail(title:string,error:unknown){this.toast.show({title,description:error instanceof Error?error.message:'Error inesperado',variant:'danger'});}
}
