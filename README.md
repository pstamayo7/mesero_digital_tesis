# 🍽️ Mesero Digital Asistido por IA (Edge AI)

![React](https://img.shields.io/badge/Frontend-React-61DAFB?logo=react&logoColor=black)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![Ollama](https://img.shields.io/badge/AI_Engine-Llama_3-000000?logo=ollama&logoColor=white)
![n8n](https://img.shields.io/badge/Orchestration-n8n-FF6C37?logo=n8n&logoColor=white)

Proyecto de titulación para la modernización y automatización operativa de la franquicia gastronómica **Fritadas Doña Zita** (Ibarra, Ecuador). Este sistema integral resuelve los cuellos de botella en la toma de pedidos mediante una arquitectura de microservicios, interacción multimodal por voz y procesamiento de Lenguaje Natural ejecutado 100% en local (Edge Computing).

---

## 🚀 Características Principales

El sistema está dividido en múltiples módulos bajo un esquema de Control de Acceso Basado en Roles (RBAC):

### 1. Kiosko Interactivo (Comensales)
*   **Interacción Multimodal:** Captura de pedidos por voz usando **Faster-Whisper** (STT) y respaldo de control táctil.
*   **Procesamiento Semántico Local:** Extracción de intenciones y estructuración de comandas (ej. *"sin cebolla"*) mediante **Llama 3** vía Ollama.
*   **Teoría de Colas:** Cálculo y visualización dinámica del tiempo de espera estimado en tiempo real.
*   **Privacidad por Diseño:** Al ejecutarse localmente (Edge AI), la biometría vocal del cliente nunca viaja a la nube.

### 2. Monitor de Cocina (Kanban)
*   **Flujo FIFO con WebSockets:** Actualización de comandas en tiempo real.
*   **Gestión de Tiempos:** Temporizadores regresivos dinámicos por tarjeta.
*   **Manejo de Excepciones:** Botones rápidos para reporte de errores humanos, falta de stock repentina o cancelación de cliente.

### 3. Panel de Administración y Caja
*   **Autenticación y Seguridad:** Ingreso protegido por **JWT** y contraseñas hasheadas (bcrypt). Trazabilidad automática de transacciones por cajero.
*   **Gestión Operativa:** CRUD completo para el Menú (con carga de imágenes), Gestión de Usuarios (Roles) y Alertas visuales de stock crítico.
*   **Asesor Operativo (Oráculo IA):** Análisis automático del rendimiento financiero e insights gerenciales generados por IA a partir de los datos del sistema.

---

## 🏗️ Arquitectura del Sistema

*   **Frontend:** React.js + Tailwind CSS (Diseño responsivo y adaptado al Modo Kiosko).
*   **Backend transaccional:** FastAPI (Python) validando entradas estrictamente con Pydantic para evitar Inyecciones SQL.
*   **Base de Datos:** PostgreSQL.
*   **Orquestación Asíncrona:** n8n (Low-code) para manejar el enrutamiento de webhooks entre el kiosko, la base de datos y la cocina.
*   **Motor de Inteligencia Artificial (Edge):** Ollama (Llama 3) para NLP y Faster-Whisper para transcripción de audio.

---

## ⚙️ Requisitos Previos

Dado que el proyecto ejecuta Inteligencia Artificial de forma local, se recomienda el siguiente hardware mínimo para el servidor:
*   CPU: Multi-core (Intel i5/i7 de 10.ª Gen o Ryzen equivalente).
*   RAM: 16 GB (Recomendado 32 GB para ejecutar Llama 3 con fluidez).
*   GPU (Opcional pero recomendado): NVIDIA RTX 3060 o superior para acelerar Whisper y Ollama.
*   Software: Node.js, Python 3.10+, PostgreSQL, Docker (para n8n y Ollama).

---

## 🛠️ Instalación y Despliegue

### 1. Clonar el repositorio
bash
git clone [https://github.com/tu-usuario/mesero-digital.git](https://github.com/tu-usuario/mesero-digital.git)
cd mesero-digital


# Descargar e iniciar Llama 3
ollama run llama3

cd backend
python -m venv venv
source venv/bin/activate  # En Windows: venv\Scripts\activate
pip install -r requirements.txt
# Configurar variables de entorno (.env) para DB y JWT secret
uvicorn app.main:app --reload




