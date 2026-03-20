/**
 * PDF Export Service
 * Generates a case chronology PDF from timeline, entities, and facts.
 * Uses plain HTML -> PDF approach (no external dependencies).
 */

import { prisma } from '@velora/db'
import { displayName } from '@velora/shared'

export interface CaseChronologyData {
  matter: {
    clientName: string | null
    status: string
    accidentDate: Date | null
    stateCode: string | null
    statuteDeadline: Date | null
  }
  timeline: Array<{
    category: string
    title: string
    description: string | null
    occurredAt: Date
    isGap: boolean
    gapDays: number | null
  }>
  entities: Array<{
    type: string
    name: string
    confidence: number
  }>
  facts: Array<{
    subject: string
    predicate: string
    object: string
    validFrom: Date
    status: string
    confidence: number
  }>
}

/**
 * Load all case data for PDF export.
 */
export async function loadCaseChronology(matterId: string): Promise<CaseChronologyData | null> {
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: {
      clientName: true,
      status: true,
      accidentDate: true,
      stateCode: true,
      statuteDeadline: true,
    },
  })

  if (!matter) return null

  const [timeline, entities, facts] = await Promise.all([
    prisma.caseTimeline.findMany({
      where: { matterId },
      orderBy: { occurredAt: 'asc' },
      select: {
        category: true,
        title: true,
        description: true,
        occurredAt: true,
        isGap: true,
        gapDays: true,
      },
    }),
    prisma.caseEntity.findMany({
      where: { matterId },
      orderBy: { confidence: 'desc' },
      select: { type: true, name: true, confidence: true },
    }),
    prisma.caseFact.findMany({
      where: { matterId, status: { in: ['CONFIRMED', 'CANDIDATE'] } },
      orderBy: { validFrom: 'asc' },
      select: {
        subject: true,
        predicate: true,
        object: true,
        validFrom: true,
        status: true,
        confidence: true,
      },
    }),
  ])

  return { matter, timeline, entities, facts }
}

/**
 * Generate an HTML document for the case chronology.
 * This can be printed to PDF by the browser or converted server-side.
 */
export function generateChronologyHTML(data: CaseChronologyData): string {
  const { matter, timeline, entities, facts } = data

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const categoryColor: Record<string, string> = {
    medical: '#3B82F6',
    legal: '#8B5CF6',
    communication: '#10B981',
    financial: '#F59E0B',
    milestone: '#EAB308',
    evidence: '#6366F1',
  }

  const entityGroups = new Map<string, typeof entities>()
  for (const e of entities) {
    const group = entityGroups.get(e.type) || []
    group.push(e)
    entityGroups.set(e.type, group)
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Case Chronology — ${matter.clientName || 'Client'}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    h2 { font-size: 18px; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; }
    h3 { font-size: 14px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 8px; }
    .header { margin-bottom: 32px; }
    .header .meta { color: #6b7280; font-size: 14px; }
    .header .meta span { margin-right: 24px; }
    .deadline { color: #dc2626; font-weight: 600; }
    .timeline-item { display: flex; gap: 16px; padding: 12px 0; border-bottom: 1px solid #f3f4f6; }
    .timeline-dot { width: 12px; height: 12px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
    .timeline-date { font-size: 13px; color: #6b7280; min-width: 120px; }
    .timeline-title { font-size: 14px; font-weight: 500; }
    .timeline-desc { font-size: 13px; color: #6b7280; margin-top: 4px; }
    .gap-item { background: #fef2f2; border-left: 3px solid #ef4444; padding: 8px 12px; margin: 8px 0; border-radius: 4px; }
    .gap-item .timeline-title { color: #dc2626; }
    .entity-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .entity-group { }
    .entity-item { font-size: 13px; padding: 4px 0; display: flex; justify-content: space-between; }
    .confidence { font-size: 12px; color: #9ca3af; }
    .fact-table { width: 100%; font-size: 13px; border-collapse: collapse; }
    .fact-table th { text-align: left; padding: 8px; background: #f9fafb; border-bottom: 2px solid #e5e7eb; }
    .fact-table td { padding: 8px; border-bottom: 1px solid #f3f4f6; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; text-align: center; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Case Chronology</h1>
    <div class="meta">
      <span>Client: <strong>${matter.clientName || 'N/A'}</strong></span>
      <span>Status: <strong>${displayName(matter.status)}</strong></span>
      ${matter.accidentDate ? `<span>Accident: <strong>${formatDate(matter.accidentDate)}</strong></span>` : ''}
      ${matter.statuteDeadline ? `<span class="deadline">Deadline: ${formatDate(matter.statuteDeadline)}</span>` : ''}
    </div>
  </div>

  <h2>Timeline (${timeline.length} events)</h2>
  ${timeline.map((event) => {
    if (event.isGap) {
      return `<div class="gap-item">
        <div class="timeline-title">Treatment Gap: ${event.gapDays} days</div>
        <div class="timeline-desc">${event.description || ''}</div>
      </div>`
    }
    const color = categoryColor[event.category] || '#9ca3af'
    return `<div class="timeline-item">
      <div class="timeline-dot" style="background: ${color}"></div>
      <div class="timeline-date">${formatDate(event.occurredAt)}</div>
      <div>
        <div class="timeline-title">${event.title}</div>
        ${event.description ? `<div class="timeline-desc">${event.description.slice(0, 200)}</div>` : ''}
      </div>
    </div>`
  }).join('\n')}

  <h2>Extracted Entities (${entities.length})</h2>
  <div class="entity-grid">
    ${Array.from(entityGroups.entries()).map(([type, items]) => `
      <div class="entity-group">
        <h3>${displayName(type)}</h3>
        ${items.map((e) => `
          <div class="entity-item">
            <span>${e.name}</span>
            <span class="confidence">${Math.round(e.confidence * 100)}%</span>
          </div>
        `).join('')}
      </div>
    `).join('')}
  </div>

  <h2>Known Facts (${facts.length})</h2>
  <table class="fact-table">
    <thead>
      <tr><th>Subject</th><th>Relationship</th><th>Object</th><th>Since</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${facts.map((f) => `
        <tr>
          <td>${f.subject}</td>
          <td>${f.predicate.replace(/_/g, ' ')}</td>
          <td>${f.object}</td>
          <td>${formatDate(f.validFrom)}</td>
          <td>${f.status.toLowerCase()}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    Generated by Velora Case Intelligence Platform — ${new Date().toLocaleDateString('en-US')}
    <br>This document is for informational purposes only and does not constitute legal advice.
  </div>
</body>
</html>`
}
