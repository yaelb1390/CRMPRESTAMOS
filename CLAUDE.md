@AGENTS.md

# CLAUDE.md

# Proyecto

Este proyecto es un CRM moderno enfocado en la gestión de clientes, conversaciones de WhatsApp, automatizaciones con n8n e inteligencia artificial.

## Tecnologías

- React
- Tailwind CSS
- shadcn/ui
- Supabase
- Vercel
- n8n
- React Hook Form
- Lucide Icons
- Framer Motion
- Recharts

---

# Objetivo

Todo el código debe ser limpio, reutilizable, escalable y fácil de mantener.

Antes de crear código nuevo:

- Analiza la estructura del proyecto.
- Reutiliza componentes existentes.
- Evita duplicar lógica.
- Sigue las mejores prácticas de React.

---

# Diseño

El diseño debe parecerse a aplicaciones SaaS modernas como:

- Linear
- Notion
- HubSpot
- Vercel
- Stripe Dashboard

Siempre usar:

- shadcn/ui
- Tailwind CSS

No utilizar:

- Bootstrap
- Material UI
- CSS Inline
- CSS duplicado

---

# Componentes

Siempre utilizar componentes oficiales de shadcn/ui antes de crear uno nuevo.

Priorizar:

- Card
- Dialog
- Drawer
- DropdownMenu
- Sheet
- Tabs
- Accordion
- Badge
- Avatar
- Input
- Select
- Table
- Data Table
- Form
- Calendar
- Command
- Popover
- Tooltip
- Toast

---

# Iconos

Utilizar únicamente Lucide Icons.

No utilizar imágenes para iconos.

---

# Colores

Diseño minimalista.

Paleta neutra.

Mucho espacio en blanco.

No utilizar colores exagerados.

Los colores principales serán definidos mediante variables CSS.

---

# Responsive

Todo debe funcionar correctamente en:

- Desktop
- Tablet
- Mobile

Nunca romper el diseño en pantallas pequeñas.

---

# Formularios

Todos los formularios deben usar:

- React Hook Form
- Validaciones
- Mensajes de error claros

---

# Tablas

Las tablas deben incluir cuando sea posible:

- Búsqueda
- Ordenamiento
- Paginación
- Filtros
- Acciones rápidas

---

# Dashboard

Las páginas principales deben incluir:

- Tarjetas de estadísticas
- Gráficos
- Actividad reciente
- Indicadores KPI
- Accesos rápidos

---

# Animaciones

Usar Framer Motion únicamente cuando aporte valor.

Las animaciones deben ser rápidas y discretas.

Evitar efectos exagerados.

---

# Código

Siempre:

- TypeScript
- Componentes pequeños
- Hooks reutilizables
- Funciones documentadas
- Imports ordenados
- Código legible

Evitar archivos enormes.

Si un componente supera las 300 líneas, evaluar dividirlo.

---

# Rendimiento

Optimizar siempre:

- Renderizados
- Consultas
- Componentes
- Estados
- Memoización cuando sea necesaria

No optimizar prematuramente.

---

# Base de datos

Supabase será la fuente principal.

Siempre:

- Tipar correctamente.
- Manejar errores.
- Validar datos.
- Evitar consultas innecesarias.

---

# IA

La IA debe generar respuestas claras y profesionales.

Evitar respuestas excesivamente largas.

Siempre priorizar:

- Precisión
- Claridad
- Rapidez

---

# WhatsApp

Los módulos relacionados con WhatsApp deben ser:

- Modulares
- Escalables
- Fáciles de mantener

---

# n8n

Las integraciones con n8n deben:

- Ser desacopladas.
- Permitir reintentos.
- Registrar errores.
- Tener logs claros.

---

# Estilo de código

Siempre que generes código:

1. Explica brevemente el enfoque.
2. Genera código limpio.
3. Sigue las mejores prácticas.
4. No elimines funcionalidades existentes.
5. Mantén compatibilidad con el proyecto.
6. Si existen varias opciones, elige la más mantenible.

---

# Cuando modifiques código existente

No reescribas archivos completos si no es necesario.

Modifica únicamente lo necesario.

Respeta la arquitectura existente.

---

# Antes de finalizar cualquier tarea

Verifica:

- Sin errores de TypeScript.
- Sin imports innecesarios.
- Sin código duplicado.
- Componentes reutilizables.
- Diseño consistente.
- Responsive.
- Accesibilidad básica.
- Buen rendimiento.

Entrega siempre código listo para producción.