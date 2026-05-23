# backend/app/api/rutas_voz.py
from fastapi import APIRouter, UploadFile, File
import tempfile
import os

# AÑADE 'app.' AL PRINCIPIO:
from app.services.ia_service import procesar_audio_con_ia

router = APIRouter()

@router.post("/pedido-voz")
async def procesar_audio(audio: UploadFile = File(...)):
    print(f"\n🎙️ Recibiendo audio del Kiosko...")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
        contenido = await audio.read()
        temp_audio.write(contenido)
        ruta_temporal = temp_audio.name
        
    try:
        # Llamamos al servicio que aisla toda la lógica de Whisper y Ollama
        resultado = procesar_audio_con_ia(ruta_temporal)
        
        if resultado.get("exito"):
            return {
                "mensaje": "Audio procesado y analizado con éxito",
                "transcripcion": resultado["transcripcion"],
                "orden": resultado["orden"]
            }
        else:
            return {"error": resultado["error"], "texto_crudo": resultado.get("texto_crudo")}
            
    finally:
        os.remove(ruta_temporal)