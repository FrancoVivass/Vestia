import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DataAccessService } from '../../../../core/services/data-access.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ModalComponent } from '../../../../shared/ui/modal/modal';

interface Field { key:string; label:string; type?:'text'|'email'|'number'|'date'|'textarea'; required?:boolean }
interface Config { title:string; singular:string; table:string; fields:Field[]; ownerOnly?:boolean }

@Component({selector:'app-entity-page',imports:[FormsModule,ModalComponent],templateUrl:'./entity-page.html',styleUrl:'./entity-page.css'})
export class EntityPageComponent implements OnInit {
  private readonly route=inject(ActivatedRoute);private readonly data=inject(DataAccessService);private readonly toast=inject(ToastService);
  readonly config=signal<Config>({title:'',singular:'',table:'',fields:[]});readonly rows=signal<Record<string,unknown>[]>([]);readonly loading=signal(false);readonly open=signal(false);readonly form=signal<Record<string,unknown>>({});readonly editingId=signal<string|null>(null);
  async ngOnInit(){this.config.set(this.route.snapshot.data['config'] as Config);await this.load();}
  async load(){this.loading.set(true);try{const result=await this.data.list<Record<string,unknown>>(this.config().table,{pageSize:100});this.rows.set(result.items);}catch(error){this.toast.show({title:'No se pudieron cargar los datos',description:this.message(error),variant:'danger'});}finally{this.loading.set(false);}}
  start(row?:Record<string,unknown>){this.editingId.set(row?String(row['id']):null);this.form.set(Object.fromEntries(this.config().fields.map(field=>[field.key,row?.[field.key]??''])));this.open.set(true);}
  close(){this.open.set(false);this.editingId.set(null);}
  update(key:string,value:unknown){this.form.update(current=>({...current,[key]:value}));}
  async save(){const cfg=this.config(),value=this.form();if(cfg.fields.some(field=>field.required&&!String(value[field.key]??'').trim())){this.toast.show({title:'Completá los campos obligatorios',variant:'warning'});return;}this.loading.set(true);try{const id=this.editingId();if(id)await this.data.update(cfg.table,id,value);else await this.data.create(cfg.table,{...value,active:true});this.close();await this.load();this.toast.show({title:`${cfg.singular} ${id?'actualizado':'guardado'}`,variant:'success'});}catch(error){this.toast.show({title:'No se pudo guardar',description:this.message(error),variant:'danger'});}finally{this.loading.set(false);}}
  async toggle(row:Record<string,unknown>){const active=Boolean(row['active']);if(!confirm(`¿Confirmás ${active?'desactivar':'activar'} este registro?`))return;try{await this.data.update(this.config().table,String(row['id']),{active:!active});await this.load();}catch(error){this.toast.show({title:'No se pudo actualizar',description:this.message(error),variant:'danger'});}}
  label(field:Field,row:Record<string,unknown>){const value=row[field.key];return value===null||value===''?'—':String(value);}
  private message(error:unknown){if(error instanceof Error)return error.message;if(error&&typeof error==='object'&&'message'in error)return String((error as{message:unknown}).message);return'Verificá la conexión con Supabase.';}
}
