-- Tabla de usuarios para login de empleados/administradores.
-- El rol 'cliente' es público (Kiosko, Pantalla de Turnos) y NO necesita
-- fila aquí: no hay login para clientes.
CREATE TABLE IF NOT EXISTS public.usuario (
    id_usuario      SERIAL PRIMARY KEY,
    username        VARCHAR(50) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    rol             VARCHAR(20) NOT NULL CHECK (rol IN ('empleado', 'administrador')),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion  TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE public.usuario OWNER TO admin;
