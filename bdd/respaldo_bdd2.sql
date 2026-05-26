--
-- PostgreSQL database dump
--

\restrict cjChl3gFQYg1Jdrjv7zFhTIL1uummc9XaEpRBWYSYt1gcSWlb8Y81WTlGrRH6jr

-- Dumped from database version 15.18
-- Dumped by pg_dump version 18.3

-- Started on 2026-05-26 14:40:52

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
-- TOC entry 3524 (class 0 OID 0)
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
    fecha_entrega timestamp without time zone
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
-- TOC entry 3525 (class 0 OID 0)
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
    precio_extra numeric(5,2) DEFAULT 0.00
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
-- TOC entry 3526 (class 0 OID 0)
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
-- TOC entry 3527 (class 0 OID 0)
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
-- TOC entry 3528 (class 0 OID 0)
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
-- TOC entry 3529 (class 0 OID 0)
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
    requiere_coccion boolean DEFAULT true
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
-- TOC entry 3530 (class 0 OID 0)
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
-- TOC entry 3323 (class 2604 OID 16487)
-- Name: detalle_pedido id_detalle; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.detalle_pedido ALTER COLUMN id_detalle SET DEFAULT nextval('public.detalle_pedido_id_detalle_seq'::regclass);


--
-- TOC entry 3315 (class 2604 OID 16448)
-- Name: ingrediente id_ingrediente; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ingrediente ALTER COLUMN id_ingrediente SET DEFAULT nextval('public.ingrediente_id_ingrediente_seq'::regclass);


--
-- TOC entry 3310 (class 2604 OID 16421)
-- Name: mesa id_mesa; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.mesa ALTER COLUMN id_mesa SET DEFAULT nextval('public.mesa_id_mesa_seq'::regclass);


--
-- TOC entry 3327 (class 2604 OID 16508)
-- Name: modificacion_item id_modificacion; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.modificacion_item ALTER COLUMN id_modificacion SET DEFAULT nextval('public.modificacion_item_id_modificacion_seq'::regclass);


--
-- TOC entry 3317 (class 2604 OID 16471)
-- Name: pedido id_pedido; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.pedido ALTER COLUMN id_pedido SET DEFAULT nextval('public.pedido_id_pedido_seq'::regclass);


--
-- TOC entry 3313 (class 2604 OID 16436)
-- Name: plato id_plato; Type: DEFAULT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.plato ALTER COLUMN id_plato SET DEFAULT nextval('public.plato_id_plato_seq'::regclass);


--
-- TOC entry 3506 (class 0 OID 16426)
-- Dependencies: 217
-- Data for Name: categoria; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.categoria (id_categoria, nombre) FROM stdin;
1	Platos Fuertes
2	Bebidas
\.


--
-- TOC entry 3518 (class 0 OID 16526)
-- Dependencies: 229
-- Data for Name: configuracion_operativa; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.configuracion_operativa (id_config, max_platos_kiosko, capacidad_paila_cocina, cantidad_cocineros, porcentaje_tiempo_extra, total_paletas) FROM stdin;
1	15	8	2	0.10	20
\.


