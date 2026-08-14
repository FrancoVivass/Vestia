import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CashSummary, CashService } from '../../../../core/services/cash.service';
import { AuthService } from '../../../../core/services/auth.service';
import { InventoryRow, SaleListRow } from '../../../../core/models/domain.model';
import { InventoryService } from '../../../../core/services/inventory.service';
import { DashboardMetrics, OwnerSalesRow, ReportService } from '../../../../core/services/report.service';
import { SaleService } from '../../../../core/services/sale.service';
import { ButtonComponent } from '../../../../shared/ui/button/button';
import { CardComponent } from '../../../../shared/ui/card/card';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state';

interface ChartPoint{date:string;amount:number;width:number}

@Component({selector:'app-dashboard-home-page',imports:[CardComponent,ButtonComponent,EmptyStateComponent,CurrencyPipe,DatePipe],templateUrl:'./dashboard-home-page.html',styleUrl:'./dashboard-home-page.css'})
export class DashboardHomePageComponent implements OnInit {
  private readonly auth=inject(AuthService);private readonly reports=inject(ReportService);private readonly inventoryService=inject(InventoryService);private readonly salesService=inject(SaleService);private readonly cash=inject(CashService);readonly router=inject(Router);
  readonly metrics=signal<DashboardMetrics|null>(null);readonly inventory=signal<InventoryRow[]>([]);readonly recentSales=signal<SaleListRow[]>([]);readonly ownerSales=signal<OwnerSalesRow[]>([]);readonly cashSummary=signal<CashSummary|null>(null);readonly loading=signal(false);
  readonly currentUserEmail=computed(()=>this.auth.user()?.email??'');readonly outOfStock=computed(()=>this.inventory().filter(row=>row.quantity===0).length);readonly lowStock=computed(()=>this.inventory().filter(row=>row.quantity>0&&row.quantity<=row.minimumStock).slice(0,8));readonly unitsSold=computed(()=>this.ownerSales().reduce((sum,row)=>sum+Number(row.units),0));readonly estimatedProfit=computed(()=>this.ownerSales().reduce((sum,row)=>sum+Number(row.estimated_profit),0));
  readonly chart=computed<ChartPoint[]>(()=>{const days=new Map<string,number>();for(let offset=6;offset>=0;offset--){const date=new Date();date.setDate(date.getDate()-offset);days.set(date.toISOString().slice(0,10),0);}for(const row of this.ownerSales()){const key=row.sale_day.slice(0,10);if(days.has(key))days.set(key,(days.get(key)??0)+Number(row.gross_sales));}const max=Math.max(...days.values(),1);return[...days].map(([date,amount])=>({date,amount,width:Math.max(3,Math.round(amount/max*100))}));});
  async ngOnInit(){await this.load();}
  async load(){this.loading.set(true);try{const from=new Date();from.setDate(from.getDate()-6);const to=new Date().toISOString().slice(0,10);const[metrics,inventory,recentSales,ownerSales,session]=await Promise.all([this.reports.dashboard(),this.inventoryService.list(),this.salesService.recent(),this.reports.owners(from.toISOString().slice(0,10),to),this.cash.current()]);this.metrics.set(metrics);this.inventory.set(inventory);this.recentSales.set(recentSales.slice(0,8));this.ownerSales.set(ownerSales);this.cashSummary.set(session?await this.cash.summary(session.id):null);}finally{this.loading.set(false);}}
}
