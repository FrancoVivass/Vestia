import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(url, serviceRole);
  let createdAuthUserId: string | undefined;

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) throw new Error('No autenticado');

    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user }, error: callerError } = await caller.auth.getUser();
    if (callerError || !user) throw new Error('Sesión inválida');

    const { data: ownerProfile, error: ownerError } = await admin
      .from('profiles')
      .select('id,business_id,role')
      .eq('auth_user_id', user.id)
      .eq('active', true)
      .single();
    if (ownerError || ownerProfile?.role !== 'OWNER') throw new Error('Permiso denegado');

    const body = await req.json();
    const action = String(body.action ?? 'create');
    const role = String(body.role ?? 'CASHIER').toUpperCase();
    const active = body.active !== false;
    const permissions = Array.isArray(body.permissions)
      ? [...new Set(body.permissions.map((value: unknown) => String(value)))]
      : [];

    if (!['OWNER', 'CASHIER'].includes(role)) throw new Error('Rol inválido');
    const ownerId = role === 'OWNER' && String(body.ownerId ?? '').trim() ? String(body.ownerId) : null;
    if (ownerId) {
      const { data: linkedOwner } = await admin.from('owners').select('id').eq('id', ownerId).eq('business_id', ownerProfile.business_id).eq('active', true).maybeSingle();
      if (!linkedOwner) throw new Error('El dueño asociado no es válido');
    }

    if (action === 'create') {
      if (!String(body.email ?? '').trim()) throw new Error('Ingresá un email');
      if (String(body.password ?? '').length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres');
      if (!String(body.firstName ?? '').trim()) throw new Error('Ingresá el nombre');

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: String(body.email).trim().toLowerCase(),
        password: String(body.password),
        email_confirm: true,
        user_metadata: {
          role,
          permissions,
          userStatus: active ? 'active' : 'inactive',
          full_name: `${body.firstName} ${body.lastName ?? ''}`.trim(),
          ownerId,
        },
      });
      if (createError) throw createError;
      createdAuthUserId = created.user.id;

      const { data: profile, error: profileError } = await admin
        .from('profiles')
        .insert({
          auth_user_id: createdAuthUserId,
          business_id: ownerProfile.business_id,
          first_name: String(body.firstName).trim(),
          last_name: String(body.lastName ?? '').trim(),
          email: String(body.email).trim().toLowerCase(),
          role,
          active,
          owner_id: ownerId,
        })
        .select('id')
        .single();
      if (profileError) throw profileError;

      if (permissions.length) {
        const { error: permissionError } = await admin.from('profile_permissions').insert(
          permissions.map((code) => ({ profile_id: profile.id, permission_code: code, enabled: true })),
        );
        if (permissionError) throw permissionError;
      }

      await admin.from('audit_logs').insert({ business_id: ownerProfile.business_id, actor_profile_id: ownerProfile.id, action: 'CREATE', entity_type: 'USER', entity_id: profile.id });

      return new Response(JSON.stringify({ id: profile.id, email: body.email }), { headers });
    }

    const profileId = String(body.profileId ?? '');
    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id,auth_user_id,business_id,email,first_name,last_name,role,active')
      .eq('id', profileId)
      .eq('business_id', ownerProfile.business_id)
      .single();
    if (targetError || !target) throw new Error('Usuario inexistente');
    if (target.id === ownerProfile.id && !active) throw new Error('No podés desactivar tu propio usuario');

    if (action === 'toggle') {
      const { error: profileError } = await admin.from('profiles').update({ active }).eq('id', target.id);
      if (profileError) throw profileError;
      const { error: authError } = await admin.auth.admin.updateUserById(target.auth_user_id, {
        user_metadata: { role: target.role, userStatus: active ? 'active' : 'inactive' },
        ban_duration: active ? 'none' : '876000h',
      });
      if (authError) throw authError;
      await admin.from('audit_logs').insert({ business_id: ownerProfile.business_id, actor_profile_id: ownerProfile.id, action: active ? 'ACTIVATE' : 'DEACTIVATE', entity_type: 'USER', entity_id: target.id });
      return new Response(JSON.stringify({ id: target.id, active }), { headers });
    }

    if (action !== 'update') throw new Error('Acción inválida');
    if (!String(body.email ?? '').trim() || !String(body.firstName ?? '').trim()) throw new Error('Nombre y email son obligatorios');

    const email = String(body.email).trim().toLowerCase();
    const firstName = String(body.firstName).trim();
    const lastName = String(body.lastName ?? '').trim();
    const { error: updateError } = await admin.from('profiles').update({
      first_name: firstName,
      last_name: lastName,
      email,
      role,
      active,
      owner_id: ownerId,
    }).eq('id', target.id);
    if (updateError) throw updateError;

    const { error: deletePermissionError } = await admin.from('profile_permissions').delete().eq('profile_id', target.id);
    if (deletePermissionError) throw deletePermissionError;
    if (permissions.length) {
      const { error: permissionError } = await admin.from('profile_permissions').insert(
        permissions.map((code) => ({ profile_id: target.id, permission_code: code, enabled: true })),
      );
      if (permissionError) throw permissionError;
    }

    const { error: authError } = await admin.auth.admin.updateUserById(target.auth_user_id, {
      email,
      email_confirm: true,
      user_metadata: {
        role,
        permissions,
        userStatus: active ? 'active' : 'inactive',
        full_name: `${firstName} ${lastName}`.trim(),
        ownerId,
      },
      ban_duration: active ? 'none' : '876000h',
    });
    if (authError) throw authError;

    await admin.from('audit_logs').insert({ business_id: ownerProfile.business_id, actor_profile_id: ownerProfile.id, action: 'UPDATE', entity_type: 'USER', entity_id: target.id, old_data: target, new_data: { email, first_name: firstName, last_name: lastName, role, active, owner_id: ownerId } });

    return new Response(JSON.stringify({ id: target.id, email }), { headers });
  } catch (error) {
    if (createdAuthUserId) await admin.auth.admin.deleteUser(createdAuthUserId);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error inesperado' }),
      { status: 400, headers },
    );
  }
});
