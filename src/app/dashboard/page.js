'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';

const ActividadComponent = ({ actividad }) => (
  <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <h2>Actividad en Vivo</h2>
      <div className="live-indicator">
        <span className="pulsing-dot"></span>
        En línea
      </div>
    </div>
    
    <div className="activity-feed" style={{ overflowY: 'auto', paddingRight: '8px' }}>
      {actividad.length > 0 ? (
        actividad.map((act) => {
          // Extraemos información de la descripción para hacer un bold en montos o IDs de prestamo si es posible
          let descHtml = act.descripcion;
          if (descHtml) {
            descHtml = descHtml.replace(/(RD\$\s*[\d,.]+)/g, '<strong>$1</strong>');
            descHtml = descHtml.replace(/(PBM-\d{4}-\d{4})/g, '<strong>$1</strong>');
          }

          return (
            <div key={act.id} className="activity-item" style={{ display: 'flex', gap: '16px', borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
              <div className="activity-icon-badge">
                {act.icono}
              </div>
              <div className="activity-content" style={{ flex: 1 }}>
                <div className="activity-content-header">
                  <span className="activity-user-name">{act.usuario}</span>
                  <span className="activity-time-badge">
                    {new Date(act.fecha).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div className="activity-description" dangerouslySetInnerHTML={{ __html: descHtml }}>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <span className="empty-state-icon" style={{ color: 'var(--text-muted)', fontSize: '24px' }}>🕒</span>
          <div className="empty-state-title" style={{ marginTop: '12px', fontWeight: 600 }}>Sin Actividad</div>
          <div className="empty-state-desc" style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Aún no hay acciones registradas.</div>
        </div>
      )}
    </div>
  </section>
);

export default function DashboardPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actividad, setActividad] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Sync fullscreen state
  useEffect(() => {
    // Client-side only
    if (typeof document !== 'undefined') {
      setIsFullscreen(document.body.classList.contains('fullscreen-mode'));
      const observer = new MutationObserver(() => {
        setIsFullscreen(document.body.classList.contains('fullscreen-mode'));
      });
      observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
      return () => observer.disconnect();
    }
  }, []);
  
  // Nuevos estados
  const [metricasDia, setMetricasDia] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [chartPeriodo, setChartPeriodo] = useState('quincena'); // dia, quincena, mes
  const [chartType, setChartType] = useState('area'); // area, bar, line
  const [chartLoading, setChartLoading] = useState(true);

  const fetchDashboardData = async (isPolling = false) => {
    try {
      if (!isPolling) setLoading(true);
      setError('');
      const res = await fetch('/api/dashboard');
      if (!res.ok) {
        throw new Error('Error al obtener datos del servidor');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
      setError('No se pudo conectar a la base de datos. Verifique la configuración.');
      showToast('No se pudo conectar a la base de datos.', 'error');
    } finally {
      if (!isPolling) setLoading(false);
    }
  };

  const fetchActividad = async () => {
    try {
      const res = await fetch('/api/dashboard/actividad');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setActividad(json.data);
      }
    } catch (err) { console.error("Error fetching actividad:", err); }
  };

  const fetchMetricasDia = async () => {
    try {
      const res = await fetch('/api/dashboard/metricas-dia');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setMetricasDia(json);
      }
    } catch (err) { console.error("Error fetching metricas del dia:", err); }
  };

  const fetchChartData = async (periodo, isPolling = false) => {
    try {
      if (!isPolling) setChartLoading(true);
      const res = await fetch(`/api/dashboard/graficas?periodo=${periodo}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setChartData(json.data);
      }
    } catch (err) { 
      console.error("Error fetching chart data:", err); 
    } finally {
      if (!isPolling) setChartLoading(false);
    }
  };

  useEffect(() => {
    fetchChartData(chartPeriodo);
    
    // Polling en vivo para la gráfica (sin animación de carga)
    const interval = setInterval(() => {
      fetchChartData(chartPeriodo, true);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [chartPeriodo]);

  useEffect(() => {
    fetchDashboardData();
    fetchActividad();
    fetchMetricasDia();
    
    // Polling cada 5 segundos para tiempo real (tarjetas y actividad)
    const interval = setInterval(() => {
      fetchDashboardData(true); // Pass true to avoid triggering the loading spinner
      fetchActividad();
      fetchMetricasDia();
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('es-DO', {
      style: 'currency',
      currency: 'DOP',
      minimumFractionDigits: 2
    }).format(value).replace('DOP', 'RD$');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <h1 className="shimmer" style={{ width: '200px', height: '36px', marginBottom: '8px' }}></h1>
          <p className="shimmer" style={{ width: '300px', height: '16px' }}></p>
        </div>
        <div className="metrics-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="card shimmer shimmer-card"></div>
          ))}
        </div>
      </div>
    );
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

  const { metrics, alertas } = data;

  const renderActividadEnVivo = () => (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Actividad en Vivo</h2>
        <div className="live-indicator">
          <span className="pulsing-dot"></span>
          En línea
        </div>
      </div>
      
      <div className="activity-feed" style={{ overflowY: 'auto', paddingRight: '8px' }}>
        {actividad.length > 0 ? (
          actividad.map((act) => (
            <div key={act.id} className="activity-item" style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <div className="activity-icon" style={{ 
                fontSize: '20px', 
                width: '40px', height: '40px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: '50%', flexShrink: 0 
              }}>
                {act.icono}
              </div>
              <div className="activity-content" style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{act.usuario}</span>
                  {' • '}
                  {new Date(act.fecha).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
                <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                  {act.descripcion}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <span className="empty-state-icon" style={{ color: 'var(--text-muted)' }}>🕒</span>
            <div className="empty-state-title">Sin Actividad</div>
            <div className="empty-state-desc">Aún no hay acciones registradas.</div>
          </div>
        )}
      </div>
    </section>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>Resumen General Financiero</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
          Métricas clave del negocio y estado de cartera en tiempo real
        </p>
      </div>

      {/* Métricas del Día y Gráficas */}
      {metricasDia && (
        <>
          <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Métricas del Día (Hoy)</h3>
          <section className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            <div className="card metric-card" style={{ background: 'var(--secondary-gradient)', color: 'white', borderColor: 'transparent', cursor: 'pointer' }} onClick={() => router.push('/prestamos?fecha=hoy')}>
              <div className="metric-icon" style={{ color: 'var(--secondary)', backgroundColor: 'white' }}>
                <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <span className="metric-title" style={{ color: 'rgba(255,255,255,0.8)' }}>Préstamos Solicitados Hoy ({metricasDia.prestamosDia})</span>
              <span className="metric-value" style={{ color: 'white' }}>{formatCurrency(metricasDia.montoPrestamosDia)}</span>
            </div>
            
            <div className="card metric-card" style={{ background: 'var(--primary-gradient)', color: 'white', borderColor: 'transparent', cursor: 'pointer' }} onClick={() => router.push('/cobros?fecha=hoy')}>
              <div className="metric-icon" style={{ color: 'var(--primary)', backgroundColor: 'white' }}>
                <svg viewBox="0 0 24 24"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <span className="metric-title" style={{ color: 'rgba(255,255,255,0.8)' }}>Cobros del Día ({metricasDia.cobrosDia})</span>
              <span className="metric-value" style={{ color: 'white' }}>{formatCurrency(metricasDia.montoCobrosDia)}</span>
            </div>
          </section>
        </>
      )}

      {/* Módulo de Gráficas */}
      <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginTop: '8px' }}>Rendimiento y Tendencias</h3>
      <section className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Comparativa Préstamos vs Cobros</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Visualización del flujo de capital en diferentes períodos</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--card-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setChartType('area')} 
                className={`btn ${chartType === 'area' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', fontSize: '12px', minHeight: 'auto' }}
                title="Gráfico de Área"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 6-6"/><path d="M7 21v-5l4-4 4 4 6-6v11"/></svg>
              </button>
              <button 
                onClick={() => setChartType('bar')} 
                className={`btn ${chartType === 'bar' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', fontSize: '12px', minHeight: 'auto' }}
                title="Gráfico de Barras"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
              </button>
              <button 
                onClick={() => setChartType('line')} 
                className={`btn ${chartType === 'line' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 8px', fontSize: '12px', minHeight: 'auto' }}
                title="Gráfico de Líneas"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              </button>
            </div>
            
            <div style={{ display: 'flex', gap: '4px', background: 'var(--card-bg)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button 
                onClick={() => setChartPeriodo('dia')} 
                className={`btn ${chartPeriodo === 'dia' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 12px', fontSize: '12px', minHeight: 'auto' }}
              >
                7 Días
              </button>
              <button 
                onClick={() => setChartPeriodo('quincena')} 
                className={`btn ${chartPeriodo === 'quincena' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 12px', fontSize: '12px', minHeight: 'auto' }}
              >
                Quincena
              </button>
              <button 
                onClick={() => setChartPeriodo('mes')} 
                className={`btn ${chartPeriodo === 'mes' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 12px', fontSize: '12px', minHeight: 'auto' }}
              >
                Mes
              </button>
            </div>
          </div>
        </div>

        {chartLoading ? (
          <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="shimmer" style={{ width: '100%', height: '100%', borderRadius: 'var(--radius-md)' }}></div>
          </div>
        ) : chartData.length > 0 ? (
          <div style={{ height: '350px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              {(() => {
                const commonProps = { data: chartData, margin: { top: 10, right: 10, left: 10, bottom: 20 } };
                const commonChildren = (
                  <>
                    <defs>
                      <linearGradient id="colorPrestamos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--secondary)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--secondary)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCobros" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--info)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--info)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 12, fill: 'var(--text-muted)' }} 
                      tickFormatter={(val) => `RD$${val >= 1000 ? (val/1000).toFixed(0) + 'k' : val}`}
                    />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 8px 30px rgba(0,0,0,0.12)', fontWeight: 500, backgroundColor: 'var(--bg-color, #fff)' }}
                      formatter={(value) => formatCurrency(value)}
                      labelStyle={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                      itemStyle={{ fontSize: '14px', padding: '4px 0' }}
                    />
                    <Legend 
                      iconType="circle" 
                      wrapperStyle={{ paddingTop: '20px' }} 
                      formatter={(value) => <span style={{ color: 'var(--text-color)', fontWeight: 600, fontSize: '14px', paddingLeft: '4px' }}>{value}</span>}
                    />
                  </>
                );

                if (chartType === 'bar') {
                  return (
                    <BarChart {...commonProps}>
                      {commonChildren}
                      <Bar name="Préstamos Solicitados" dataKey="prestamos" fill="var(--secondary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      <Bar name="Cobros Registrados" dataKey="cobros" fill="var(--info)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  );
                } else if (chartType === 'line') {
                  return (
                    <LineChart {...commonProps}>
                      {commonChildren}
                      <Line type="monotone" name="Préstamos Solicitados" dataKey="prestamos" stroke="var(--secondary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 0, fill: 'var(--secondary)' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                      <Line type="monotone" name="Cobros Registrados" dataKey="cobros" stroke="var(--info)" strokeWidth={3} dot={{ r: 4, strokeWidth: 0, fill: 'var(--info)' }} activeDot={{ r: 6, strokeWidth: 0 }} />
                    </LineChart>
                  );
                } else {
                  return (
                    <AreaChart {...commonProps}>
                      {commonChildren}
                      <Area type="monotone" name="Préstamos Solicitados" dataKey="prestamos" stroke="var(--secondary)" strokeWidth={3} fillOpacity={1} fill="url(#colorPrestamos)" activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--secondary)' }} />
                      <Area type="monotone" name="Cobros Registrados" dataKey="cobros" stroke="var(--info)" strokeWidth={3} fillOpacity={1} fill="url(#colorCobros)" activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--info)' }} />
                    </AreaChart>
                  );
                }
              })()}
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="empty-state" style={{ height: '300px' }}>
            <span className="empty-state-icon">📊</span>
            <div className="empty-state-title">Sin Datos</div>
            <div className="empty-state-desc">No hay registros suficientes para este período.</div>
          </div>
        )}
      </section>

      {/* Primary Metrics Grid */}
      <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginTop: '8px' }}>Cartera y Capital</h3>
      <section className="metrics-grid">
        <div className="card metric-card cursor-pointer" onClick={() => router.push('/prestamos?estado=todos')}>
          <div className="metric-icon" style={{ color: 'var(--primary)' }}>
            <svg viewBox="0 0 24 24"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
          </div>
          <span className="metric-title">Capital Prestado</span>
          <span className="metric-value">{formatCurrency(metrics.capitalPrestado)}</span>
        </div>
        <div className="card metric-card metric-card-activos cursor-pointer" onClick={() => router.push('/cobros')}>
          <div className="metric-icon" style={{ color: 'var(--secondary)' }}>
            <svg viewBox="0 0 24 24"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <span className="metric-title">Capital Recuperado</span>
          <span className="metric-value">{formatCurrency(metrics.capitalRecuperado)}</span>
        </div>
        <div className="card metric-card metric-card-cartera cursor-pointer" onClick={() => router.push('/prestamos?estado=activo')}>
          <div className="metric-icon" style={{ color: 'var(--info)' }}>
            <svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          </div>
          <span className="metric-title">Capital Pendiente</span>
          <span className="metric-value">{formatCurrency(metrics.capitalPendiente)}</span>
        </div>
        <div className="card metric-card metric-card-vencimientos-hoy cursor-pointer" onClick={() => router.push('/prestamos?estado=atrasado')}>
          <div className="metric-icon" style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-light)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <svg viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <span className="metric-title">Monto Total en Mora</span>
          <span className="metric-value" style={{ color: 'var(--danger)' }}>{formatCurrency(metrics.montoTotalMora)}</span>
        </div>
      </section>

      {/* Actividad en Vivo (Modo Pantalla Completa) */}
      {isFullscreen && renderActividadEnVivo()}

      {/* Secondary Metrics Grid */}
      <h3 style={{ fontSize: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginTop: '16px' }}>Clientes y Préstamos</h3>
      <section className="metrics-grid">
        <div 
          className="card metric-card metric-card-cartera hover-scale cursor-pointer" 
          onClick={() => router.push('/clientes?tab=activos')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div className="metric-icon" style={{ color: 'var(--primary)' }}>
            <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span className="metric-title">Clientes Activos</span>
          <span className="metric-value">{metrics.clientesActivos}</span>
        </div>
        <div 
          className="card metric-card metric-card-total-clientes hover-scale cursor-pointer" 
          onClick={() => router.push('/clientes?tab=historicos')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div className="metric-icon" style={{ color: 'var(--info)' }}>
            <svg viewBox="0 0 24 24"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
          </div>
          <span className="metric-title">Clientes Históricos</span>
          <span className="metric-value">{metrics.clientesHistoricos}</span>
        </div>
        <div 
          className="card metric-card metric-card-activos hover-scale cursor-pointer" 
          onClick={() => router.push('/clientes?clasificacion=excelente')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div className="metric-icon" style={{ color: 'var(--secondary)' }}>
            <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          </div>
          <span className="metric-title">Clientes Excelentes</span>
          <span className="metric-value" style={{ color: 'var(--secondary)' }}>{metrics.clientesExcelentes}</span>
        </div>
        <div 
          className="card metric-card metric-card-atrasados hover-scale cursor-pointer" 
          onClick={() => router.push('/clientes?clasificacion=riesgoso')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div className="metric-icon" style={{ color: 'var(--warning)', backgroundColor: 'var(--warning-light)', borderColor: 'rgba(245, 158, 11, 0.2)' }}>
            <svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="12"/><line x1="19" x2="19.01" y1="16" y2="16"/></svg>
          </div>
          <span className="metric-title">Clientes Morosos</span>
          <span className="metric-value" style={{ color: 'var(--warning)' }}>{metrics.clientesMorosos}</span>
        </div>

        <div 
          className="card metric-card metric-card-activos hover-scale cursor-pointer" 
          onClick={() => router.push('/prestamos?estado=activo')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div className="metric-icon" style={{ color: 'var(--secondary)' }}>
            <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <span className="metric-title">Préstamos Activos</span>
          <span className="metric-value">{metrics.prestamosActivos}</span>
        </div>
        <div 
          className="card metric-card metric-card-total-clientes hover-scale cursor-pointer" 
          onClick={() => router.push('/prestamos?estado=pagado')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div className="metric-icon" style={{ color: 'var(--info)' }}>
            <svg viewBox="0 0 24 24"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>
          </div>
          <span className="metric-title">Préstamos Liquidados</span>
          <span className="metric-value">{metrics.prestamosLiquidados}</span>
        </div>
        <div 
          className="card metric-card metric-card-vencimientos-hoy hover-scale cursor-pointer" 
          onClick={() => router.push('/prestamos?estado=atrasado')}
          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <div className="metric-icon" style={{ color: 'var(--danger)', backgroundColor: 'var(--danger-light)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <span className="metric-title">Préstamos en Mora</span>
          <span className="metric-value" style={{ color: 'var(--danger)' }}>{metrics.prestamosEnMora}</span>
        </div>
      </section>

      {/* Bottom Sections: Alertas & Actividad */}
      <div className="dashboard-sections-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* Alertas */}
        <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

        {/* Actividad en Vivo (Modo Normal) */}
        {!isFullscreen && renderActividadEnVivo()}
      </div>

      <style jsx>{`
        .live-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          color: var(--success);
          background: rgba(34, 197, 94, 0.1);
          padding: 4px 10px;
          border-radius: 20px;
        }
        .pulsing-dot {
          width: 8px;
          height: 8px;
          background-color: var(--success);
          border-radius: 50%;
          animation: pulse 1.5s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        .activity-feed::-webkit-scrollbar {
          width: 6px;
        }
        .activity-feed::-webkit-scrollbar-track {
          background: transparent;
        }
        .activity-feed::-webkit-scrollbar-thumb {
          background-color: var(--border-color);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
}
