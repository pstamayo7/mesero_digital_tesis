import { useState, useEffect, useRef } from 'react'
import './App.css'
import './BienvenidaPaleta.css'
import ModalEdicionPlato from './ModalEdicionPlato.jsx'

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
  const [extrasDisponibles, setExtrasDisponibles] = useState([]);
  const [itemEditando, setItemEditando] = useState(null); // { index, idPlato, precioBase } | null

  // 🌟 MODAL DE DETALLE DE PLATO (solo lectura, no toca el carrito por sí solo)
  const [platoViendoDetalle, setPlatoViendoDetalle] = useState(null);
  const [ingredientesDetalle, setIngredientesDetalle] = useState([]);

  useEffect(() => {
    if (!platoViendoDetalle) {
      setIngredientesDetalle([]);
      return;
    }
    fetch(`http://127.0.0.1:8000/menu/${platoViendoDetalle.id_plato}/ingredientes`)
      .then(res => res.json())
      .then(data => setIngredientesDetalle(data.ingredientes_base || []))
      .catch(err => console.error("Error cargando ingredientes del plato:", err));
  }, [platoViendoDetalle]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/configuracion-kiosko')
      .then(res => res.json())
      .then(data => setLimitePlatos(data.max_platos))
      .catch(err => console.error("Usando límite por defecto", err));
  }, []);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/extras-disponibles')
      .then(res => res.json())
      .then(data => setExtrasDisponibles(data.extras || []))
      .catch(err => console.error("Error cargando extras disponibles", err));
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

  // 🌟 TAREA 4: Centralizamos el recálculo de tiempo de cocina + validación de stock en
  // una sola función, para poder invocarla INMEDIATAMENTE después de un setCarrito por voz
  // (sin esperar al próximo render/efecto) y también desde el useEffect para los cambios
  // táctiles del carrito.
  const recalcularMetricasCarrito = (carritoParaCalcular) => {
    if (!carritoParaCalcular || carritoParaCalcular.length === 0) {
      setTiempoEstimado(null);
      setErrorStock("");
      return;
    }

    // 1. Petición original para estimar el tiempo
    fetch('http://127.0.0.1:8000/estimar-tiempo', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(carritoParaCalcular)
    })
      .then(res => res.json())
      .then(data => setTiempoEstimado(data.tiempo_estimado_minutos))
      .catch(err => console.error("Error estimando tiempo:", err));

    // 🌟 2. Validar stock en tiempo real
    fetch('http://127.0.0.1:8000/validar-carrito', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(carritoParaCalcular)
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
  };

  useEffect(() => {
    recalcularMetricasCarrito(carrito);
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

  const eliminarDelCarrito = (index) => {
    setErrorStock("");
    setCarrito(prev => prev.filter((_, i) => i !== index));
  };

  // 🌟 Abre el modal de edición táctil. Buscamos los metadatos del plato (id_plato,
  // precio base) en 'menu' en vez de guardarlos en el ítem del carrito: así un plato
  // agregado por voz (que no trae id_plato) también se puede editar por tacto.
  const abrirModalEdicion = (index) => {
    const item = carrito[index];
    const platoMeta = menu.flatMap(categoria => categoria.platos).find(p => p.nombre === item.plato);
    if (!platoMeta) return; // ej. "Porción de X": no tiene receta base que editar
    setItemEditando({ index, idPlato: platoMeta.id_plato, precioBase: platoMeta.precio });
  };

  const guardarEdicionPlato = (itemActualizado) => {
    setCarrito(prev => {
      const nuevoCarrito = [...prev];
      nuevoCarrito[itemEditando.index] = itemActualizado;
      return nuevoCarrito;
    });
    setItemEditando(null);
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

              if (resultado.orden.pedidos) {
                // El useEffect de [carrito] ya reacciona a este setCarrito y llama a
                // recalcularMetricasCarrito con el array actualizado: no duplicar la llamada
                // aquí para evitar peticiones dobles/condiciones de carrera.
                setCarrito(resultado.orden.pedidos);
              }
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
      <div className="bienvenida-pantalla">
        <div className="bienvenida-header">
          <img
            src="/logo.png"
            alt="Logo Doña Zita"
            className="w-28 h-28 object-cover rounded-full shadow-md shrink-0 bg-white p-1.5 box-border"
          />
          <div>
            <h1 className="bienvenida-marca-titulo">DOÑA ZITA</h1>
            <p className="bienvenida-marca-subtitulo">la fritada más deliciosa</p>
          </div>
        </div>

        <h2 className="bienvenida-titulo">🥟 ¡Bienvenido a Doña Zita!</h2>
        <h3 className="bienvenida-subtitulo">
          Por favor, selecciona tu <strong>número de paleta</strong> para comenzar:
        </h3>

        <div className="grid-paletas">
          {mesasLibres.length > 0 ? (
            mesasLibres.map(mesa => (
              <button
                key={mesa}
                onClick={() => { setNumeroMesa(mesa); setEsParaLlevar(false); setPasoActual(1); }}
                className="btn-paleta"
              >
                {mesa}
              </button>
            ))
          ) : (
            <p className="col-span-full text-red-500 font-bold">Cargando paletas disponibles...</p>
          )}
        </div>

        <div className="divisor-bienvenida" />

        <div className="card-llevar">
          <h3 className="card-llevar-titulo">🛍️ ¿Pedido para llevar? Habla con nuestra Anfitriona</h3>

          {/* CUADRO DE DIÁLOGO DE LA IA */}
          {mensajeAnfitriona && (
            <div className="caja-anfitriona">
              🤖 IA: "{mensajeAnfitriona}"
            </div>
          )}

          {/* BOTONES DE DICTADO Y TECLADO */}
          <div className="flex gap-4 w-full">
            <button
              onMouseDown={iniciarGrabacionBienvenida}
              onMouseUp={detenerGrabacionBienvenida}
              onTouchStart={iniciarGrabacionBienvenida}
              onTouchEnd={detenerGrabacionBienvenida}
              className={`btn-voz-bienvenida ${grabandoNombre ? 'grabando' : ''}`}
            >
              {grabandoNombre ? "👂 Te escucho (Suelta para enviar)..." : "🎙️ Mantén presionado para hablar"}
            </button>

            <button
              onClick={() => setMostrarTeclado(!mostrarTeclado)}
              className="btn-teclado"
            >
              ⌨️ {mostrarTeclado ? "Ocultar Teclado" : "Escribir Manualmente"}
            </button>
          </div>

          <input
            type="text"
            readOnly
            placeholder="TU NOMBRE APARECERÁ AQUÍ"
            value={nombreCliente}
            className="input-nombre-bienvenida"
          />

          {/* TECLADO VIRTUAL */}
          {mostrarTeclado && (
            <div className="teclado-virtual">
              {tecladoFilas.map((fila, i) => (
                <div key={i} className="flex justify-center gap-1">
                  {fila.map(tecla => (
                    <button
                      key={tecla}
                      onClick={() => pulsarTecla(tecla)}
                      className="tecla-virtual"
                    >
                      {tecla}
                    </button>
                  ))}
                </div>
              ))}
              <div className="flex justify-center gap-1">
                <button onClick={() => pulsarTecla('ESPACIO')} className="tecla-espacio">ESPACIO</button>
                <button onClick={() => pulsarTecla('BORRAR')} className="tecla-borrar">⌫ BORRAR</button>
              </div>
            </div>
          )}

          <button
            disabled={!nombreCliente.trim()}
            onClick={() => { setNumeroMesa(0); setEsParaLlevar(true); setPasoActual(1); setMensajeAnfitriona(""); }}
            className={`btn-siguiente-paso ${nombreCliente.trim() ? 'activo' : ''}`}
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

  // Helper puramente visual: elige un icono para el título de categoría según su nombre.
  const iconoCategoria = (nombreCategoria) => {
    const n = (nombreCategoria || "").toLowerCase();
    if (n.includes("bebida") || n.includes("jugo") || n.includes("chicha")) return "🥤";
    if (n.includes("postre") || n.includes("dulce")) return "🍮";
    return "🍴";
  };

  return (
    <div className="bg-amber-50 min-h-screen pb-10">
      <div className="bg-red-900 rounded-b-[3rem] shadow-xl px-6 pt-5 pb-9 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Logo Doña Zita"
            className="w-20 h-20 object-cover rounded-full bg-amber-50 p-1 shadow-md shrink-0"
          />
          <div>
            <h1 className="text-xl md:text-2xl font-serif font-black tracking-wide m-0">DOÑA ZITA</h1>
            <p className="text-amber-300 italic text-sm m-0">la fritada más deliciosa</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-amber-50 text-stone-800 font-bold rounded-full px-4 py-2 flex items-center gap-2 shadow-md whitespace-nowrap">
            🪑 {esParaLlevar ? `Llevar: ${nombreCliente}` : `Paleta: ${numeroMesa}`}
          </div>
          <button
            onClick={() => { setPasoActual(0); setMostrarTeclado(false); setMensajeAnfitriona(""); }}
            className="w-11 h-11 rounded-full bg-red-950 text-white flex items-center justify-center shadow-md transition-all duration-150 ease-out transform-gpu active:scale-95 hover:bg-red-800"
            title="Cancelar"
          >
            🛒
          </button>
        </div>
      </div>

      <div className="flex justify-center -mt-6 mb-8 px-4">
        <div className="relative">
          <span className={`absolute inset-0 rounded-full bg-red-600 opacity-20 animate-ping duration-1000 ${grabando ? 'block' : 'hidden'}`} />
          <span className="absolute inset-0 rounded-full bg-red-600 opacity-10 animate-pulse" />
          <button
            className={`relative rounded-full px-14 py-6 text-white font-bold text-2xl shadow-lg shadow-red-900/50 transition-all duration-100 ease-out select-none transform-gpu will-change-transform active:scale-95 hover:brightness-110 bg-gradient-to-r ${grabando ? 'from-red-600 to-red-800 animate-pulse' : 'from-red-700 to-red-900 hover:from-red-600 hover:to-red-800'}`}
            onMouseDown={iniciarGrabacion}
            onMouseUp={detenerGrabacion}
            onTouchStart={iniciarGrabacion}
            onTouchEnd={detenerGrabacion}
          >
            <span className="mr-3 text-3xl align-middle">{grabando ? "🎙️" : "🎤"}</span>
            {grabando ? "Escuchando... (Suelta para enviar)" : "Mantén presionado para pedir"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">

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
                    <button onClick={() => abrirModalEdicion(index)} style={{ padding: '8px 12px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>📝</button>
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
        <p className="text-center text-stone-500 text-lg py-10">Encendiendo los fogones (Cargando menú)...</p>
      ) : (
        <div>
          {menu.map((categoria) => {
            const esCategoriaCompacta = categoria.platos.length === 1;
            return (
              <div key={categoria.id_categoria} className="mt-8">
                <div className="flex items-center gap-2 text-red-900 font-bold text-xl border-b-2 border-amber-600 w-max pb-1 mb-5">
                  <span>{iconoCategoria(categoria.nombre)}</span>
                  <h2 className="m-0 uppercase">{categoria.nombre}</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {categoria.platos.map((plato) => {
                    const disponible = plato.disponible !== false; // por defecto disponible si el backend no manda el campo
                    return (
                      <div
                        key={plato.id_plato}
                        className={`bg-white rounded-2xl shadow-md transition-all duration-200 ease-out transform-gpu will-change-transform hover:-translate-y-1 hover:shadow-xl overflow-hidden flex ${esCategoriaCompacta ? 'col-span-2 md:col-span-3 flex-row' : 'flex-col'}`}
                      >
                        {/* 🌟 FASE 3: tocar la foto o el título abre el modal de detalle. El botón
                            "Agregar +" tiene su propio onClick con stopPropagation para no disparar esto. */}
                        <div
                          className={`relative cursor-pointer shrink-0 ${esCategoriaCompacta ? 'w-1/3' : 'w-full'}`}
                          onClick={() => setPlatoViendoDetalle(plato)}
                        >
                          <img
                            src={`http://127.0.0.1:8000${plato.ruta_imagen || '/imagenes/default.png'}`}
                            alt={plato.nombre}
                            className={`object-cover ${esCategoriaCompacta ? 'w-full h-full' : 'w-full h-40'} ${disponible ? '' : 'grayscale'}`}
                          />
                          {!disponible && (
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                              <span className="bg-stone-800 text-white font-bold text-sm px-4 py-2 rounded-full shadow-md text-center">
                                🚫 Agotado por el momento
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="p-4 flex flex-col flex-1">
                          <h3 className="text-lg font-bold text-stone-800 m-0 cursor-pointer" onClick={() => setPlatoViendoDetalle(plato)}>{plato.nombre}</h3>
                          <p className="text-sm text-stone-500 mb-3">🕒 {plato.descripcion}</p>
                          <div className="flex justify-between items-center mt-auto">
                            {disponible ? (
                              <>
                                <span className="text-red-700 font-bold text-xl">${plato.precio.toFixed(2)}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); agregarAlCarrito(plato.nombre); }}
                                  className="bg-red-900 text-white rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-150 ease-out transform-gpu active:scale-95 hover:bg-red-800"
                                >
                                  Agregar +
                                </button>
                              </>
                            ) : (
                              <span className="text-stone-500 italic text-sm">
                                Agotado temporalmente
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      </div>

      {itemEditando && (
        <ModalEdicionPlato
          item={carrito[itemEditando.index]}
          idPlato={itemEditando.idPlato}
          precioBase={itemEditando.precioBase}
          extrasDisponibles={extrasDisponibles}
          onGuardar={guardarEdicionPlato}
          onCerrar={() => setItemEditando(null)}
        />
      )}

      {/* 🌟 FASE 4: MODAL DE DETALLE DE PLATO (solo informativo + acceso rápido al carrito) */}
      {platoViendoDetalle && (
        <div className="modal-overlay" onClick={() => setPlatoViendoDetalle(null)}>
          <div className="modal-detalle-plato" onClick={(e) => e.stopPropagation()}>
            <div className="modal-imagen-wrap">
              <img
                src={`http://127.0.0.1:8000${platoViendoDetalle.ruta_imagen || '/imagenes/default.png'}`}
                alt={platoViendoDetalle.nombre}
                className="modal-imagen"
                style={{ filter: platoViendoDetalle.disponible === false ? 'grayscale(100%)' : 'none' }}
              />
              <button className="modal-cerrar" onClick={() => setPlatoViendoDetalle(null)}>✕</button>
            </div>
            <div className="modal-body">
              <h2 className="modal-titulo">{platoViendoDetalle.nombre}</h2>
              <p className="tarjeta-plato-tiempo">🕐 {platoViendoDetalle.descripcion}</p>
              <span className="modal-precio">${platoViendoDetalle.precio.toFixed(2)}</span>
              <p className="modal-descripcion">
                Preparado con ingredientes frescos al estilo tradicional de Doña Zita.
              </p>

              {ingredientesDetalle.length > 0 && (
                <>
                  <p className="modal-ingredientes-titulo">Ingredientes:</p>
                  <div className="modal-ingredientes-lista">
                    {ingredientesDetalle.map((ingrediente, i) => (
                      <span key={i} className="modal-ingrediente-badge">{ingrediente}</span>
                    ))}
                  </div>
                </>
              )}

              <button
                className="modal-btn-agregar"
                disabled={platoViendoDetalle.disponible === false}
                onClick={() => {
                  agregarAlCarrito(platoViendoDetalle.nombre);
                  setPlatoViendoDetalle(null);
                }}
              >
                {platoViendoDetalle.disponible === false ? 'Agotado por el momento' : 'Agregar al Carrito'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Kiosko