'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';
import { formatCurrency } from '@/lib/format';
import ReciboTermico from '@/components/ReciboTermico';

export default function ReciboImprimiblePage() {
  const { pagoId } = useParams();
  const [pago, setPago] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [formato, setFormatoState] = useState('a4');

  // Leer el formato inicial de la URL (?formato=termico) en cliente
  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get('formato');
    if (f === 'termico') setFormatoState('termico');
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [pagoRes, empresaRes] = await Promise.all([
          apiFetch(`/api/pagos/${pagoId}`),
          apiFetch('/api/configuracion/empresa'),
        ]);
        if (pagoRes.ok) {
          const json = await pagoRes.json();
          setPago(json.data);
        } else {
          setError('No se pudo encontrar el recibo de pago.');
        }
        // La empresa no es crítica: si falla, el recibo usa valores por defecto.
        setEmpresa(empresaRes.ok ? (await empresaRes.json()).empresa : {});
      } catch (err) {
        console.error(err);
        setError('Error al conectar con el servidor.');
      } finally {
        setLoading(false);
      }
    };
    if (pagoId) fetchData();
  }, [pagoId]);

  // Auto-imprimir cuando el pago Y la empresa estén listos (para no imprimir sin encabezado)
  useEffect(() => {
    if (pago && empresa !== null) {
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [pago, empresa]);

  const setFormato = (f) => {
    setFormatoState(f);
    const url = new URL(window.location.href);
    if (f === 'termico') url.searchParams.set('formato', 'termico');
    else url.searchParams.delete('formato');
    window.history.replaceState({}, '', url);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() + userTimezoneOffset);
    return localDate.toLocaleString('es-DO', {
      year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const handleSendEmail = async () => {
    try {
      setSendingEmail(true);
      const res = await apiFetch('/api/correos/factura', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagoId }),
      });
      const data = await res.json();
      if (res.ok) {
        alert('✅ ¡Factura enviada por correo exitosamente!');
      } else {
        alert('❌ Error: ' + (data.error || 'No se pudo enviar el correo.'));
      }
    } catch (err) {
      alert('❌ Error de red al intentar enviar el correo.');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif' }}>Generando recibo de pago...</div>;
  }

  if (error || !pago) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#B71C1C', fontFamily: 'sans-serif' }}>
        <h3>Error</h3>
        <p>{error || 'Recibo no encontrado.'}</p>
      </div>
    );
  }

  const prevBalance = parseFloat(pago.monto_pagado || 0) + parseFloat(pago.balance_pendiente || 0);

  // Barra de controles (oculta en impresión), común a ambos formatos
  const segBtn = (activo) => ({
    padding: '8px 14px', border: '1px solid #D8E2EF', borderRadius: '4px',
    fontWeight: 600, fontSize: '13px', cursor: 'pointer',
    background: activo ? '#1E3A5F' : '#FFFFFF', color: activo ? '#FFFFFF' : '#5A6B82',
  });

  const controls = (
    <div className="no-print" style={{
      maxWidth: '650px', margin: '20px auto 0', padding: '0 8px',
      display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#5A6B82' }}>Formato:</span>
        <button onClick={() => setFormato('termico')} style={segBtn(formato === 'termico')}>🧾 80mm</button>
        <button onClick={() => setFormato('a4')} style={segBtn(formato === 'a4')}>📄 A4</button>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={handleSendEmail} disabled={sendingEmail}
          style={{ padding: '8px 16px', backgroundColor: '#10B981', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: sendingEmail ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: sendingEmail ? 0.7 : 1 }}>
          {sendingEmail ? '⏳ Enviando...' : '📧 Enviar por Correo'}
        </button>
        <button onClick={() => window.print()}
          style={{ padding: '8px 16px', backgroundColor: '#1E3A5F', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}>
          🖨️ Imprimir (Ctrl + P)
        </button>
      </div>
    </div>
  );

  // --- Formato térmico 80mm ---
  if (formato === 'termico') {
    return (
      <div>
        {controls}
        <ReciboTermico pago={pago} empresa={empresa} />
      </div>
    );
  }

  // --- Formato A4 (por defecto) ---
  return (
    <div>
      {controls}
      <div className="receipt-container" style={{
        maxWidth: '650px', margin: '16px auto', padding: '30px',
        border: '1px solid #D8E2EF', borderRadius: '8px', backgroundColor: '#FFFFFF',
        fontFamily: "'Plus Jakarta Sans', sans-serif", color: '#1C2D42', boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
      }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @page { size: A4 portrait; margin: 0; }
          @media print {
            body { background-color: #FFFFFF !important; color: #000000 !important;
              -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print, .sidebar, .header, .sidebar-overlay, .hamburger-btn,
            .sidebar-toggle-btn, .header-search-container { display: none !important; }
            .main-wrapper, .content-area {
              margin: 0 !important; padding: 0 !important; width: 100% !important;
              min-height: auto !important; box-shadow: none !important; border: none !important; }
            .app-container { display: block !important; }
            .receipt-container {
              box-shadow: none !important; border: none !important; margin: 15mm auto !important;
              padding: 0 !important; max-width: 100% !important; page-break-inside: avoid; }
          }
        `}} />

        {/* Encabezado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', borderBottom: '2px solid #1E3A5F', paddingBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img src={`/api/configuracion/logo?t=${Date.now()}`} alt="Logo Empresa"
              style={{ width: '80px', height: '80px', objectFit: 'contain' }}
              onError={(e) => { e.target.src = '/logo.png?v=1'; }} />
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1E3A5F', margin: '0 0 4px 0', textTransform: 'uppercase' }}>
                {empresa?.nombre || 'Factura de Pago'}
              </h1>
              <p style={{ fontSize: '13px', color: '#5A6B82', margin: 0 }}>
                {[empresa?.rnc ? `RNC: ${empresa.rnc}` : null, empresa?.direccion, empresa?.telefono ? `Tel: ${empresa.telefono}` : null]
                  .filter(Boolean).join(' | ') || 'Servicios Financieros | Santo Domingo, Rep. Dom.'}
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: '#5A6B82', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Comprobante N°</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#B71C1C' }}>{String(pago.id).padStart(6, '0')}</div>
            <div style={{ fontSize: '13px', color: '#5A6B82', marginTop: '8px' }}><b>Fecha:</b> {formatDate(pago.fecha_pago)}</div>
          </div>
        </div>

        {/* Detalles */}
        <div style={{ border: '1px solid #D8E2EF', borderRadius: '6px', padding: '16px', marginBottom: '24px', fontSize: '13.5px', lineHeight: '1.6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F0F4F8', paddingBottom: '8px', marginBottom: '8px' }}>
            <span style={{ color: '#5A6B82' }}>Fecha de Pago:</span><span style={{ fontWeight: 600 }}>{formatDate(pago.fecha_pago)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F0F4F8', paddingBottom: '8px', marginBottom: '8px' }}>
            <span style={{ color: '#5A6B82' }}>Cliente:</span><span style={{ fontWeight: 600 }}>{pago.nombre_cliente}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F0F4F8', paddingBottom: '8px', marginBottom: '8px' }}>
            <span style={{ color: '#5A6B82' }}>Cédula:</span><span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{pago.cedula}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F0F4F8', paddingBottom: '8px', marginBottom: '8px' }}>
            <span style={{ color: '#5A6B82' }}>Número de Préstamo:</span><span style={{ fontWeight: 600, color: '#1E3A5F' }}>{pago.numero_prestamo}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#5A6B82' }}>Método de Pago:</span><span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{pago.metodo_pago}</span>
          </div>
        </div>

        {/* Desglose */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #1E3A5F', color: '#1E3A5F', textAlign: 'left' }}>
              <th style={{ padding: '8px 0', fontWeight: 700 }}>Concepto</th>
              <th style={{ padding: '8px 0', textAlign: 'right', fontWeight: 700 }}>Importe</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #F0F4F8' }}>
              <td style={{ padding: '12px 0' }}>Pago de Cuota / Amortización Préstamo</td>
              <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(pago.monto_pagado)}</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #F0F4F8' }}>
              <td style={{ padding: '10px 0', color: '#5A6B82', fontSize: '13px' }}>Balance Anterior</td>
              <td style={{ padding: '10px 0', textAlign: 'right', color: '#5A6B82', fontSize: '13px' }}>{formatCurrency(prevBalance)}</td>
            </tr>
            <tr style={{ borderBottom: '2px solid #D8E2EF' }}>
              <td style={{ padding: '12px 0', fontWeight: 700, color: '#1E3A5F' }}>Monto Recibido</td>
              <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 800, fontSize: '16px', color: '#1B5E20' }}>{formatCurrency(pago.monto_pagado)}</td>
            </tr>
            <tr>
              <td style={{ padding: '12px 0', fontWeight: 700 }}>Balance Pendiente Restante</td>
              <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 700, color: '#B71C1C' }}>{formatCurrency(pago.balance_pendiente)}</td>
            </tr>
          </tbody>
        </table>

        {pago.comentario && (
          <div style={{ backgroundColor: '#F8FAFC', border: '1px dashed #D8E2EF', borderRadius: '4px', padding: '12px', fontSize: '12.5px', color: '#5A6B82', marginBottom: '36px' }}>
            <b>Comentarios:</b> {pago.comentario}
          </div>
        )}

        {/* Firmas */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '60px', fontSize: '12px', color: '#5A6B82' }}>
          <div style={{ textAlign: 'center', width: '220px' }}>
            <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '6px', fontWeight: 600 }}>Entregado por (Firma Cliente)</div>
          </div>
          <div style={{ textAlign: 'center', width: '220px' }}>
            <div style={{ fontWeight: 700, color: '#1E3A5F', marginBottom: '2px' }}>{pago.registrado_por}</div>
            <div style={{ borderTop: '1px solid #CBD5E1', paddingTop: '6px', fontWeight: 600 }}>Recibido por (BM Oficial)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
