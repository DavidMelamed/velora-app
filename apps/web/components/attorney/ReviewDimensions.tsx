'use client'

/**
 * ReviewDimensions — Radar-style visualization of 8 review dimensions.
 * Uses a simple CSS-based approach (no heavy chart library needed).
 */

export interface DimensionScores {
  communication: number
  outcome: number
  responsiveness: number
  empathy: number
  expertise: number
  feeTransparency: number
  trialExperience: number
  satisfaction: number
}

interface ReviewDimensionsProps {
  scores: DimensionScores
}

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  communication: 'Communication',
  outcome: 'Outcome',
  responsiveness: 'Responsiveness',
  empathy: 'Empathy',
  expertise: 'Expertise',
  feeTransparency: 'Fee Transparency',
  trialExperience: 'Trial Experience',
  satisfaction: 'Satisfaction',
}

const DIMENSION_COLORS: Record<keyof DimensionScores, string> = {
  communication: 'bg-blue-500',
  outcome: 'bg-green-500',
  responsiveness: 'bg-purple-500',
  empathy: 'bg-pink-500',
  expertise: 'bg-indigo-500',
  feeTransparency: 'bg-amber-500',
  trialExperience: 'bg-red-500',
  satisfaction: 'bg-teal-500',
}

export function ReviewDimensions({ scores }: ReviewDimensionsProps) {
  const dimensions = Object.entries(scores) as Array<[keyof DimensionScores, number]>
  const avgScore = dimensions.reduce((sum, [, v]) => sum + v, 0) / dimensions.length

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Review Intelligence
        </h3>
        <span className="text-sm text-gray-500">
          Avg: {avgScore.toFixed(0)}/100
        </span>
      </div>

      {/* Radar Chart (SVG) */}
      <div className="mb-6 flex justify-center">
        <RadarChart scores={scores} size={240} />
      </div>

      {/* Bar breakdown */}
      <div className="space-y-3">
        {dimensions.map(([key, value]) => (
          <div key={key}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {DIMENSION_LABELS[key]}
              </span>
              <span className="text-gray-500">{Math.round(value)}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className={`h-2 rounded-full ${DIMENSION_COLORS[key]}`}
                style={{ width: `${Math.min(value, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function RadarChart({ scores, size }: { scores: DimensionScores; size: number }) {
  const dimensions = Object.entries(scores) as Array<[keyof DimensionScores, number]>
  const n = dimensions.length
  const cx = size / 2
  const cy = size / 2
  const radius = size / 2 - 30

  // Generate points for polygon
  const points = dimensions.map(([, value], i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    const r = (value / 100) * radius
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    }
  })

  const polygonPoints = points.map((p) => `${p.x},${p.y}`).join(' ')

  // Grid circles
  const gridLevels = [25, 50, 75, 100]

  // Axis lines and labels
  const axes = dimensions.map(([key], i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    const endX = cx + radius * Math.cos(angle)
    const endY = cy + radius * Math.sin(angle)
    const labelX = cx + (radius + 18) * Math.cos(angle)
    const labelY = cy + (radius + 18) * Math.sin(angle)
    return { key, endX, endY, labelX, labelY }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid circles */}
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

      {/* Axis lines */}
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

      {/* Data polygon */}
      <polygon
        points={polygonPoints}
        fill="rgba(59, 130, 246, 0.2)"
        stroke="#3b82f6"
        strokeWidth="2"
      />

      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#3b82f6" />
      ))}

      {/* Labels */}
      {axes.map((axis) => (
        <text
          key={`label-${axis.key}`}
          x={axis.labelX}
          y={axis.labelY}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="8"
          fill="#6b7280"
          className="dark:fill-gray-400"
        >
          {DIMENSION_LABELS[axis.key].split(' ')[0]}
        </text>
      ))}
    </svg>
  )
}
