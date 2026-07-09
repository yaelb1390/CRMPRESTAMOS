import { formatCurrency } from '@/lib/format';

// Paleta alineada con las variables CSS del proyecto (globals.css)
export const PALETTE = {
  primary: '#0F172A',
  info: '#3B82F6',
  secondary: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  muted: '#64748B',
  light: '#94A3B8',
  border: '#E2E8F0',
  grid: '#F1F5F9',
  text: '#0F172A',
};

const FONT = "'Plus Jakarta Sans', sans-serif";

// Formato compacto para ejes (RD$15K, RD$1.2M)
export function compactCurrency(v) {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1e6) return `RD$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `RD$${Math.round(n / 1e3)}K`;
  return `RD$${n}`;
}

// Tooltip elegante compartido (navy con esquinas redondeadas y sombra suave)
const tooltipBase = {
  backgroundColor: 'rgba(15, 23, 42, 0.95)',
  borderWidth: 0,
  padding: [10, 14],
  textStyle: { color: '#F8FAFC', fontFamily: FONT, fontSize: 13 },
  extraCssText: 'border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,0.22);backdrop-filter:blur(4px);',
};

// Toolbox con exportación PNG en alta resolución
function toolbox(name) {
  return {
    right: 6,
    top: -2,
    feature: {
      saveAsImage: {
        name,
        title: 'Descargar PNG',
        pixelRatio: 2,
        backgroundColor: '#FFFFFF',
      },
    },
    iconStyle: { borderColor: PALETTE.light },
    emphasis: { iconStyle: { borderColor: PALETTE.info } },
  };
}

const baseAnim = { animationDuration: 1200, animationEasing: 'cubicOut' };

// Gradiente vertical reutilizable (para áreas de línea)
function areaGradient(rgb) {
  return {
    type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: `rgba(${rgb}, 0.26)` },
      { offset: 1, color: `rgba(${rgb}, 0.01)` },
    ],
  };
}

/**
 * Tendencia con dos series (Cobros vs Préstamos otorgados).
 * data: [{ label, cobros, prestamos }]. type: 'line' | 'bar'.
 */
export function tendenciaOption(data = [], { type = 'line' } = {}) {
  const esBarra = type === 'bar';
  const serieBase = esBarra
    ? {
        type: 'bar',
        barMaxWidth: 18,
        barGap: '20%',
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        emphasis: { focus: 'series' },
        // Relleno progresivo de izquierda a derecha.
        animationDuration: 900,
        animationDelay: (idx) => idx * 45,
      }
    : {
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        showSymbol: false,
        lineStyle: { width: 3 },
        emphasis: { focus: 'series' },
        animationDuration: 1400,
      };

  return {
    ...baseAnim,
    color: [PALETTE.secondary, PALETTE.info],
    tooltip: {
      ...tooltipBase,
      trigger: 'axis',
      axisPointer: { type: esBarra ? 'shadow' : 'line', lineStyle: { color: PALETTE.border } },
      valueFormatter: (v) => formatCurrency(v),
    },
    legend: {
      top: 0,
      left: 0,
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 8,
      textStyle: { color: PALETTE.muted, fontFamily: FONT, fontSize: 12 },
    },
    toolbox: toolbox('tendencia-cobros-prestamos'),
    grid: { left: 8, right: 16, top: 40, bottom: 28, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: esBarra,
      data: data.map((d) => d.label),
      axisLine: { lineStyle: { color: PALETTE.border } },
      axisTick: { show: false },
      axisLabel: { color: PALETTE.muted, fontFamily: FONT, hideOverlap: true },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: PALETTE.grid } },
      axisLabel: { color: PALETTE.muted, fontFamily: FONT, formatter: compactCurrency },
    },
    dataZoom: [{ type: 'inside', throttle: 50 }],
    series: [
      {
        ...serieBase,
        name: 'Cobros',
        data: data.map((d) => d.cobros),
        ...(esBarra ? {} : { lineStyle: { width: 3, color: PALETTE.secondary }, areaStyle: { color: areaGradient('16, 185, 129') } }),
        itemStyle: { ...(serieBase.itemStyle || {}), color: PALETTE.secondary },
      },
      {
        ...serieBase,
        name: 'Préstamos otorgados',
        data: data.map((d) => d.prestamos),
        ...(esBarra ? {} : { lineStyle: { width: 3, color: PALETTE.info }, areaStyle: { color: areaGradient('59, 130, 246') } }),
        itemStyle: { ...(serieBase.itemStyle || {}), color: PALETTE.info },
      },
    ],
  };
}

/** Anillo tipo gauge para un porcentaje (0-100) con color por umbral */
export function gaugeOption(percent, { label = '', good = 85, warn = 60 } = {}) {
  const val = Math.round(percent);
  const color = val >= good ? PALETTE.secondary : val >= warn ? PALETTE.warning : PALETTE.danger;
  return {
    ...baseAnim,
    series: [
      {
        type: 'gauge',
        animationDuration: 1700,
        startAngle: 220,
        endAngle: -40,
        min: 0,
        max: 100,
        radius: '96%',
        center: ['50%', '56%'],
        progress: { show: true, width: 14, roundCap: true, itemStyle: { color } },
        axisLine: { lineStyle: { width: 14, color: [[1, PALETTE.grid]] }, roundCap: true },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: !!label, offsetCenter: [0, '32%'], color: PALETTE.muted, fontSize: 12, fontFamily: FONT },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '-4%'],
          formatter: '{value}%',
          color: PALETTE.text,
          fontSize: 30,
          fontWeight: 700,
          fontFamily: FONT,
        },
        data: [{ value: val, name: label }],
      },
    ],
  };
}

/** Donut con total al centro. data: [{ name, value, color }] */
export function donutOption(data = [], { isCurrency = false, centerLabel = 'Total' } = {}) {
  const total = data.reduce((s, d) => s + (d.value || 0), 0);
  const centerValue = isCurrency ? compactCurrency(total) : total;
  return {
    ...baseAnim,
    color: data.map((d) => d.color),
    tooltip: {
      ...tooltipBase,
      trigger: 'item',
      valueFormatter: (v) => (isCurrency ? formatCurrency(v) : v),
    },
    toolbox: toolbox('distribucion'),
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: PALETTE.muted, fontFamily: FONT, fontSize: 12 },
    },
    graphic: {
      type: 'group',
      left: 'center',
      top: '40%',
      children: [
        { type: 'text', style: { text: String(centerValue), fontFamily: FONT, fontSize: 22, fontWeight: 700, fill: PALETTE.text, textAlign: 'center' } },
        { type: 'text', top: 28, style: { text: centerLabel, fontFamily: FONT, fontSize: 12, fill: PALETTE.light, textAlign: 'center' } },
      ],
    },
    series: [
      {
        type: 'pie',
        radius: ['58%', '82%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        // Relleno escalonado: cada segmento aparece uno tras otro creciendo desde el centro.
        animationType: 'scale',
        animationDuration: 1100,
        animationDelay: (idx) => 200 + idx * 180,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 6 },
        emphasis: { scaleSize: 6, itemStyle: { shadowBlur: 12, shadowColor: 'rgba(15,23,42,0.18)' } },
        data: data.map((d) => ({ name: d.name, value: d.value })),
      },
    ],
  };
}

/** Barras horizontales. items: [{ name, value }] */
export function horizontalBarOption(items = [], { color = PALETTE.info, isCurrency = false, name = 'valor' } = {}) {
  // ECharts dibuja el eje Y de abajo hacia arriba: invertimos para mostrar el mayor arriba.
  const sorted = [...items].reverse();
  return {
    ...baseAnim,
    tooltip: {
      ...tooltipBase,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (v) => (isCurrency ? formatCurrency(v) : v),
    },
    toolbox: toolbox(name),
    grid: { left: 8, right: 24, top: 12, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: PALETTE.grid } },
      axisLabel: { color: PALETTE.muted, fontFamily: FONT, formatter: isCurrency ? compactCurrency : undefined },
    },
    yAxis: {
      type: 'category',
      data: sorted.map((d) => d.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: PALETTE.text, fontFamily: FONT, fontWeight: 600 },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 22,
        // Relleno escalonado de las barras al cargar.
        animationDuration: 1300,
        animationDelay: (idx) => 150 + idx * 130,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: {
            type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: color },
              { offset: 1, color: color + 'cc' },
            ],
          },
        },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(15,23,42,0.18)' } },
        data: sorted.map((d) => d.value),
      },
    ],
  };
}