--
-- TOC entry 3515 (class 0 OID 16484)
-- Dependencies: 226
-- Data for Name: detalle_pedido; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.detalle_pedido (id_detalle, id_pedido, id_plato, cantidad, fecha_solicitud, estado_item, especificaciones_ia, fecha_inicio_preparacion, tiempo_asignado_cocina, fecha_entrega) FROM stdin;
27	22	1	8	2026-05-25 19:53:32.288756	ENTREGADO		2026-05-25 19:53:33.504146	0	\N
28	22	1	8	2026-05-25 19:53:32.288756	ENTREGADO		2026-05-25 19:54:41.295287	0	\N
55	45	1	8	2026-05-25 23:07:50.706494	ENTREGADO		2026-05-25 23:08:05.287462	0	\N
1	1	1	1	2026-05-24 17:32:08.680052	ENTREGADO		2026-05-24 17:36:26.002585	0	\N
29	23	1	8	2026-05-25 19:54:34.862853	ENTREGADO		2026-05-25 19:54:43.589665	0	\N
4	2	4	1	2026-05-24 17:42:16.111415	ENTREGADO		2026-05-24 17:42:22.681694	0	\N
3	2	2	2	2026-05-24 17:42:16.111415	ENTREGADO		2026-05-24 17:42:22.681694	0	\N
2	2	1	1	2026-05-24 17:42:16.111415	ENTREGADO		2026-05-24 17:42:22.681694	0	\N
6	3	2	1	2026-05-24 17:43:08.077537	ENTREGADO		2026-05-24 17:43:14.7873	0	\N
5	3	1	1	2026-05-24 17:43:08.077537	ENTREGADO		2026-05-24 17:43:14.7873	0	\N
7	4	4	1	2026-05-24 17:45:08.454218	ENTREGADO		2026-05-24 17:45:29.831625	0	\N
8	5	1	1	2026-05-24 17:49:42.717675	ENTREGADO		2026-05-24 17:50:21.516133	0	\N
9	6	2	1	2026-05-24 17:50:07.852915	ENTREGADO		2026-05-24 17:50:27.342129	0	\N
30	23	1	8	2026-05-25 19:54:34.862853	ENTREGADO		2026-05-25 19:54:55.36431	0	\N
82	69	1	1	2026-05-26 01:53:04.182309	ENTREGADO		2026-05-26 01:53:07.917981	13	\N
31	23	1	1	2026-05-25 19:54:34.862853	ENTREGADO		2026-05-25 19:55:55.712015	0	\N
10	7	1	1	2026-05-24 18:03:54.402162	ENTREGADO		2026-05-24 18:04:00.487773	0	\N
11	8	2	1	2026-05-24 18:04:53.331012	ENTREGADO		2026-05-24 18:05:00.17369	0	\N
12	9	1	1	2026-05-24 18:05:32.341479	ENTREGADO		2026-05-24 18:05:40.263951	0	\N
13	10	2	2	2026-05-24 18:06:36.842982	ENTREGADO		2026-05-24 18:07:11.729687	0	\N
14	11	1	1	2026-05-24 18:07:03.301499	ENTREGADO		2026-05-24 18:11:14.24678	0	\N
15	12	1	1	2026-05-24 20:20:47.910388	ENTREGADO		2026-05-24 20:20:53.694896	0	\N
32	24	1	7	2026-05-25 19:55:51.038942	ENTREGADO		2026-05-25 19:55:55.712015	0	\N
56	46	1	8	2026-05-25 23:08:34.677276	ENTREGADO		2026-05-25 23:08:37.599119	0	\N
16	13	1	1	2026-05-24 20:21:21.301348	ENTREGADO		2026-05-24 20:21:25.613337	0	\N
17	14	1	1	2026-05-24 20:22:32.507666	ENTREGADO		2026-05-24 20:23:14.954202	0	\N
18	15	1	1	2026-05-24 20:23:05.3179	ENTREGADO		2026-05-24 20:32:13.089852	0	\N
19	16	1	1	2026-05-24 21:22:10.486492	ENTREGADO		2026-05-24 21:22:10.676637	0	\N
20	17	1	1	2026-05-25 18:17:58.166698	CANCELADO		2026-05-25 18:17:58.874267	0	\N
35	26	1	1	2026-05-25 20:00:42.203653	ENTREGADO		2026-05-25 20:00:45.507748	0	\N
83	70	1	3	2026-05-26 01:54:27.849817	ENTREGADO		2026-05-26 02:01:00.201524	10	\N
21	18	1	1	2026-05-25 18:21:58.368426	ENTREGADO		2026-05-25 18:21:58.865671	0	\N
22	18	2	2	2026-05-25 18:21:58.368426	ENTREGADO		2026-05-25 18:21:58.865671	0	\N
34	25	1	6	2026-05-25 19:56:48.549307	ENTREGADO		2026-05-25 20:00:09.903331	0	\N
23	19	2	1	2026-05-25 18:24:51.601578	ENTREGADO		2026-05-25 18:24:54.873315	0	\N
24	19	3	1	2026-05-25 18:24:51.601578	ENTREGADO		2026-05-25 18:24:54.873315	0	\N
57	47	1	5	2026-05-25 23:09:35.438863	ENTREGADO		2026-05-25 23:11:32.145677	0	\N
25	20	1	1	2026-05-25 18:25:45.816724	ENTREGADO		2026-05-25 18:40:38.099105	0	\N
26	21	1	1	2026-05-25 18:26:06.047527	ENTREGADO		2026-05-25 18:40:58.974817	0	\N
58	48	2	3	2026-05-25 23:11:24.603795	ENTREGADO		2026-05-25 23:11:32.145677	0	\N
33	25	1	1	2026-05-25 19:56:48.549307	ENTREGADO		2026-05-25 19:58:29.838193	0	\N
72	59	1	1	2026-05-25 23:34:10.971761	ENTREGADO		2026-05-25 23:34:36.395018	0	\N
37	27	1	2	2026-05-25 20:01:45.791954	ENTREGADO		2026-05-25 20:01:59.243547	0	\N
36	27	1	1	2026-05-25 20:01:45.791954	ENTREGADO		2026-05-25 20:01:49.511488	0	\N
38	28	1	1	2026-05-25 20:10:03.398713	ENTREGADO		2026-05-25 20:10:05.503274	0	\N
39	29	2	2	2026-05-25 20:10:24.496593	ENTREGADO		2026-05-25 20:10:25.49458	0	\N
40	30	1	7	2026-05-25 20:18:31.169669	ENTREGADO		2026-05-25 20:18:32.653376	0	\N
59	49	1	8	2026-05-25 23:13:32.700479	ENTREGADO		2026-05-25 23:13:33.611862	0	\N
73	60	1	7	2026-05-25 23:35:28.087415	ENTREGADO		2026-05-25 23:35:30.880627	0	\N
41	31	1	4	2026-05-25 20:18:52.584245	ENTREGADO		2026-05-25 20:19:38.046758	0	\N
42	32	1	4	2026-05-25 20:19:30.074509	ENTREGADO		2026-05-25 20:19:38.046758	0	\N
60	49	1	1	2026-05-25 23:13:32.700479	ENTREGADO		2026-05-25 23:13:46.977929	0	\N
43	32	1	5	2026-05-25 20:19:30.074509	ENTREGADO		2026-05-25 20:20:33.68559	0	\N
74	61	4	1	2026-05-25 23:38:52.416898	ENTREGADO		2026-05-25 23:38:54.872509	0	\N
44	33	1	4	2026-05-25 20:20:22.926633	ENTREGADO		2026-05-25 20:20:57.395192	0	\N
45	34	1	4	2026-05-25 20:21:26.036838	ENTREGADO		2026-05-25 20:21:28.641389	0	\N
46	34	1	8	2026-05-25 20:21:26.036838	ENTREGADO		2026-05-25 20:22:29.597027	0	\N
61	50	1	6	2026-05-25 23:14:32.83176	ENTREGADO		2026-05-25 23:14:33.60298	0	\N
47	35	1	3	2026-05-25 20:24:30.652905	ENTREGADO		2026-05-25 20:24:32.649842	0	\N
48	36	1	5	2026-05-25 20:25:19.215628	ENTREGADO		2026-05-25 20:25:20.649809	0	\N
62	51	1	2	2026-05-25 23:15:02.18469	ENTREGADO		2026-05-25 23:15:05.609758	0	\N
49	36	1	8	2026-05-25 20:25:19.215628	ENTREGADO		2026-05-25 20:25:29.732125	0	\N
51	41	1	5	2026-05-25 23:02:33.384057	ENTREGADO		2026-05-25 23:02:36.158806	0	\N
50	40	1	3	2026-05-25 23:00:32.525518	ENTREGADO		2026-05-25 23:00:37.045471	0	\N
52	42	1	4	2026-05-25 23:05:23.848436	ENTREGADO		2026-05-25 23:05:25.608303	0	\N
63	52	1	8	2026-05-25 23:16:22.561994	ENTREGADO		2026-05-25 23:16:25.601103	0	\N
53	43	2	3	2026-05-25 23:06:01.732349	ENTREGADO		2026-05-25 23:06:05.611573	0	\N
54	44	1	4	2026-05-25 23:07:14.889152	ENTREGADO		2026-05-25 23:07:24.141167	0	\N
64	52	1	1	2026-05-25 23:16:22.561994	ENTREGADO		2026-05-25 23:16:53.962751	0	\N
65	53	1	7	2026-05-25 23:16:49.554995	ENTREGADO		2026-05-25 23:16:53.962751	0	\N
75	62	1	1	2026-05-26 01:39:18.129554	ENTREGADO		2026-05-26 01:39:21.785913	0	\N
76	63	1	1	2026-05-26 01:39:56.355834	ENTREGADO		2026-05-26 01:39:57.784772	0	\N
66	54	1	7	2026-05-25 23:17:48.615754	ENTREGADO		2026-05-25 23:17:49.609732	0	\N
67	55	1	1	2026-05-25 23:18:06.493836	ENTREGADO		2026-05-25 23:18:09.599521	0	\N
69	56	4	1	2026-05-25 23:29:07.620698	ENTREGADO		2026-05-25 23:29:07.626285	0	\N
71	58	4	1	2026-05-25 23:31:29.918842	ENTREGADO		2026-05-25 23:31:30.871946	0	\N
68	56	2	3	2026-05-25 23:29:07.620698	ENTREGADO		2026-05-25 23:29:07.626285	0	\N
70	57	2	5	2026-05-25 23:29:55.725074	ENTREGADO		2026-05-25 23:29:58.880755	0	\N
89	75	2	8	2026-05-26 02:06:05.557769	ENTREGADO		2026-05-26 02:06:11.711413	16	\N
80	67	4	1	2026-05-26 01:42:46.636673	ENTREGADO		2026-05-26 01:42:49.762579	0	\N
79	66	4	1	2026-05-26 01:42:17.9928	ENTREGADO		2026-05-26 01:42:21.770626	0	\N
77	64	1	7	2026-05-26 01:41:18.950155	ENTREGADO		2026-05-26 01:41:21.799486	0	\N
78	65	1	1	2026-05-26 01:41:53.541423	ENTREGADO		2026-05-26 01:41:53.762648	0	\N
84	71	1	7	2026-05-26 02:01:43.075024	ENTREGADO		2026-05-26 02:01:46.965825	12	\N
92	77	2	5	2026-05-26 12:17:14.659484	ENTREGADO		2026-05-26 12:24:30.263665	13	2026-05-26 12:29:52.410267
81	68	1	7	2026-05-26 01:52:20.53457	ENTREGADO		2026-05-26 01:52:21.768879	12	\N
90	75	2	1	2026-05-26 02:06:05.557769	ENTREGADO		2026-05-26 02:06:15.198764	9	\N
85	72	1	1	2026-05-26 02:02:07.121324	ENTREGADO		2026-05-26 02:02:10.977603	13	\N
86	73	4	1	2026-05-26 02:03:02.459527	ENTREGADO		2026-05-26 02:03:02.94902	0	\N
87	74	2	3	2026-05-26 02:05:06.859608	ENTREGADO		2026-05-26 02:05:43.39306	12	\N
88	75	2	8	2026-05-26 02:06:05.557769	ENTREGADO		2026-05-26 02:06:06.972774	16	\N
91	76	1	5	2026-05-26 12:16:22.142516	ENTREGADO		2026-05-26 12:16:25.435707	11	2026-05-26 12:24:30.186186
95	80	1	5	2026-05-26 13:03:03.228308	ENTREGADO		2026-05-26 13:03:05.426169	11	2026-05-26 13:03:33.150758
93	78	1	3	2026-05-26 12:25:38.572367	ENTREGADO		2026-05-26 12:25:41.422368	13	2026-05-26 12:38:50.204844
94	79	1	1	2026-05-26 12:26:23.971413	ENTREGADO	con extra mote	2026-05-26 12:29:52.461803	10	2026-05-26 12:39:29.450217
96	84	1	1	2026-05-26 13:28:57.589305	ENTREGADO		2026-05-26 13:29:01.443504	8	2026-05-26 13:29:24.564283
\.


