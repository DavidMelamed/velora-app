#!/usr/bin/env tsx
/**
 * Check DataForSEO spending breakdown by endpoint
 */

const login = process.env.DATAFORSEO_LOGIN || 'david@davidmelamed.com'
const password = process.env.DATAFORSEO_PASSWORD || '00208c1be8be582f'
const auth = 'Basic ' + Buffer.from(`${login}:${password}`).toString('base64')

async function main() {
  // Get today's statistics
  const res = await fetch('https://api.dataforseo.com/v3/appendix/statistics', {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ date_from: '2026-03-01', date_to: '2026-03-16' }]),
  })
  const data = await res.json() as Record<string, unknown>
  const stats = (data as any).tasks?.[0]?.result ?? []

  let totalCost = 0
  const rows: Array<{ endpoint: string; tasks: number; cost: number }> = []

  function walk(obj: any, path: string) {
    if (obj === null || obj === undefined || typeof obj !== 'object') return
    if (obj.total_cost !== undefined && obj.total_cost > 0) {
      rows.push({ endpoint: path, tasks: obj.total_tasks, cost: obj.total_cost })
      totalCost += obj.total_cost
      return
    }
    for (const [k, v] of Object.entries(obj)) {
      walk(v, path ? `${path}/${k}` : k)
    }
  }

  for (const entry of stats) walk(entry, '')

  // Sort by cost descending
  rows.sort((a, b) => b.cost - a.cost)

  console.log('DataForSEO Spending Breakdown (today)')
  console.log('=' .repeat(80))
  for (const r of rows) {
    const costPerTask = r.tasks > 0 ? (r.cost / r.tasks).toFixed(6) : '?'
    console.log(`  $${r.cost.toFixed(4).padStart(8)}  |  ${String(r.tasks).padStart(6)} tasks  |  $${costPerTask}/task  |  ${r.endpoint}`)
  }
  console.log('=' .repeat(80))
  console.log(`  TOTAL: $${totalCost.toFixed(2)}`)

  // Also check balance
  const balRes = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
    headers: { Authorization: auth },
  })
  const balData = await balRes.json() as any
  const balance = balData.tasks?.[0]?.result?.[0]?.money?.balance
  console.log(`  Balance: $${balance?.toFixed(2) ?? '?'}`)
}

main().catch(console.error)
