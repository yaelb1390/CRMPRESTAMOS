'use client';

import React from 'react';

/**
 * Modal reutilizable que reemplaza el scaffold repetido
 * (`modal-backdrop > modal-content > modal-header/body/footer`) que estaba
 * copiado en clientes, prestamos, cobros y usuarios.
 *
 * Mantiene las mismas clases CSS y comportamiento actual. Por defecto NO cierra
 * al hacer clic fuera (para no perder datos de formularios); se puede habilitar
 * con `closeOnBackdrop`.
 *
 * @param {object} props
 * @param {boolean} props.open - Si el modal está visible.
 * @param {() => void} [props.onClose] - Cierra el modal (botón ❌); si se omite, no se muestra la ❌.
 * @param {React.ReactNode} props.title - Título del encabezado.
 * @param {React.ReactNode} props.children - Contenido del cuerpo.
 * @param {React.ReactNode} [props.footer] - Botones/acciones del pie.
 * @param {'div'|'form'} [props.as='div'] - Envolver el contenido en <form> (para onSubmit).
 * @param {(e: React.FormEvent) => void} [props.onSubmit] - Handler de submit cuando as="form".
 * @param {string|number} [props.maxWidth] - Ancho máximo opcional del modal.
 * @param {boolean} [props.closeOnBackdrop=false] - Cerrar al hacer clic en el fondo.
 * @param {React.CSSProperties} [props.contentStyle] - Estilos extra para `.modal-content`.
 * @param {React.CSSProperties} [props.bodyStyle] - Estilos extra para `.modal-body` (ej. maxHeight/overflow).
 * @param {React.CSSProperties} [props.footerStyle] - Estilos extra para `.modal-footer` (ej. justifyContent).
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  as = 'div',
  onSubmit,
  maxWidth,
  closeOnBackdrop = false,
  contentStyle,
  bodyStyle,
  footerStyle,
}) {
  if (!open) return null;

  const Inner = as;
  const innerProps = as === 'form' ? { onSubmit } : {};
  const mergedContentStyle = { ...(maxWidth ? { maxWidth } : null), ...contentStyle };

  return (
    <div
      className="modal-backdrop"
      onClick={closeOnBackdrop && onClose ? onClose : undefined}
    >
      <div
        className="modal-content"
        style={Object.keys(mergedContentStyle).length ? mergedContentStyle : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <Inner {...innerProps}>
          <div className="modal-header">
            <h2>{title}</h2>
            {onClose && (
              <button
                type="button"
                className="btn"
                style={{ background: 'none', padding: 0 }}
                onClick={onClose}
              >
                ❌
              </button>
            )}
          </div>
          <div className="modal-body" style={bodyStyle}>{children}</div>
          {footer && <div className="modal-footer" style={footerStyle}>{footer}</div>}
        </Inner>
      </div>
    </div>
  );
}
