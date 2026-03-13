'use client'

import { useChat } from '@ai-sdk/react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, Suspense } from 'react'
import { CrashResultsMap } from './CrashResultsMap'
import { IntersectionCard } from './IntersectionCard'
import { AttorneyGrid } from './AttorneyGrid'
import { TrendChart } from './TrendChart'
import { ToolSkeleton } from './ToolSkeleton'
import { PersonaBadge, detectPersonaClient } from './PersonaBadge'

const SUGGESTIONS = [
  'Show me fatal crashes in Pennsylvania this year',
  'What are the most dangerous intersections in Philadelphia?',
  'Find top-rated personal injury attorneys in PA',
  'What are crash trends by day of week in New York?',
  'How many rear-end collisions happened in California?',
]

function ToolResult({ toolName, result }: { toolName: string; result: unknown }) {
  const data = result as Record<string, unknown>

  switch (toolName) {
    case 'searchCrashes':
      return (
        <CrashResultsMap
          results={data.results as never[]}
          total={data.total as number}
          showing={data.showing as number}
        />
      )
    case 'getIntersectionStats':
      return <IntersectionCard data={data as never} />
    case 'findAttorneys':
      return (
        <AttorneyGrid
          attorneys={data.attorneys as never[]}
          total={data.total as number}
        />
      )
    case 'getTrends':
      return <TrendChart data={data as never} />
    default:
      return (
        <pre className="my-2 overflow-auto rounded bg-gray-100 p-3 text-xs dark:bg-gray-800">
          {JSON.stringify(data, null, 2)}
        </pre>
      )
  }
}

function SearchInterfaceInner() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const hasSentInitial = useRef(false)

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: '/api/search',
    id: 'velora-search',
  })

  // Send initial query from URL param
  useEffect(() => {
    if (initialQuery && !hasSentInitial.current && messages.length === 0) {
      hasSentInitial.current = true
      append({ role: 'user', content: initialQuery })
    }
  }, [initialQuery, messages.length, append])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <h1 className="mb-2 text-3xl font-bold tracking-tight">Search Crash Data</h1>
              <p className="mb-8 text-gray-500 dark:text-gray-400">
                Ask anything about crashes, intersections, attorneys, or trends
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => append({ role: 'user', content: s })}
                    className="rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`mb-6 ${msg.role === 'user' ? 'flex justify-end' : ''}`}>
              {msg.role === 'user' ? (
                <div className="max-w-[80%] rounded-2xl bg-blue-600 px-4 py-3 text-white">
                  {msg.parts
                    .filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
                    .map((p) => p.text)
                    .join('')}
                </div>
              ) : (
                <div className="max-w-full">
                  {(() => {
                    // Show persona badge based on the previous user message
                    const msgIndex = messages.indexOf(msg)
                    const prevMsg = msgIndex > 0 ? messages[msgIndex - 1] : null
                    const userText = prevMsg?.role === 'user' && typeof prevMsg.content === 'string' ? prevMsg.content : ''
                    const persona = userText ? detectPersonaClient(userText) : 'general'
                    return persona !== 'general' ? (
                      <div className="mb-2">
                        <PersonaBadge persona={persona} />
                      </div>
                    ) : null
                  })()}
                  {msg.parts.map((part, i) => {
                    if (part.type === 'text' && part.text) {
                      return (
                        <div
                          key={`${msg.id}-text-${i}`}
                          className="prose prose-sm max-w-none dark:prose-invert"
                        >
                          {part.text.split('\n').map((line, li) => (
                            <p key={li} className={line === '' ? 'h-2' : ''}>
                              {line}
                            </p>
                          ))}
                        </div>
                      )
                    }
                    if (part.type === 'tool-invocation') {
                      const toolInvocation = part.toolInvocation
                      if (toolInvocation.state !== 'result') {
                        return (
                          <ToolSkeleton
                            key={`${msg.id}-tool-${i}`}
                            toolName={toolInvocation.toolName}
                          />
                        )
                      }
                      return (
                        <ToolResult
                          key={`${msg.id}-tool-${i}`}
                          toolName={toolInvocation.toolName}
                          result={toolInvocation.result}
                        />
                      )
                    }
                    return null
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Follow-up suggestions after response */}
          {messages.length > 0 &&
            !isLoading &&
            messages[messages.length - 1]?.role === 'assistant' && (
              <div className="mb-6 flex flex-wrap gap-2">
                {['Show more details', 'Find attorneys nearby', 'Show trends for this area'].map(
                  (s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => append({ role: 'user', content: s })}
                      className="rounded-full border border-gray-200 px-3 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      {s}
                    </button>
                  )
                )}
              </div>
            )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white px-4 py-4 dark:border-gray-700 dark:bg-gray-950">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about crashes, intersections, attorneys, or trends..."
            className="flex-1 rounded-full border border-gray-300 bg-gray-50 px-5 py-3 text-sm outline-none transition-colors focus:border-blue-500 focus:bg-white dark:border-gray-600 dark:bg-gray-800 dark:focus:border-blue-400 dark:focus:bg-gray-900"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-full bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Thinking...' : 'Search'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function SearchInterface() {
  return (
    <Suspense>
      <SearchInterfaceInner />
    </Suspense>
  )
}
