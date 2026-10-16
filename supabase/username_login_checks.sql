-- Verificar que todos los usuarios tienen username y no existen duplicados.
SELECT id, username FROM public.profiles WHERE username IS NULL;
SELECT lower(username), count(*) FROM public.profiles GROUP BY lower(username) HAVING count(*) > 1;
-- Antes de habilitar el acceso, asigna un username válido a cada cuenta.
