import React from 'react'

import { Button } from './primitives/Button'
import { ErrorScreen } from './screens/ErrorScreen'

interface ErrorBoundaryProps {
  children: React.ReactNode
  /**
   * Changing this value clears a caught error. Pass the current pathname so
   * navigating away from a broken screen recovers without a reload.
   */
  resetKey?: string
}

interface ErrorBoundaryState {
  error: Error | null
  resetKey?: string
}

/**
 * Catches render errors below it and shows the 500 page instead of the blank
 * screen React leaves behind when a component throws.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error }
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey }
    return null
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    /** Kept so the stack is still reachable in the browser console. */
    // eslint-disable-next-line no-console
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <ErrorScreen
        code="500"
        icon="alert"
        title="Something went wrong"
        message="This screen hit an unexpected error and could not finish loading. Reloading usually clears it."
        detail={import.meta.env.DEV ? this.state.error.message : undefined}
        actions={
          <>
            <Button variant="primary" leftIcon="refresh" onClick={() => window.location.reload()}>
              Reload page
            </Button>
            <Button variant="ghost" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          </>
        }
      />
    )
  }
}
