import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardHeader } from '@/components/common';
import { cn } from '@/lib/utils';

/**
 * A categorical palette that stays legible in both themes and keeps a
 * consistent meaning across the app: teal is the primary series, indigo the
 * comparison, emerald positive, amber attention, red critical.
 */
export const CHART_COLORS = [
  '#1E90A0',
  '#5B5BD6',
  '#0E9F6E',
  '#D08700',
  '#8B5CF6',
  '#DC2626',
  '#0C5E6C',
  '#94A3B8',
];

export const SEVERITY_COLORS = {
  critical: '#DC2626',
  high: '#EA580C',
  medium: '#D08700',
  low: '#2563EB',
} as const;

const AXIS = {
  stroke: 'var(--color-text-tertiary)',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
};

function ChartTooltip({ active, payload, label, suffix }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-lg"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {label !== undefined && (
        <p className="mb-1.5 border-b pb-1 font-semibold" style={{ borderColor: 'var(--color-border)' }}>
          {label}
        </p>
      )}
      {payload.map((entry: any) => (
        <p key={entry.dataKey ?? entry.name} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: entry.color ?? entry.fill }}
            aria-hidden
          />
          <span className="text-muted">{entry.name}:</span>
          <span className="font-medium">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            {suffix ?? ''}
          </span>
        </p>
      ))}
    </div>
  );
}

// ─── KPI card ────────────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  unit,
  delta,
  hint,
  tone = 'primary',
  icon,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: { value: number; goodWhen: 'up' | 'down' };
  hint?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  icon?: ReactNode;
}) {
  const toneColor = {
    primary: 'var(--color-primary)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    danger: 'var(--color-danger)',
    info: 'var(--color-info)',
  }[tone];

  const deltaGood =
    delta && (delta.goodWhen === 'up' ? delta.value >= 0 : delta.value <= 0);

  return (
    <Card className="group">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {icon && (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-105"
            style={{
              background: `color-mix(in srgb, ${toneColor} 12%, transparent)`,
              color: toneColor,
            }}
            aria-hidden
          >
            <span className="[&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>
          </span>
        )}
      </div>

      <p className="mt-2.5 flex items-baseline gap-1.5">
        <span className="text-[1.75rem] font-semibold leading-none tracking-[-0.03em] tabular">
          {value}
        </span>
        {unit && <span className="text-[0.8125rem] font-medium text-muted">{unit}</span>}
        {delta && (
          <span
            className="ml-1 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.625rem] font-semibold tabular"
            style={{
              background: deltaGood ? 'var(--color-success-light)' : 'var(--color-danger-light)',
              color: deltaGood ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            {delta.value >= 0 ? '▲' : '▼'} {Math.abs(delta.value).toFixed(1)}%
          </span>
        )}
      </p>

      {hint && <p className="mt-2 text-xs leading-relaxed text-muted">{hint}</p>}
    </Card>
  );
}

// ─── Line / area ─────────────────────────────────────────────────────────────

export function TrendChart({
  title,
  subtitle,
  data,
  xKey,
  series,
  height = 240,
  area,
  suffix,
  action,
}: {
  title: string;
  subtitle?: string;
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; label: string; color?: string }[];
  height?: number;
  area?: boolean;
  suffix?: string;
  action?: ReactNode;
}) {
  const Chart = area ? AreaChart : LineChart;

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} action={action} />
      <ResponsiveContainer width="100%" height={height}>
        <Chart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                  stopOpacity={0.28}
                />
                <stop
                  offset="100%"
                  stopColor={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                  stopOpacity={0.02}
                />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis dataKey={xKey} {...AXIS} />
          <YAxis {...AXIS} width={44} />
          <Tooltip content={<ChartTooltip suffix={suffix} />} />
          {series.length > 1 && (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            />
          )}
          {series.map((s, i) =>
            area ? (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
                dot={false}
              />
            ) : (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )
          )}
        </Chart>
      </ResponsiveContainer>
    </Card>
  );
}

// ─── Bars ────────────────────────────────────────────────────────────────────

