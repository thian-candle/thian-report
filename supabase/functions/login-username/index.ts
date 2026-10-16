import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const projectUrl = Deno.env.get("SUPABASE_URL")!;
const publicKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const origin = Deno.env.get("ALLOWED_ORIGIN") ?? "";
const headers = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const failure = () => new Response(JSON.stringify({ error: "Credenciales inválidas" }), { status: 401, headers });

serve(async (req) => {
  if (!origin || req.headers.get("origin") !== origin) {
    return new Response("Origen no permitido", { status: 403 });
  }
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405, headers });
  try {
    const { username, password } = await req.json();
    if (typeof username !== "string" || !/^[a-zA-Z0-9._]{4,20}$/.test(username) ||
        typeof password !== "string" || !password || password.length > 1024) return failure();

    const admin = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: lookupError } = await admin.from("profiles")
      .select("id,active").ilike("username", username).maybeSingle();
    if (lookupError || !profile?.active) return failure();

    const { data: account, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError || !account?.user?.email) return failure();

    const authClient = createClient(projectUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signed, error: signError } = await authClient.auth.signInWithPassword({
      email: account.user.email, password,
    });
    if (signError || !signed.session) return failure();

    return new Response(JSON.stringify({
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
    }), { status: 200, headers });
  } catch {
    return failure();
  }
});
