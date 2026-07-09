'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/context/ToastContext';
import { apiFetch } from '@/lib/apiFetch';
import { formatCurrency } from '@/lib/format';
import EChart from '@/components/EChart';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import CountUp from '@/components/CountUp';
import {
  PALETTE,
  tendenciaOption,
  gaugeOption,
  donutOption,
  horizontalBarOption,
} from '@/lib/charts';

const PERIODOS_UI = [
  { key: 'dia', label: 'Día' },
  { key: 'mes', label: 'Mes' },
  { key: 'trimestre', label: 'Trimestre' },
  { key: 'anual', label: 'Año' },
];
const TIPOS_UI = [
  { key: 'line', label: 'Línea' },
  { key: 'bar', label: 'Barras' },
];

// Control segmentado reutilizable (estilo Linear/Stripe)
function SegGroup({ options, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', gap: '2px', padding: '3px', background: 'var(--primary-bg)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          style={{
            padding: '4px 12px',
            fontSize: '12px',
            fontWeight: 600,
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            background: value === o.key ? 'var(--card-bg)' : 'transparent',
            color: value === o.key ? 'var(--primary)' : 'var(--text-muted)',
            boxShadow: value === o.key ? 'var(--shadow-sm)' : 'none',
            transition: 'all 0.15s ease',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Tarjeta contenedora reutilizable para cada gráfico
function ChartCard({ title, subtitle, children, span, minHeight }) {
  return (
    <section
      className="card"
      style={{ display: 'flex', flexDirection: 'column', gap: '4px', gridColumn: span, minHeight }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div>
          <h2 style={{ fontSize: '16px' }}>{title}</h2>
          {subtitle && (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>{subtitle}</p>
          )}
        </div>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </section>
  );
}

// Estado vacío reutilizable dentro de un gráfico
function ChartEmpty({ text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '220px', color: 'var(--text-light)', fontSize: '14px' }}>
      {text}
    </div>
  );
}

const CHARTS_GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '24px',
};

export default function DashboardPage() {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [periodo, setPeriodo] = useState('mes');
  const [tipoGrafico, setTipoGrafico] = useState('line');
  const [serie, setSerie] = useState([]);
  const [serieLoading, setSerieLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      // Recalcular mora/atraso antes de leer las metricas (endpoint idempotente).
      await apiFetch('/api/prestamos/actualizar-mora', { method: 'POST' }).catch(() => {});
      const res = await apiFetch('/api/dashboard');
      if (!res.ok) throw new Error('Error al obtener datos del servidor');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar a la base de datos. Verifique la configuración.');
      showToast('No se pudo conectar a la base de datos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Serie temporal (cobros vs préstamos) — se recarga al cambiar la granularidad.
  useEffect(() => {
    let cancel = false;
    setSerieLoading(true);
    apiFetch(`/api/dashboard/series?periodo=${periodo}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((json) => { if (!cancel) setSerie(json.data || []); })
      .catch(() => { if (!cancel) setSerie([]); })
      .finally(() => { if (!cancel) setSerieLoading(false); });
    return () => { cancel = true; };
  }, [periodo]);

  const metrics = data?.metrics;
  const series = data?.series;
  const alertas = data?.alertas || [];

  // Opciones de gráficos (memoizadas: solo se recalculan al cambiar datos/periodo)
  const tendencia = useMemo(
    () => tendenciaOption(serie, { type: tipoGrafico }),
    [serie, tipoGrafico]
  );
  const serieTieneDatos = useMemo(() => serie.some((d) => d.cobros || d.prestamos), [serie]);

  const saludCartera = useMemo(() => {
    if (!metrics) return 0;
    const total = metrics.prestamosActivos + metrics.prestamosEnMora;
    return total > 0 ? (metrics.prestamosActivos / total) * 100 : 100;
  }, [metrics]);
  const gaugeOpt = useMemo(() => gaugeOption(saludCartera, { label: 'Al día' }), [saludCartera]);

  const estadoOption = useMemo(() => {
    if (!metrics) return null;
    return donutOption(
      [
        { name: 'Activos', value: metrics.prestamosActivos, color: PALETTE.info },
        { name: 'Liquidados', value: metrics.prestamosLiquidados, color: PALETTE.secondary },
        { name: 'En mora', value: metrics.prestamosEnMora, color: PALETTE.danger },
      ],
      { centerLabel: 'Préstamos' }
    );
  }, [metrics]);

  const clasificacionOption = useMemo(() => {
    if (!metrics) return null;
    return donutOption(
      [
        { name: 'Excelentes', value: metrics.clientesExcelentes, color: PALETTE.secondary },
        { name: 'Regulares', value: metrics.clientesRegulares, color: PALETTE.info },
        { name: 'En riesgo', value: metrics.clientesMorosos, color: PALETTE.danger },
      ],
      { centerLabel: 'Clientes' }
    );
  }, [metrics]);

  const metodoOption = useMemo(() => {
    const items = (series?.cobrosPorMetodo || []).map((m) => ({
      name: m.metodo.charAt(0).toUpperCase() + m.metodo.slice(1),
      value: m.total,
    }));
    return items.length ? horizontalBarOption(items, { color: PALETTE.secondary, isCurrency: true, name: 'cobros-por-metodo' }) : null;
  }, [series]);

  const moraOption = useMemo(() => {
    const items = alertas.slice(0, 8).map((a) => ({
      name: a.nombre_cliente || a.cedula,
      value: a.dias_atraso,
    }));
    return items.length ? horizontalBarOption(items, { color: PALETTE.danger, name: 'top-mora' }) : null;
  }, [alertas]);

  // --- Skeleton loading (mientras se cargan los datos de la API) ---
  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="card empty-state" style={{ borderTop: '4px solid var(--danger)' }}>
        <div className="empty-state-icon">⚠️</div>
        <div className="empty-state-title">Error de Conexión</div>
        <div className="empty-state-desc">{error}</div>
        <button className="btn btn-primary" onClick={fetchDashboardData}>Reintentar Conexión</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Resumen General Financiero</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Métricas clave del negocio y estado de cartera en tiempo real
        </p>
      </div>

      {/* Cartera y Capital */}
      <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Cartera y Capital</h3>
      <section className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-icon" style={{ color: 'var(--primary)' }}>
            <svg viewBox="0 0 24 24"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
          </div>
          <span className="metric-title">Capital Prestado</span>
          <span className="metric-value"><CountUp value={metrics.capitalPrestado} format={formatCurrency} /></span>
        </div>
        <div className="card metric-card metric-card-activos">
          <div className="metric-icon" style={{ color: 'var(--secondary)' }}>
            <svg viewBox="0 0 24 24"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <span className="metric-title">Capital Recuperado</span>
          <span className="metric-value"><CountUp value={metrics.capitalRecuperado} format={formatCurrency} /></span>
        </div>
        <div className="card metric-card metric-card-cartera">
          <div className="metric-icon" style={{ color: 'var(--info)' }}>
            <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          </div>
          <span className="metric-title">Capital Pendiente</span>
          <span className="metric-value"><CountUp value={metrics.capitalPendiente} format={formatCurrency} /></span>
        </div>
        <div className="card metric-card metric-card-vencimientos-hoy">
          <div className="metric-icon" style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-light)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <svg viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <span className="metric-title">Monto Total en Mora</span>
          <span className="metric-value" style={{ color: 'var(--danger)' }}><CountUp value={metrics.montoTotalMora} format={formatCurrency} /></span>
        </div>
      </section>

      {/* Clientes y Préstamos */}
      <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginTop: '16px' }}>Clientes y Préstamos</h3>
      <section className="metrics-grid">
        <div className="card metric-card metric-card-cartera">
          <div className="metric-icon" style={{ color: 'var(--primary)' }}>
            <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span className="metric-title">Clientes Activos</span>
          <span className="metric-value"><CountUp value={metrics.clientesActivos} /></span>
        </div>
        <div className="card metric-card metric-card-total-clientes">
          <div className="metric-icon" style={{ color: 'var(--info)' }}>
            <svg viewBox="0 0 24 24"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
          </div>
          <span className="metric-title">Clientes Históricos</span>
          <span className="metric-value"><CountUp value={metrics.clientesHistoricos} /></span>
        </div>
        <div className="card metric-card metric-card-activos">
          <div className="metric-icon" style={{ color: 'var(--secondary)' }}>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <span className="metric-title">Clientes Excelentes</span>
          <span className="metric-value" style={{ color: 'var(--secondary)' }}><CountUp value={metrics.clientesExcelentes} /></span>
        </div>
        <div className="card metric-card metric-card-atrasados">
          <div className="metric-icon" style={{ color: 'var(--warning)', backgroundColor: 'var(--warning-light)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
            <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="12"/><line x1="19" x2="19.01" y1="16" y2="16"/></svg>
          </div>
          <span className="metric-title">Clientes Morosos</span>
          <span className="metric-value" style={{ color: 'var(--warning)' }}><CountUp value={metrics.clientesMorosos} /></span>
        </div>
        <div className="card metric-card metric-card-activos">
          <div className="metric-icon" style={{ color: 'var(--secondary)' }}>
            <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <span className="metric-title">Préstamos Activos</span>
          <span className="metric-value"><CountUp value={metrics.prestamosActivos} /></span>
        </div>
        <div className="card metric-card metric-card-total-clientes">
          <div className="metric-icon" style={{ color: 'var(--info)' }}>
            <svg viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <span className="metric-title">Préstamos Liquidados</span>
          <span className="metric-value"><CountUp value={metrics.prestamosLiquidados} /></span>
        </div>
        <div className="card metric-card metric-card-vencimientos-hoy">
          <div className="metric-icon" style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-light)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <span className="metric-title">Préstamos en Mora</span>
          <span className="metric-value" style={{ color: 'var(--danger)' }}><CountUp value={metrics.prestamosEnMora} /></span>
        </div>
      </section>

      {/* Análisis visual */}
      <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginTop: '16px' }}>Análisis Visual</h3>

      {/* Cobros vs Préstamos — ocupa todo el ancho */}
      <ChartCard
        title="Cobros vs Préstamos Otorgados"
        subtitle="Dinero recaudado y capital colocado en el tiempo"
        minHeight="380px"
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <SegGroup options={PERIODOS_UI} value={periodo} onChange={setPeriodo} />
          <SegGroup options={TIPOS_UI} value={tipoGrafico} onChange={setTipoGrafico} />
        </div>
        {serieLoading ? (
          <div className="shimmer" style={{ height: 280, borderRadius: 'var(--radius-md)' }} />
        ) : serieTieneDatos ? (
          <EChart option={tendencia} height={280} ariaLabel="Cobros vs préstamos otorgados" />
        ) : (
          <ChartEmpty text="Sin movimientos en este periodo" />
        )}
      </ChartCard>

      {/* Fila de gráficos */}
      <div style={CHARTS_GRID}>
        <ChartCard title="Salud de Cartera" subtitle="Préstamos al día vs. en mora">
          <EChart option={gaugeOpt} height={260} ariaLabel="Salud de cartera" />
        </ChartCard>

        <ChartCard title="Estado de Préstamos" subtitle="Distribución por estado">
          {estadoOption ? <EChart option={estadoOption} height={260} ariaLabel="Estado de préstamos" /> : <ChartEmpty text="Sin préstamos" />}
        </ChartCard>

        <ChartCard title="Clasificación de Clientes" subtitle="Según su comportamiento de pago">
          {clasificacionOption ? <EChart option={clasificacionOption} height={260} ariaLabel="Clasificación de clientes" /> : <ChartEmpty text="Sin clientes" />}
        </ChartCard>
      </div>

      <div style={CHARTS_GRID}>
        <ChartCard title="Cobros por Método de Pago" subtitle="Total recaudado por vía de cobro">
          {metodoOption ? <EChart option={metodoOption} height={260} ariaLabel="Cobros por método de pago" /> : <ChartEmpty text="Aún no hay cobros registrados" />}
        </ChartCard>

        <ChartCard title="Top Mora por Días de Atraso" subtitle="Préstamos que requieren gestión inmediata" span="span 2">
          {moraOption ? <EChart option={moraOption} height={260} ariaLabel="Top mora por días de atraso" /> : <ChartEmpty text="🎉 No hay préstamos atrasados" />}
        </ChartCard>
      </div>

      {/* Alertas Críticas de Mora (tabla) */}
      <div className="dashboard-sections-grid">
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', gridColumn: '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Alertas Críticas de Mora (Top 20)</h2>
            <span className="badge badge-atrasado">{alertas.length} préstamos requieren atención</span>
          </div>

          <div className="table-container" style={{ flex: 1, borderBottomLeftRadius: 'var(--radius-md)', borderBottomRightRadius: 'var(--radius-md)' }}>
            {alertas.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Cédula</th>
                    <th># Préstamo</th>
                    <th>Balance Pendiente</th>
                    <th style={{ textAlign: 'center' }}>Días Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {alertas.map((alerta) => (
                    <tr key={alerta.numero_prestamo}>
                      <td style={{ fontWeight: 600 }}>{alerta.nombre_cliente}</td>
                      <td>{alerta.cedula}</td>
                      <td>
                        <code style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '700' }}>
                          {alerta.numero_prestamo}
                        </code>
                      </td>
                      <td style={{ fontWeight: '700' }}>
                        {formatCurrency(alerta.balance_pendiente)}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: alerta.dias_atraso > 30 ? 'var(--danger)' : 'var(--warning)' }}>
                        {alerta.dias_atraso} días
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">
                <span className="empty-state-icon" style={{ color: 'var(--secondary)' }}>🎉</span>
                <div className="empty-state-title">Cartera Sana</div>
                <div className="empty-state-desc">No hay préstamos con días de atraso registrados.</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
