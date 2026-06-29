-- Amplía el modelo de roles para distinguir personal de caja vs. cocina, y
-- agrega nombre_completo para mostrarlo en la UI de Gestión de Personal.
-- Se conserva el rol genérico 'empleado' (legacy) para no romper sesiones
-- existentes; los nuevos usuarios deben crearse con un rol específico.
ALTER TABLE public.usuario
    ADD COLUMN IF NOT EXISTS nombre_completo VARCHAR(100);

ALTER TABLE public.usuario
    DROP CONSTRAINT IF EXISTS usuario_rol_check;

ALTER TABLE public.usuario
    ADD CONSTRAINT usuario_rol_check
    CHECK (rol IN ('empleado', 'empleado_caja', 'empleado_cocina', 'administrador'));
