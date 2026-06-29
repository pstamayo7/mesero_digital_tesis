-- Revierte la separación caja/cocina: un solo rol 'empleado' con acceso a
-- ambas terminales (decisión de negocio: no se necesita ese nivel de
-- granularidad). Cualquier fila que haya quedado en 'empleado_caja' o
-- 'empleado_cocina' se normaliza de vuelta a 'empleado' antes de restringir
-- el CHECK, para que la migración no falle por datos existentes.
UPDATE public.usuario
    SET rol = 'empleado'
    WHERE rol IN ('empleado_caja', 'empleado_cocina');

ALTER TABLE public.usuario
    DROP CONSTRAINT IF EXISTS usuario_rol_check;

ALTER TABLE public.usuario
    ADD CONSTRAINT usuario_rol_check
    CHECK (rol IN ('empleado', 'administrador'));
