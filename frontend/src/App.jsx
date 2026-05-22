import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [menu, setMenu] = useState([])
  const [cargando, setCargando] = useState(true)
  
  // Estados para controlar el micrófono y la IA
  const [grabando, setGrabando] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const [transcripcion, setTranscripcion] = useState("")
  
  // 1. NUEVO: Estado para almacenar la orden estructurada (El carrito)
  const [carrito, setCarrito] = useState([])

  // Cargar el menú al inicio
  useEffect(() => {
    fetch('http://127.0.0.1:8000/menu')
      .then(respuesta => respuesta.json())
      .then(datos => {
        // Asumiendo que tu JSON tiene una llave "categorias"
        setMenu(datos.categorias || []) 
        setCargando(false)
      })
      .catch(error => {
        console.error("Error conectando con el backend:", error)
        setCargando(false)
      })
  }, [])

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
        // --- NUEVO ESCUDO: Si no hay audio, no enviamos nada ---
        if (audioChunksRef.current.length === 0) {
          console.warn("⚠️ Audio demasiado corto o vacío. No se enviará.");
          setGrabando(false);
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append("audio", audioBlob, "pedido.webm")

        try {
          console.log("Enviando audio al servidor...")
          const respuesta = await fetch("http://127.0.0.1:8000/pedido-voz", {
            method: "POST",
            body: formData,
          })
          
          const resultado = await respuesta.json()
          console.log("Respuesta del servidor:", resultado)
          
          setTranscripcion(resultado.transcripcion)
          
          // 2. NUEVO: Extraemos los pedidos de la IA y los metemos al carrito visual
          if (resultado.orden && resultado.orden.pedidos) {
            setCarrito(carritoActual => [...carritoActual, ...resultado.orden.pedidos])
          }
          
        } catch (error) {
          console.error("Error al enviar el audio:", error)
          alert("Hubo un error al enviar el audio al servidor.")
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

  // 3. NUEVO: Función real para enviar a n8n mediante FastAPI
  const confirmarOrden = async () => {
    try {
      // Empaquetamos el carrito y calculamos un total básico para la base de datos
      const payloadOrden = {
        id_mesa: 1, // Simulamos que es la mesa 1 o el kiosko principal
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

      {/* 4. NUEVO: Renderizado del Carrito de Compras en pantalla */}
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

export default App