export function BarCard({
  title,
  subtitle,
  data,
  xKey,
  series,
  height = 240,
  stacked,
  horizontal,
  suffix,
  colorByKey,
}: {
  title: string;
  subtitle?: string;
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; label: string; color?: string }[];
  height?: number;
  stacked?: boolean;
  horizontal?: boolean;
  suffix?: string;
  colorByKey?: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={horizontal ? 'vertical' : 'horizontal'}
          margin={{ top: 4, right: 8, left: horizontal ? 8 : -18, bottom: 0 }}
          barCategoryGap={horizontal ? 8 : '22%'}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            vertical={horizontal}
            horizontal={!horizontal}
          />
          {horizontal ? (
            <>
              <XAxis type="number" {...AXIS} />
              <YAxis type="category" dataKey={xKey} {...AXIS} width={130} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...AXIS} />
              <YAxis {...AXIS} width={44} />
            </>
          )}
          <Tooltip content={<ChartTooltip suffix={suffix} />} cursor={{ fill: 'var(--color-surface-muted)' }} />
          {series.length > 1 && (
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
          )}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId={stacked ? 'a' : undefined}
              fill={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
              radius={stacked ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={horizontal ? 22 : 48}
            >
              {colorByKey &&
                data.map((row, idx) => (
                  <Cell
                    key={idx}
                    fill={colorByKey[String(row[xKey])] ?? CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

// ─── Gauge ───────────────────────────────────────────────────────────────────

export function GaugeCard({
  title,
  subtitle,
  value,
  max = 100,
  unit = '%',
  color = '#1E90A0',
  caption,
}: {
  title: string;
  subtitle?: string;
  value: number;
  max?: number;
  unit?: string;
  color?: string;
  caption?: ReactNode;
}) {
  const data = [{ name: title, value: Math.min(value, max), fill: color }];

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="relative">
        <ResponsiveContainer width="100%" height={170}>
          <RadialBarChart
            innerRadius="72%"
            outerRadius="100%"
            data={data}
            startAngle={210}
            endAngle={-30}
          >
            <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
            <RadialBar background={{ fill: 'var(--color-surface-muted)' }} dataKey="value" cornerRadius={8} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-4">
          <span className="text-3xl font-bold leading-none" style={{ color }}>
            {value.toLocaleString(undefined, { maximumFractionDigits: 1 })}
            <span className="ml-0.5 text-base font-medium">{unit}</span>
          </span>
        </div>
      </div>
      {caption && <p className="mt-1 text-center text-xs text-muted">{caption}</p>}
    </Card>
  );
}

// ─── Funnel ──────────────────────────────────────────────────────────────────

export function FunnelCard({
  title,
  subtitle,
  stages,
}: {
  title: string;
  subtitle?: string;
  stages: { stage: string; count: number }[];
}) {
  const max = Math.max(1, ...stages.map((s) => s.count));

  return (
    <Card>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="space-y-2.5">
        {stages.map((stage, i) => {
          const width = (stage.count / max) * 100;
          const previous = i > 0 ? stages[i - 1].count : stage.count;
          const dropoff = previous > 0 ? Math.round((1 - stage.count / previous) * 100) : 0;

          return (
            <div key={stage.stage}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="font-medium">{stage.stage}</span>
                <span className="text-muted">
                  {stage.count}
                  {i > 0 && dropoff > 0 && (
                    <span className="ml-2 text-faint">−{dropoff}%</span>
                  )}
                </span>
              </div>
              <div
                className="h-6 overflow-hidden rounded-lg"
                style={{ background: 'var(--color-surface-muted)' }}
              >
                <div
                  className="h-full rounded-lg transition-all duration-500"
                  style={{
                    width: `${Math.max(width, stage.count > 0 ? 4 : 0)}%`,
                    background: CHART_COLORS[i % CHART_COLORS.length],
                    opacity: 0.85,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ─── Sparkline-style mini bar row ────────────────────────────────────────────

export function MiniBars({
  data,
  valueKey,
  labelKey,
  color = '#1E90A0',
  className,
}: {
  data: Record<string, unknown>[];
  valueKey: string;
  labelKey: string;
  color?: string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className={cn('flex items-end gap-1', className)} style={{ height: 40 }}>
      {data.map((d, i) => (
        <div
          key={i}
          className="flex-1 rounded-t"
          style={{
            height: `${Math.max(((Number(d[valueKey]) || 0) / max) * 100, 3)}%`,
            background: color,
            opacity: 0.25 + (0.75 * (i + 1)) / data.length,
          }}
          title={`${d[labelKey]}: ${d[valueKey]}`}
        />
      ))}
    </div>
  );
}
