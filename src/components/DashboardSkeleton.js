// Skeleton del dashboard. Se reutiliza en:
//  - dashboard/loading.js  → efecto de carga instantáneo al seleccionar el módulo (Suspense)
//  - dashboard/page.js      → mientras se cargan los datos de la API
// Es markup puro (sin hooks) para poder renderizar en ambos contextos.

const CHARTS_GRID = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
  gap: '24px',
};

function SectionTitle() {
  return (
    <div
      className="shimmer"
      style={{ width: '180px', height: '18px', borderBottom: '1px solid var(--border-color)' }}
    />
  );
}

export default function DashboardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} aria-busy="true" aria-label="Cargando dashboard">
      {/* Encabezado */}
      <div>
        <div className="shimmer" style={{ width: '260px', height: '36px', marginBottom: '8px' }} />
        <div className="shimmer" style={{ width: '320px', height: '16px' }} />
      </div>

      {/* Cartera y Capital */}
      <SectionTitle />
      <div className="metrics-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card shimmer shimmer-card" />
        ))}
      </div>

      {/* Clientes y Préstamos */}
      <SectionTitle />
      <div className="metrics-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card shimmer shimmer-card" />
        ))}
      </div>

      {/* Análisis Visual */}
      <SectionTitle />
      <div className="card shimmer" style={{ height: '340px' }} />
      <div style={CHARTS_GRID}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card shimmer" style={{ height: '300px' }} />
        ))}
      </div>
    </div>
  );
}
