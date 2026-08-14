import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

type ErrorLike = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  error_description?: unknown;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object') {
    const value = error as ErrorLike;
    const parts = [value.message, value.error_description, value.details, value.hint, value.code]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
    if (parts.length) return [...new Set(parts)].join(' · ');
    try { return JSON.stringify(error); } catch { /* sin representación adicional */ }
  }
  return 'Error no identificado';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Método no permitido' }), { status: 405, headers: cors });

  let createdUserId: string | undefined;
  let createdBusinessId: string | undefined;
  let uploadedLogoPath: string | undefined;
  let stage = 'configuración de la función';

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !serviceRole || !anon) {
    return new Response(JSON.stringify({ error: 'Error en configuración de la función: faltan variables internas de Supabase' }), { status: 500, headers: cors });
  }

  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    stage = 'autenticación';
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) throw new Error('No se recibió una sesión válida. Cerrá sesión y volvé a ingresar.');

    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await caller.auth.getUser();
    if (userError) throw new Error(`La sesión no pudo validarse: ${errorMessage(userError)}`);
    if (!user) throw new Error('La sesión expiró. Cerrá sesión y volvé a ingresar.');

    stage = 'autorización del propietario de plataforma';
    const { data: platform, error: platformError } = await admin
      .from('platform_owners')
      .select('auth_user_id,active')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .maybeSingle();
    if (platformError) throw new Error(`No se pudo comprobar el permiso: ${errorMessage(platformError)}`);
    if (!platform) throw new Error(`El usuario ${user.id} no está habilitado como propietario de la plataforma`);

    stage = 'validación de datos';
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { throw new Error('La solicitud no contiene datos válidos'); }
    const required = ['businessName', 'ownerFirstName', 'ownerLastName', 'email', 'password'] as const;
    for (const key of required) if (!String(body[key] ?? '').trim()) throw new Error(`Falta completar ${key}`);

    const email = String(body['email']).trim().toLowerCase();
    const password = String(body['password']);
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('El email de acceso no es válido');
    if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');

    stage = 'usuario de acceso';
    const { data: auth, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'OWNER', permissions: [], userStatus: 'active', businessStatus: 'active',
        full_name: `${body['ownerFirstName']} ${body['ownerLastName']}`.trim(),
      },
    });
    if (authError) throw new Error(errorMessage(authError).toLowerCase().includes('already') ? 'Ya existe un usuario con ese email' : errorMessage(authError));
    if (!auth.user) throw new Error('Supabase no devolvió el usuario creado');
    createdUserId = auth.user.id;

    stage = 'comercio';
    const { data: business, error: businessError } = await admin.from('businesses').insert({
      name: String(body['businessName']).trim(),
      legal_name: String(body['legalName'] || body['businessName']).trim(),
      tax_id: String(body['taxId'] ?? '').trim() || null,
      email: String(body['businessEmail'] || email).trim().toLowerCase(),
      phone: String(body['phone'] ?? '').trim() || null,
      address: String(body['address'] ?? '').trim() || null,
    }).select('id,name').single();
    if (businessError) throw new Error(errorMessage(businessError));
    if (!business) throw new Error('Supabase no devolvió el comercio creado');
    createdBusinessId = business.id;

    if (body['logoBase64']) {
      stage = 'logo';
      const mime = String(body['logoMime'] ?? '').toLowerCase();
      const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/svg+xml': 'svg' } as Record<string, string>)[mime];
      if (!extension) throw new Error('El logo debe ser JPG, PNG, WEBP o SVG');
      let bytes: Uint8Array;
      try { bytes = Uint8Array.from(atob(String(body['logoBase64'])), (char) => char.charCodeAt(0)); }
      catch { throw new Error('El archivo del logo está dañado o no es válido'); }
      if (bytes.length > 5 * 1024 * 1024) throw new Error('El logo no puede superar 5 MB');
      uploadedLogoPath = `${business.id}/business-logos/logo.${extension}`;
      const { error: uploadError } = await admin.storage.from('business-assets').upload(uploadedLogoPath, bytes, { contentType: mime, upsert: true });
      if (uploadError) throw new Error(errorMessage(uploadError));
      const { error: logoError } = await admin.from('businesses').update({ logo_path: uploadedLogoPath }).eq('id', business.id);
      if (logoError) throw new Error(errorMessage(logoError));
    }

    stage = 'perfil OWNER';
    const { data: profile, error: profileError } = await admin.from('profiles').insert({
      auth_user_id: createdUserId, business_id: business.id,
      first_name: String(body['ownerFirstName']).trim(), last_name: String(body['ownerLastName']).trim(),
      email, phone: String(body['ownerPhone'] ?? '').trim() || null, role: 'OWNER', active: true,
    }).select('id').single();
    if (profileError) throw new Error(errorMessage(profileError));

    stage = 'configuración inicial';
    const methods = [['CASH', 'Efectivo'], ['DEBIT', 'Débito'], ['CREDIT', 'Crédito'], ['TRANSFER', 'Transferencia'], ['QR', 'QR'], ['OTHER', 'Otro']];
    const operations = await Promise.all([
      admin.from('payment_methods').insert(methods.map(([code, name]) => ({ business_id: business.id, code, name }))),
      admin.from('cash_registers').insert({ business_id: business.id, name: 'Caja principal' }),
      admin.from('sizes').insert(['XS', 'S', 'M', 'L', 'XL', 'XXL', '36', '38', '40', '42', '44', '46'].map((name, index) => ({ business_id: business.id, name, sort_order: index + 1 }))),
      admin.from('app_settings').insert({ business_id: business.id, store_name: business.name, logo_path: uploadedLogoPath ?? null, email: body['businessEmail'] || email }),
    ]);
    const operationError = operations.find((result) => result.error)?.error;
    if (operationError) throw new Error(errorMessage(operationError));

    await admin.from('audit_logs').insert({ business_id: business.id, actor_profile_id: profile.id, action: 'CREATE', entity_type: 'BUSINESS', entity_id: business.id });

    return new Response(JSON.stringify({ businessId: business.id, businessName: business.name, userId: createdUserId, email, logoPath: uploadedLogoPath ?? null }), { status: 200, headers: cors });
  } catch (error) {
    if (uploadedLogoPath) await admin.storage.from('business-assets').remove([uploadedLogoPath]);
    if (createdBusinessId) {
      for (const table of ['app_settings', 'sizes', 'payment_methods', 'cash_registers', 'audit_logs', 'profiles']) {
        await admin.from(table).delete().eq('business_id', createdBusinessId);
      }
      await admin.from('businesses').delete().eq('id', createdBusinessId);
    }
    if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
    const detail = errorMessage(error);
    console.error('create-business', { stage, detail });
    return new Response(JSON.stringify({ error: `Error en ${stage}: ${detail}`, stage, detail }), { status: 400, headers: cors });
  }
});
