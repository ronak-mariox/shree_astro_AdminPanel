/**
 * Charts drawn as plain SVG — no charting dependency, and the brand ramp
 * (#F55102 → #FFBC01) is painted directly so they sit beside the mobile UI
 * without re-theming a third-party library.
 */

import { useId } from 'react';

const PALETTE = ['#F55102', '#FFBC01', '#1F2937', '#16A34A', '#5B3FA8', '#9CA3AF'];

const niceMax = (value) => {
  if (value <= 0) return 10;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / magnitude) * magnitude;
};

/** Smooth path through a series of points (Catmull–Rom, rendered as cubics). */
function smoothPath(points) {
  if (points.length < 2) return '';
  let path = `M ${points[0][0]} ${points[0][1]}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] || points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`;
  }
  return path;
}

/* ————————————————————————————— Area chart */

export function AreaChart({
  data,
  height = 200,
  valueFormat = (value) => value,
  color = '#F55102',
  fillFrom = 'rgba(245, 81, 2, 0.22)',
}) {
  const gradientId = useId();
  const width = 640;
  const pad = { top: 12, right: 8, bottom: 24, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = niceMax(Math.max(...data.map((point) => point.value)));
  const step = data.length > 1 ? plotW / (data.length - 1) : plotW;

  const points = data.map((point, index) => [
    pad.left + index * step,
    pad.top + plotH - (point.value / max) * plotH,
  ]);
  const line = smoothPath(points);
  const area = `${line} L ${pad.left + plotW} ${pad.top + plotH} L ${pad.left} ${pad.top + plotH} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend over time"
      style={{ height }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillFrom} />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>

      <g className="chart__grid">
        {ticks.map((tick) => {
          const y = pad.top + plotH - tick * plotH;
          return (
            <g key={tick}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} />
              <text className="chart__axis" x={pad.left - 8} y={y + 3} textAnchor="end">
                {valueFormat(Math.round(max * tick))}
              </text>
            </g>
          );
        })}
      </g>

      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />

      {points.map((point, index) => (
        <g key={data[index].label}>
          <circle cx={point[0]} cy={point[1]} r="3.4" fill="#fff" stroke={color} strokeWidth="2" />
          <title>{`${data[index].label}: ${valueFormat(data[index].value)}`}</title>
        </g>
      ))}

      {data.map((point, index) => (
        <text
          key={point.label}
          className="chart__axis"
          x={pad.left + index * step}
          y={height - 6}
          textAnchor="middle"
        >
          {point.label}
        </text>
      ))}
    </svg>
  );
}

/* ————————————————————————————— Bar chart */

export function BarChart({ data, height = 200, valueFormat = (value) => value, stacked }) {
  const width = 640;
  const pad = { top: 12, right: 8, bottom: 26, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const keys = stacked || ['value'];
  const totals = data.map((point) =>
    keys.reduce((sum, key) => sum + (point[key] ?? 0), 0),
  );
  const max = niceMax(Math.max(...totals));
  const slot = plotW / data.length;
  const barWidth = Math.min(30, slot * 0.52);

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Distribution"
      style={{ height }}
    >
      <g className="chart__grid">
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = pad.top + plotH - tick * plotH;
          return (
            <g key={tick}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} />
              <text className="chart__axis" x={pad.left - 8} y={y + 3} textAnchor="end">
                {valueFormat(Math.round(max * tick))}
              </text>
            </g>
          );
        })}
      </g>

      {data.map((point, index) => {
        const x = pad.left + slot * index + (slot - barWidth) / 2;
        let cursor = pad.top + plotH;
        return (
          <g key={point.label}>
            {keys.map((key, keyIndex) => {
              const value = point[key] ?? 0;
              const barHeight = (value / max) * plotH;
              cursor -= barHeight;
              return (
                <rect
                  key={key}
                  x={x}
                  y={cursor}
                  width={barWidth}
                  height={Math.max(barHeight, value > 0 ? 2 : 0)}
                  rx={keyIndex === keys.length - 1 ? 5 : 0}
                  fill={PALETTE[keyIndex]}
                  opacity={keyIndex === 0 ? 1 : 0.9}
                >
                  <title>{`${point.label} · ${key}: ${valueFormat(value)}`}</title>
                </rect>
              );
            })}
            <text
              className="chart__axis"
              x={x + barWidth / 2}
              y={height - 8}
              textAnchor="middle"
            >
              {point.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ————————————————————————————— Donut */

export function DonutChart({ data, size = 170, thickness = 22, centreLabel, centreValue }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // Each arc starts where the previous one ended, so the offsets are worked out
  // up front rather than accumulated during the render pass.
  const arcs = data.reduce((acc, slice) => {
    const length = (slice.value / total) * circumference;
    const start = acc.length ? acc[acc.length - 1].start + acc[acc.length - 1].length : 0;
    acc.push({ ...slice, length, start });
    return acc;
  }, []);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Split">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#F3F4F6"
          strokeWidth={thickness}
        />
        {arcs.map((slice, index) => {
          const drawn = Math.max(slice.length - 3, 0);
          return (
            <circle
              key={slice.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={slice.color || PALETTE[index % PALETTE.length]}
              strokeWidth={thickness}
              strokeDasharray={`${drawn} ${circumference - drawn}`}
              strokeDashoffset={-slice.start}
              strokeLinecap="round"
            >
              <title>{`${slice.label}: ${slice.value}`}</title>
            </circle>
          );
        })}
      </g>
      {centreValue && (
        <>
          <text
            x="50%"
            y="47%"
            textAnchor="middle"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 20,
              fontWeight: 700,
              fill: '#1F2937',
            }}
          >
            {centreValue}
          </text>
          <text
            x="50%"
            y="62%"
            textAnchor="middle"
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fill: '#9CA3AF' }}
          >
            {centreLabel}
          </text>
        </>
      )}
    </svg>
  );
}

/** Compact trend line for a stat tile or a table cell. */
export function Sparkline({ data, width = 92, height = 28, color = '#F55102' }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((value, index) => [
    index * step,
    height - ((value - min) / span) * (height - 4) - 2,
  ]);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={smoothPath(points)} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function ChartLegend({ items }) {
  return (
    <div className="chart-legend">
      {items.map((item, index) => (
        <span className="chart-legend__key" key={item.label}>
          <span
            className="chart-legend__swatch"
            style={{ background: item.color || PALETTE[index % PALETTE.length] }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export { PALETTE };
