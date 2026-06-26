--
-- PostgreSQL database dump
--

\restrict trTAQhjV72SXVS3b378I4IyQohRSuxiPkWhrJeCVzcOjORefLUtip4d3hg2fWFJ

-- Dumped from database version 15.18
-- Dumped by pg_dump version 18.3

-- Started on 2026-06-23 11:31:47

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 858 (class 1247 OID 16400)
-- Name: estado_item_enum; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public.estado_item_enum AS ENUM (
    'SOLICITADO',
    'PREPARANDO',
    'ENTREGADO',
    'CANCELADO'
);


ALTER TYPE public.estado_item_enum OWNER TO admin;

--
-- TOC entry 852 (class 1247 OID 16386)
-- Name: estado_mesa_enum; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public.estado_mesa_enum AS ENUM (
    'LIBRE',
    'OCUPADA',
    'RESERVADA'
);


ALTER TYPE public.estado_mesa_enum OWNER TO admin;

--
-- TOC entry 855 (class 1247 OID 16394)
-- Name: estado_pago_enum; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public.estado_pago_enum AS ENUM (
    'PENDIENTE',
    'PAGADO'
);


ALTER TYPE public.estado_pago_enum OWNER TO admin;

--
-- TOC entry 861 (class 1247 OID 16410)
-- Name: tipo_mod_enum; Type: TYPE; Schema: public; Owner: admin
--

CREATE TYPE public.tipo_mod_enum AS ENUM (
    'EXTRA',
    'SIN',
    'CAMBIO'
);


ALTER TYPE public.tipo_mod_enum OWNER TO admin;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 217 (class 1259 OID 16426)
-- Name: categoria; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.categoria (
    id_categoria integer NOT NULL,
    nombre character varying(50) NOT NULL
);


ALTER TABLE public.categoria OWNER TO admin;

--
-- TOC entry 216 (class 1259 OID 16425)
-- Name: categoria_id_categoria_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.categoria_id_categoria_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.categoria_id_categoria_seq OWNER TO admin;

--
-- TOC entry 3511 (class 0 OID 0)
-- Dependencies: 216
-- Name: categoria_id_categoria_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.categoria_id_categoria_seq OWNED BY public.categoria.id_categoria;


--
-- TOC entry 229 (class 1259 OID 16526)
-- Name: configuracion_operativa; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.configuracion_operativa (
    id_config integer DEFAULT 1 NOT NULL,
    max_platos_kiosko integer DEFAULT 15 NOT NULL,
    capacidad_paila_cocina integer DEFAULT 8 NOT NULL,
    cantidad_cocineros integer DEFAULT 2 NOT NULL,
    porcentaje_tiempo_extra numeric(3,2) DEFAULT 0.10,
    total_paletas integer DEFAULT 20
);


ALTER TABLE public.configuracion_operativa OWNER TO admin;

--
-- TOC entry 226 (class 1259 OID 16484)
-- Name: detalle_pedido; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.detalle_pedido (
    id_detalle integer NOT NULL,
    id_pedido integer,
    id_plato integer,
    cantidad integer NOT NULL,
    fecha_solicitud timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    estado_item public.estado_item_enum DEFAULT 'SOLICITADO'::public.estado_item_enum,
    especificaciones_ia text,
    fecha_inicio_preparacion timestamp without time zone,
    tiempo_asignado_cocina integer DEFAULT 0,
    fecha_entrega timestamp without time zone,
    subtotal_calculado numeric(8,2) DEFAULT 0.00
);


ALTER TABLE public.detalle_pedido OWNER TO admin;

--
-- TOC entry 225 (class 1259 OID 16483)
-- Name: detalle_pedido_id_detalle_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.detalle_pedido_id_detalle_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.detalle_pedido_id_detalle_seq OWNER TO admin;

--
-- TOC entry 3512 (class 0 OID 0)
-- Dependencies: 225
-- Name: detalle_pedido_id_detalle_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.detalle_pedido_id_detalle_seq OWNED BY public.detalle_pedido.id_detalle;


--
-- TOC entry 221 (class 1259 OID 16445)
-- Name: ingrediente; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.ingrediente (
    id_ingrediente integer NOT NULL,
    nombre character varying(50) NOT NULL,
    stock_actual numeric(8,2) NOT NULL,
    precio_extra numeric(5,2) DEFAULT 0.00,
    cantidad_porcion numeric(8,2) DEFAULT 0.00
);


ALTER TABLE public.ingrediente OWNER TO admin;

--
-- TOC entry 220 (class 1259 OID 16444)
-- Name: ingrediente_id_ingrediente_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.ingrediente_id_ingrediente_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ingrediente_id_ingrediente_seq OWNER TO admin;

--
-- TOC entry 3513 (class 0 OID 0)
-- Dependencies: 220
-- Name: ingrediente_id_ingrediente_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.ingrediente_id_ingrediente_seq OWNED BY public.ingrediente.id_ingrediente;


