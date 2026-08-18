import { Injectable, inject } from '@angular/core';
import { OwnerSettlement } from '../models/domain.model';
import { SupabaseService } from './supabase.service';

export interface DashboardMetrics { today_sales: number; month_sales: number; total_stock: number; low_stock: number; }
export interface OwnerSalesRow { owner_id: string; owner_first_name: string; owner_last_name: string; sale_day: string; gross_sales: number; cost: number; estimated_profit: number; units: number; }

export interface SalesSummary {
  total_sales: number;
  total_cost: number;
  total_returns: number;
  total_expenses: number;
  sale_count: number;
  total_units: number;
  avg_ticket: number;
}

export interface SalesByDay {
  sale_date: string;
  amount: number;
  count: number;
}

export interface TopProduct {
  product_name: string;
  variant_name: string;
  total_quantity: number;
  total_revenue: number;
}

export interface PaymentMethodBreakdown {
  method_name: string;
  amount: number;
  count: number;
}

export interface StockAlert {
  product_name: string;
  variant_name: string;
  sku: string;
  quantity: number;
  minimum_stock: number;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly client = inject(SupabaseService).client;

  async dashboard(): Promise<DashboardMetrics> {
    const { data, error } = await this.client.from('dashboard_summary').select('*').single();
    if (error) throw error;
    return data as DashboardMetrics;
  }

  async owners(from: string, to: string): Promise<OwnerSalesRow[]> {
    const { data, error } = await this.client.from('owner_sales_summary').select('*').gte('sale_day', from).lte('sale_day', `${to}T23:59:59`).order('sale_day', { ascending: false });
    if (error) throw error;
    return (data ?? []) as OwnerSalesRow[];
  }

  async audit() {
    const { data, error } = await this.client.from('audit_logs').select('id,action,entity_type,entity_id,created_at,profiles(first_name,last_name),metadata').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return data ?? [];
  }

  async createSettlement(ownerId: string, from: string, to: string): Promise<OwnerSettlement> {
    const { data, error } = await this.client.rpc('create_owner_settlement', { p_owner: ownerId, p_from: from, p_to: to });
    if (error) throw error;
    return data as OwnerSettlement;
  }

  async settlements() {
    const { data, error } = await this.client.from('owner_settlements').select('id,date_from,date_to,gross_sales,cost,returns_amount,expenses,net_amount,created_at,owners(first_name,last_name)').order('created_at', { ascending: false }).limit(50);
    if (error) throw error;
    return data ?? [];
  }

  async salesSummary(from: string, to: string): Promise<SalesSummary> {
    const { data, error } = await this.client.rpc('get_sales_summary', { p_from: from, p_to: to });
    if (error) throw error;
    return data as SalesSummary;
  }

  async salesByDay(from: string, to: string): Promise<SalesByDay[]> {
    const { data, error } = await this.client.rpc('get_sales_by_day', { p_from: from, p_to: to });
    if (error) throw error;
    return (data ?? []) as SalesByDay[];
  }

  async topProducts(from: string, to: string, limit = 10): Promise<TopProduct[]> {
    const { data, error } = await this.client.rpc('get_top_products', { p_from: from, p_to: to, p_limit: limit });
    if (error) throw error;
    return (data ?? []) as TopProduct[];
  }

  async salesByPaymentMethod(from: string, to: string): Promise<PaymentMethodBreakdown[]> {
    const { data, error } = await this.client.rpc('get_sales_by_payment_method', { p_from: from, p_to: to });
    if (error) throw error;
    return (data ?? []) as PaymentMethodBreakdown[];
  }

  async stockAlerts(): Promise<StockAlert[]> {
    const { data, error } = await this.client.rpc('get_stock_alerts');
    if (error) throw error;
    return (data ?? []) as StockAlert[];
  }

  async cashSummary(from: string, to: string) {
    const { data, error } = await this.client.rpc('get_cash_summary', { p_from: from, p_to: to });
    if (error) throw error;
    return data as { total_openings: number; total_sales: number; total_differences: number; };
  }
}
