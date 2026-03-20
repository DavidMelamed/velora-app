import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { prisma } from '@velora/db'
import { registerTool } from './register'

export function registerTrendTools(server: McpServer) {
  registerTool(server,
    'get_crash_trends',
    'Get crash trend data over time for a state or county — total crashes, fatalities, injuries by period',
    {
      stateCode: z.string().length(2).describe('2-letter state code'),
      county: z.string().optional().describe('Optional county filter'),
      metric: z.enum(['total_crashes', 'fatalities', 'injuries', 'severity_distribution']).default('total_crashes').describe('Metric to analyze'),
      period: z.enum(['weekly', 'monthly', 'yearly']).default('monthly').describe('Aggregation period'),
      months: z.number().int().min(1).max(60).default(12).describe('Look-back period in months'),
    },
    async (params) => {
      const since = new Date()
      since.setMonth(since.getMonth() - (params.months ?? 12))

      const where: Record<string, unknown> = {
        stateCode: params.stateCode.toUpperCase(),
        crashDate: { gte: since },
      }
      if (params.county) where.county = { contains: params.county, mode: 'insensitive' }

      const crashes = await prisma.crash.findMany({
        where: where as any,
        select: { crashDate: true, crashSeverity: true },
        orderBy: { crashDate: 'asc' },
      })

      const period = params.period ?? 'monthly'
      const buckets: Record<string, { total: number; fatalities: number; injuries: number; severity: Record<string, number> }> = {}

      for (const crash of crashes) {
        let key: string
        const d = crash.crashDate
        if (period === 'weekly') {
          const weekStart = new Date(d)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          key = weekStart.toISOString().split('T')[0]
        } else if (period === 'monthly') {
          key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        } else {
          key = String(d.getFullYear())
        }

        if (!buckets[key]) buckets[key] = { total: 0, fatalities: 0, injuries: 0, severity: {} }
        buckets[key].total++
        const sev = crash.crashSeverity || 'UNKNOWN'
        buckets[key].severity[sev] = (buckets[key].severity[sev] || 0) + 1
        if (sev === 'FATAL') buckets[key].fatalities++
        if (['SUSPECTED_SERIOUS_INJURY', 'SUSPECTED_MINOR_INJURY', 'POSSIBLE_INJURY'].includes(sev)) {
          buckets[key].injuries++
        }
      }

      const dataPoints = Object.entries(buckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([p, data]) => ({ period: p, ...data }))

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            stateCode: params.stateCode, county: params.county ?? null,
            metric: params.metric ?? 'total_crashes', period, monthsAnalyzed: params.months ?? 12,
            totalCrashes: crashes.length, dataPoints,
          }),
        }],
      }
    }
  )

  registerTool(server,
    'get_seasonal_patterns',
    'Analyze seasonal crash patterns — which months, days of week, and times have most crashes',
    {
      stateCode: z.string().length(2).describe('2-letter state code'),
      county: z.string().optional().describe('Optional county filter'),
      years: z.number().int().min(1).max(5).default(2).describe('Years of data to analyze'),
    },
    async (params) => {
      const since = new Date()
      since.setFullYear(since.getFullYear() - (params.years ?? 2))

      const where: Record<string, unknown> = {
        stateCode: params.stateCode.toUpperCase(),
        crashDate: { gte: since },
      }
      if (params.county) where.county = { contains: params.county, mode: 'insensitive' }

      const crashes = await prisma.crash.findMany({
        where: where as any,
        select: { crashDate: true, crashTime: true, crashSeverity: true },
      })

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const byMonth: number[] = new Array(12).fill(0)
      const byDay: number[] = new Array(7).fill(0)
      const byHour: number[] = new Array(24).fill(0)

      for (const crash of crashes) {
        byMonth[crash.crashDate.getMonth()]++
        byDay[crash.crashDate.getDay()]++
        if (crash.crashTime) {
          const hour = parseInt(crash.crashTime.split(':')[0], 10)
          if (!isNaN(hour) && hour >= 0 && hour < 24) byHour[hour]++
        }
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            stateCode: params.stateCode, county: params.county ?? null,
            yearsAnalyzed: params.years ?? 2, totalCrashes: crashes.length,
            monthlyPattern: monthNames.map((name, i) => ({ month: name, crashes: byMonth[i] })),
            dayOfWeekPattern: dayNames.map((name, i) => ({ day: name, crashes: byDay[i] })),
            hourlyPattern: byHour.map((count, hour) => ({ hour: `${String(hour).padStart(2, '0')}:00`, crashes: count })),
            peakMonth: monthNames[byMonth.indexOf(Math.max(...byMonth))],
            peakDay: dayNames[byDay.indexOf(Math.max(...byDay))],
            peakHour: `${String(byHour.indexOf(Math.max(...byHour))).padStart(2, '0')}:00`,
          }),
        }],
      }
    }
  )
}