--
-- TOC entry 215 (class 1259 OID 16418)
-- Name: mesa; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.mesa (
    id_mesa integer NOT NULL,
    numero_mesa integer NOT NULL,
    capacidad integer NOT NULL,
    estado_mesa public.estado_mesa_enum DEFAULT 'LIBRE'::public.estado_mesa_enum
);


ALTER TABLE public.mesa OWNER TO admin;

--
-- TOC entry 214 (class 1259 OID 16417)
-- Name: mesa_id_mesa_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.mesa_id_mesa_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.mesa_id_mesa_seq OWNER TO admin;

--
-- TOC entry 3514 (class 0 OID 0)
-- Dependencies: 214
-- Name: mesa_id_mesa_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.mesa_id_mesa_seq OWNED BY public.mesa.id_mesa;


--
-- TOC entry 228 (class 1259 OID 16505)
-- Name: modificacion_item; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.modificacion_item (
    id_modificacion integer NOT NULL,
    id_detalle integer,
    id_ingrediente integer,
    tipo public.tipo_mod_enum NOT NULL,
    recargo numeric(5,2) DEFAULT 0.00
);


ALTER TABLE public.modificacion_item OWNER TO admin;

--
-- TOC entry 227 (class 1259 OID 16504)
-- Name: modificacion_item_id_modificacion_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.modificacion_item_id_modificacion_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.modificacion_item_id_modificacion_seq OWNER TO admin;

--
-- TOC entry 3515 (class 0 OID 0)
-- Dependencies: 227
-- Name: modificacion_item_id_modificacion_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.modificacion_item_id_modificacion_seq OWNED BY public.modificacion_item.id_modificacion;


--
-- TOC entry 224 (class 1259 OID 16468)
-- Name: pedido; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.pedido (
    id_pedido integer NOT NULL,
    id_mesa integer,
    fecha_apertura timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre timestamp without time zone,
    estado_pago public.estado_pago_enum DEFAULT 'PENDIENTE'::public.estado_pago_enum,
    subtotal numeric(8,2) DEFAULT 0.00,
    total_final numeric(8,2) DEFAULT 0.00,
    cliente_nombre character varying(100) DEFAULT 'Local'::character varying
);


ALTER TABLE public.pedido OWNER TO admin;

--
-- TOC entry 223 (class 1259 OID 16467)
-- Name: pedido_id_pedido_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.pedido_id_pedido_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.pedido_id_pedido_seq OWNER TO admin;

--
-- TOC entry 3516 (class 0 OID 0)
-- Dependencies: 223
-- Name: pedido_id_pedido_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.pedido_id_pedido_seq OWNED BY public.pedido.id_pedido;


--
-- TOC entry 219 (class 1259 OID 16433)
-- Name: plato; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.plato (
    id_plato integer NOT NULL,
    id_categoria integer,
    nombre character varying(100) NOT NULL,
    precio_base numeric(6,2) NOT NULL,
    tiempo_prep_min integer,
    requiere_coccion boolean DEFAULT true,
    ruta_imagen character varying(255) DEFAULT '/imagenes/default.png'::character varying
);


ALTER TABLE public.plato OWNER TO admin;

--
-- TOC entry 218 (class 1259 OID 16432)
-- Name: plato_id_plato_seq; Type: SEQUENCE; Schema: public; Owner: admin
--

CREATE SEQUENCE public.plato_id_plato_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.plato_id_plato_seq OWNER TO admin;

--
-- TOC entry 3517 (class 0 OID 0)
-- Dependencies: 218
-- Name: plato_id_plato_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: admin
--

ALTER SEQUENCE public.plato_id_plato_seq OWNED BY public.plato.id_plato;


--
-- TOC entry 222 (class 1259 OID 16452)
-- Name: receta; Type: TABLE; Schema: public; Owner: admin
--

CREATE TABLE public.receta (
    id_plato integer NOT NULL,
    id_ingrediente integer NOT NULL,
    cantidad_base numeric(8,2) NOT NULL
);


ALTER TABLE public.receta OWNER TO admin;

--
-- TOC entry 3312 (class 2604 OID 16429)
-- Name: categoria id_categoria; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.categoria ALTER COLUMN id_categoria SET DEFAULT nextval('public.categoria_id_categoria_seq'::regclass);


--
-- TOC entry 3325 (class 2604 OID 16487)
-- Name: detalle_pedido id_detalle; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.detalle_pedido ALTER COLUMN id_detalle SET DEFAULT nextval('public.detalle_pedido_id_detalle_seq'::regclass);


--
-- TOC entry 3316 (class 2604 OID 16448)
-- Name: ingrediente id_ingrediente; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ingrediente ALTER COLUMN id_ingrediente SET DEFAULT nextval('public.ingrediente_id_ingrediente_seq'::regclass);


--
-- TOC entry 3310 (class 2604 OID 16421)
-- Name: mesa id_mesa; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.mesa ALTER COLUMN id_mesa SET DEFAULT nextval('public.mesa_id_mesa_seq'::regclass);