--
-- TOC entry 3510 (class 0 OID 16445)
-- Dependencies: 221
-- Data for Name: ingrediente; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.ingrediente (id_ingrediente, nombre, stock_actual, precio_extra) FROM stdin;
1	Carne de Cerdo (kg)	50.00	0.00
2	Mote Cocinado (kg)	30.00	0.50
3	Tostado (kg)	20.00	0.40
4	Plátano Maduro (u)	100.00	0.30
5	Papas para Llapingacho (kg)	40.00	0.00
6	Cola Grande Botella (u)	120.00	0.00
\.


--
-- TOC entry 3504 (class 0 OID 16418)
-- Dependencies: 215
-- Data for Name: mesa; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.mesa (id_mesa, numero_mesa, capacidad, estado_mesa) FROM stdin;
1	1	4	LIBRE
2	2	4	LIBRE
3	3	4	LIBRE
4	4	4	LIBRE
5	5	4	LIBRE
6	6	4	LIBRE
\.


--
-- TOC entry 3517 (class 0 OID 16505)
-- Dependencies: 228
-- Data for Name: modificacion_item; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.modificacion_item (id_modificacion, id_detalle, id_ingrediente, tipo, recargo) FROM stdin;
\.


--
-- TOC entry 3513 (class 0 OID 16468)
-- Dependencies: 224
-- Data for Name: pedido; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.pedido (id_pedido, id_mesa, fecha_apertura, fecha_cierre, estado_pago, subtotal, total_final, cliente_nombre) FROM stdin;
1	1	2026-05-24 17:32:04.343562	\N	PENDIENTE	0.00	0.00	Local
2	2	2026-05-24 17:42:16.08924	\N	PENDIENTE	0.00	0.00	Local
3	2	2026-05-24 17:43:08.062192	\N	PENDIENTE	0.00	0.00	Local
4	1	2026-05-24 17:45:08.434404	\N	PENDIENTE	0.00	0.00	Local
5	1	2026-05-24 17:49:42.697518	\N	PENDIENTE	0.00	0.00	Local
6	1	2026-05-24 17:50:07.839773	\N	PENDIENTE	0.00	0.00	Local
7	1	2026-05-24 18:03:51.277008	\N	PENDIENTE	0.00	0.00	Local
8	1	2026-05-24 18:04:53.316361	\N	PENDIENTE	0.00	0.00	Local
9	1	2026-05-24 18:05:32.330128	\N	PENDIENTE	0.00	0.00	Local
10	4	2026-05-24 18:06:36.825149	\N	PENDIENTE	0.00	0.00	Local
11	5	2026-05-24 18:07:03.287835	\N	PENDIENTE	0.00	0.00	Local
12	5	2026-05-24 20:20:47.885992	\N	PENDIENTE	0.00	0.00	Local
13	5	2026-05-24 20:21:21.287367	\N	PENDIENTE	0.00	0.00	Local
14	5	2026-05-24 20:22:32.495492	\N	PENDIENTE	0.00	0.00	Local
15	5	2026-05-24 20:23:05.300676	\N	PENDIENTE	0.00	0.00	Local
16	2	2026-05-24 21:22:10.469011	\N	PENDIENTE	0.00	0.00	Local
17	3	2026-05-25 18:17:58.092217	\N	PENDIENTE	0.00	0.00	Local
18	5	2026-05-25 18:21:58.347255	\N	PENDIENTE	0.00	0.00	Local
19	5	2026-05-25 18:24:51.586863	\N	PENDIENTE	0.00	0.00	Local
20	5	2026-05-25 18:25:45.790863	\N	PENDIENTE	0.00	0.00	Local
21	5	2026-05-25 18:26:06.034036	\N	PENDIENTE	0.00	0.00	Local
22	1	2026-05-25 19:53:32.269159	\N	PENDIENTE	0.00	0.00	Local
23	1	2026-05-25 19:54:34.843848	\N	PENDIENTE	0.00	0.00	Local
24	1	2026-05-25 19:55:51.01833	\N	PENDIENTE	0.00	0.00	Local
25	1	2026-05-25 19:56:48.531299	\N	PENDIENTE	0.00	0.00	Local
26	1	2026-05-25 20:00:42.185535	\N	PENDIENTE	0.00	0.00	Local
27	1	2026-05-25 20:01:45.774397	\N	PENDIENTE	0.00	0.00	Local
28	1	2026-05-25 20:10:03.374628	\N	PENDIENTE	0.00	0.00	Local
29	1	2026-05-25 20:10:24.482388	\N	PENDIENTE	0.00	0.00	Local
30	1	2026-05-25 20:18:31.151845	\N	PENDIENTE	0.00	0.00	Local
31	1	2026-05-25 20:18:52.561344	\N	PENDIENTE	0.00	0.00	Local
32	1	2026-05-25 20:19:30.057735	\N	PENDIENTE	0.00	0.00	Local
33	1	2026-05-25 20:20:22.897946	\N	PENDIENTE	0.00	0.00	Local
34	1	2026-05-25 20:21:26.018665	\N	PENDIENTE	0.00	0.00	Local
35	1	2026-05-25 20:24:30.635988	\N	PENDIENTE	0.00	0.00	Local
36	1	2026-05-25 20:25:19.203545	\N	PENDIENTE	0.00	0.00	Local
40	1	2026-05-25 23:00:32.50769	\N	PENDIENTE	0.00	0.00	Local
41	1	2026-05-25 23:02:33.365361	\N	PENDIENTE	0.00	0.00	Local
42	1	2026-05-25 23:05:23.831189	\N	PENDIENTE	0.00	0.00	Local
43	1	2026-05-25 23:06:01.719812	\N	PENDIENTE	0.00	0.00	Local
44	1	2026-05-25 23:07:14.869934	\N	PENDIENTE	0.00	0.00	Local
45	1	2026-05-25 23:07:50.688641	\N	PENDIENTE	0.00	0.00	Local
46	1	2026-05-25 23:08:34.659033	\N	PENDIENTE	0.00	0.00	Local
47	1	2026-05-25 23:09:35.420586	\N	PENDIENTE	0.00	0.00	Local
48	1	2026-05-25 23:11:24.589873	\N	PENDIENTE	0.00	0.00	Local
49	1	2026-05-25 23:13:32.682202	\N	PENDIENTE	0.00	0.00	Local
50	1	2026-05-25 23:14:32.813932	\N	PENDIENTE	0.00	0.00	Local
51	1	2026-05-25 23:15:02.171773	\N	PENDIENTE	0.00	0.00	Local
52	1	2026-05-25 23:16:22.544241	\N	PENDIENTE	0.00	0.00	Local
53	1	2026-05-25 23:16:49.540336	\N	PENDIENTE	0.00	0.00	Local
54	1	2026-05-25 23:17:48.597583	\N	PENDIENTE	0.00	0.00	Local
55	1	2026-05-25 23:18:06.481141	\N	PENDIENTE	0.00	0.00	Local
56	1	2026-05-25 23:29:07.602289	\N	PENDIENTE	0.00	0.00	Local
57	1	2026-05-25 23:29:55.711997	\N	PENDIENTE	0.00	0.00	Local
58	1	2026-05-25 23:31:29.901271	\N	PENDIENTE	0.00	0.00	Local
59	1	2026-05-25 23:34:10.953281	\N	PENDIENTE	0.00	0.00	Local
60	1	2026-05-25 23:35:28.069516	\N	PENDIENTE	0.00	0.00	Local
61	1	2026-05-25 23:38:52.405255	\N	PENDIENTE	0.00	0.00	Local
62	1	2026-05-26 01:39:18.105193	\N	PENDIENTE	0.00	0.00	Local
63	1	2026-05-26 01:39:56.334579	\N	PENDIENTE	0.00	0.00	Local
64	1	2026-05-26 01:41:18.933191	\N	PENDIENTE	0.00	0.00	Local
65	1	2026-05-26 01:41:53.528636	\N	PENDIENTE	0.00	0.00	Local
66	1	2026-05-26 01:42:17.980444	\N	PENDIENTE	0.00	0.00	Local
67	1	2026-05-26 01:42:46.618978	\N	PENDIENTE	0.00	0.00	Local
68	1	2026-05-26 01:52:20.516853	\N	PENDIENTE	0.00	0.00	Local
69	1	2026-05-26 01:53:04.168487	\N	PENDIENTE	0.00	0.00	Local
70	1	2026-05-26 01:54:27.832749	\N	PENDIENTE	0.00	0.00	Local
71	1	2026-05-26 02:01:43.056515	\N	PENDIENTE	0.00	0.00	Local
72	1	2026-05-26 02:02:07.108161	\N	PENDIENTE	0.00	0.00	Local
73	1	2026-05-26 02:03:02.447349	\N	PENDIENTE	0.00	0.00	Local
74	1	2026-05-26 02:05:06.842592	\N	PENDIENTE	0.00	0.00	Local
75	1	2026-05-26 02:06:05.540545	\N	PENDIENTE	0.00	0.00	Local
76	5	2026-05-26 12:16:22.104931	\N	PENDIENTE	0.00	0.00	Local
77	4	2026-05-26 12:17:14.639955	\N	PENDIENTE	0.00	0.00	Local
78	4	2026-05-26 12:25:38.553018	\N	PENDIENTE	0.00	0.00	Local
79	4	2026-05-26 12:26:23.958349	\N	PENDIENTE	0.00	0.00	Local
80	6	2026-05-26 13:03:03.207797	\N	PENDIENTE	0.00	0.00	Local
84	2	2026-05-26 13:28:57.570673	\N	PENDIENTE	0.00	0.00	Local
\.


