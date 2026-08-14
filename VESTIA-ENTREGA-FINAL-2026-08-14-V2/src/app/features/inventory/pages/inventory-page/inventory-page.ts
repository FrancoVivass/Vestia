import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InventoryRow } from '../../../../core/models/domain.model';
import { InventoryService } from '../../../../core/services/inventory.service';
@Component({selector:'app-inventory-page',imports:[FormsModule],templateUrl:'./inventory-page.html',styleUrl:'./inventory-page.css'}) export class InventoryPageComponent implements OnInit{private readonly service=inject(InventoryService);readonly rows=signal<InventoryRow[]>([]);readonly loading=signal(false);search='';async ngOnInit(){await this.load();}async load(){this.loading.set(true);try{this.rows.set(await this.service.list(this.search));}finally{this.loading.set(false);}}state(r:InventoryRow){return r.quantity===0?'SIN STOCK':r.quantity<=r.minimumStock?'STOCK BAJO':'EN STOCK';}total(){return this.rows().reduce((sum,row)=>sum+row.quantity,0);}}
