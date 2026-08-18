import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CashRegisterRecord, PaymentMethodRecord } from '../../../../core/models/domain.model';
import { StorageService } from '../../../../core/services/storage.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { ThemeService } from '../../../../core/services/theme.service';
import { ToastService } from '../../../../core/services/toast.service';

type SettingsTab = 'general' | 'printing' | 'payments' | 'registers';

interface AppSettings {
  store_name: string; logo_path: string | null; address: string; phone: string;
  email: string; currency: string; tax_rate: number; default_minimum_stock: number;
  allow_cashier_returns: boolean; allow_pending_balance: boolean;
  label_settings: { width: number; height: number; columns: number };
  ticket_settings: { width: number };
  theme_settings: { mode: 'light' | 'dark' };
}

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.css',
})
export class SettingsPageComponent implements OnInit {
  private readonly client = inject(SupabaseService).client;
  private readonly storage = inject(StorageService);
  private readonly theme = inject(ThemeService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly methods = signal<PaymentMethodRecord[]>([]);
  readonly registers = signal<CashRegisterRecord[]>([]);
  readonly logoPreview = signal<string | null>(null);
  readonly activeTab = signal<SettingsTab>('general');

  settings: AppSettings = {
    store_name: 'VESTIA', logo_path: null, currency: 'ARS', tax_rate: 0,
    default_minimum_stock: 0, allow_cashier_returns: false, allow_pending_balance: false,
    address: '', phone: '', email: '',
    label_settings: { width: 50, height: 30, columns: 3 },
    ticket_settings: { width: 80 },
    theme_settings: { mode: 'light' },
  };

  newMethodName = '';
  newMethodCode = '';
  newRegisterName = '';

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [settings, methods, registers] = await Promise.all([
        this.client.from('app_settings').select('*').maybeSingle(),
        this.client.from('payment_methods').select('id,code,name,requires_reference,active').order('name'),
        this.client.from('cash_registers').select('id,name,active').order('name'),
      ]);
      if (settings.error) throw settings.error;
      if (methods.error) throw methods.error;
      if (registers.error) throw registers.error;
      if (settings.data) {
        this.settings = {
          ...this.settings, ...settings.data,
          label_settings: { ...this.settings.label_settings, ...settings.data.label_settings },
          ticket_settings: { ...this.settings.ticket_settings, ...settings.data.ticket_settings },
          theme_settings: { ...this.settings.theme_settings, ...settings.data.theme_settings },
        };
        this.logoPreview.set(this.settings.logo_path
          ? await this.storage.signedUrl('business-assets', this.settings.logo_path)
          : null);
      }
      this.methods.set((methods.data ?? []).filter(m => m.code !== 'EXCHANGE_CREDIT') as PaymentMethodRecord[]);
      this.registers.set((registers.data ?? []) as CashRegisterRecord[]);
    } catch (error) {
      this.fail('No se pudo cargar la configuración', error);
    } finally {
      this.loading.set(false);
    }
  }

  async selectLogo(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.loading.set(true);
    try {
      const uploaded = await this.storage.uploadBusinessLogo(file, 'logo');
      this.settings.logo_path = uploaded.path;
      this.logoPreview.set(uploaded.publicUrl);
    } catch (error) {
      this.fail('No se pudo subir el logo', error);
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    this.loading.set(true);
    try {
      const { data: businessId, error: businessError } = await this.client.rpc('current_business_id');
      if (businessError || !businessId) throw businessError ?? new Error('No existe un comercio activo');
      this.settings.currency = this.settings.currency.toUpperCase();
      const { error } = await this.client.from('app_settings').upsert({
        ...this.settings, business_id: businessId, updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      const { error: businessUpdateError } = await this.client.rpc('update_business_identity', {
        p_name: this.settings.store_name, p_address: this.settings.address,
        p_phone: this.settings.phone, p_email: this.settings.email,
        p_currency: this.settings.currency, p_logo_path: this.settings.logo_path,
      });
      if (businessUpdateError) throw businessUpdateError;
      this.theme.set(this.settings.theme_settings.mode === 'dark');
      this.toast.show({ title: 'Configuración guardada', variant: 'success' });
    } catch (error) {
      this.fail('No se pudo guardar', error);
    } finally {
      this.loading.set(false);
    }
  }

  async addMethod(): Promise<void> {
    const name = this.newMethodName.trim();
    if (!name) return;
    const code = (this.newMethodCode.trim() || name)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    await this.createRecord('payment_methods', { code, name, active: true });
    this.newMethodName = '';
    this.newMethodCode = '';
    await this.load();
  }

  async toggleMethod(method: PaymentMethodRecord): Promise<void> {
    await this.updateRecord('payment_methods', method.id, { active: !method.active });
    await this.load();
  }

  async addRegister(): Promise<void> {
    const name = this.newRegisterName.trim();
    if (!name) return;
    await this.createRecord('cash_registers', { name, active: true });
    this.newRegisterName = '';
    await this.load();
  }

  async toggleRegister(register: CashRegisterRecord): Promise<void> {
    await this.updateRecord('cash_registers', register.id, { active: !register.active });
    await this.load();
  }

  private async createRecord(table: string, value: Record<string, unknown>): Promise<void> {
    try {
      const { data: businessId, error: businessError } = await this.client.rpc('current_business_id');
      if (businessError) throw businessError;
      const { error } = await this.client.from(table).insert({ ...value, business_id: businessId });
      if (error) throw error;
      this.toast.show({ title: 'Agregado correctamente', variant: 'success' });
    } catch (error) {
      this.fail('No se pudo agregar', error);
    }
  }

  private async updateRecord(table: string, id: string, value: Record<string, unknown>): Promise<void> {
    try {
      const { error } = await this.client.from(table).update(value).eq('id', id);
      if (error) throw error;
    } catch (error) {
      this.fail('No se pudo actualizar', error);
    }
  }

  private fail(title: string, error: unknown): void {
    this.toast.show({ title, description: error instanceof Error ? error.message : 'Error inesperado', variant: 'danger' });
  }
}