--
-- TOC entry 3508 (class 0 OID 16433)
-- Dependencies: 219
-- Data for Name: plato; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.plato (id_plato, id_categoria, nombre, precio_base, tiempo_prep_min, requiere_coccion) FROM stdin;
1	1	Fritada Tradicional	6.50	15	t
2	1	Fritada Especial Doble	9.00	18	t
3	1	Llapingachos	4.00	10	t
4	2	Cola Grande	1.50	1	f
\.


--
-- TOC entry 3511 (class 0 OID 16452)
-- Dependencies: 222
-- Data for Name: receta; Type: TABLE DATA; Schema: public; Owner: admin
--

COPY public.receta (id_plato, id_ingrediente, cantidad_base) FROM stdin;
1	1	0.25
1	2	0.15
1	3	0.05
1	4	1.00
2	1	0.50
2	2	0.15
2	3	0.05
2	4	2.00
3	5	0.30
3	2	0.10
4	6	1.00
\.


--
-- TOC entry 3531 (class 0 OID 0)
-- Dependencies: 216
-- Name: categoria_id_categoria_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.categoria_id_categoria_seq', 2, true);


--
-- TOC entry 3532 (class 0 OID 0)
-- Dependencies: 225
-- Name: detalle_pedido_id_detalle_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.detalle_pedido_id_detalle_seq', 96, true);


