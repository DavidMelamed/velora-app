'use client'

import { cn } from '@/lib/utils'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
} from 'recharts'

export interface TrendDataPoint {
  label: string
  count: number
  fatal?: number
  injury?: number
  pdo?: number
}

interface TrendChartProps {
  data: TrendDataPoint[]
  title?: string
  variant?: 'bar' | 'line'
  className?: string
}

export function TrendChart({
  data,
  title = 'Crash Trend Over Time',
  variant = 'bar',
  className,
}: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className={cn('rounded-lg border border-gray-200 bg-white p-8 text-center', className)}>
        <p className="text-sm text-gray-500">No trend data available.</p>
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-gray-200 bg-white p-5', className)}>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>

      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {variant === 'bar' ? (
            <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Crashes" />
              {data.some((d) => d.fatal !== undefined) && (
                <Bar dataKey="fatal" fill="#475569" radius={[4, 4, 0, 0]} name="Fatal" />
              )}
              {data.some((d) => d.injury !== undefined) && (
                <Bar dataKey="injury" fill="#ef4444" radius={[4, 4, 0, 0]} name="Injury" />
              )}
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 3 }}
                name="Crashes"
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
