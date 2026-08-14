import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OwnerSettlement } from '../../../../core/models/domain.model';
import { DataAccessService } from '../../../../core/services/data-access.service';
import { OwnerSalesRow, ReportService } from '../../../../core/services/report.service';
import { ToastService } from '../../../../core/services/toast.service';

interface OwnerOption{id:string;first_name:string;last_name:string}
interface StoredSettlement{id:string;date_from:string;date_to:string;gross_sales:number;cost:number;returns_amount:number;expenses:number;net_amount:number;created_at:string;owners:{first_name:string;last_name:string}}

@Component({selector:'app-reports-page',imports:[FormsModule,CurrencyPipe,DatePipe],templateUrl:'./reports-page.html',styleUrl:'./reports-page.css'})
export class ReportsPageComponent implements OnInit {
  private readonly reports=inject(ReportService);private readonly data=inject(DataAccessService);private readonly toast=inject(ToastService);
  readonly rows=signal<OwnerSalesRow[]>([]);readonly owners=signal<OwnerOption[]>([]);readonly settlement=signal<OwnerSettlement|null>(null);readonly history=signal<StoredSettlement[]>([]);readonly loading=signal(false);
  from=new Date(new Date().setDate(1)).toISOString().slice(0,10);to=new Date().toISOString().slice(0,10);ownerId='';
  async ngOnInit(){await this.loadInitial();}
  async loadInitial(){this.loading.set(true);try{const[rows,owners,history]=await Promise.all([this.reports.owners(this.from,this.to),this.data.list<OwnerOption>('owners',{pageSize:200,active:true}),this.reports.settlements()]);this.rows.set(rows);this.owners.set(owners.items);this.history.set(history as unknown as StoredSettlement[]);if(!this.ownerId&&owners.items.length)this.ownerId=owners.items[0].id;}catch(error){this.fail(error);}finally{this.loading.set(false);}}
  async load(){this.loading.set(true);try{this.rows.set(await this.reports.owners(this.from,this.to));}catch(error){this.fail(error);}finally{this.loading.set(false);}}
  async calculate(){if(!this.ownerId){this.toast.show({title:'Seleccioná un dueño',variant:'warning'});return;}if(!confirm('¿Generar y guardar la liquidación para el período seleccionado?'))return;this.loading.set(true);try{this.settlement.set(await this.reports.createSettlement(this.ownerId,this.from,this.to));this.history.set(await this.reports.settlements() as unknown as StoredSettlement[]);this.toast.show({title:'Liquidación generada',description:'El resultado quedó guardado y auditado.',variant:'success'});}catch(error){this.fail(error);}finally{this.loading.set(false);}}
  print(){window.print();}
  exportCsv(){
    const quote=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`;
    const lines=[
      ['Fecha','Dueño','Unidades netas','Ventas netas','Costo neto','Ganancia bruta'],
      ...this.rows().map(row=>[row.sale_day,`${row.owner_first_name} ${row.owner_last_name}`,row.units,row.gross_sales,row.cost,row.estimated_profit]),
    ].map(row=>row.map(quote).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([`\uFEFF${lines}`],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`reporte-vestia-${this.from}-${this.to}.csv`;link.click();URL.revokeObjectURL(url);
  }
  private fail(error:unknown){this.toast.show({title:'No se pudo generar el reporte',description:error instanceof Error?error.message:'Error inesperado',variant:'danger'});}
}