--
-- TOC entry 3533 (class 0 OID 0)
-- Dependencies: 220
-- Name: ingrediente_id_ingrediente_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.ingrediente_id_ingrediente_seq', 6, true);


--
-- TOC entry 3534 (class 0 OID 0)
-- Dependencies: 214
-- Name: mesa_id_mesa_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.mesa_id_mesa_seq', 6, true);


--
-- TOC entry 3535 (class 0 OID 0)
-- Dependencies: 227
-- Name: modificacion_item_id_modificacion_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.modificacion_item_id_modificacion_seq', 1, false);


--
-- TOC entry 3536 (class 0 OID 0)
-- Dependencies: 223
-- Name: pedido_id_pedido_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.pedido_id_pedido_seq', 85, true);


--
-- TOC entry 3537 (class 0 OID 0)
-- Dependencies: 218
-- Name: plato_id_plato_seq; Type: SEQUENCE SET; Schema: public; Owner: admin
--

SELECT pg_catalog.setval('public.plato_id_plato_seq', 4, true);


--
-- TOC entry 3338 (class 2606 OID 16431)
-- Name: categoria categoria_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.categoria
    ADD CONSTRAINT categoria_pkey PRIMARY KEY (id_categoria);


--
-- TOC entry 3352 (class 2606 OID 16535)
-- Name: configuracion_operativa configuracion_operativa_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.configuracion_operativa
    ADD CONSTRAINT configuracion_operativa_pkey PRIMARY KEY (id_config);