--
-- TOC entry 3330 (class 2604 OID 16508)
-- Name: modificacion_item id_modificacion; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.modificacion_item ALTER COLUMN id_modificacion SET DEFAULT nextval('public.modificacion_item_id_modificacion_seq'::regclass);


--
-- TOC entry 3319 (class 2604 OID 16471)
-- Name: pedido id_pedido; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.pedido ALTER COLUMN id_pedido SET DEFAULT nextval('public.pedido_id_pedido_seq'::regclass);


--
-- TOC entry 3313 (class 2604 OID 16436)
-- Name: plato id_plato; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.plato ALTER COLUMN id_plato SET DEFAULT nextval('public.plato_id_plato_seq'::regclass);


--
-- TOC entry 3341 (class 2606 OID 16431)
-- Name: categoria categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.categoria
    ADD CONSTRAINT categoria_pkey PRIMARY KEY (id_categoria);


--
-- TOC entry 3355 (class 2606 OID 16535)
-- Name: configuracion_operativa configuracion_operativa_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.configuracion_operativa
    ADD CONSTRAINT configuracion_operativa_pkey PRIMARY KEY (id_config);


--
-- TOC entry 3351 (class 2606 OID 16493)
-- Name: detalle_pedido detalle_pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_pkey PRIMARY KEY (id_detalle);


--
-- TOC entry 3345 (class 2606 OID 16451)
-- Name: ingrediente ingrediente_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ingrediente
    ADD CONSTRAINT ingrediente_pkey PRIMARY KEY (id_ingrediente);


--
-- TOC entry 3339 (class 2606 OID 16424)
-- Name: mesa mesa_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.mesa
    ADD CONSTRAINT mesa_pkey PRIMARY KEY (id_mesa);


--
-- TOC entry 3353 (class 2606 OID 16511)
-- Name: modificacion_item modificacion_item_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.modificacion_item
    ADD CONSTRAINT modificacion_item_pkey PRIMARY KEY (id_modificacion);


--
-- TOC entry 3349 (class 2606 OID 16477)
-- Name: pedido pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.pedido
    ADD CONSTRAINT pedido_pkey PRIMARY KEY (id_pedido);


--
-- TOC entry 3343 (class 2606 OID 16438)
-- Name: plato plato_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.plato
    ADD CONSTRAINT plato_pkey PRIMARY KEY (id_plato);


--
-- TOC entry 3347 (class 2606 OID 16456)
-- Name: receta receta_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.receta
    ADD CONSTRAINT receta_pkey PRIMARY KEY (id_plato, id_ingrediente);


--
-- TOC entry 3360 (class 2606 OID 16494)
-- Name: detalle_pedido detalle_pedido_id_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_id_pedido_fkey FOREIGN KEY (id_pedido) REFERENCES public.pedido(id_pedido);


--
-- TOC entry 3361 (class 2606 OID 16499)
-- Name: detalle_pedido detalle_pedido_id_plato_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_id_plato_fkey FOREIGN KEY (id_plato) REFERENCES public.plato(id_plato);


--
-- TOC entry 3362 (class 2606 OID 16512)
-- Name: modificacion_item modificacion_item_id_detalle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.modificacion_item
    ADD CONSTRAINT modificacion_item_id_detalle_fkey FOREIGN KEY (id_detalle) REFERENCES public.detalle_pedido(id_detalle);


--
-- TOC entry 3363 (class 2606 OID 16517)
-- Name: modificacion_item modificacion_item_id_ingrediente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.modificacion_item
    ADD CONSTRAINT modificacion_item_id_ingrediente_fkey FOREIGN KEY (id_ingrediente) REFERENCES public.ingrediente(id_ingrediente);


--
-- TOC entry 3359 (class 2606 OID 16478)
-- Name: pedido pedido_id_mesa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.pedido
    ADD CONSTRAINT pedido_id_mesa_fkey FOREIGN KEY (id_mesa) REFERENCES public.mesa(id_mesa);


--
-- TOC entry 3356 (class 2606 OID 16439)
-- Name: plato plato_id_categoria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.plato
    ADD CONSTRAINT plato_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categoria(id_categoria);


--
-- TOC entry 3357 (class 2606 OID 16462)
-- Name: receta receta_id_ingrediente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.receta
    ADD CONSTRAINT receta_id_ingrediente_fkey FOREIGN KEY (id_ingrediente) REFERENCES public.ingrediente(id_ingrediente);


--
-- TOC entry 3358 (class 2606 OID 16457)
-- Name: receta receta_id_plato_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.receta
    ADD CONSTRAINT receta_id_plato_fkey FOREIGN KEY (id_plato) REFERENCES public.plato(id_plato);


-- Completed on 2026-06-23 11:31:47

--
-- PostgreSQL database dump complete
--

\unrestrict trTAQhjV72SXVS3b378I4IyQohRSuxiPkWhrJeCVzcOjORefLUtip4d3hg2fWFJ

