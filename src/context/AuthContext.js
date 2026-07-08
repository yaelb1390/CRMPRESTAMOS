'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiFetch';

const AuthContext = createContext(null);

/**
 * Provee el usuario autenticado y helpers de permisos a toda la app.
 *
 * Antes cada pantalla (AppShell, clientes, prestamos, auditoria) consultaba
 * `/api/auth/me` por su cuenta. Ahora se consulta una vez aquí y se comparte,
 * y `hasPermission` deja de estar encerrado dentro de AppShell.
 */
export function AuthProvider({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return data.user;
      }
    } catch (err) {
      console.error('Error fetching user', err);
    }
    return null;
  }, []);

  useEffect(() => {
    if (pathname === '/login') {
      setAuthLoading(false);
      return;
    }
    let active = true;
    setAuthLoading(true);
    (async () => {
      await refreshUser();
      if (active) setAuthLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [pathname, refreshUser]);

  const hasPermission = useCallback(
    (permission) => {
      if (!user) return false;
      if (user.rol === 'admin') return true;
      return Array.isArray(user.permisos) && user.permisos.includes(permission);
    },
    [user]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    } finally {
      setUser(null);
      router.push('/login');
      router.refresh();
    }
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, authLoading, hasPermission, refreshUser, logout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
