import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { publicGuard } from './core/guards/public.guard';
import { roleGuard } from './core/guards/role.guard';
import { platformOwnerGuard } from './core/guards/platform-owner.guard';
import { LoginPageComponent } from './features/auth/pages/login-page/login-page';
import { BrandsPageComponent } from './features/catalog/pages/brands-page/brands-page';
import { CategoriesPageComponent } from './features/catalog/pages/categories-page/categories-page';
import { ProductsPageComponent } from './features/catalog/pages/products-page/products-page';
import { DashboardHomePageComponent } from './features/dashboard/pages/dashboard-home-page/dashboard-home-page';
import { LandingPageComponent } from './features/landing/pages/landing-page/landing-page';
import { UsersPageComponent } from './features/users/pages/users-page/users-page';
import { EntityPageComponent } from './features/management/pages/entity-page/entity-page';
import { InventoryPageComponent } from './features/inventory/pages/inventory-page/inventory-page';
import { SalesPageComponent } from './features/sales/pages/sales-page/sales-page';
import { CashPageComponent } from './features/cash/pages/cash-page/cash-page';
import { PurchasesPageComponent } from './features/purchases/pages/purchases-page/purchases-page';
import { ReturnsPageComponent } from './features/returns/pages/returns-page/returns-page';
import { AuditPageComponent } from './features/audit/pages/audit-page/audit-page';
import { SettingsPageComponent } from './features/settings/pages/settings-page/settings-page';
import { PasswordPageComponent } from './features/auth/pages/password-page/password-page';
import { DashboardLayoutComponent } from './layouts/dashboard-layout/dashboard-layout';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout';