--
-- TOC entry 3348 (class 2606 OID 16493)
-- Name: detalle_pedido detalle_pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_pkey PRIMARY KEY (id_detalle);


--
-- TOC entry 3342 (class 2606 OID 16451)
-- Name: ingrediente ingrediente_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.ingrediente
    ADD CONSTRAINT ingrediente_pkey PRIMARY KEY (id_ingrediente);


--
-- TOC entry 3336 (class 2606 OID 16424)
-- Name: mesa mesa_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.mesa
    ADD CONSTRAINT mesa_pkey PRIMARY KEY (id_mesa);


--
-- TOC entry 3350 (class 2606 OID 16511)
-- Name: modificacion_item modificacion_item_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.modificacion_item
    ADD CONSTRAINT modificacion_item_pkey PRIMARY KEY (id_modificacion);


--
-- TOC entry 3346 (class 2606 OID 16477)
-- Name: pedido pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.pedido
    ADD CONSTRAINT pedido_pkey PRIMARY KEY (id_pedido);


--
-- TOC entry 3340 (class 2606 OID 16438)
-- Name: plato plato_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.plato
    ADD CONSTRAINT plato_pkey PRIMARY KEY (id_plato);


--
-- TOC entry 3344 (class 2606 OID 16456)
-- Name: receta receta_pkey; Type: CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.receta
    ADD CONSTRAINT receta_pkey PRIMARY KEY (id_plato, id_ingrediente);


