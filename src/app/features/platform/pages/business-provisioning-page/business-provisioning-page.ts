import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../../core/services/auth.service';
import { SupabaseService } from '../../../../core/services/supabase.service';
import { StorageService } from '../../../../core/services/storage.service';
import { ToastService } from '../../../../core/services/toast.service';

interface BusinessRow {
  id: string;
  name: string;
  legal_name: string | null;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_path: string | null;
  active: boolean;
  created_at: string;
  profiles: { first_name: string; last_name: string; email: string; active: boolean }[];
}

@Component({
  selector: 'app-business-provisioning-page',
  imports: [FormsModule],
  templateUrl: './business-provisioning-page.html',
  styleUrl: './business-provisioning-page.css',
})
export class BusinessProvisioningPageComponent implements OnInit {
  private readonly client = inject(SupabaseService).client;
  private readonly auth = inject(AuthService);
  private readonly storage = inject(StorageService);
  private readonly toast = inject(ToastService);

  readonly businesses = signal<BusinessRow[]>([]);
  readonly loading = signal(false);
  readonly credentials = signal<{ businessName: string; email: string; password: string } | null>(null);
  readonly logoPreview = signal<string | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly confirmDelete = signal<string | null>(null);
  private logoBase64 = '';
  private logoMime = '';

  form = {
    businessName: '', legalName: '', taxId: '', businessEmail: '',
    phone: '', address: '', ownerFirstName: '', ownerLastName: '',
    ownerPhone: '', email: '', password: '',
  };

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  get isEditing(): boolean {
    return this.editingId() !== null;
  }

  async load(): Promise<void> {
    const { data, error } = await this.client
      .from('businesses')
      .select('id,name,legal_name,tax_id,email,phone,address,logo_path,active,created_at,profiles(first_name,last_name,email,active)')
      .order('created_at', { ascending: false });
    if (!error) this.businesses.set(data ?? []);
  }

  generatePassword(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    this.form.password = Array.from(
      crypto.getRandomValues(new Uint32Array(14)),
      (n) => chars[n % chars.length]
    ).join('');
  }

  async selectLogo(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.toast.show({ title: 'El logo no puede superar 5 MB', variant: 'warning' });
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      this.toast.show({ title: 'Usá un logo JPG, PNG, WEBP o SVG', variant: 'warning' });
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    this.logoPreview.set(dataUrl);
    this.logoBase64 = dataUrl.split(',')[1] ?? '';
    this.logoMime = file.type;
  }

  startEdit(business: BusinessRow): void {
    this.editingId.set(business.id);
    this.form.businessName = business.name;
    this.form.legalName = business.legal_name ?? '';
    this.form.taxId = business.tax_id ?? '';
    this.form.businessEmail = business.email ?? '';
    this.form.phone = business.phone ?? '';
    this.form.address = business.address ?? '';
    this.form.ownerFirstName = business.profiles?.[0]?.first_name ?? '';
    this.form.ownerLastName = business.profiles?.[0]?.last_name ?? '';
    this.form.ownerPhone = '';
    this.form.email = business.profiles?.[0]?.email ?? '';
    this.form.password = '';
    this.logoPreview.set(null);
    this.logoBase64 = '';
    this.logoMime = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.resetForm();
  }

  private resetForm(): void {
    this.form = {
      businessName: '', legalName: '', taxId: '', businessEmail: '',
      phone: '', address: '', ownerFirstName: '', ownerLastName: '',
      ownerPhone: '', email: '', password: '',
    };
    this.logoPreview.set(null);
    this.logoBase64 = '';
    this.logoMime = '';
  }

  async create(): Promise<void> {
    this.loading.set(true);
    this.credentials.set(null);
    try {
      const { data, error } = await this.client.functions.invoke('create-business', {
        body: {
          ...this.form,
          logoBase64: this.logoBase64 || undefined,
          logoMime: this.logoMime || undefined,
        },
      });
      if (error) throw new Error(await this.functionError(error));
      this.credentials.set({ businessName: data.businessName, email: this.form.email, password: this.form.password });
      this.toast.show({ title: 'Comercio creado correctamente', variant: 'success' });
      this.resetForm();
      await this.load();
    } catch (e) {
      this.toast.show({ title: 'No se pudo crear el comercio', description: e instanceof Error ? e.message : 'Error inesperado', variant: 'danger' });
    } finally {
      this.loading.set(false);
    }
  }

  async update(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    this.loading.set(true);
    try {
      let logoPath: string | null = null;
      if (this.logoBase64 && this.logoMime) {
        const ext = this.logoMime.split('/')[1] ?? 'png';
        const path = `logos/${id}.${ext}`;
        const byteCharacters = atob(this.logoBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: this.logoMime });
        const { error: uploadErr } = await this.storage.from('business-assets').upload(path, blob, { upsert: true });
        if (uploadErr) throw uploadErr;
        logoPath = path;
      }

      const updates: Record<string, unknown> = {
        name: this.form.businessName,
        legal_name: this.form.legalName || null,
        tax_id: this.form.taxId || null,
        email: this.form.businessEmail || null,
        phone: this.form.phone || null,
        address: this.form.address || null,
      };
      if (logoPath) updates['logo_path'] = logoPath;

      const { error } = await this.client.from('businesses').update(updates).eq('id', id);
      if (error) throw error;

      this.toast.show({ title: 'Comercio actualizado', variant: 'success' });
      this.editingId.set(null);
      this.resetForm();
      await this.load();
    } catch (e) {
      this.toast.show({ title: 'No se pudo actualizar', description: e instanceof Error ? e.message : 'Error inesperado', variant: 'danger' });
    } finally {
      this.loading.set(false);
    }
  }

  async toggleActive(business: BusinessRow): Promise<void> {
    try {
      const { data, error } = await this.client
        .from('businesses')
        .update({ active: !business.active })
        .eq('id', business.id)
        .select();
      if (error) {
        const msg = [error.message, error.details, error.hint].filter(Boolean).join(' · ');
        throw new Error(msg || 'Error al actualizar');
      }
      this.toast.show({
        title: business.active ? 'Comercio desactivado' : 'Comercio activado',
        description: `${business.name} ahora está ${!business.active ? 'activo' : 'inactivo'}.`,
        variant: business.active ? 'warning' : 'success',
      });
      await this.load();
    } catch (e) {
      this.toast.show({ title: 'No se pudo cambiar el estado', description: e instanceof Error ? e.message : 'Error inesperado', variant: 'danger' });
    }
  }

  async deleteBusiness(id: string): Promise<void> {
    try {
      const { error } = await this.client.rpc('delete_business', { p_business_id: id });
      if (error) {
        const msg = [error.message, error.details, error.hint].filter(Boolean).join(' · ');
        throw new Error(msg || 'Error al eliminar');
      }
      this.toast.show({ title: 'Comercio eliminado', variant: 'success' });
      this.confirmDelete.set(null);
      await this.load();
    } catch (e) {
      this.toast.show({ title: 'No se pudo eliminar', description: e instanceof Error ? e.message : 'Error inesperado', variant: 'danger' });
    }
  }

  async copy(): Promise<void> {
    const c = this.credentials();
    if (c) await navigator.clipboard.writeText(`Comercio: ${c.businessName}\nUsuario: ${c.email}\nContraseña: ${c.password}`);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
  }

  private async functionError(error: any): Promise<string> {
    try {
      const body = await error.context?.json();
      return body?.error || error.message;
    } catch {
      return error instanceof Error ? error.message : 'Error inesperado';
    }
  }
}
