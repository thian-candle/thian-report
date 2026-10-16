import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') ?? '';
const allowedRoles = ['admin','seller','production','billing','supervisor'];
const headers = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
function reply(status: number, value: Record<string, unknown>) {
  return new Response(JSON.stringify(value), {status, headers});
}
serve(async (req) => {
  if (!allowedOrigin || req.headers.get('origin') !== allowedOrigin) return new Response('Origen no permitido',{status:403});
  if(req.method==='OPTIONS') return new Response(null,{headers});
  if(req.method!=='POST') return reply(405,{error:'Método no permitido'});
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
  if(!jwt) return reply(401,{error:'Sesión requerida'});
  const admin = createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data: identity,error: identityError} = await admin.auth.getUser(jwt);
  if(identityError || !identity.user) return reply(401,{error:'Sesión inválida'});
  const actorId=identity.user.id;
  const {data: actor,error: actorError}=await admin.from('profiles').select('active').eq('id',actorId).single();
  if(actorError||!actor?.active) return reply(403,{error:'Acceso denegado'});
  const {data: adminRole,error: roleError}=await admin.from('user_roles').select('roles!inner(code)').eq('user_id',actorId).eq('roles.code','admin').limit(1);
  if(roleError||!adminRole?.length) return reply(403,{error:'Solo administradores pueden crear usuarios'});
  let payload;
  try{payload=await req.json()}catch{return reply(400,{error:'Solicitud inválida'})}
  const full_name=String(payload.full_name||'').trim();
  const username=String(payload.username||'').trim();
  const email=String(payload.email||'').trim().toLowerCase();
  const password=payload.password;
  const roles=payload.roles;
  if(!full_name||full_name.length>100||!/^[a-zA-Z0-9._]{4,20}$/.test(username)||
     !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||
     typeof password!=='string'||password.length<10||password.length>128||
     !Array.isArray(roles)||!roles.length||roles.length>5||
     !roles.every((r:unknown)=>typeof r==='string'&&allowedRoles.includes(r))||new Set(roles).size!==roles.length)
     return reply(400,{error:'Revisa los campos y selecciona al menos un rol'});
  const {data: duplicate,error: duplicateError}=await admin.from('profiles').select('id').ilike('username',username).maybeSingle();
  if(duplicateError) return reply(500,{error:'No se pudo validar el username'});
  if(duplicate) return reply(409,{error:'Este username ya está registrado'});
  const {data: availableRoles,error: catalogError}=await admin.from('roles').select('id,code').in('code',roles);
  if(catalogError||availableRoles?.length!==roles.length) return reply(400,{error:'Roles inválidos'});
  // El trigger existente crea el perfil con rol legado seller. Nunca se concede admin por esa columna.
  const {data: created,error: createError}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name}});
  if(createError||!created.user) return reply(409,{error:'No se pudo crear el usuario. Verifica que el correo no exista.'});
  const userId=created.user.id;
  const {error: profileError}=await admin.from('profiles').update({full_name,username,active:true}).eq('id',userId);
  const {error: assignmentsError}=profileError?{error:profileError}:await admin.from('user_roles').insert(availableRoles!.map(r=>({user_id:userId,role_id:r.id})));
  if(profileError||assignmentsError){
    await admin.auth.admin.deleteUser(userId);
    return reply(assignmentsError?.code==='23505'?409:500,{error:assignmentsError?.code==='23505'?'El username ya está registrado':'No se pudo completar el registro'});
  }
  return reply(201,{id:userId,username});
});
