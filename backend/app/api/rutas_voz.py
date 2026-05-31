from fastapi import APIRouter, UploadFile, File, Form
import tempfile
import os
import base64
from app.services.ia_service import procesar_audio_con_ia, procesar_audio_bienvenida

router = APIRouter()

@router.post("/pedido-voz", tags=["Interacción Voz"])
async def procesar_audio(
    audio: UploadFile = File(...), 
    carrito_actual: str = Form("[]")
):
    print(f"\n🎙️ Recibiendo audio y estado actual del carrito...")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
        contenido = await audio.read()
        temp_audio.write(contenido)
        ruta_temporal = temp_audio.name
        
    try:
        resultado = procesar_audio_con_ia(ruta_temporal, carrito_actual)
        
        if resultado.get("exito"):
            ruta_audio = resultado["ruta_audio"]
            
            # Codificamos el audio en Base64 para enviarlo en el cuerpo JSON
            with open(ruta_audio, "rb") as f_audio:
                audio_b64 = base64.b64encode(f_audio.read()).decode("utf-8")
            
            # Limpiamos el archivo temporal generado por pyttsx3
            if os.path.exists(ruta_audio):
                os.remove(ruta_audio)

            # Devolvemos todo estructurado en un solo objeto de respuesta estándar
            return {
                "transcripcion": resultado["transcripcion"],
                "orden": resultado["orden"],
                "audio_b64": audio_b64
            }
        else:
            return {"error": resultado["error"]}
            
    finally:
        if os.path.exists(ruta_temporal):
            os.remove(ruta_temporal)


@router.post("/bienvenida-voz", tags=["Interacción Voz"])
async def bienvenida_voz(
    audio: UploadFile = File(...),
    estado_actual_nombre: str = Form("")
):
    print(f"\n🎙️ Recibiendo audio para bienvenida... (Memoria actual: '{estado_actual_nombre}')")
    
    # Usamos la misma lógica segura de archivos temporales
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
        contenido = await audio.read()
        temp_audio.write(contenido)
        ruta_temporal = temp_audio.name
        
    try:
        # Llamamos a la nueva función de ia_service exclusiva para la bienvenida
        resultado = procesar_audio_bienvenida(ruta_temporal, estado_actual_nombre)
        
        if resultado.get("exito"):
            ruta_audio = resultado.get("ruta_audio")
            audio_b64 = None
            
            # Codificamos el audio hablado de la anfitriona
            if ruta_audio and os.path.exists(ruta_audio):
                with open(ruta_audio, "rb") as f_audio:
                    audio_b64 = base64.b64encode(f_audio.read()).decode("utf-8")
                
                # Limpiamos el .wav generado
                os.remove(ruta_audio)

            # Devolvemos el estado de la conversación y el audio
            return {
                "transcripcion": resultado["transcripcion"],
                "estado_conversacion": resultado["estado_conversacion"],
                "audio_b64": audio_b64
            }
        else:
            return {"error": resultado.get("error", "Error desconocido")}
            
    finally:
        # Eliminamos el .webm de entrada
        if os.path.exists(ruta_temporal):
            os.remove(ruta_temporal)