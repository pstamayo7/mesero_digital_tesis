function SeleccionModalidad({ onSeleccion }) {
  const handleSeleccion = (modalidad) => {
    // 'local' | 'llevar' -> el padre decide a qué pantalla navegar después
    if (onSeleccion) onSeleccion(modalidad);
  };

  return (
    <div className="relative h-screen w-full overflow-hidden bg-stone-900">
      {/* ===================================================================== */}
      {/* HERO: 60% superior con la imagen apetitosa de la fritada */}
      {/* ===================================================================== */}
      <div className="absolute inset-0 h-[60%] w-full">
        <img
          src="/promo-fritada.jpg"
          alt="Fritada Doña Zita"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 px-8 pb-10">
          <p className="font-serif italic text-amber-300 text-2xl drop-shadow-md">
            ¡Sabor que enamora!
          </p>
          <h1 className="font-black italic text-white text-5xl leading-tight tracking-tight drop-shadow-lg">
            LA MEJOR FRITADA
          </h1>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* BOTTOM SHEET: 40% inferior, tarjeta flotante con las modalidades */}
      {/* ===================================================================== */}
      <div className="absolute inset-x-0 bottom-0 h-[44%] bg-[#fdfbf7] rounded-t-[3rem] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] px-8 pt-10 pb-8 flex flex-col">
        <h2 className="text-center text-red-900 font-black text-4xl mb-8">
          ¿CON HAMBRE? <br /> ORDENA AQUÍ
        </h2>

        <div className="grid grid-cols-2 gap-5 flex-1">
          <button
            onClick={() => handleSeleccion('local')}
            className="bg-white border border-stone-100 rounded-3xl shadow-md hover:shadow-xl transform-gpu will-change-transform hover:-translate-y-2 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col items-center justify-center gap-3"
          >
            <span className="text-5xl">🍽️</span>
            <span className="text-stone-800 font-black text-xl">COMER AQUÍ</span>
          </button>

          <button
            onClick={() => handleSeleccion('llevar')}
            className="bg-white border border-stone-100 rounded-3xl shadow-md hover:shadow-xl transform-gpu will-change-transform hover:-translate-y-2 active:scale-95 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] flex flex-col items-center justify-center gap-3"
          >
            <span className="text-5xl">🛍️</span>
            <span className="text-stone-800 font-black text-xl">PARA LLEVAR</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SeleccionModalidad;
