-- Trazabilidad de cobros: registra qué usuario (cajero/admin) cerró cada
-- pedido, para habilitar reportes de "Ventas por Cajero" y auditoría de caja.
--
-- NULLABLE a propósito: un pedido recién abierto (PENDIENTE, en cocina, etc.)
-- todavía no tiene cajero porque nadie lo ha cobrado.
-- ON DELETE SET NULL: si el usuario se elimina físicamente alguna vez (hoy
-- usamos borrado lógico, así que esto es solo una salvaguarda), el pedido
-- conserva su historial de ventas en vez de romperse por la FK.
ALTER TABLE public.pedido
    ADD COLUMN IF NOT EXISTS id_cajero INTEGER NULL;

ALTER TABLE public.pedido
    DROP CONSTRAINT IF EXISTS pedido_id_cajero_fkey;

ALTER TABLE public.pedido
    ADD CONSTRAINT pedido_id_cajero_fkey
    FOREIGN KEY (id_cajero) REFERENCES public.usuario (id_usuario)
    ON DELETE SET NULL;

-- Acelera el futuro reporte "Ventas por Cajero" (GROUP BY id_cajero).
CREATE INDEX IF NOT EXISTS idx_pedido_id_cajero ON public.pedido (id_cajero);
