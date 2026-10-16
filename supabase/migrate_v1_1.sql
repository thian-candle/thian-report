-- THIAN CANDLE V1.1 — Ejecutar DESPUÉS de schema.sql y los scripts de roles previos.
-- Ejecutar como postgres desde SQL Editor. Hacer copia de seguridad primero.
BEGIN;

-- Garantizar que los roles originales se hayan migrado.
INSERT INTO public.user_roles(user_id,role_id)
SELECT p.id,r.id FROM public.profiles p JOIN public.roles r ON r.code=p.role::text
ON CONFLICT DO NOTHING;

-- Los nuevos perfiles tendrán username temporal único y rol seller.
-- El administrador podrá cambiar el username desde el panel.
-- Generar username temporal único desde UUID.
CREATE OR REPLACE FUNCTION public.create_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_role_id bigint;
BEGIN
  INSERT INTO public.profiles(id,full_name,role,username)
  VALUES(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),'seller', 'u_' || substr(replace(new.id::text,'-',''),1,16))
  ON CONFLICT(id) DO NOTHING;
  SELECT id INTO v_role_id FROM public.roles WHERE code='seller';
  IF v_role_id IS NULL THEN RAISE EXCEPTION 'Falta rol seller'; END IF;
  INSERT INTO public.user_roles(user_id,role_id) VALUES(new.id,v_role_id) ON CONFLICT DO NOTHING;
  RETURN new;
END; $$;

-- Función central para RLS (no depende de profiles.role).
CREATE OR REPLACE FUNCTION public.has_role(p_role text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
SELECT EXISTS(SELECT 1 FROM public.user_roles ur
 JOIN public.roles r ON r.id=ur.role_id
 JOIN public.profiles p ON p.id=ur.user_id
 WHERE ur.user_id=(SELECT auth.uid()) AND p.active AND r.code=p_role);
$$;
REVOKE ALL ON FUNCTION public.has_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$ SELECT public.has_role('admin'); $$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Permisos acumulativos en RLS.
DROP POLICY IF EXISTS "orders read" ON public.orders;
CREATE POLICY "orders read" ON public.orders FOR SELECT TO authenticated
USING (public.is_admin() OR public.has_role('production') OR public.has_role('billing') OR public.has_role('supervisor') OR (public.has_role('seller') AND seller_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS "orders insert" ON public.orders;
CREATE POLICY "orders insert" ON public.orders FOR INSERT TO authenticated
WITH CHECK ((public.is_admin() OR public.has_role('seller')) AND public.is_active_user() AND seller_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS "items insert" ON public.order_items;
CREATE POLICY "items insert" ON public.order_items FOR INSERT TO authenticated
WITH CHECK ((public.is_admin() OR public.has_role('seller')) AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.seller_id=(SELECT auth.uid())));
DROP POLICY IF EXISTS "items admin update" ON public.order_items;
CREATE POLICY "items production update" ON public.order_items FOR UPDATE TO authenticated
USING (public.is_admin() OR public.has_role('production'))
WITH CHECK (public.is_admin() OR public.has_role('production'));

-- Producción solo puede cambiar status, no cantidades, productos ni notas.
-- RLS no controla columnas; un trigger impide modificaciones no autorizadas.
CREATE OR REPLACE FUNCTION public.guard_order_item_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.is_admin() AND (
   NEW.id IS DISTINCT FROM OLD.id OR NEW.order_id IS DISTINCT FROM OLD.order_id OR
   NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.quantity IS DISTINCT FROM OLD.quantity OR
   NEW.notes IS DISTINCT FROM OLD.notes OR NEW.created_at IS DISTINCT FROM OLD.created_at
 ) THEN RAISE EXCEPTION 'Producción solo puede modificar el estado'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_order_item_update ON public.order_items;
CREATE TRIGGER guard_order_item_update BEFORE UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.guard_order_item_update();

-- Solo admin puede actualizar perfiles, y nunca puede alterar el rol legado o el id.
CREATE OR REPLACE FUNCTION public.guard_profile_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role OR NEW.created_at IS DISTINCT FROM OLD.created_at
 THEN RAISE EXCEPTION 'Campos de perfil protegidos'; END IF;
 IF OLD.id=(SELECT auth.uid()) AND NEW.active=false THEN RAISE EXCEPTION 'No puedes desactivar tu propia cuenta'; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS guard_profile_update ON public.profiles;
CREATE TRIGGER guard_profile_update BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- No retirar el rol admin de uno mismo ni del último admin activo.
CREATE OR REPLACE FUNCTION public.guard_admin_role_delete() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_admin_id bigint;
BEGIN
 SELECT id INTO v_admin_id FROM public.roles WHERE code='admin';
 IF OLD.role_id=v_admin_id THEN
  IF OLD.user_id=(SELECT auth.uid()) THEN RAISE EXCEPTION 'No puedes quitarte tu propio rol administrador'; END IF;
  IF (SELECT count(*) FROM public.user_roles ur JOIN public.profiles p ON p.id=ur.user_id
      WHERE ur.role_id=v_admin_id AND p.active) <= 1 THEN
    RAISE EXCEPTION 'Debe permanecer al menos un administrador activo';
  END IF;
 END IF;
 RETURN OLD;
END; $$;
DROP TRIGGER IF EXISTS guard_admin_role_delete ON public.user_roles;
CREATE TRIGGER guard_admin_role_delete BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_admin_role_delete();

-- La tabla de roles es solo lectura desde el frontend.
REVOKE INSERT,UPDATE,DELETE ON public.roles FROM anon,authenticated;
-- Permisos para leer/administrar asignaciones (RLS restringe por usuario).
GRANT SELECT ON public.roles TO authenticated;
GRANT SELECT,INSERT,DELETE ON public.user_roles TO authenticated;
GRANT SELECT,UPDATE ON public.profiles TO authenticated;

-- RLS de asignaciones: revisar y sustituir políticas de scripts anteriores.
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can read assigned roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;
CREATE POLICY "Users can read assigned roles" ON public.user_roles FOR SELECT TO authenticated
USING (user_id=(SELECT auth.uid()) OR public.is_admin());
CREATE POLICY "Admins can insert user roles" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.is_admin());
CREATE POLICY "Admins can delete user roles" ON public.user_roles FOR DELETE TO authenticated
USING (public.is_admin());
COMMIT;
