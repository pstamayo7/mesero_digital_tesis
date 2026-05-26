from fastapi import APIRouter, UploadFile, File, Form
import tempfile
import os
import base64
from app.services.ia_service import procesar_audio_con_ia

router = APIRouter()

@router.post("/pedido-voz")
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
            
            # 🌟 SOLUCIÓN AL BUG: Codificamos el audio en Base64 para enviarlo en el cuerpo JSON
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
        os.remove(ruta_temporal)