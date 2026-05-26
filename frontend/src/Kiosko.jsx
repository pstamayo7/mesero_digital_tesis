import { useState, useEffect, useRef } from 'react'
import './App.css'

function Kiosko() {
  const [menu, setMenu] = useState([])
  const [cargando, setCargando] = useState(true)
  
  // Estados para controlar el micrófono y la IA
  const [grabando, setGrabando] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const [transcripcion, setTranscripcion] = useState("")
  
  // Estado para almacenar la orden estructurada (El carrito)
  const [carrito, setCarrito] = useState([])
  const [tiempoEstimado, setTiempoEstimado] = useState(null)
  const [numeroMesa, setNumeroMesa] = useState(0) // <-- NUEVO ESTADO

  // Cargar el menú al inicio
  useEffect(() => {
    fetch('http://127.0.0.1:8000/menu')
      .then(respuesta => respuesta.json())
      .then(datos => {
        setMenu(datos.categorias || []) 
        setCargando(false)
      })
      .catch(error => {
        console.error("Error conectando con el backend:", error)
        setCargando(false)
      })
  }, [])
  useEffect(() => {
    if (carrito.length > 0) {
      fetch('http://127.0.0.1:8000/estimar-tiempo', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(carrito)
      })
      .then(res => res.json())
      .then(data => {
        setTiempoEstimado(data.tiempo_estimado_minutos);
      })
      .catch(err => console.error("Error estimando tiempo:", err));
    } else {
      setTiempoEstimado(null);
    }
  }, [carrito]);
  // Función para empezar a escuchar
  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

    mediaRecorderRef.current.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          console.warn("⚠️ Audio demasiado corto o vacío. No se enviará.");
          setGrabando(false);
          return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append("audio", audioBlob, "pedido.webm")
        
        // 🌟 CORRECCIÓN 1: Enviamos el carrito Y el número de mesa en la memoria
        formData.append("carrito_actual", JSON.stringify({ 
          numero_mesa: numeroMesa, 
          pedidos: carrito 
        }))

        try {
          console.log("Enviando audio y memoria al servidor...")
          
          const respuesta = await fetch("http://127.0.0.1:8000/pedido-voz", {
            method: "POST",
            body: formData,
          })
          
          if (respuesta.ok) {
            const resultado = await respuesta.json();
            console.log("Respuesta del servidor:", resultado);
            
            if (resultado.transcripcion) {
              setTranscripcion(resultado.transcripcion);
            }
            
            if (resultado.orden) {
              // Actualizamos los pedidos
              if (resultado.orden.pedidos) {
                setCarrito(resultado.orden.pedidos); 
              }
              // 🌟 CORRECCIÓN 2: Extraemos el número de mesa y lo guardamos
              if (resultado.orden.numero_mesa !== undefined) {
                setNumeroMesa(resultado.orden.numero_mesa);
              }
            }
            
            // Reproducimos el audio
            if (resultado.audio_b64) {
              const audioUrl = `data:audio/wav;base64,${resultado.audio_b64}`;
              const audioMesero = new Audio(audioUrl);
              audioMesero.play();
            }
            
          } else {
            console.error("Error en la petición de voz.");
          }
          
        } catch (error) {
          console.error("Error al enviar el audio:", error)
        }
      }

      mediaRecorderRef.current.start()
      setGrabando(true)
    } catch (error) {
      console.error("Error al acceder al micrófono:", error)
      alert("Por favor, permite el acceso al micrófono para dictar tu pedido.")
    }
  }

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && grabando) {
      mediaRecorderRef.current.stop()
      setGrabando(false)
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
  }

  // Función real para enviar a n8n mediante FastAPI
  const confirmarOrden = async () => {
    try {
      const payloadOrden = {
        id_mesa: numeroMesa > 0 ? numeroMesa : 1, // Si no dijo, por defecto 1
        pedidos: carrito
      }

      const respuesta = await fetch("http://127.0.0.1:8000/confirmar-orden", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payloadOrden)
      })

      if (respuesta.ok) {
        alert("¡Orden confirmada! Se está preparando en cocina.");
        setCarrito([]); // Vaciamos el carrito tras el éxito
        setTranscripcion(""); 
      } else {
        alert("Hubo un problema al enviar la orden a cocina.");
      }

    } catch (error) {
      console.error("Error al confirmar:", error);
      alert("Error de conexión al confirmar la orden.");
    }
  }

  return (
    <div className="kiosko">
      <h1>🥟 Kiosko - Fritadas Doña Zita</h1>
      
      <div className="zona-microfono">
        <button 
          className={`btn-microfono ${grabando ? 'grabando' : ''}`}
          onMouseDown={iniciarGrabacion}
          onMouseUp={detenerGrabacion}
          onTouchStart={iniciarGrabacion}
          onTouchEnd={detenerGrabacion}
        >
          {grabando ? "🎙️ Escuchando... (Suelta para enviar)" : "🎤 Mantén presionado para pedir"}
        </button>
      </div>

      {transcripcion && (
        <div className="caja-transcripcion">
          <p><strong>🗣️ Te escuché decir:</strong> "{transcripcion}"</p>
        </div>
      )}

      {/* Renderizado del Carrito de Compras en pantalla */}
      {carrito.length > 0 && (
        <div className="carrito-contenedor" style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px', margin: '20px 0', border: '2px solid #28a745' }}>
          <h2>🛒 Resumen de tu Pedido</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {carrito.map((item, index) => (
              <li key={index} style={{ fontSize: '1.2rem', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #ccc' }}>
                <strong>{item.cantidad}x</strong> {item.plato}
                {item.modificaciones && (
                  <span style={{ color: '#d9534f', display: 'block', fontSize: '1rem', marginLeft: '30px' }}>
                    * Nota: {item.modificaciones}
                  </span>
                )}
              </li>
            ))}
           {tiempoEstimado > 0 && (
            <div style={{ background: '#e9ecef', padding: '15px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', border: '1px solid #ced4da' }}>
              <span style={{ fontSize: '1.2rem', color: '#495057', display: 'block', marginBottom: '5px' }}>
                Tu pedido entrará en cola de producción
              </span>
              <span style={{ fontSize: '1.4rem', color: '#d97706', fontWeight: 'bold' }}>
                ⏱️ Tiempo estimado: {tiempoEstimado} - {tiempoEstimado + 5} minutos
              </span>
            </div>
          )}
          </ul>
          <button 
            onClick={confirmarOrden}
            style={{ background: '#28a745', color: 'white', padding: '15px 30px', fontSize: '1.2rem', border: 'none', borderRadius: '8px', cursor: 'pointer', width: '100%' }}>
            Confirmar Orden
          </button>
        </div>
      )}
      
      {cargando ? (
        <p className="mensaje-carga">Encendiendo los fogones (Cargando menú)...</p>
      ) : (
        <div className="menu-contenedor">
          {menu.map((categoria) => (
            <div key={categoria.id_categoria} className="categoria">
              <h2>{categoria.nombre}</h2>
              <div className="platos-grid">
                {categoria.platos.map((plato) => (
                  <div key={plato.id_plato} className="tarjeta-plato">
                    <h3>{plato.nombre}</h3>
                    <p>{plato.descripcion}</p>
                    <div className="plato-footer">
                      <span className="precio">${plato.precio.toFixed(2)}</span>
                      <button className="btn-agregar">Agregar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default Kiosko