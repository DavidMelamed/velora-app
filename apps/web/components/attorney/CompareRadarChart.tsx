'use client'

import type { DimensionScores } from './ReviewDimensions'

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  communication: 'Comm',
  outcome: 'Outcome',
  responsiveness: 'Response',
  empathy: 'Empathy',
  expertise: 'Expertise',
  feeTransparency: 'Fees',
  trialExperience: 'Trial',
  satisfaction: 'Satisfaction',
}

const COLORS = [
  { fill: 'rgba(59, 130, 246, 0.15)', stroke: '#3b82f6', dot: '#3b82f6' },   // blue
  { fill: 'rgba(16, 185, 129, 0.15)', stroke: '#10b981', dot: '#10b981' },    // emerald
  { fill: 'rgba(139, 92, 246, 0.15)', stroke: '#8b5cf6', dot: '#8b5cf6' },    // purple
  { fill: 'rgba(245, 158, 11, 0.15)', stroke: '#f59e0b', dot: '#f59e0b' },    // amber
]

interface CompareRadarChartProps {
  entries: {
    name: string
    scores: DimensionScores
  }[]
  size?: number
}

export function CompareRadarChart({ entries, size = 280 }: CompareRadarChartProps) {
  const dimensions = Object.keys(DIMENSION_LABELS) as (keyof DimensionScores)[]
  const n = dimensions.length
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 36

  const gridLevels = [25, 50, 75, 100]

  const axes = dimensions.map((key, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return {
      key,
      endX: cx + radius * Math.cos(angle),
      endY: cy + radius * Math.sin(angle),
      labelX: cx + (radius + 22) * Math.cos(angle),
      labelY: cy + (radius + 22) * Math.sin(angle),
    }
  })

  return (
    <div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid */}
        {gridLevels.map((level) => (
          <circle
            key={level}
            cx={cx}
            cy={cy}
            r={(level / 100) * radius}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="0.5"
            className="dark:stroke-gray-600"
          />
        ))}

        {/* Axes */}
        {axes.map((axis) => (
          <line
            key={axis.key}
            x1={cx}
            y1={cy}
            x2={axis.endX}
            y2={axis.endY}
            stroke="#e5e7eb"
            strokeWidth="0.5"
            className="dark:stroke-gray-600"
          />
        ))}

        {/* Data polygons */}
        {entries.map((entry, ei) => {
          const color = COLORS[ei % COLORS.length]
          const points = dimensions.map((dim, i) => {
            const angle = (Math.PI * 2 * i) / n - Math.PI / 2
            const r = (entry.scores[dim] / 100) * radius
            return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
          })
          const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ')

          return (
            <g key={ei}>
              <polygon points={polygonPoints} fill={color.fill} stroke={color.stroke} strokeWidth="2" />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3" fill={color.dot} />
              ))}
            </g>
          )
        })}

        {/* Labels */}
        {axes.map((axis) => (
          <text
            key={`label-${axis.key}`}
            x={axis.labelX}
            y={axis.labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="9"
            fill="#6b7280"
            className="dark:fill-gray-400"
          >
            {DIMENSION_LABELS[axis.key]}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap justify-center gap-4">
        {entries.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: COLORS[i % COLORS.length].stroke }}
            />
            <span className="text-xs text-gray-600 dark:text-gray-400">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
