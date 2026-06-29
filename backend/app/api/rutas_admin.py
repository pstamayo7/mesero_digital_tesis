from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from typing import List, Optional
from psycopg2.extras import RealDictCursor
from app.core.database import get_db
from fastapi import APIRouter, UploadFile, File, Depends, Form
import shutil
import os
from app.core.database import get_db
from app.core.seguridad import verificar_rol_requerido

# 🌟 RBAC: Administración es exclusiva del rol 'administrador'.
router = APIRouter(
    prefix="/admin",
    tags=["Administración"],
    dependencies=[Depends(verificar_rol_requerido(["administrador"]))],
)

# ==========================================
# ESQUEMAS PYDANTIC
# ==========================================
class ConfigOperativaUpdate(BaseModel):
    max_platos_kiosko: int
    capacidad_paila_cocina: int
    cantidad_cocineros: int
    porcentaje_tiempo_extra: float
    total_paletas: int

class IngredienteBase(BaseModel):
    nombre: str
    stock_actual: float
    precio_extra: float

    @field_validator("nombre")
    @classmethod
    def sin_espacios_fantasma(cls, v: str) -> str:
        return v.strip()

class PlatoBase(BaseModel):
    id_categoria: int
    nombre: str
    precio_base: float
    requiere_coccion: bool
    tiempo_prep_min: int

    @field_validator("nombre")
    @classmethod
    def sin_espacios_fantasma(cls, v: str) -> str:
        # Evita que "Combo Especial " se guarde distinto de "Combo Especial"
        # y rompa el cruce de nombres con el LLM (ver ia_service.py).
        return v.strip()

class RecetaItem(BaseModel):
    id_plato: int
    id_ingrediente: int
    cantidad_base: float  # 🌟 CORREGIDO AQUÍ

# ==========================================
# RUTAS DE CONFIGURACIÓN
# ==========================================

@router.get("/configuracion")
def obtener_configuracion(db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor) 
    cursor.execute("SELECT * FROM configuracion_operativa LIMIT 1;")
    config = cursor.fetchone()
    return config if config else {"max_platos_kiosko": 10, "capacidad_paila_cocina": 5, "cantidad_cocineros": 2, "porcentaje_tiempo_extra": 0.10, "total_paletas": 20}

