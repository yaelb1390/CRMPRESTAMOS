import DashboardSkeleton from '@/components/DashboardSkeleton';

// Fallback de Suspense a nivel de ruta: se muestra al instante al navegar
// al Dashboard, dentro del AppShell (sidebar/navbar visibles).
export default function Loading() {
  return <DashboardSkeleton />;
}
