'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import * as XLSX from 'xlsx';
import { apiFetch } from '@/lib/apiFetch';

function PrestamosContent() {
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const cedulaParam = searchParams.get('cedula');

  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estadoFilter, setEstadoFilter] = useState('');
  const [diasMinFilter, setDiasMinFilter] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [finConfig, setFinConfig] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showFutureDateWarning, setShowFutureDateWarning] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);


  // Estado del formulario
  const [formValues, setFormValues] = useState({
    cedula: '',
    monto_aprobado: '',
    frecuencia: 'mensual',
    total_cuotas: '12',
    tasa_interes: '5',   // Se guarda como porcentaje (ej. 5 = 5%), se convierte a decimal al enviar
    fecha_inicio: new Date().toISOString().split('T')[0],
    metodo_desembolso: 'efectivo',
    banco_nombre: '',
    numero_cuenta: ''
  });

  // â”€â”€ CÃ¡lculo automÃ¡tico en tiempo real â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const calculo = useMemo(() => {
    const monto     = parseFloat(formValues.monto_aprobado) || 0;
    const tasaPct   = parseFloat(formValues.tasa_interes)   || 0;
    const cuotas    = parseInt(formValues.total_cuotas)      || 1;

    if (monto <= 0 || cuotas <= 0) {
      return { montoInteres: 0, totalAPagar: 0, cuotaEstimada: 0, tasaDecimal: 0 };
    }

    const tasaDecimal    = tasaPct / 100;
    const montoInteres   = Math.round(monto * tasaDecimal * 100) / 100;
    const totalAPagar    = Math.round((monto + montoInteres) * 100) / 100;
    const cuotaEstimada  = Math.round((totalAPagar / cuotas) * 100) / 100;

    return { montoInteres, totalAPagar, cuotaEstimada, tasaDecimal };
  }, [formValues.monto_aprobado, formValues.tasa_interes, formValues.total_cuotas]);
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const fetchLoans = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (estadoFilter)  params.set('estado',     estadoFilter);
      if (diasMinFilter) params.set('dias_min',   diasMinFilter);
      if (fechaDesde)    params.set('fecha_desde', fechaDesde);
      if (fechaHasta)    params.set('fecha_hasta', fechaHasta);

      const res = await apiFetch(`/api/prestamos?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setLoans(json.data || []);
      } else {
        showToast('Error al obtener la lista de prÃ©stamos.', 'error');
      }
    } catch (err) {
      showToast('No se pudo conectar a la base de datos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    fetchLoans(); 
    fetchConfig();
    fetchCurrentUser();
  }, [estadoFilter, diasMinFilter, fechaDesde, fechaHasta]);

  const fetchCurrentUser = async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const json = await res.json();
        setCurrentUser(json.user);
      }
    } catch (err) {}
  };

  const fetchConfig = async () => {
    try {
      const res = await apiFetch('/api/configuracion');
      if (res.ok) {
        const json = await res.json();
        const configMap = {};
        json.data.forEach(item => configMap[item.clave] = item.valor);
        setFinConfig(configMap);
        
        setFormValues(prev => ({
          ...prev,
          tasa_interes: configMap.tasa_interes_default || '5'
        }));
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (cedulaParam) {
      setFormValues(prev => ({ ...prev, cedula: cedulaParam }));
      setShowAddModal(true);
      router.replace('/prestamos');
    }
  }, [cedulaParam]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    
    const today = new Date().toISOString().split('T')[0];
    if (formValues.fecha_inicio > today) {
      setPendingAction('create');
      setShowFutureDateWarning(true);
      return;
    }
    await executeCreateSubmit();
  };

  const executeCreateSubmit = async () => {
    if (!formValues.cedula || !formValues.monto_aprobado || !formValues.total_cuotas) {
      showToast('Llene los campos obligatorios', 'error');
      return;
    }
    if (calculo.totalAPagar <= 0) {
      showToast('Ingrese un monto vÃ¡lido mayor a cero.', 'error');
      return;
    }
    if (formValues.metodo_desembolso === 'banco' && (!formValues.banco_nombre || !formValues.numero_cuenta)) {
      showToast('Debe ingresar el banco y nÃºmero de cuenta para transferencia.', 'error');
      return;
    }

    if (finConfig) {
      const min = parseFloat(finConfig.monto_minimo) || 0;
      const max = parseFloat(finConfig.monto_maximo) || Infinity;
      const monto = parseFloat(formValues.monto_aprobado) || 0;
      if (monto < min) {
        showToast(`El monto no puede ser menor a RD$ ${min.toLocaleString()}`, 'error');
        return;
      }
      if (monto > max) {
        showToast(`El monto no puede ser mayor a RD$ ${max.toLocaleString()}`, 'error');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        ...formValues,
        tasa_interes: calculo.tasaDecimal   // Convertir de porcentaje a decimal para la API
      };
      const res = await apiFetch('/api/prestamos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`PrÃ©stamo ${data.data?.numero_prestamo} creado correctamente`, 'success');
        setShowAddModal(false);
        setFormValues({
          cedula: '', monto_aprobado: '', frecuencia: 'mensual',
          total_cuotas: '12', tasa_interes: finConfig?.tasa_interes_default || '5',
          fecha_inicio: new Date().toISOString().split('T')[0],
          metodo_desembolso: 'efectivo',
          banco_nombre: '',
          numero_cuenta: ''
        });
        fetchLoans();
      } else {
        showToast(data.error || 'Error al crear', 'error');
      }
    } catch (err) {
      showToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (loan) => {
    setEditingLoan(loan);
    setFormValues({
      cedula: loan.cedula,
      monto_aprobado: loan.monto_aprobado.toString(),
      frecuencia: loan.tipo_frecuencia || 'mensual',
      total_cuotas: loan.total_cuotas.toString(),
      tasa_interes: loan.tasa_interes ? (parseFloat(loan.tasa_interes) * 100).toFixed(2) : '5',
      fecha_inicio: loan.created_at ? new Date(loan.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      metodo_desembolso: loan.metodo_desembolso || 'efectivo',
      banco_nombre: loan.banco_nombre || '',
      numero_cuenta: loan.numero_cuenta || ''
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingLoan) return;

    const today = new Date().toISOString().split('T')[0];
    if (formValues.fecha_inicio > today) {
      setPendingAction('edit');
      setShowFutureDateWarning(true);
      return;
    }
    await executeEditSubmit();
  };

  const executeEditSubmit = async () => {
    if (calculo.totalAPagar <= 0) {
      showToast('Ingrese un monto vÃ¡lido mayor a cero.', 'error');
      return;
    }

    if (finConfig) {
      const min = parseFloat(finConfig.monto_minimo) || 0;
      const max = parseFloat(finConfig.monto_maximo) || Infinity;
      const monto = parseFloat(formValues.monto_aprobado) || 0;
      if (monto < min) {
        showToast(`El monto no puede ser menor a RD$ ${min.toLocaleString()}`, 'error');
        return;
      }
      if (monto > max) {
        showToast(`El monto no puede ser mayor a RD$ ${max.toLocaleString()}`, 'error');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        ...formValues,
        tasa_interes: calculo.tasaDecimal
      };
      const res = await apiFetch(`/api/prestamos/${encodeURIComponent(editingLoan.numero_prestamo)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        showToast('PrÃ©stamo actualizado correctamente', 'success');
        setShowEditModal(false);
        setEditingLoan(null);
        fetchLoans();
      } else {
        showToast(data.error || 'Error al actualizar', 'error');
      }
    } catch (err) {
      showToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (value) => {
    if (value === undefined || value === null) return 'RD$ 0.00';
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 2 })
      .format(value).replace('DOP', 'RD$');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const offset = date.getTimezoneOffset() * 60000;
    const local  = new Date(date.getTime() + offset);
    return `${String(local.getDate()).padStart(2,'0')}/${String(local.getMonth()+1).padStart(2,'0')}/${local.getFullYear()}`;
  };

  const handleExportXLSX = () => {
    if (!loans.length) { showToast('No hay datos para exportar', 'error'); return; }
    const ws = XLSX.utils.json_to_sheet(loans.map(l => ({
      'PrÃ©stamo': l.numero_prestamo, 'Cliente': l.nombre_cliente, 'CÃ©dula': l.cedula,
      'Monto': l.monto_aprobado, 'Balance': l.balance_pendiente,
      'Frecuencia': l.tipo_frecuencia, 'Estado': l.estado
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PrÃ©stamos');
    XLSX.writeFile(wb, 'prestamos.xlsx');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>MÃ³dulo de PrÃ©stamos</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Listado y administraciÃ³n de prÃ©stamos y calendarios de pago
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={handleExportXLSX}>ðŸ“¥ Exportar</button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <span>âž•</span> Otorgar PrÃ©stamo
          </button>
        </div>
      </div>

      {/* Filtros */}
      <section className="filters-bar">
        <div className="filter-item" style={{ width: '180px' }}>
          <label>Estado</label>
          <select className="form-control" value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="activo">Activo</option>
            <option value="atrasado">Atrasado</option>
            {currentUser?.rol === 'admin' && <option value="pagado">Pagado</option>}
          </select>
        </div>
        <div className="filter-item" style={{ width: '160px' }}>
          <label>DÃ­as mÃ­n. atraso</label>
          <input type="number" className="form-control" value={diasMinFilter}
            onChange={(e) => setDiasMinFilter(e.target.value)} placeholder="Ej. 30" />
        </div>
        <div className="filter-item" style={{ width: '160px' }}>
          <label>Fecha desde</label>
          <input type="date" className="form-control" value={fechaDesde}
            onChange={(e) => setFechaDesde(e.target.value)} />
        </div>
        <div className="filter-item" style={{ width: '160px' }}>
          <label>Fecha hasta</label>
          <input type="date" className="form-control" value={fechaHasta}
            onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
      </section>

      {/* Tabla */}
      <section>
        {loading ? (
          <div className="card" style={{ padding: '48px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...Array(6)].map((_, i) => <div key={i} className="shimmer shimmer-row"></div>)}
          </div>
        ) : loans.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>CÃ©dula</th>
                  <th># PrÃ©stamo</th>
                  <th>Monto Aprobado</th>
                  <th>Total c/InterÃ©s</th>
                  <th>Balance Pendiente</th>
                  <th>Cuota</th>
                  <th>Frecuencia</th>
                  <th>Estado</th>
                  {currentUser?.rol === 'admin' && <th>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => {
                  return (
                    <tr key={loan.id}>
                      <td style={{ fontWeight: 600 }}>{loan.nombre_cliente}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{loan.cedula}</td>
                      <td>
                        <code style={{ color: 'var(--primary)', fontWeight: '700', fontSize: '13px' }}>
                          {loan.numero_prestamo}
                        </code>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {loan.metodo_desembolso === 'banco' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              ðŸ¦ <b>{loan.banco_nombre}</b>: {loan.numero_cuenta}
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              ðŸ’µ Efectivo
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{formatCurrency(loan.monto_aprobado)}</td>
                      <td style={{ fontWeight: '600' }}>
                        {formatCurrency(loan.monto_total_original)}
                      </td>
                      <td style={{ fontWeight: 700, color: loan.balance_pendiente === 0 ? 'var(--secondary)' : 'inherit' }}>
                        {formatCurrency(loan.balance_pendiente)}
                      </td>
                      <td>{formatCurrency(loan.cuota_mensual)}</td>
                      <td style={{ textTransform: 'capitalize' }}>
                        {loan.tipo_frecuencia || 'mensual'}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {loan.total_cuotas} cuotas
                        </div>
                      </td>
                      <td><span className={`badge badge-${loan.estado}`}>{loan.estado}</span></td>
                      {currentUser?.rol === 'admin' && (
                        <td>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                            onClick={() => openEditModal(loan)}
                          >
                            âœï¸ Editar
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card empty-state">
            <div className="empty-state-icon">ðŸ’¼</div>
            <div className="empty-state-title">No se encontraron prÃ©stamos</div>
          </div>
        )}
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MODAL OTORGAR PRÃ‰STAMO con cÃ¡lculo automÃ¡tico
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <form onSubmit={handleCreateSubmit}>
              <div className="modal-header">
                <h2>Otorgar Nuevo PrÃ©stamo</h2>
                <button type="button" className="btn" style={{ background: 'none', padding: 0 }}
                  onClick={() => setShowAddModal(false)}>âŒ</button>
              </div>
              <div className="modal-body">

                {/* CÃ©dula del cliente */}
                <div className="form-group">
                  <label>CÃ©dula del Cliente <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    className="form-control"
                    value={formValues.cedula}
                    placeholder="00100000000 (debe estar registrado)"
                    onChange={(e) => setFormValues({ ...formValues, cedula: e.target.value.replace(/\D/g, '') })}
                  />
                  <small style={{ color: 'var(--text-muted)' }}>El cliente debe estar registrado en el mÃ³dulo de Clientes.</small>
                </div>

                {/* Monto + Tasa */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Monto Aprobado (RD$) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      className="form-control"
                      value={formValues.monto_aprobado}
                      placeholder="0.00"
                      onChange={(e) => setFormValues({ ...formValues, monto_aprobado: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      Tasa de InterÃ©s Total (%)
                      {currentUser?.rol !== 'admin' && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--warning)', fontWeight: '700' }}>ðŸ”’ Solo Admin</span>}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        className="form-control"
                        value={formValues.tasa_interes}
                        onChange={(e) => currentUser?.rol === 'admin' && setFormValues({ ...formValues, tasa_interes: e.target.value })}
                        readOnly={currentUser?.rol !== 'admin'}
                        style={{ paddingRight: '36px', cursor: currentUser?.rol !== 'admin' ? 'not-allowed' : 'text', backgroundColor: currentUser?.rol !== 'admin' ? 'var(--primary-bg)' : '' }}
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>%</span>
                    </div>
                    <small style={{ color: 'var(--text-muted)' }}>Ej: 5 = 5% sobre el capital</small>
                  </div>
                </div>

                {/* Frecuencia + Cuotas */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Frecuencia de Pago</label>
                    <select
                      className="form-control"
                      value={formValues.frecuencia}
                      onChange={(e) => setFormValues({ ...formValues, frecuencia: e.target.value })}
                    >
                      <option value="diario">Diario</option>
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="mensual">Mensual</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cantidad de Cuotas <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="form-control"
                      value={formValues.total_cuotas}
                      onChange={(e) => setFormValues({ ...formValues, total_cuotas: e.target.value })}
                    />
                  </div>
                </div>

                {/* Fecha de inicio */}
                <div className="form-group">
                  <label>Fecha de Inicio del PrÃ©stamo <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="date"
                    required
                    className="form-control"
                    value={formValues.fecha_inicio}
                    onChange={(e) => setFormValues({ ...formValues, fecha_inicio: e.target.value })}
                  />
                </div>

                {/* MÃ©todo de desembolso */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>MÃ©todo de Desembolso</label>
                    <select
                      className="form-control"
                      value={formValues.metodo_desembolso}
                      onChange={(e) => setFormValues({ ...formValues, metodo_desembolso: e.target.value })}
                    >
                      <option value="efectivo">ðŸ’µ Efectivo</option>
                      <option value="banco">ðŸ¦ Transferencia Bancaria</option>
                    </select>
                  </div>
                </div>

                {formValues.metodo_desembolso === 'banco' && (
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Banco <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        placeholder="Ej: Banco Popular, Banreservas"
                        value={formValues.banco_nombre || ''}
                        onChange={(e) => setFormValues({ ...formValues, banco_nombre: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>NÃºmero de Cuenta <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        placeholder="Ej: 0102030405"
                        value={formValues.numero_cuenta || ''}
                        onChange={(e) => setFormValues({ ...formValues, numero_cuenta: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* â”€â”€ Panel de cÃ¡lculo automÃ¡tico â”€â”€ */}
                {calculo.totalAPagar > 0 && (
                  <div style={{
                    marginTop: '8px',
                    background: 'linear-gradient(135deg, rgba(var(--primary-rgb, 30,58,95),0.06) 0%, rgba(var(--secondary-rgb, 16,185,129),0.05) 100%)',
                    border: '1.5px solid var(--primary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '16px' }}>ðŸ§®</span>
                      <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--primary)' }}>CÃ¡lculo AutomÃ¡tico del PrÃ©stamo</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Capital Prestado</div>
                        <div style={{ fontWeight: '700', fontSize: '15px' }}>
                          {formatCurrency(parseFloat(formValues.monto_aprobado) || 0)}
                        </div>
                      </div>
                      <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '10px', border: '1px solid var(--border-color)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                          InterÃ©s ({formValues.tasa_interes}%)
                        </div>
                        <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--warning)' }}>
                          + {formatCurrency(calculo.montoInteres)}
                        </div>
                      </div>
                      <div style={{ background: 'linear-gradient(135deg, var(--primary) 0%, #1e5a9c 100%)', borderRadius: 'var(--radius-sm)', padding: '10px' }}>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '3px' }}>Total a Pagar</div>
                        <div style={{ fontWeight: '800', fontSize: '17px', color: '#fff' }}>
                          {formatCurrency(calculo.totalAPagar)}
                        </div>
                      </div>
                      <div style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-sm)', padding: '10px', border: '2px solid var(--secondary)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>
                          Cuota {formValues.frecuencia === 'mensual' ? 'Mensual' : formValues.frecuencia === 'semanal' ? 'Semanal' : formValues.frecuencia === 'quincenal' ? 'Quincenal' : 'Diaria'}
                        </div>
                        <div style={{ fontWeight: '800', fontSize: '17px', color: 'var(--secondary)' }}>
                          {formatCurrency(calculo.cuotaEstimada)}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                      {formValues.total_cuotas} cuotas de {formatCurrency(calculo.cuotaEstimada)} | Frecuencia: {formValues.frecuencia}
                    </div>
                  </div>
                )}

                {/* Nota informativa */}
                {calculo.totalAPagar <= 0 && (
                  <div style={{ backgroundColor: 'var(--primary-bg)', border: '1px solid var(--border-color)', padding: '12px', borderRadius: 'var(--radius-sm)', marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
                    ðŸ’¡ Ingresa el monto aprobado para ver el cÃ¡lculo automÃ¡tico de cuotas e intereses.
                  </div>
                )}

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving || calculo.totalAPagar <= 0}>
                  {saving ? 'Procesando...' : 'âœ… Guardar y Generar Calendario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          MODAL EDITAR PRÃ‰STAMO
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      {showEditModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-header">
                <h2>Editar PrÃ©stamo {editingLoan?.numero_prestamo}</h2>
                <button type="button" className="btn" style={{ background: 'none', padding: 0 }}
                  onClick={() => { setShowEditModal(false); setEditingLoan(null); }}>âŒ</button>
              </div>
              <div className="modal-body">
                
                <div style={{ backgroundColor: 'rgba(255,193,7,0.1)', border: '1px solid #ffc107', padding: '12px', borderRadius: '4px', marginBottom: '16px', fontSize: '13px', color: '#856404' }}>
                  âš ï¸ <b>Importante:</b> Al guardar los cambios, se eliminarÃ¡ el calendario de cuotas actual y se generarÃ¡ uno nuevo con estos datos. Esta acciÃ³n no se puede realizar si el cliente ya ha pagado alguna cuota.
                </div>

                {/* CÃ©dula del cliente (Disabled en ediciÃ³n) */}
                <div className="form-group">
                  <label>CÃ©dula del Cliente</label>
                  <input
                    type="text"
                    disabled
                    className="form-control"
                    value={formValues.cedula}
                  />
                </div>

                {/* Monto + Tasa */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Monto Aprobado (RD$) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      className="form-control"
                      value={formValues.monto_aprobado}
                      onChange={(e) => setFormValues({ ...formValues, monto_aprobado: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      Tasa de InterÃ©s Total (%)
                      {currentUser?.rol !== 'admin' && <span style={{ marginLeft: '6px', fontSize: '10px', color: 'var(--warning)', fontWeight: '700' }}>ðŸ”’ Solo Admin</span>}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        className="form-control"
                        value={formValues.tasa_interes}
                        onChange={(e) => currentUser?.rol === 'admin' && setFormValues({ ...formValues, tasa_interes: e.target.value })}
                        readOnly={currentUser?.rol !== 'admin'}
                        style={{ paddingRight: '36px', cursor: currentUser?.rol !== 'admin' ? 'not-allowed' : 'text', backgroundColor: currentUser?.rol !== 'admin' ? 'var(--primary-bg)' : '' }}
                      />
                      <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>%</span>
                    </div>
                  </div>
                </div>

                {/* Frecuencia + Cuotas */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Frecuencia de Pago</label>
                    <select
                      className="form-control"
                      value={formValues.frecuencia}
                      onChange={(e) => setFormValues({ ...formValues, frecuencia: e.target.value })}
                    >
                      <option value="diario">Diario</option>
                      <option value="semanal">Semanal</option>
                      <option value="quincenal">Quincenal</option>
                      <option value="mensual">Mensual</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Cantidad de Cuotas <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="form-control"
                      value={formValues.total_cuotas}
                      onChange={(e) => setFormValues({ ...formValues, total_cuotas: e.target.value })}
                    />
                  </div>
                </div>

                {/* Fecha de inicio */}
                <div className="form-group">
                  <label>Fecha de Inicio Original <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="date"
                    required
                    className="form-control"
                    value={formValues.fecha_inicio}
                    onChange={(e) => setFormValues({ ...formValues, fecha_inicio: e.target.value })}
                  />
                </div>

                {/* MÃ©todo de desembolso */}
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>MÃ©todo de Desembolso</label>
                    <select
                      className="form-control"
                      value={formValues.metodo_desembolso}
                      onChange={(e) => setFormValues({ ...formValues, metodo_desembolso: e.target.value })}
                    >
                      <option value="efectivo">ðŸ’µ Efectivo</option>
                      <option value="banco">ðŸ¦ Transferencia Bancaria</option>
                    </select>
                  </div>
                </div>

                {formValues.metodo_desembolso === 'banco' && (
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Banco <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        value={formValues.banco_nombre || ''}
                        onChange={(e) => setFormValues({ ...formValues, banco_nombre: e.target.value })}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>NÃºmero de Cuenta <span style={{ color: 'var(--danger)' }}>*</span></label>
                      <input
                        type="text"
                        required
                        className="form-control"
                        value={formValues.numero_cuenta || ''}
                        onChange={(e) => setFormValues({ ...formValues, numero_cuenta: e.target.value })}
                      />
                    </div>
                  </div>
                )}

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditingLoan(null); }} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving || calculo.totalAPagar <= 0}>
                  {saving ? 'Guardando...' : 'ðŸ’¾ Actualizar PrÃ©stamo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal ConfirmaciÃ³n de Fecha Futura */}
      {showFutureDateWarning && (
        <div className="modal-backdrop" style={{ zIndex: 1050 }}>
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>âš ï¸ Fecha Futura</h2>
              <button className="close-btn" onClick={() => setShowFutureDateWarning(false)}>Ã—</button>
            </div>
            <div className="modal-body">
              <p>EstÃ¡s intentando registrar o editar un prÃ©stamo con una <strong>fecha de inicio en el futuro</strong> ({formValues.fecha_inicio}).</p>
              <p>Â¿EstÃ¡s seguro de que deseas continuar?</p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowFutureDateWarning(false)}
              >
                Cancelar
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={async () => {
                  setShowFutureDateWarning(false);
                  if (pendingAction === 'create') {
                    await executeCreateSubmit();
                  } else if (pendingAction === 'edit') {
                    await executeEditSubmit();
                  }
                  setPendingAction(null);
                }}
              >
                SÃ­, continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PrestamosPageWrapper() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <PrestamosContent />
    </Suspense>
  );
}
