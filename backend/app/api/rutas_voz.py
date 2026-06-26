from fastapi import APIRouter, UploadFile, File, Form
from fastapi.responses import JSONResponse
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

        # 🚫 TAREA 1: Audio inválido/ruido o Whisper colapsó. ia_service.py ya abortó
        # antes de llamar a Ollama; devolvemos su JSON exacto en 200 OK, sin envolverlo
        # en la estructura "orden/audio_b64" porque no hubo nada que procesar.
        if resultado.get("audio_invalido"):
            return JSONResponse(status_code=200, content={
                "razonamiento": resultado["razonamiento"],
                "respuesta_mesero": resultado["respuesta_mesero"],
                "numero_mesa": resultado["numero_mesa"],
                "acciones": resultado["acciones"],
            })

        if resultado.get("exito"):
            ruta_audio = resultado.get("ruta_audio")
            audio_b64 = None

            # 🛡️ Blindaje anti-crash: si el .wav esperado no existe (TTS falló, ruta
            # estática que ya no se genera, etc.), NO tumbamos el servidor con un
            # FileNotFoundError. Degradamos a una respuesta sin audio (200 OK) para
            # que React siga mostrando el carrito/mensaje aunque no haya voz.
            if ruta_audio and os.path.exists(ruta_audio):
                try:
                    with open(ruta_audio, "rb") as f_audio:
                        audio_b64 = base64.b64encode(f_audio.read()).decode("utf-8")
                finally:
                    os.remove(ruta_audio)
            else:
                print(f"⚠️ Audio no encontrado ('{ruta_audio}'). Respondiendo sin audio_b64.")

            # Devolvemos todo estructurado en un solo objeto de respuesta estándar
            return {
                "transcripcion": resultado["transcripcion"],
                "orden": resultado["orden"],
                "audio_b64": audio_b64
            }
        else:
            # Fallo controlado de la IA (JSON inválido, etc.): 400, no 500.
            return JSONResponse(
                status_code=400,
                content={"error": resultado.get("error", "Error desconocido procesando el audio")}
            )

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
                try:
                    with open(ruta_audio, "rb") as f_audio:
                        audio_b64 = base64.b64encode(f_audio.read()).decode("utf-8")
                finally:
                    os.remove(ruta_audio)
            else:
                print(f"⚠️ Audio de bienvenida no encontrado ('{ruta_audio}'). Respondiendo sin audio_b64.")

            # Devolvemos el estado de la conversación y el audio
            return {
                "transcripcion": resultado["transcripcion"],
                "estado_conversacion": resultado["estado_conversacion"],
                "audio_b64": audio_b64
            }
        else:
            return JSONResponse(
                status_code=400,
                content={"error": resultado.get("error", "Error desconocido")}
            )
            
    finally:
        # Eliminamos el .webm de entrada
        if os.path.exists(ruta_temporal):
            os.remove(ruta_temporal)