--
-- TOC entry 3357 (class 2606 OID 16494)
-- Name: detalle_pedido detalle_pedido_id_pedido_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_id_pedido_fkey FOREIGN KEY (id_pedido) REFERENCES public.pedido(id_pedido);


--
-- TOC entry 3358 (class 2606 OID 16499)
-- Name: detalle_pedido detalle_pedido_id_plato_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_id_plato_fkey FOREIGN KEY (id_plato) REFERENCES public.plato(id_plato);


--
-- TOC entry 3359 (class 2606 OID 16512)
-- Name: modificacion_item modificacion_item_id_detalle_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.modificacion_item
    ADD CONSTRAINT modificacion_item_id_detalle_fkey FOREIGN KEY (id_detalle) REFERENCES public.detalle_pedido(id_detalle);


--
-- TOC entry 3360 (class 2606 OID 16517)
-- Name: modificacion_item modificacion_item_id_ingrediente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.modificacion_item
    ADD CONSTRAINT modificacion_item_id_ingrediente_fkey FOREIGN KEY (id_ingrediente) REFERENCES public.ingrediente(id_ingrediente);


--
-- TOC entry 3356 (class 2606 OID 16478)
-- Name: pedido pedido_id_mesa_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.pedido
    ADD CONSTRAINT pedido_id_mesa_fkey FOREIGN KEY (id_mesa) REFERENCES public.mesa(id_mesa);


--
-- TOC entry 3353 (class 2606 OID 16439)
-- Name: plato plato_id_categoria_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.plato
    ADD CONSTRAINT plato_id_categoria_fkey FOREIGN KEY (id_categoria) REFERENCES public.categoria(id_categoria);


--
-- TOC entry 3354 (class 2606 OID 16462)
-- Name: receta receta_id_ingrediente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.receta
    ADD CONSTRAINT receta_id_ingrediente_fkey FOREIGN KEY (id_ingrediente) REFERENCES public.ingrediente(id_ingrediente);


--
-- TOC entry 3355 (class 2606 OID 16457)
-- Name: receta receta_id_plato_fkey; Type: FK CONSTRAINT; Schema: public; Owner: admin
--

ALTER TABLE ONLY public.receta
    ADD CONSTRAINT receta_id_plato_fkey FOREIGN KEY (id_plato) REFERENCES public.plato(id_plato);


-- Completed on 2026-05-26 14:40:52

--
-- PostgreSQL database dump complete
--

\unrestrict cjChl3gFQYg1Jdrjv7zFhTIL1uummc9XaEpRBWYSYt1gcSWlb8Y81WTlGrRH6jr