export const routes: Routes = [
  {path:'platform/comercios',loadComponent:()=>import('./features/platform/pages/business-provisioning-page/business-provisioning-page').then(m=>m.BusinessProvisioningPageComponent),canActivate:[authGuard,platformOwnerGuard],title:'VESTIA | Comercios'},
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '',
        component: LandingPageComponent,
        title: 'VESTIA — Gestión inteligente para tu comercio',
      },
      {
        path: 'login',
        component: LoginPageComponent,
        canActivate: [publicGuard],
        title: 'VESTIA | Ingresar',
      },
      {path:'recuperar-clave',component:PasswordPageComponent,data:{mode:'reset'},title:'VESTIA | Recuperar clave'},
      {path:'nueva-clave',component:PasswordPageComponent,data:{mode:'update'},title:'VESTIA | Nueva clave'},
    ],
  },
  {
    path: 'app',
    component: DashboardLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardHomePageComponent, title: 'VESTIA | Dashboard' },
      {
        path: 'productos',
        component: ProductsPageComponent,
        canActivate: [permissionGuard],
        data: { permissions: ['products.read'] },
        title: 'VESTIA | Productos',
      },
      {
        path: 'categorias',
        component: CategoriesPageComponent,
        canActivate: [permissionGuard],
        data: { permissions: ['products.read'] },
        title: 'VESTIA | Categorías',
      },
      {
        path: 'marcas',
        component: BrandsPageComponent,
        canActivate: [permissionGuard],
        data: { permissions: ['products.read'] },
        title: 'VESTIA | Marcas',
      },
      {
        path: 'usuarios',
        component: UsersPageComponent,
        canActivate: [permissionGuard],
        data: { permissions: ['users.read'] },
        title: 'VESTIA | Usuarios',
      },
      { path: 'inventario', component: InventoryPageComponent, canActivate:[permissionGuard], data:{permissions:['stock.read']}, title:'VESTIA | Inventario' },
      { path: 'pos', loadComponent:()=>import('./features/pos/pages/pos-page/pos-page').then(m=>m.PosPageComponent), canActivate:[permissionGuard], data:{permissions:['sales.create']}, title:'VESTIA | POS' },
      { path: 'ventas', component: SalesPageComponent, canActivate:[permissionGuard], data:{permissions:['sales.read']}, title:'VESTIA | Ventas' },
      { path: 'caja', component: CashPageComponent, title:'VESTIA | Caja' },
      { path: 'compras', component: PurchasesPageComponent, canActivate:[roleGuard], data:{roles:['OWNER']}, title:'VESTIA | Compras' },
      { path: 'devoluciones', component: ReturnsPageComponent, canActivate:[permissionGuard], data:{permissions:['returns.create']}, title:'VESTIA | Devoluciones' },
      { path: 'cambios', loadComponent:()=>import('./features/exchanges/pages/exchanges-page/exchanges-page').then(m=>m.ExchangesPageComponent), canActivate:[permissionGuard], data:{permissions:['exchanges.create']}, title:'VESTIA | Cambios' },
      { path: 'reportes', loadComponent:()=>import('./features/reports/pages/reports-page/reports-page').then(m=>m.ReportsPageComponent), canActivate:[roleGuard], data:{roles:['OWNER']}, title:'VESTIA | Reportes' },
      { path: 'auditoria', component: AuditPageComponent, canActivate:[roleGuard], data:{roles:['OWNER']}, title:'VESTIA | Auditoría' },
      { path: 'configuracion', component: SettingsPageComponent, canActivate:[roleGuard], data:{roles:['OWNER']}, title:'VESTIA | Configuración' },
      { path: 'etiquetas', loadComponent:()=>import('./features/labels/pages/labels-page/labels-page').then(m=>m.LabelsPageComponent), canActivate:[roleGuard], data:{roles:['OWNER']}, title:'VESTIA | Etiquetas' },
      { path: 'operaciones', loadComponent:()=>import('./features/operations/pages/operations-page/operations-page').then(m=>m.OperationsPageComponent), canActivate:[roleGuard], data:{roles:['OWNER']}, title:'VESTIA | Operaciones' },
      { path: 'duenos', component: EntityPageComponent, canActivate:[roleGuard], data:{roles:['OWNER'],config:{title:'Dueños',singular:'dueño',table:'owners',fields:[{key:'first_name',label:'Nombre',required:true},{key:'last_name',label:'Apellido',required:true},{key:'document',label:'Documento'},{key:'phone',label:'Teléfono'},{key:'email',label:'Email',type:'email'},{key:'address',label:'Dirección'},{key:'participation_percentage',label:'Participación %',type:'number'}]}}, title:'VESTIA | Dueños' },
      { path: 'proveedores', component: EntityPageComponent, canActivate:[roleGuard], data:{roles:['OWNER'],config:{title:'Proveedores',singular:'proveedor',table:'suppliers',fields:[{key:'name',label:'Nombre',required:true},{key:'legal_name',label:'Razón social'},{key:'tax_id',label:'CUIT'},{key:'phone',label:'Teléfono'},{key:'email',label:'Email',type:'email'},{key:'address',label:'Dirección'},{key:'contact_name',label:'Contacto'},{key:'notes',label:'Notas',type:'textarea'}]}}, title:'VESTIA | Proveedores' },
      { path: 'clientes', component: EntityPageComponent, data:{config:{title:'Clientes',singular:'cliente',table:'customers',fields:[{key:'first_name',label:'Nombre',required:true},{key:'last_name',label:'Apellido'},{key:'document',label:'DNI'},{key:'phone',label:'Teléfono'},{key:'email',label:'Email',type:'email'},{key:'address',label:'Dirección'},{key:'notes',label:'Notas',type:'textarea'}]}}, title:'VESTIA | Clientes' },
      { path: 'talles', component: EntityPageComponent, canActivate:[roleGuard], data:{roles:['OWNER'],config:{title:'Talles',singular:'talle',table:'sizes',fields:[{key:'name',label:'Nombre',required:true},{key:'sort_order',label:'Orden',type:'number'}]}}, title:'VESTIA | Talles' },
      { path: 'colores', component: EntityPageComponent, canActivate:[roleGuard], data:{roles:['OWNER'],config:{title:'Colores',singular:'color',table:'colors',fields:[{key:'name',label:'Nombre',required:true},{key:'hex_code',label:'Código hexadecimal'}]}}, title:'VESTIA | Colores' },
    ],
  },
  { path: 'dashboard', redirectTo: 'app', pathMatch: 'full' },
  { path: 'usuarios', redirectTo: 'app/usuarios', pathMatch: 'full' },
  { path: 'productos', redirectTo: 'app/productos', pathMatch: 'full' },
  { path: 'categorias', redirectTo: 'app/categorias', pathMatch: 'full' },
  { path: 'marcas', redirectTo: 'app/marcas', pathMatch: 'full' },
  { path: '**', redirectTo: '' },
];
