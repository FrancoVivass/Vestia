import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly supabase = inject(SupabaseService).client;

  from(bucket: string) {
    return this.supabase.storage.from(bucket);
  }

  async signedUrl(bucket: string, path: string): Promise<string> {
    const { data, error } = await this.supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) return '';
    return data.signedUrl;
  }

  async uploadBusinessLogo(file: File, businessSlug: string): Promise<{ path: string; publicUrl: string }> {
    return this.uploadBusinessAsset(file, 'business-logos', businessSlug);
  }

  async uploadProductImage(file: File, productSlug: string): Promise<{ path: string; publicUrl: string }> {
    return this.uploadBusinessAsset(file, 'product-images', productSlug);
  }

  private async uploadBusinessAsset(file: File, folder: string, slug: string): Promise<{ path: string; publicUrl: string }> {
    if (!['image/jpeg','image/png','image/webp','image/svg+xml'].includes(file.type)) throw new Error('Usá una imagen JPG, PNG, WEBP o SVG.');
    if (file.size > 5 * 1024 * 1024) throw new Error('La imagen no puede superar 5 MB.');
    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'png';
    const { data: businessId, error: businessError } = await this.supabase.rpc('current_business_id');
    if (businessError || !businessId) {
      throw businessError ?? new Error('No existe un comercio activo.');
    }
    const safeSlug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'archivo';
    const filePath = `${businessId}/${folder}/${safeSlug}-${Date.now()}.${extension}`;

    const { error } = await this.supabase.storage
      .from('business-assets')
      .upload(filePath, file, {
        upsert: true,
      });

    if (error) {
      throw error;
    }

    const { data, error: signedError } = await this.supabase.storage.from('business-assets').createSignedUrl(filePath, 3600);
    if (signedError) {
      throw signedError;
    }

    return {
      path: filePath,
      publicUrl: data.signedUrl,
    };
  }
}
