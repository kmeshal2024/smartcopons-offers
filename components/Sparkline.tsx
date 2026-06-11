'use client'

interface Point {
  date: string
  price: number
}

interface SparklineProps {
  data: Point[]
  width?: number
  height?: number
  stroke?: string
  /** Show a dot on the last point. */
  showLast?: boolean
}

/**
 * Tiny dependency-free price-history sparkline (last ~30 days).
 * Renders flat baseline for 0/1 points; trend-aware color when not overridden.
 */
export default function Sparkline({
  data,
  width = 90,
  height = 28,
  stroke,
  showLast = true,
}: SparklineProps) {
  const pad = 2
  const w = width
  const h = height

  if (!data || data.length === 0) {
    return (
      <svg width={w} height={h} role="img" aria-label="لا يوجد سجل أسعار">
        <line x1={pad} y1={h / 2} x2={w - pad} y2={h / 2} stroke="#e5e7eb" strokeWidth={2} strokeDasharray="3 3" />
      </svg>
    )
  }

  const prices = data.map((d) => d.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const n = data.length

  // x evenly spaced; y inverted (lower price = higher on chart looks odd,
  // so lower price = lower y? We invert so cheaper dips DOWN, like a price drop).
  const x = (i: number) => (n === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (n - 1))
  const y = (p: number) => pad + ((max - p) / range) * (h - pad * 2)

  const points = data.map((d, i) => `${x(i).toFixed(1)},${y(d.price).toFixed(1)}`)
  const linePath = `M ${points.join(' L ')}`
  const areaPath = `${linePath} L ${x(n - 1).toFixed(1)},${h - pad} L ${x(0).toFixed(1)},${h - pad} Z`

  // Trend: compare first vs last. Price up = red, down/flat = green.
  const trendUp = prices[n - 1] > prices[0]
  const color = stroke || (trendUp ? '#dc2626' : '#16a34a')
  const lastX = x(n - 1)
  const lastY = y(prices[n - 1])
  const gid = `spark-${color.replace('#', '')}-${n}`

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={`سجل السعر: من ${prices[0]} إلى ${prices[n - 1]} ريال`}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {n > 1 && <path d={areaPath} fill={`url(#${gid})`} />}
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      {showLast && <circle cx={lastX} cy={lastY} r={2.5} fill={color} />}
    </svg>
  )
}
