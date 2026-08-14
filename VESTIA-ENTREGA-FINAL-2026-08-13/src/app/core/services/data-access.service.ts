import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface PageQuery { page?:number; pageSize?:number; search?:string; active?:boolean; }

@Injectable({providedIn:'root'})
export class DataAccessService {
  private readonly client=inject(SupabaseService).client;

  async list<T>(table:string, query:PageQuery={}) {
    const page=query.page??1, size=query.pageSize??25;
    let request=this.client.from(table).select('*',{count:'exact'}).range((page-1)*size,page*size-1);
    if(query.search) request=request.ilike('name',`%${query.search}%`);
    if(query.active!==undefined) request=request.eq('active',query.active);
    const {data,error,count}=await request;
    if(error) throw error;
    return {items:(data??[]) as T[],total:count??0};
  }
  async create<T>(table:string,value:Record<string,unknown>):Promise<T>{ const {data:businessId,error:businessError}=await this.client.rpc('current_business_id');if(businessError)throw businessError;const {data,error}=await this.client.from(table).insert({...value,business_id:businessId}).select().single(); if(error) throw error; return data as T; }
  async update<T>(table:string,id:string,value:Record<string,unknown>):Promise<T>{ const {data,error}=await this.client.from(table).update(value).eq('id',id).select().single(); if(error) throw error; return data as T; }
}
