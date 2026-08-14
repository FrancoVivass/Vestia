import { Injectable, computed, inject, signal } from '@angular/core';
import { PERMISSIONS, Permission } from '../models/permission.model';
import { Role } from '../models/role.model';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

const CASHIER_PERMISSIONS = [
  'sales.create','sales.read','products.read','stock.read','customers.create','customers.read',
  'cash.read','cash.open','cash.close',
];

@Injectable({providedIn:'root'})
export class PermissionService {
  private readonly authService=inject(AuthService);
  private readonly client=inject(SupabaseService).client;
  private readonly cashierReturns=signal(false);
  readonly permissions=PERMISSIONS;
  readonly roles=computed<Role[]>(()=>[
    {id:'r-owner',name:'DUEÑO',code:'OWNER',description:'Acceso completo al comercio.',permissions:this.permissions.map(permission=>permission.code)},
    {id:'r-cashier',name:'CAJERO',code:'CASHIER',description:'Acceso operativo al POS y a su caja.',permissions:CASHIER_PERMISSIONS},
  ]);
  readonly groupedPermissions=computed<Record<string,Permission[]>>(()=>this.permissions.reduce<Record<string,Permission[]>>((groups,permission)=>{const group=permission.group??'General';groups[group]??=[];groups[group].push(permission);return groups;},{}));

  constructor(){void this.loadOperationalSettings();}
  getCurrentRoleCode(){return String(this.authService.user()?.user_metadata['role']??'CASHIER').toUpperCase();}
  getCurrentPermissions(){const explicit=this.authService.user()?.user_metadata['permissions'];if(Array.isArray(explicit)&&explicit.every(value=>typeof value==='string'))return explicit;return this.roles().find(role=>role.code===this.getCurrentRoleCode())?.permissions??[];}
  hasPermission(code:string){return this.isSuperAdmin()||this.getCurrentPermissions().includes(code)||(this.cashierReturns()&&['returns.create','exchanges.create'].includes(code));}
  hasAnyPermission(codes:string[]){return codes.some(code=>this.hasPermission(code));}
  hasRole(code:string){return this.getCurrentRoleCode()===code.toUpperCase();}
  isSuperAdmin(){return this.getCurrentRoleCode()==='OWNER';}
  getRolePermissions(code:string){return this.roles().find(role=>role.code===code.toUpperCase())?.permissions??[];}
  private async loadOperationalSettings(){const{data}=await this.client.from('app_settings').select('allow_cashier_returns').maybeSingle();this.cashierReturns.set(data?.allow_cashier_returns===true);}
}
