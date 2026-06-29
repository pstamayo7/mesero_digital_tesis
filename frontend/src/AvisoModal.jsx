import { CheckCircle2, XCircle, HelpCircle, AlertTriangle } from 'lucide-react'
import './AvisoModal.css'

// 🌟 Reemplazo de window.alert()/window.confirm() con la estética del local.
// `tema` elige la paleta (kiosko = cálido cliente, ops = bronce personal),
// `tipo` decide ícono y botones: 'confirmar' muestra Cancelar + acción,
// el resto ('exito' | 'error' | 'info') es informativo con un solo botón.
const ICONOS = {
  exito: CheckCircle2,
  error: XCircle,
  confirmar: HelpCircle,
  info: AlertTriangle,
}

function AvisoModal({
  tema = 'kiosko',
  tipo = 'info',
  titulo,
  mensaje,
  textoConfirmar = 'Aceptar',
  textoCancelar = 'Cancelar',
  onConfirmar,
  onCerrar,
}) {
  const Icono = ICONOS[tipo] || ICONOS.info
  const esConfirmacion = tipo === 'confirmar'

  return (
    <div className="aviso-overlay" onClick={esConfirmacion ? undefined : onCerrar}>
      <div className={`aviso-box aviso-tema-${tema}`} onClick={(e) => e.stopPropagation()}>
        <div className={`aviso-icon-wrap is-${tipo}`}>
          <Icono size={28} />
        </div>
        {titulo && <h3 className="aviso-titulo">{titulo}</h3>}
        {mensaje && <p className="aviso-mensaje">{mensaje}</p>}
        <div className="aviso-botones">
          {esConfirmacion && (
            <button className="aviso-btn aviso-btn-ghost" onClick={onCerrar}>
              {textoCancelar}
            </button>
          )}
          <button
            className={`aviso-btn aviso-btn-primary ${tipo === 'error' ? 'is-danger' : ''}`}
            onClick={esConfirmacion ? onConfirmar : onCerrar}
          >
            {esConfirmacion ? textoConfirmar : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AvisoModal
