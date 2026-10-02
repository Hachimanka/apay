import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from 'recharts'
import { formatPeso } from '@/lib/format'

/** Validated with the dataviz palette checker (light surface): brand blue, orange, aqua. */
export const SERIES = ['#1557e0', '#eb6834', '#1baf7a'] as const

const axis = { stroke: '#6b7a99', fontSize: 11, tickLine: false, axisLine: false } as const
const compact = (v: number) => (v >= 1_000_000 ? `₱${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `₱${Math.round(v / 1000)}k` : `₱${v}`)

function PesoTooltip({ active, payload, label }: TooltipContentProps<number, string>) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-line bg-white px-3.5 py-2.5 text-xs shadow-float">
      <p className="mb-1.5 font-semibold text-navy">{label}</p>
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink">
          <span className="size-2.5 rounded-sm" style={{ background: p.color }} />
          {p.name}
          <span className="ml-auto pl-4 font-semibold text-navy tabular-nums">{formatPeso(Number(p.value))}</span>
        </p>
      ))}
    </div>
  )
}

type Series = { key: string; name: string }

/** Vertical bars; several series stack with a 2px surface gap. */
export function PesoBarChart({
  data,
  xKey,
  series,
  height = 260,
}: {
  data: Record<string, string | number>[]
  xKey: string
  series: Series[]
  height?: number
}) {
  const stacked = series.length > 1
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke="#e6ecf7" />
        <XAxis dataKey={xKey} {...axis} dy={6} />
        <YAxis {...axis} tickFormatter={compact} width={52} />
        <Tooltip content={(p) => <PesoTooltip {...(p as TooltipContentProps<number, string>)} />} cursor={{ fill: '#eef3fd' }} />
        {stacked && (
          <Legend
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            formatter={(value) => <span style={{ color: '#2a3656' }}>{value}</span>}
          />
        )}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            stackId={stacked ? 'a' : undefined}
            fill={SERIES[i]}
            stroke="#ffffff"
            strokeWidth={stacked ? 2 : 0}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            maxBarSize={44}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

/** Horizontal single-series bars for comparing categories (e.g. departments). */
export function PesoHBarChart({
  data,
  labelKey,
  valueKey,
  name,
}: {
  data: Record<string, string | number>[]
  labelKey: string
  valueKey: string
  name: string
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid horizontal={false} stroke="#e6ecf7" />
        <XAxis type="number" {...axis} tickFormatter={compact} />
        <YAxis type="category" dataKey={labelKey} {...axis} width={120} />
        <Tooltip content={(p) => <PesoTooltip {...(p as TooltipContentProps<number, string>)} />} cursor={{ fill: '#eef3fd' }} />
        <Bar dataKey={valueKey} name={name} fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}
