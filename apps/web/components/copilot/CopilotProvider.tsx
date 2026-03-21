'use client'

import React from 'react'
import { CopilotKit } from '@copilotkit/react-core'

interface CopilotProviderProps {
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class CopilotErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.warn('[CopilotKit] Error caught by boundary:', error.message)
  }

  render() {
    if (this.state.hasError) {
      return <>{this.props.children}</>
    }
    return this.props.children
  }
}

export function CopilotProvider({ children }: CopilotProviderProps) {
  return (
    <CopilotErrorBoundary>
      <CopilotKit runtimeUrl="/api/copilot">
        {children}
      </CopilotKit>
    </CopilotErrorBoundary>
  )
}
