import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ExpenseRecord } from '../models/domain.model';
export interface CashSummary { opening:number;expectedCash:number;sales:number;income:number;expenses:number;withdrawals:number;refunds:number;payments:{name:string;amount:number}[]; }
export interface CashCloseReport { id:string;register_name:string;closed_at:string;opening_amount:number;expected_amount:number;counted_amount:number;difference:number;total_sales:number;total_income:number;total_expenses:number;total_withdrawals:number;total_refunds:number;payments_breakdown:{name:string;amount:number}[];notes:string; }
@Injectable({providedIn:'root'})
export class CashService {
  private readonly client=inject(SupabaseService).client;
  async open(registerId:string,amount:number){const{data,error}=await this.client.rpc('open_cash_register',{p_register_id:registerId,p_opening:amount});if(error)throw error;return data as string;}
  async close(sessionId:string,counted:number,notes=''){const{error}=await this.client.rpc('close_cash_register',{p_session:sessionId,p_counted:counted,p_notes:notes});if(error)throw error;}
  async current(){const{data,error}=await this.client.from('cash_sessions').select('*,cash_registers(name)').eq('status','OPEN').order('opened_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data;}
  async summary(sessionId:string):Promise<CashSummary>{const{data,error}=await this.client.rpc('cash_session_summary',{p_session:sessionId});if(error)throw error;return data as CashSummary;}
  async registerExpense(input:{sessionId:string;concept:string;category:string;amount:number;paymentMethodId:string|null;ownerId:string|null;notes:string;occurredAt:string}){const{data,error}=await this.client.rpc('register_expense',{p_session:input.sessionId,p_concept:input.concept,p_category:input.category,p_amount:input.amount,p_payment_method:input.paymentMethodId,p_owner:input.ownerId,p_notes:input.notes,p_occurred_at:input.occurredAt});if(error)throw error;return data as string;}
  async recentExpenses():Promise<ExpenseRecord[]>{const{data,error}=await this.client.from('expenses').select('id,category,concept,amount,occurred_at,notes,owners(first_name,last_name),payment_methods(name)').order('occurred_at',{ascending:false}).limit(50);if(error)throw error;return (data??[]) as unknown as ExpenseRecord[];}
  async closeReports(limit=50):Promise<CashCloseReport[]>{const{data,error}=await this.client.rpc('get_cash_close_reports',{p_limit:limit,p_offset:0});if(error)throw error;return (data??[]) as CashCloseReport[];}
}
