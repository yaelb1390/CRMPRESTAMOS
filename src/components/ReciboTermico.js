'use client';

import { formatCurrency } from '@/lib/format';

// Fecha compacta dd/mm/aaaa hh:mm (con corrección de zona horaria)
function fechaCorta(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const local = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  return local.toLocaleString('es-DO', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const linea = { borderTop: '1px dashed #000', margin: '6px 0' };
const fila = { display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', lineHeight: 1.5 };
const etiqueta = { color: '#000', flexShrink: 0 };
const valor = { fontWeight: 700, textAlign: 'right', wordBreak: 'break-word' };

/**
 * Recibo/factura para impresoras térmicas genéricas de 80mm.
 * Una sola columna, monoespaciado, negro sobre blanco. El alto es automático
 * (papel de rollo). Incluye su propio CSS de impresión (@page 80mm).
 */
export default function ReciboTermico({ pago, empresa }) {
  const prevBalance = parseFloat(pago.monto_pagado || 0) + parseFloat(pago.balance_pendiente || 0);

  return (
    <div
      className="recibo-termico"
      style={{
        width: '76mm',
        margin: '16px auto',
        padding: '4mm 3mm',
        background: '#fff',
        color: '#000',
        fontFamily: "'Courier New', ui-monospace, monospace",
        fontSize: '11px',
        lineHeight: 1.4,
        border: '1px solid #E2E8F0',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        @page { size: 80mm auto; margin: 0; }
        @media print {
          body { background: #fff !important; color: #000 !important;
                 -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print, .sidebar, .header, .sidebar-overlay, .hamburger-btn,
          .sidebar-toggle-btn, .header-search-container { display: none !important; }
          .app-container { display: block !important; }
          .main-wrapper, .content-area {
            margin: 0 !important; padding: 0 !important; width: 100% !important;
            min-height: auto !important; box-shadow: none !important; border: none !important;
          }
          .recibo-termico {
            width: 80mm !important; margin: 0 !important; padding: 2mm 3mm !important;
            border: none !important; box-shadow: none !important;
            page-break-inside: avoid;
          }
        }
      `}} />

      {/* Encabezado empresa */}
      <div style={{ textAlign: 'center', marginBottom: '6px' }}>
        <img
          src={`/api/configuracion/logo?t=${Date.now()}`}
          alt="Logo"
          style={{ maxWidth: '38mm', maxHeight: '20mm', objectFit: 'contain', margin: '0 auto 4px', display: 'block' }}
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div style={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase' }}>
          {empresa?.nombre || 'Préstamos BM'}
        </div>
        {empresa?.rnc ? <div style={{ fontSize: '10px' }}>RNC: {empresa.rnc}</div> : null}
        {empresa?.direccion ? <div style={{ fontSize: '10px' }}>{empresa.direccion}</div> : null}
        {empresa?.telefono ? <div style={{ fontSize: '10px' }}>Tel: {empresa.telefono}</div> : null}
      </div>

      <div style={linea} />

      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '12px', letterSpacing: '1px' }}>
        FACTURA DE PAGO
      </div>
      <div style={{ ...fila, marginTop: '4px' }}>
        <span style={etiqueta}>Comprobante:</span>
        <span style={valor}>N° {String(pago.id).padStart(6, '0')}</span>
      </div>
      <div style={fila}>
        <span style={etiqueta}>Fecha:</span>
        <span style={valor}>{fechaCorta(pago.fecha_pago)}</span>
      </div>

      <div style={linea} />

      <div style={fila}><span style={etiqueta}>Cliente:</span><span style={valor}>{pago.nombre_cliente}</span></div>
      <div style={fila}><span style={etiqueta}>Cédula:</span><span style={valor}>{pago.cedula}</span></div>
      <div style={fila}><span style={etiqueta}>Préstamo:</span><span style={valor}>{pago.numero_prestamo}</span></div>
      <div style={fila}><span style={etiqueta}>Método:</span><span style={{ ...valor, textTransform: 'uppercase' }}>{pago.metodo_pago}</span></div>

      <div style={linea} />

      {/* Monto recibido destacado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '4px 0' }}>
        <span style={{ fontWeight: 700, fontSize: '12px' }}>MONTO RECIBIDO</span>
        <span style={{ fontWeight: 800, fontSize: '15px' }}>{formatCurrency(pago.monto_pagado)}</span>
      </div>
      <div style={fila}><span style={etiqueta}>Balance anterior:</span><span style={valor}>{formatCurrency(prevBalance)}</span></div>
      <div style={fila}><span style={etiqueta}>Balance pendiente:</span><span style={valor}>{formatCurrency(pago.balance_pendiente)}</span></div>

      {pago.comentario ? (
        <>
          <div style={linea} />
          <div style={{ fontSize: '10px' }}><b>Nota:</b> {pago.comentario}</div>
        </>
      ) : null}

      <div style={linea} />

      <div style={{ fontSize: '10px', textAlign: 'center' }}>
        Recibido por: <b>{pago.registrado_por}</b>
      </div>

      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '11px', fontWeight: 700 }}>
        ¡Gracias por su pago!
      </div>
      <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '2px' }}>
        Este documento es un comprobante de pago.
      </div>
    </div>
  );
}
