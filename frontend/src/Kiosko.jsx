import { useState, useEffect, useRef } from 'react'
import './App.css'

function Kiosko() {
  const [pasoActual, setPasoActual] = useState(0);
  const [mesasLibres, setMesasLibres] = useState([]);
  const [esParaLlevar, setEsParaLlevar] = useState(false);

  // 🌟 ESTADOS PARA EL NOMBRE Y TECLADO
  const [nombreCliente, setNombreCliente] = useState("");
  const [mostrarTeclado, setMostrarTeclado] = useState(false);
  const [grabandoNombre, setGrabandoNombre] = useState(false);
  const [mensajeAnfitriona, setMensajeAnfitriona] = useState(""); // Para mostrar lo que dice la IA

  const [menu, setMenu] = useState([])
  const [cargando, setCargando] = useState(true)
  const [grabando, setGrabando] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const [transcripcion, setTranscripcion] = useState("")
  const [carrito, setCarrito] = useState([])
  const [tiempoEstimado, setTiempoEstimado] = useState(null)
  const [numeroMesa, setNumeroMesa] = useState(0)
  const [limitePlatos, setLimitePlatos] = useState(15);
  const [errorStock, setErrorStock] = useState(""); //

  useEffect(() => {
    fetch('http://127.0.0.1:8000/configuracion-kiosko')
      .then(res => res.json())
      .then(data => setLimitePlatos(data.max_platos))
      .catch(err => console.error("Usando límite por defecto", err));
  }, []);

  useEffect(() => {
    if (pasoActual === 0) {
      fetch('http://127.0.0.1:8000/mesas-disponibles')
        .then(res => res.json())
        .then(data => setMesasLibres(data.disponibles || []))
        .catch(err => console.error("Error cargando mesas", err));
    }
  }, [pasoActual]);

  const totalPlatosPedido = carrito.reduce((acumulador, item) => acumulador + (parseInt(item.cantidad) || 1), 0);
  const excedeLimite = totalPlatosPedido > limitePlatos;

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
      // 1. Petición original para estimar el tiempo
      fetch('http://127.0.0.1:8000/estimar-tiempo', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(carrito)
      })
        .then(res => res.json())
        .then(data => setTiempoEstimado(data.tiempo_estimado_minutos))
        .catch(err => console.error("Error estimando tiempo:", err));

      // 🌟 2. NUEVA PETICIÓN: Validar stock en tiempo real
      fetch('http://127.0.0.1:8000/validar-carrito', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(carrito)
      })
        .then(res => res.json())
        .then(data => {
          if (!data.valido) {
            // Si el backend dice que no hay, bloqueamos la pantalla
            setErrorStock(`Stock insuficiente de ${data.ingrediente}. Quedan ${data.stock} en bodega.`);
          } else {
            // Si el backend dice que todo está bien (ej. le dio al botón '-'), limpiamos el error
            setErrorStock(""); 
          }
        })
        .catch(err => console.error("Error validando stock:", err));

    } else {
      setTiempoEstimado(null);
      setErrorStock("");
    }
  }, [carrito]);

 // =====================================================================
  // CARRITO TÁCTIL (AHORA CON COSTEO MATEMÁTICO)
  // =====================================================================
  const agregarAlCarrito = (platoNombre) => {
   
    setCarrito(prev => {
      const index = prev.findIndex(item => item.plato === platoNombre && !item.modificaciones);
      
      // Buscamos el precio base del plato en el estado 'menu'
      let precioBase = 0;
      menu.forEach(categoria => {
        const platoEncontrado = categoria.platos.find(p => p.nombre === platoNombre);
        if (platoEncontrado) precioBase = platoEncontrado.precio;
      });

      if (index !== -1) {
        const nuevoCarrito = [...prev];
        const nuevaCant = parseInt(nuevoCarrito[index].cantidad) + 1;
        nuevoCarrito[index] = {
          ...nuevoCarrito[index],
          cantidad: nuevaCant,
          subtotal: (nuevoCarrito[index].precio_unitario || precioBase) * nuevaCant
        };
        return nuevoCarrito;
      }
      
      return [...prev, { 
        plato: platoNombre, 
        cantidad: 1, 
        modificaciones: "",
        mods_estructuradas: [],
        precio_unitario: precioBase,
        subtotal: precioBase
      }];
    });
  };

  const cambiarCantidad = (index, delta) => {
    setErrorStock(""); // Limpiamos la alerta si el usuario modifica el carrito a mano
    setCarrito(prev => {
      const nuevoCarrito = [...prev];
      const nuevaCantidad = parseInt(nuevoCarrito[index].cantidad) + delta;

      if (nuevaCantidad <= 0) {
        nuevoCarrito.splice(index, 1);
      } else {
        const item = nuevoCarrito[index];
        // Calculamos los recargos de los extras por si la IA los agregó
        const recargosExtras = (item.mods_estructuradas || []).reduce((suma, mod) => suma + (mod.recargo || 0), 0);
        const precioBase = item.precio_unitario || 0;

        nuevoCarrito[index] = {
          ...item,
          cantidad: nuevaCantidad,
          subtotal: (precioBase + recargosExtras) * nuevaCantidad
        };
      }
      return nuevoCarrito;
    });
  };

  // =====================================================================
  // 🌟 NUEVAS FUNCIONES: IA CONVERSACIONAL PARA LA BIENVENIDA
  // =====================================================================
  const iniciarGrabacionBienvenida = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          setGrabandoNombre(false); return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append("audio", audioBlob, "bienvenida.webm");
        formData.append("estado_actual_nombre", nombreCliente); // Le pasamos la memoria

        try {
          const respuesta = await fetch("http://127.0.0.1:8000/bienvenida-voz", {
            method: "POST",
            body: formData
          });

          if (respuesta.ok) {
            const resultado = await respuesta.json();

            // 1. Mostramos el mensaje en pantalla
            if (resultado.estado_conversacion) {
              setMensajeAnfitriona(resultado.estado_conversacion.respuesta_mesero);

              // CÓDIGO CORREGIDO EN FRONTEND
              if (resultado.estado_conversacion.nombre_cliente !== undefined && resultado.estado_conversacion.nombre_cliente !== null) {
                setNombreCliente(resultado.estado_conversacion.nombre_cliente.toUpperCase());
              }
            }

            // 2. Reproducimos el audio de la IA
            if (resultado.audio_b64) {
              const audioIA = new Audio(`data:audio/wav;base64,${resultado.audio_b64}`);
              audioIA.play();
            }

            // 3. Verificamos si la IA confirmó el nombre
            if (resultado.estado_conversacion?.nombre_confirmado) {
              // Esperamos 3.5 segundos para que la IA termine de despedirse y pasamos al menú
              setTimeout(() => {
                setNumeroMesa(0);
                setEsParaLlevar(true);
                setPasoActual(1);
                setMensajeAnfitriona(""); // Limpiamos para la próxima
              }, 3500);
            }
          }
        } catch (error) {
          console.error("Error transcribiendo nombre:", error);
        }
      };

      mediaRecorderRef.current.start();
      setGrabandoNombre(true);
    } catch (error) {
      alert("Permite el acceso al micrófono.");
    }
  };

  const detenerGrabacionBienvenida = () => {
    if (mediaRecorderRef.current && grabandoNombre) {
      mediaRecorderRef.current.stop();
      setGrabandoNombre(false);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const pulsarTecla = (tecla) => {
    if (tecla === 'BORRAR') {
      setNombreCliente(prev => prev.slice(0, -1));
    } else if (tecla === 'ESPACIO') {
      setNombreCliente(prev => prev + ' ');
    } else {
      setNombreCliente(prev => prev + tecla);
    }
  };

  const tecladoFilas = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
  ];

  // =====================================================================
  // FUNCIONES DEL KIOSKO (Mantenidas)
  // =====================================================================
  const iniciarGrabacion = async () => {
    setErrorStock(""); // 🌟 Limpiamos el error viejo
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaRecorderRef.current = new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }

      mediaRecorderRef.current.onstop = async () => {
        if (audioChunksRef.current.length === 0) {
          setGrabando(false); return;
        }
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const formData = new FormData()
        formData.append("audio", audioBlob, "pedido.webm")
        formData.append("carrito_actual", JSON.stringify({ numero_mesa: numeroMesa, pedidos: carrito }))

        try {
          const respuesta = await fetch("http://127.0.0.1:8000/pedido-voz", { method: "POST", body: formData })
          if (respuesta.ok) {
            const resultado = await respuesta.json();
            if (resultado.transcripcion) setTranscripcion(resultado.transcripcion);
            
            if (resultado.orden) {
              // 🌟 NUEVO: Buscamos el error dentro de la orden
              if (resultado.orden.error_stock) {
                setErrorStock(resultado.orden.error_stock);
              }

              if (resultado.orden.pedidos) setCarrito(resultado.orden.pedidos);
              if (resultado.orden.numero_mesa !== undefined && resultado.orden.numero_mesa !== 0) {
                setNumeroMesa(resultado.orden.numero_mesa);
              }
            }
            if (resultado.audio_b64) {
              const audioMesero = new Audio(`data:audio/wav;base64,${resultado.audio_b64}`);
              audioMesero.play();
            }
          }
        } catch (error) { console.error("Error audio:", error) }
      }

      mediaRecorderRef.current.start()
      setGrabando(true)
    } catch (error) { alert("Permite el acceso al micrófono.") }
  }

  const detenerGrabacion = () => {
    if (mediaRecorderRef.current && grabando) {
      mediaRecorderRef.current.stop()
      setGrabando(false)
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
    }
  }

  const confirmarOrden = async () => {
    try {
      const payloadOrden = {
        id_mesa: esParaLlevar ? 0 : numeroMesa,
        cliente_nombre: esParaLlevar ? nombreCliente : "Local",
        pedidos: carrito
      }
      const respuesta = await fetch("http://127.0.0.1:8000/confirmar-orden", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payloadOrden)
      })

      if (respuesta.ok) {
        alert("¡Orden confirmada! Se está preparando en cocina.");
        setCarrito([]); setTranscripcion(""); setNumeroMesa(0); setNombreCliente(""); setEsParaLlevar(false); setPasoActual(0); setMostrarTeclado(false); setMensajeAnfitriona("");
      } else {
        alert("Hubo un problema al enviar la orden a cocina.");
      }
    } catch (error) {
      alert("Error de conexión al confirmar la orden.");
    }
  }

  // =====================================================================
  // 🌟 PANTALLA 0: SELECCIÓN DE MESA Y PARA LLEVAR (ACTUALIZADA)
  // =====================================================================
  if (pasoActual === 0) {
    return (
      <div className="kiosko" style={{ textAlign: 'center', padding: '40px 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '10px' }}>🥟 ¡Bienvenido a Doña Zita!</h1>
        <h2 style={{ color: '#4b5563', marginBottom: '40px' }}>Por favor, selecciona tu número de paleta para comenzar:</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '15px', maxWidth: '800px', margin: '0 auto 40px auto' }}>
          {mesasLibres.length > 0 ? (
            mesasLibres.map(mesa => (
              <button
                key={mesa}
                onClick={() => { setNumeroMesa(mesa); setEsParaLlevar(false); setPasoActual(1); }}
                style={{ padding: '20px', fontSize: '1.5rem', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {mesa}
              </button>
            ))
          ) : (
            <p style={{ gridColumn: '1 / -1', color: '#ef4444', fontWeight: 'bold' }}>Cargando paletas disponibles...</p>
          )}
        </div>

        <hr style={{ maxWidth: '800px', width: '100%', margin: '0 auto 40px auto', borderColor: '#d1d5db' }} />

        <div style={{ backgroundColor: '#f3f4f6', padding: '30px', borderRadius: '12px', maxWidth: '700px', margin: '0 auto', width: '100%' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.8rem', color: '#1f2937' }}>🛍️ ¿Pedido para llevar? Habla con nuestra Anfitriona</h3>

          {/* CUADRO DE DIÁLOGO DE LA IA */}
          {mensajeAnfitriona && (
            <div style={{ backgroundColor: '#dbeafe', color: '#1e40af', padding: '15px', borderRadius: '8px', marginBottom: '20px', fontStyle: 'italic', fontWeight: 'bold' }}>
              🤖 IA: "{mensajeAnfitriona}"
            </div>
          )}

          {/* BOTONES DE DICTADO Y TECLADO */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
            <button
              onMouseDown={iniciarGrabacionBienvenida}
              onMouseUp={detenerGrabacionBienvenida}
              onTouchStart={iniciarGrabacionBienvenida}
              onTouchEnd={detenerGrabacionBienvenida}
              style={{ flex: 1, padding: '15px', fontSize: '1.2rem', backgroundColor: grabandoNombre ? '#ef4444' : '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              {grabandoNombre ? "👂 Te escucho (Suelta para enviar)..." : "🎙️ Mantén presionado para hablar"}
            </button>

            <button
              onClick={() => setMostrarTeclado(!mostrarTeclado)}
              style={{ flex: 1, padding: '15px', fontSize: '1.2rem', backgroundColor: '#4b5563', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
            >
              ⌨️ {mostrarTeclado ? "Ocultar Teclado" : "Escribir Manualmente"}
            </button>
          </div>

          <input
            type="text"
            readOnly
            placeholder="TU NOMBRE APARECERÁ AQUÍ"
            value={nombreCliente}
            style={{ width: '90%', padding: '15px', fontSize: '1.5rem', borderRadius: '8px', border: '2px solid #3b82f6', marginBottom: '20px', textAlign: 'center', fontWeight: 'bold', backgroundColor: 'white' }}
          />

          {/* TECLADO VIRTUAL */}
          {mostrarTeclado && (
            <div style={{ backgroundColor: '#e5e7eb', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
              {tecladoFilas.map((fila, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginBottom: '5px' }}>
                  {fila.map(tecla => (
                    <button key={tecla} onClick={() => pulsarTecla(tecla)} style={{ padding: '15px 20px', fontSize: '1.2rem', fontWeight: 'bold', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}>
                      {tecla}
                    </button>
                  ))}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '5px' }}>
                <button onClick={() => pulsarTecla('ESPACIO')} style={{ padding: '15px 40px', fontSize: '1.2rem', fontWeight: 'bold', backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', flex: 2 }}>ESPACIO</button>
                <button onClick={() => pulsarTecla('BORRAR')} style={{ padding: '15px 20px', fontSize: '1.2rem', fontWeight: 'bold', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', flex: 1 }}>⌫ BORRAR</button>
              </div>
            </div>
          )}

          <button
            disabled={!nombreCliente.trim()}
            onClick={() => { setNumeroMesa(0); setEsParaLlevar(true); setPasoActual(1); setMensajeAnfitriona(""); }}
            style={{ width: '100%', padding: '20px', fontSize: '1.5rem', backgroundColor: nombreCliente.trim() ? '#10b981' : '#9ca3af', color: 'white', border: 'none', borderRadius: '8px', cursor: nombreCliente.trim() ? 'pointer' : 'not-allowed', fontWeight: 'bold' }}
          >
            Siguiente Paso ➡️
          </button>
        </div>
      </div>
    );
  }

  // =====================================================================
  // 🌟 PANTALLA 1: EL KIOSKO NORMAL (Mantenida)
  // =====================================================================
  return (
    <div className="kiosko">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e293b', color: 'white', padding: '15px 30px', borderRadius: '12px', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem' }}>🥟 Fritadas Doña Zita</h1>
        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', backgroundColor: '#3b82f6', padding: '5px 15px', borderRadius: '8px' }}>
          {esParaLlevar ? `🛍️ Llevar: ${nombreCliente}` : `🪑 Paleta: ${numeroMesa}`}
        </div>
        <button onClick={() => { setPasoActual(0); setMostrarTeclado(false); setMensajeAnfitriona(""); }} style={{ backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer' }}>
          Cancelar
        </button>
      </div>

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

      {carrito.length > 0 && (
        <div className="carrito-contenedor" style={{ background: '#f8f9fa', padding: '20px', borderRadius: '10px', margin: '20px 0', border: '2px solid #28a745' }}>
          <h2>🛒 Resumen de tu Pedido</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {carrito.map((item, index) => (
              <li key={index} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #ccc', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  
                  {/* NOMBRE Y PRECIO UNITARIO */}
                  <div style={{ flex: 2 }}>
                    <strong style={{ fontSize: '1.2rem', display: 'block' }}>{item.plato}</strong>
                    <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                      ${(item.precio_unitario || 0).toFixed(2)} c/u
                    </span>
                  </div>

                  {/* CONTROLES TÁCTILES DE CANTIDAD */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, justifyContent: 'center' }}>
                    <button onClick={() => cambiarCantidad(index, -1)} style={{ width: '40px', height: '40px', fontSize: '1.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer' }}>-</button>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(index, 1)} style={{ width: '40px', height: '40px', fontSize: '1.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer' }}>+</button>
                  </div>

                  {/* SUBTOTAL DE ESTE PLATO Y BOTONES */}
                  <div style={{ display: 'flex', gap: '10px', flex: 1.5, justifyContent: 'flex-end', alignItems: 'center' }}>
                    <strong style={{ fontSize: '1.3rem', color: '#059669', marginRight: '10px' }}>
                      ${(item.subtotal || 0).toFixed(2)}
                    </strong>
                    <button onClick={() => editarNota(index)} style={{ padding: '8px 12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>📝</button>
                    <button onClick={() => eliminarDelCarrito(index)} style={{ padding: '8px 12px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>🗑️</button>
                  </div>
                </div>

                {/* MODIFICACIONES Y SUS RECARGOS (El detalle) */}
                {item.mods_estructuradas && item.mods_estructuradas.length > 0 ? (
                  <div style={{ paddingLeft: '10px', marginTop: '5px' }}>
                    {item.mods_estructuradas.map((mod, i) => (
                      <div key={i} style={{ color: mod.tipo === 'EXTRA' ? '#d97706' : '#dc2626', fontSize: '0.95rem', fontStyle: 'italic', display: 'flex', justifyContent: 'space-between', maxWidth: '300px' }}>
                        <span>* {mod.tipo} {mod.ingrediente}</span>
                        {mod.recargo > 0 && <span>+${mod.recargo.toFixed(2)}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  item.modificaciones && (
                    <span style={{ color: '#d9534f', fontSize: '1rem', fontStyle: 'italic' }}>
                      * Nota: {item.modificaciones}
                    </span>
                  )
                )}
              </li>
            ))}

            {/* ESTIMADOR DE TIEMPO */}
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

          {/* 🌟 NUEVO: EL GRAN TOTAL EN DÓLARES 🌟 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#e2e8f0', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #cbd5e1' }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', color: '#1e293b' }}>Total a Pagar:</h3>
            <span style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#10b981' }}>
              ${carrito.reduce((suma, item) => suma + (item.subtotal || 0), 0).toFixed(2)}
            </span>
          </div>
          {/* 🌟 NUEVO: ALERTA ROJA DE STOCK */}
          {errorStock && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '15px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', border: '1px solid #f87171' }}>
              <strong>🚫 ¡Bodega Insuficiente!</strong> <br />
              {errorStock} <br />
              El carrito ha sido revertido a su estado anterior.
            </div>
          )}
          {excedeLimite && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '15px', borderRadius: '8px', marginBottom: '15px', textAlign: 'center', border: '1px solid #f87171' }}>
              <strong>⚠️ ¡Qué gran apetito!</strong> <br />
              Tu pedido contiene {totalPlatosPedido} ítems. Para garantizar la frescura y rapidez, el kiosko automático procesa un máximo de <strong>{limitePlatos} ítems</strong>. <br />
              Para pedidos masivos o corporativos, por favor acércate a la caja principal.
            </div>
          )}

          <button
            onClick={confirmarOrden}
            disabled={excedeLimite || !!errorStock} // 🌟 NUEVO: Se bloquea si no hay stock
            style={{ width: '100%', padding: '15px', backgroundColor: (excedeLimite || !!errorStock) ? '#9ca3af' : '#10b981', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: (excedeLimite || !!errorStock) ? 'not-allowed' : 'pointer' }}
          >
            {excedeLimite ? 'Límite Excedido' : errorStock ? 'Revisa el Stock' : 'Confirmar Orden'}
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
                    <div className="plato-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '15px' }}>
                      <span className="precio" style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>${plato.precio.toFixed(2)}</span>
                      <button
                        onClick={() => agregarAlCarrito(plato.nombre)}
                        className="btn-agregar"
                        style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Agregar
                      </button>
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