@router.put("/configuracion")
def actualizar_configuracion(config_data: ConfigOperativaUpdate, db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id_config FROM configuracion_operativa LIMIT 1;")
    existe = cursor.fetchone()
    if existe:
        cursor.execute("UPDATE configuracion_operativa SET max_platos_kiosko=%s, capacidad_paila_cocina=%s, cantidad_cocineros=%s, porcentaje_tiempo_extra=%s, total_paletas=%s WHERE id_config=%s", 
                       (config_data.max_platos_kiosko, config_data.capacidad_paila_cocina, config_data.cantidad_cocineros, config_data.porcentaje_tiempo_extra, config_data.total_paletas, existe['id_config']))
    else:
        cursor.execute("INSERT INTO configuracion_operativa (max_platos_kiosko, capacidad_paila_cocina, cantidad_cocineros, porcentaje_tiempo_extra, total_paletas) VALUES (%s, %s, %s, %s, %s)", 
                       (config_data.max_platos_kiosko, config_data.capacidad_paila_cocina, config_data.cantidad_cocineros, config_data.porcentaje_tiempo_extra, config_data.total_paletas))
    db.commit()
    return {"mensaje": "Configuración actualizada"}

# ==========================================
# RUTAS DE INVENTARIO E INGREDIENTES
# ==========================================
@router.get("/ingredientes")
def obtener_ingredientes(db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM ingrediente ORDER BY nombre ASC;")
    return cursor.fetchall() 

@router.post("/ingredientes")
def crear_ingrediente(ing: IngredienteBase, db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    cursor.execute("INSERT INTO ingrediente (nombre, stock_actual, precio_extra) VALUES (%s, %s, %s) RETURNING id_ingrediente;", (ing.nombre, ing.stock_actual, ing.precio_extra))
    id_nuevo = cursor.fetchone()['id_ingrediente']
    db.commit()
    return {"mensaje": "Ingrediente creado", "id_ingrediente": id_nuevo}

@router.put("/ingredientes/{id_ingrediente}")
def editar_ingrediente(id_ingrediente: int, ing: IngredienteBase, db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    cursor.execute("UPDATE ingrediente SET nombre=%s, stock_actual=%s, precio_extra=%s WHERE id_ingrediente=%s", (ing.nombre, ing.stock_actual, ing.precio_extra, id_ingrediente))
    db.commit()
    return {"mensaje": "Ingrediente actualizado"}


# ==========================================
# RUTAS DE MENÚ (PLATOS)
# ==========================================
@router.get("/categorias")
def obtener_categorias(db=Depends(get_db)):
    """Catálogo estricto de categorías ('Comida', 'Bebida', 'Porciones') para alimentar
    el <select> del Dashboard. Viven en la tabla Categoria, no como texto libre en Plato."""
    cursor = db.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id_categoria, nombre FROM categoria ORDER BY id_categoria ASC;")
    return cursor.fetchall()

@router.get("/platos")
def obtener_platos_admin(db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT p.*, c.nombre as categoria_nombre
        FROM plato p LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
        WHERE p.activo = True
        ORDER BY c.nombre ASC, p.nombre ASC;
    """)
    return cursor.fetchall()

@router.post("/platos")
def crear_plato(plato: PlatoBase, db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    cursor.execute("INSERT INTO plato (id_categoria, nombre, precio_base, requiere_coccion, tiempo_prep_min) VALUES (%s, %s, %s, %s, %s) RETURNING id_plato;",
                   (plato.id_categoria, plato.nombre, plato.precio_base, plato.requiere_coccion, plato.tiempo_prep_min))
    id_nuevo = cursor.fetchone()['id_plato']
    db.commit()
    return {"mensaje": "Plato creado", "id_plato": id_nuevo}

@router.put("/platos/{id_plato}")
def editar_plato(id_plato: int, plato: PlatoBase, db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    cursor.execute("UPDATE plato SET id_categoria=%s, nombre=%s, precio_base=%s, requiere_coccion=%s, tiempo_prep_min=%s WHERE id_plato=%s",
                   (plato.id_categoria, plato.nombre, plato.precio_base, plato.requiere_coccion, plato.tiempo_prep_min, id_plato))
    db.commit()
    return {"mensaje": "Plato actualizado"}

@router.delete("/platos/{id_plato}")
def eliminar_plato(id_plato: int, db=Depends(get_db)):
    """Borrado lógico: nunca un DELETE FROM, para no romper la integridad referencial
    de pedidos históricos (detalle_pedido, receta) que ya apuntan a este id_plato."""
    cursor = db.cursor(cursor_factory=RealDictCursor)
    cursor.execute("UPDATE plato SET activo = False WHERE id_plato = %s", (id_plato,))
    db.commit()
    return {"mensaje": "Plato eliminado del menú"}


@router.get("/platos/todos")
async def obtener_todos_los_platos(db = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id_plato, nombre, precio_base, ruta_imagen FROM plato WHERE activo = True ORDER BY id_plato")
    filas = cursor.fetchall()
    
    # 🌟 CORRECCIÓN: Convertimos las tuplas crudas a diccionarios que React pueda entender
    platos_formateados = []
    for fila in filas:
        platos_formateados.append({
            "id_plato": fila[0],
            "nombre": fila[1],
            "precio_base": fila[2],
            "ruta_imagen": fila[3]
        })
        
    return {"platos": platos_formateados}

@router.post("/platos/{id_plato}/imagen")
async def subir_imagen_plato(id_plato: int, imagen: UploadFile = File(...), db = Depends(get_db)):
    # 1. Definimos dónde se va a guardar
    extension = imagen.filename.split(".")[-1]
    nombre_archivo = f"plato_{id_plato}.{extension}"
    ruta_fisica = f"app/static/imagenes/{nombre_archivo}"
    
    # 2. Guardamos el archivo en el disco duro
    with open(ruta_fisica, "wb") as buffer:
        shutil.copyfileobj(imagen.file, buffer)
        
    # 3. Actualizamos la base de datos con la ruta pública
    ruta_publica = f"/imagenes/{nombre_archivo}"
    cursor = db.cursor()
    cursor.execute("UPDATE plato SET ruta_imagen = %s WHERE id_plato = %s", (ruta_publica, id_plato))
    db.commit()
    
    return {"mensaje": "Imagen subida con éxito", "ruta_imagen": ruta_publica}

# ==========================================
# RUTAS DE RECETAS (¡NUEVO!)
# ==========================================
@router.get("/receta/{id_plato}")
def obtener_receta(id_plato: int, db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    cursor.execute("""
        SELECT r.id_ingrediente, r.cantidad_base, i.nombre as ingrediente_nombre, i.stock_actual
        FROM receta r JOIN ingrediente i ON r.id_ingrediente = i.id_ingrediente WHERE r.id_plato = %s
    """, (id_plato,)) # 🌟 CORREGIDO AQUÍ
    return cursor.fetchall()

@router.post("/receta")
def agregar_ingrediente_receta(receta: RecetaItem, db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    cursor.execute("DELETE FROM receta WHERE id_plato=%s AND id_ingrediente=%s", (receta.id_plato, receta.id_ingrediente))
    cursor.execute("INSERT INTO receta (id_plato, id_ingrediente, cantidad_base) VALUES (%s, %s, %s)", (receta.id_plato, receta.id_ingrediente, receta.cantidad_base)) # 🌟 CORREGIDO AQUÍ
    db.commit()
    return {"mensaje": "Receta actualizada"}

@router.delete("/receta/{id_plato}/{id_ingrediente}")
def quitar_ingrediente_receta(id_plato: int, id_ingrediente: int, db=Depends(get_db)):
    cursor = db.cursor(cursor_factory=RealDictCursor)
    cursor.execute("DELETE FROM receta WHERE id_plato=%s AND id_ingrediente=%s", (id_plato, id_ingrediente))
    db.commit()
    return {"mensaje": "Ingrediente quitado de la receta"}