'use client'

import React, { useEffect, useState } from 'react'

interface CopilotProviderProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class CopilotErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.warn('[CopilotKit] Error caught:', error.message)
  }

  render() {
    if (this.state.hasError) {
      return <>{this.props.fallback}</>
    }
    return this.props.children
  }
}

/**
 * CopilotProvider that gracefully degrades when CopilotKit runtime is unavailable.
 * Checks /api/copilot health before initializing. Falls back to rendering children without CopilotKit.
 */
export function CopilotProvider({ children }: CopilotProviderProps) {
  const [copilotAvailable, setCopilotAvailable] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Quick health check on the copilot runtime
    const controller = new AbortController()
    fetch('/api/copilot', {
      method: 'HEAD',
      signal: controller.signal,
    })
      .then((res) => {
        setCopilotAvailable(res.ok || res.status === 405) // 405 = method not allowed but endpoint exists
        setChecked(true)
      })
      .catch(() => {
        setCopilotAvailable(false)
        setChecked(true)
      })

    return () => controller.abort()
  }, [])

  // While checking, render children without CopilotKit
  if (!checked || !copilotAvailable) {
    return <>{children}</>
  }

  // Dynamically import CopilotKit only when available
  return (
    <CopilotErrorBoundary fallback={<>{children}</>}>
      <CopilotKitWrapper>{children}</CopilotKitWrapper>
    </CopilotErrorBoundary>
  )
}

function CopilotKitWrapper({ children }: { children: React.ReactNode }) {
  // Lazy load to avoid import errors when package has issues
  const [CopilotKitComponent, setCopilotKitComponent] = useState<React.ComponentType<{ runtimeUrl: string; children: React.ReactNode }> | null>(null)

  useEffect(() => {
    import('@copilotkit/react-core')
      .then((mod) => setCopilotKitComponent(() => mod.CopilotKit))
      .catch(() => setCopilotKitComponent(null))
  }, [])

  if (!CopilotKitComponent) {
    return <>{children}</>
  }

  return (
    <CopilotKitComponent runtimeUrl="/api/copilot">
      {children}
    </CopilotKitComponent>
  )
}
