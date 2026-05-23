# backend/app/api/rutas_voz.py
from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import FileResponse
import tempfile
import os
from app.services.ia_service import procesar_audio_con_ia

router = APIRouter()

@router.post("/pedido-voz")
async def procesar_audio(
    audio: UploadFile = File(...), 
    carrito_actual: str = Form("[]") # <-- ¡Aquí recibimos la memoria desde React!
):
    print(f"\n🎙️ Recibiendo audio y estado actual del carrito...")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
        contenido = await audio.read()
        temp_audio.write(contenido)
        ruta_temporal = temp_audio.name
        
    try:
        resultado = procesar_audio_con_ia(ruta_temporal, carrito_actual)
        
        if resultado.get("exito"):
            # Para enviar el archivo de audio Y los datos JSON juntos, 
            # guardamos los datos en las cabeceras (headers) de la respuesta.
            import json
            headers = {
                "X-Transcripcion": resultado["transcripcion"].encode('latin-1', 'ignore').decode('latin-1'),
                "X-Orden-JSON": json.dumps(resultado["orden"])
            }
            
            # Devolvemos el archivo de audio. El navegador de React lo reproducirá automáticamente.
            return FileResponse(
                path=resultado["ruta_audio"], 
                media_type="audio/wav", 
                headers=headers
            )
        else:
            return {"error": resultado["error"]}
            
    finally:
        os.remove(ruta_temporal)