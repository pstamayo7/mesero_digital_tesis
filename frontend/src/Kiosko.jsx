import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import './App.css'
import './BienvenidaPaleta.css'
import './KioskoDonaZita.css'
import ModalEdicionPlato from './ModalEdicionPlato.jsx'
import SeleccionModalidad from './SeleccionModalidad.jsx'

function Kiosko() {
  const [pasoActual, setPasoActual] = useState(0);
  const [mesasLibres, setMesasLibres] = useState([]);
  const [esParaLlevar, setEsParaLlevar] = useState(false);

  // 🌟 PANTALLA INICIAL: "COMER AQUÍ" vs "PARA LLEVAR" (antes de elegir paleta/nombre)
  const [modalidadElegida, setModalidadElegida] = useState(null); // null | 'local' | 'llevar'

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
  // 🌟 useCallback: mantiene la misma identidad de función mientras 'menu' no
  // cambie, para que el grid de platos memoizado (más abajo) no se vuelva a
  // calcular en cada tap del carrito y la interfaz se sienta más fluida.
  const agregarAlCarrito = useCallback((platoNombre) => {

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
  }, [menu]);

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

  // 🌟 Botón "Volver": regresa a la pantalla inicial y limpia todo el estado del
  // cliente actual (carrito, mesa, nombre, etc.) para que el siguiente cliente
  // no herede un carrito ajeno.
  const volverAlInicio = () => {
    setCarrito([]);
    setTranscripcion("");
    setNumeroMesa(0);
    setNombreCliente("");
    setEsParaLlevar(false);
    setErrorStock("");
    setTiempoEstimado(null);
    setItemEditando(null);
    setPlatoViendoDetalle(null);
    setMostrarTeclado(false);
    setMensajeAnfitriona("");
    setModalidadElegida(null);
    setPasoActual(0);
  }

  // Helper puramente visual: elige un icono para el título de categoría según su nombre.
  const iconoCategoria = (nombreCategoria) => {
    const n = (nombreCategoria || "").toLowerCase();
    if (n.includes("bebida") || n.includes("jugo") || n.includes("chicha")) return "🥤";
    if (n.includes("postre") || n.includes("dulce")) return "🍮";
    return "🍴";
  };

  // 🌟 useMemo: el grid de platos es lo más pesado de renderizar (imágenes,
  // sombras, gradientes). Al depender solo de 'menu' y 'agregarAlCarrito'
  // (ambos estables mientras no cambie el menú), React se salta por completo
  // su reconciliación cuando el carrito/voz/scroll cambian otros estados.
  // 🌟 IMPORTANTE: este hook debe llamarse siempre (antes de cualquier
  // return condicional de pantalla), o React rompe las "Rules of Hooks".
  const menuRenderizado = useMemo(() => (
    menu.map((categoria) => {
      const esCategoriaCompacta = categoria.platos.length === 1;
      return (
        <div key={categoria.id_categoria}>
          <div className="dz-section-head">
            <span className="dz-section-badge">{iconoCategoria(categoria.nombre)}</span>
            <div>
              <h2 className="dz-section-title">{categoria.nombre}</h2>
              <div className="dz-section-rule" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {categoria.platos.map((plato) => {
              const disponible = plato.disponible !== false; // por defecto disponible si el backend no manda el campo
              return (
                <div
                  key={plato.id_plato}
                  className={`dz-card ${esCategoriaCompacta ? 'dz-card--wide' : ''}`}
                >
                  {/* 🌟 tocar la foto o el título abre el modal de detalle. El botón
                      "+" tiene su propio onClick con stopPropagation para no disparar esto. */}
                  <button
                    type="button"
                    className="dz-card-media"
                    onClick={() => setPlatoViendoDetalle(plato)}
                    aria-label={`Ver ${plato.nombre}`}
                  >
                    <img
                      src={`http://127.0.0.1:8000${plato.ruta_imagen || '/imagenes/default.png'}`}
                      alt={plato.nombre}
                      loading="lazy"
                      decoding="async"
                      className={disponible ? '' : 'is-out'}
                    />
                    {!disponible && (
                      <div className="dz-out-overlay">
                        <span className="dz-out-chip">🚫 Agotado por el momento</span>
                      </div>
                    )}
                  </button>

                  <div className="dz-card-body">
                    <h3 className="dz-card-name" onClick={() => setPlatoViendoDetalle(plato)}>{plato.nombre}</h3>
                    <p className="dz-card-time">🕒 {plato.descripcion}</p>
                    {disponible ? (
                      <span className="dz-card-price">${plato.precio.toFixed(2)}</span>
                    ) : (
                      <span className="dz-card-soldtext">Agotado temporalmente</span>
                    )}
                  </div>

                  {disponible && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        agregarAlCarrito(plato.nombre);
                        const boton = e.currentTarget;
                        boton.classList.add('dz-pop');
                        setTimeout(() => boton.classList.remove('dz-pop'), 420);
                      }}
                      title="Agregar"
                      aria-label={`Agregar ${plato.nombre}`}
                      className="dz-add"
                    >
                      +
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    })
  ), [menu, agregarAlCarrito]);

  // =====================================================================
  // 🌟 PANTALLA 0: SELECCIÓN DE MESA Y PARA LLEVAR (ACTUALIZADA)
  // =====================================================================
  if (pasoActual === 0) {

    // 🌟 PRIMER CONTACTO: el cliente todavía no eligió "Comer aquí" / "Para llevar"
    if (modalidadElegida === null) {
      return <SeleccionModalidad onSeleccion={(modalidad) => setModalidadElegida(modalidad)} />;
    }

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

        <button
          onClick={() => setModalidadElegida(null)}
          className="dz-back-pill"
        >
          ⬅️ Cambiar modalidad
        </button>

        {modalidadElegida === 'local' ? (
          <>
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
          </>
        ) : (
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
        )}
      </div>
    );
  }

  // =====================================================================
  // 🌟 PANTALLA 1: EL KIOSKO NORMAL (rediseñada visualmente)
  // =====================================================================

  return (
    <div className="dz-root pb-32">
      {/* ============================ HEADER ============================ */}
      <div className="sticky top-0 z-50">
        <div className="dz-header px-6 pt-5 pb-9 flex items-center justify-between">
          <div className="dz-header-pattern" />
          <div className="relative flex items-center gap-3">
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
          <div className="relative flex items-center gap-3">
            <div className="dz-pill">
              🪑 {esParaLlevar ? `Llevar: ${nombreCliente}` : `Paleta: ${numeroMesa}`}
            </div>
            <button
              onClick={volverAlInicio}
              className="dz-icon-btn"
              title="Volver"
              aria-label="Volver"
            >
              <span className="text-xl leading-none">←</span>
            </button>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="dz-icon-btn dz-icon-btn--solid relative"
              title="Ver carrito"
              aria-label="Ver carrito"
            >
              🛒
              {totalPlatosPedido > 0 && <span key={totalPlatosPedido} className="dz-cart-count">{totalPlatosPedido}</span>}
            </button>
          </div>
        </div>

        {/* ===================== BOTÓN DE VOZ + ONDAS ==================== */}
        <div className="flex justify-center -mt-6 mb-2 px-4 pt-1">
          <div className={`dz-voice-wrap ${grabando ? 'is-rec' : ''}`}>
            <div className="dz-waves" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <button
              className={`dz-voice ${grabando ? 'is-rec' : ''}`}
              onMouseDown={iniciarGrabacion}
              onMouseUp={detenerGrabacion}
              onTouchStart={iniciarGrabacion}
              onTouchEnd={detenerGrabacion}
            >
              <span className="text-2xl align-middle">{grabando ? "🎙️" : "🎤"}</span>
              {grabando ? "Escuchando... (Suelta para enviar)" : "Mantén presionado para pedir"}
            </button>
            <div className="dz-waves" aria-hidden="true">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4">

      {transcripcion && (
        <div className="caja-transcripcion">
          <p><strong>🗣️ Te escuché decir:</strong> "{transcripcion}"</p>
        </div>
      )}

      {/* ============================ CARRITO ============================ */}
      {carrito.length > 0 && (
        <div className="carrito-contenedor" style={{ background: '#fff', padding: '22px', borderRadius: '24px', margin: '22px 0', border: '1px solid #efe2cd', boxShadow: '0 18px 40px -28px rgba(72,28,14,0.5)' }}>
          <h2 style={{ color: '#7d1620', fontWeight: 900, margin: '0 0 16px' }}>🛒 Resumen de tu Pedido</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {carrito.map((item, index) => (
              <li key={index} style={{ marginBottom: '15px', paddingBottom: '15px', borderBottom: '1px solid #f0e6d6', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                  {/* NOMBRE Y PRECIO UNITARIO */}
                  <div style={{ flex: 2 }}>
                    <strong style={{ fontSize: '1.2rem', display: 'block', color: '#2b2018' }}>{item.plato}</strong>
                    <span style={{ fontSize: '0.9rem', color: '#8a7d6f' }}>
                      ${(item.precio_unitario || 0).toFixed(2)} c/u
                    </span>
                  </div>

                  {/* CONTROLES TÁCTILES DE CANTIDAD */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flex: 1, justifyContent: 'center' }}>
                    <button onClick={() => cambiarCantidad(index, -1)} style={{ width: '40px', height: '40px', fontSize: '1.5rem', backgroundColor: '#b22230', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer' }}>-</button>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2b2018' }}>{item.cantidad}</span>
                    <button onClick={() => cambiarCantidad(index, 1)} style={{ width: '40px', height: '40px', fontSize: '1.5rem', backgroundColor: '#7d1620', color: 'white', border: 'none', borderRadius: '50%', cursor: 'pointer' }}>+</button>
                  </div>

                  {/* SUBTOTAL DE ESTE PLATO Y BOTONES */}
                  <div style={{ display: 'flex', gap: '10px', flex: 1.5, justifyContent: 'flex-end', alignItems: 'center' }}>
                    <strong style={{ fontSize: '1.3rem', color: '#b22230', marginRight: '10px' }}>
                      ${(item.subtotal || 0).toFixed(2)}
                    </strong>
                    <button onClick={() => abrirModalEdicion(index)} style={{ padding: '8px 12px', backgroundColor: '#e6a817', color: '#5e0f18', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>📝</button>
                    <button onClick={() => eliminarDelCarrito(index)} style={{ padding: '8px 12px', backgroundColor: '#8a7d6f', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>🗑️</button>
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
              <div style={{ background: '#fbf4e6', padding: '15px', borderRadius: '14px', marginBottom: '15px', textAlign: 'center', border: '1px solid #efe2cd' }}>
                <span style={{ fontSize: '1.1rem', color: '#6b5d4d', display: 'block', marginBottom: '5px' }}>
                  Tu pedido entrará en cola de producción
                </span>
                <span style={{ fontSize: '1.4rem', color: '#b22230', fontWeight: 'bold' }}>
                  ⏱️ Tiempo estimado: {tiempoEstimado} - {tiempoEstimado + 5} minutos
                </span>
              </div>
            )}
          </ul>

          {/* 🌟 EL GRAN TOTAL EN DÓLARES 🌟 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#7d1620', padding: '16px 20px', borderRadius: '16px', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, fontSize: '1.4rem', color: '#fff', fontWeight: 800 }}>Total a Pagar:</h3>
            <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f3c64d' }}>
              ${carrito.reduce((suma, item) => suma + (item.subtotal || 0), 0).toFixed(2)}
            </span>
          </div>
          {/* 🌟 ALERTA ROJA DE STOCK */}
          {errorStock && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '15px', borderRadius: '14px', marginBottom: '15px', textAlign: 'center', border: '1px solid #f87171' }}>
              <strong>🚫 ¡Bodega Insuficiente!</strong> <br />
              {errorStock} <br />
              El carrito ha sido revertido a su estado anterior.
            </div>
          )}
          {excedeLimite && (
            <div style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '15px', borderRadius: '14px', marginBottom: '15px', textAlign: 'center', border: '1px solid #fcd34d' }}>
              <strong>⚠️ ¡Qué gran apetito!</strong> <br />
              Tu pedido contiene {totalPlatosPedido} ítems. Para garantizar la frescura y rapidez, el kiosko automático procesa un máximo de <strong>{limitePlatos} ítems</strong>. <br />
              Para pedidos masivos o corporativos, por favor acércate a la caja principal.
            </div>
          )}

          <button
            onClick={confirmarOrden}
            disabled={excedeLimite || !!errorStock} // 🌟 Se bloquea si no hay stock
            style={{ width: '100%', padding: '16px', backgroundColor: (excedeLimite || !!errorStock) ? '#cbb9a3' : '#7d1620', color: 'white', fontSize: '1.2rem', fontWeight: 'bold', border: 'none', borderRadius: '14px', cursor: (excedeLimite || !!errorStock) ? 'not-allowed' : 'pointer' }}
          >
            {excedeLimite ? 'Límite Excedido' : errorStock ? 'Revisa el Stock' : 'Confirmar Orden'}
          </button>
        </div>
      )}

      {/* ============================ MENÚ ============================ */}
      {cargando ? (
        <p className="text-center text-stone-500 text-lg py-10">Encendiendo los fogones (Cargando menú)...</p>
      ) : (
        <div>
          {menuRenderizado}
        </div>
      )}

      </div>

      {/* ===================== BARRA FLOTANTE CARRITO ===================== */}
      {carrito.length > 0 && (
        <div className="dz-cta-bar">
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="dz-cta"
          >
            🛒 IR AL CARRITO ({totalPlatosPedido})
          </button>
        </div>
      )}

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

      {/* 🌟 MODAL DE DETALLE DE PLATO (solo informativo + acceso rápido al carrito) */}
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
                onClick={(e) => {
                  agregarAlCarrito(platoViendoDetalle.nombre);
                  e.currentTarget.classList.add('dz-pop-soft');
                  setTimeout(() => setPlatoViendoDetalle(null), 220);
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