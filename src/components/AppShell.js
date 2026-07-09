'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/context/AuthContext';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Usuario, permisos y logout centralizados en AuthContext (antes se consultaba aquí).
  const { user, authLoading, hasPermission, logout } = useAuth();

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Recordar la preferencia de sidebar colapsado (escritorio)
  useEffect(() => {
    if (localStorage.getItem('sidebarCollapsed') === '1') setSidebarCollapsed(true);
  }, []);

  const toggleSidebarCollapsed = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebarCollapsed', next ? '1' : '0');
      } catch {}
      return next;
    });
  };

  // Debounce logic for search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/buscar?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.data || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error("Global search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Close search dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleResultClick = (cedula) => {
    setSearchQuery('');
    setShowDropdown(false);
    router.push(`/clientes?cedula=${cedula}`);
  };

  if (pathname === '/login') {
    return <>{children}</>;
  }

  const getBreadcrumbs = () => {
    if (pathname === '/dashboard') return [{ label: 'Dashboard', active: true }];
    if (pathname === '/clientes') return [{ label: 'CRM', active: false }, { label: 'Clientes', active: true }];
    if (pathname === '/prestamos') return [{ label: 'CRM', active: false }, { label: 'Préstamos', active: true }];
    if (pathname === '/configuracion') return [{ label: 'Configuración', active: false }, { label: 'General', active: true }];
    if (pathname === '/usuarios') return [{ label: 'Configuración', active: false }, { label: 'Usuarios', active: true }];
    return [{ label: 'Inicio', active: true }];
  };

  const breadcrumbs = getBreadcrumbs();

  const getRequiredPermission = (path) => {
    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/clientes')) return 'clientes';
    if (path.startsWith('/cobros')) return 'cobros';
    if (path.startsWith('/recordatorios')) return 'recordatorios';
    if (path.startsWith('/prestamos')) return 'prestamos';
    if (path.startsWith('/reportes')) return 'reportes';
    if (path.startsWith('/usuarios')) return 'usuarios';
    if (path.startsWith('/auditoria')) return 'auditoria';
    if (path.startsWith('/configuracion')) return 'configuracion';
    return null;
  };

  const requiredPerm = getRequiredPermission(pathname);
  const isAuthorized = !requiredPerm || hasPermission(requiredPerm);

  return (
    <div className={`app-container${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        {/* Mobile close button inside sidebar */}
        <button
          className="sidebar-close-btn"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menú"
        >
          ✕
        </button>

        <div className="sidebar-logo-container">
          <img 
            src="/api/configuracion/logo?v=6" 
            alt="Préstamos BM" 
            className="sidebar-logo" 
            onError={(e) => { e.target.src = '/logo.png?v=6'; }}
          />
        </div>

        <nav className="sidebar-menu">
          {hasPermission('dashboard') && (
            <Link href="/dashboard" className={`sidebar-item-link ${pathname === '/dashboard' ? 'active' : ''}`}>
              <span>📊</span> Dashboard
            </Link>
          )}
          {hasPermission('clientes') && (
            <Link href="/clientes" className={`sidebar-item-link ${pathname === '/clientes' ? 'active' : ''}`}>
              <span>👥</span> Clientes
            </Link>
          )}
          {hasPermission('cobros') && (
            <Link href="/cobros" className={`sidebar-item-link ${pathname === '/cobros' ? 'active' : ''}`}>
              <span>💳</span> Cobros
            </Link>
          )}
          {hasPermission('recordatorios') && (
            <Link href="/recordatorios" className={`sidebar-item-link ${pathname === '/recordatorios' ? 'active' : ''}`}>
              <span>🔔</span> Recordatorios
            </Link>
          )}
          {hasPermission('prestamos') && (
            <Link href="/prestamos" className={`sidebar-item-link ${pathname === '/prestamos' ? 'active' : ''}`}>
              <span>💼</span> Préstamos
            </Link>
          )}
          {hasPermission('reportes') && (
            <Link href="/reportes" className={`sidebar-item-link ${pathname === '/reportes' ? 'active' : ''}`}>
              <span>📈</span> Reportes
            </Link>
          )}
          {hasPermission('usuarios') && (
            <Link href="/usuarios" className={`sidebar-item-link ${pathname === '/usuarios' ? 'active' : ''}`}>
              <span>🛡️</span> Usuarios
            </Link>
          )}
          {hasPermission('auditoria') && (
            <Link href="/auditoria" className={`sidebar-item-link ${pathname === '/auditoria' ? 'active' : ''}`}>
              <span>📋</span> Auditoría
            </Link>
          )}
          {hasPermission('configuracion') && (
            <Link href="/configuracion" className={`sidebar-item-link ${pathname === '/configuracion' ? 'active' : ''}`}>
              <span>⚙️</span> Configuración
            </Link>
          )}
        </nav>

        <div style={{ padding: '20px', marginTop: 'auto' }}>
          {user && (
            <div style={{ marginBottom: '15px', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '13px' }}>
              <div style={{ color: '#fff', fontWeight: '600' }}>{user.nombre}</div>
              <div style={{ color: 'var(--text-light)', marginTop: '2px', fontSize: '11px', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.05em' }}>
                {user.rol === 'admin' ? 'Administrador' : 'Colaborador'}
              </div>
            </div>
          )}
          <button
            onClick={logout}
            style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <span>🚪</span> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="main-wrapper">
        {/* Header */}
        <header className="header">
          {/* Hamburger button (visible on mobile) */}
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>

          {/* Colapsar/expandir sidebar (visible en escritorio) */}
          <button
            className="sidebar-toggle-btn"
            onClick={toggleSidebarCollapsed}
            aria-label={sidebarCollapsed ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}
            aria-pressed={sidebarCollapsed}
            title={sidebarCollapsed ? 'Mostrar menú' : 'Ocultar menú'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
              {sidebarCollapsed
                ? <path d="m14 9 3 3-3 3" />
                : <path d="m16 15-3-3 3-3" />}
            </svg>
          </button>

          {/* Breadcrumb */}
          <div className="breadcrumb">
            {breadcrumbs.map((b, index) => (
              <React.Fragment key={index}>
                {index > 0 && <span className="breadcrumb-separator">/</span>}
                <span className={b.active ? 'breadcrumb-active' : ''}>{b.label}</span>
              </React.Fragment>
            ))}
          </div>

          {/* Global Search */}
          <div className="header-search-container" ref={dropdownRef}>
            <span className="header-search-icon">🔍</span>
            <input
              type="text"
              className="header-search-input"
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim() && setShowDropdown(true)}
            />
            {isSearching && (
              <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}>
                <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(30, 58, 95, 0.1)', borderTopColor: 'var(--primary)' }}></div>
              </div>
            )}

            {showDropdown && (
              <div className="search-results-dropdown">
                {searchResults.length > 0 ? (
                  <ul className="search-results-list">
                    {searchResults.map((client) => (
                      <li
                        key={client.cedula}
                        className="search-result-item"
                        onClick={() => handleResultClick(client.cedula)}
                      >
                        <div>
                          <div className="search-result-name">{client.nombre_cliente}</div>
                          <div className="search-result-meta">Cédula: {client.cedula}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <span className={`badge badge-${client.estado}`}>{client.estado}</span>
                          <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)' }}>
                            RD$ {client.balance_pendiente.toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="search-result-no-results">No se encontraron clientes</div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="content-area">
          {authLoading ? (
            <div style={{ padding: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div className="spinner" style={{ width: '32px', height: '32px', border: '3px solid rgba(30, 58, 95, 0.1)', borderTopColor: 'var(--primary)' }}></div>
            </div>
          ) : isAuthorized ? (
            children
          ) : (
            <div className="card" style={{ padding: '48px', textAlign: 'center', maxWidth: '500px', margin: '40px auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '48px' }}>🚫</div>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--danger)' }}>Acceso Denegado</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5' }}>
                No tienes privilegios asignados para acceder al módulo de <b>{requiredPerm === 'prestamos' ? 'Préstamos' : requiredPerm === 'auditoria' ? 'Auditoría' : requiredPerm === 'configuracion' ? 'Configuración' : requiredPerm === 'usuarios' ? 'Usuarios' : requiredPerm === 'reportes' ? 'Reportes' : requiredPerm}</b>. Por favor, solicita acceso a un administrador.
              </p>
              {(() => {
                const allRoutes = [
                  { perm: 'dashboard', path: '/dashboard' },
                  { perm: 'clientes', path: '/clientes' },
                  { perm: 'cobros', path: '/cobros' },
                  { perm: 'recordatorios', path: '/recordatorios' },
                  { perm: 'prestamos', path: '/prestamos' },
                  { perm: 'reportes', path: '/reportes' },
                ];
                const firstAvailable = allRoutes.find(r => hasPermission(r.perm));
                return firstAvailable ? (
                  <button className="btn btn-primary" onClick={() => router.push(firstAvailable.path)}>
                    Ir a {firstAvailable.perm.charAt(0).toUpperCase() + firstAvailable.perm.slice(1)}
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={logout}>
                    Cerrar Sesión
                  </button>
                );
              })()}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
