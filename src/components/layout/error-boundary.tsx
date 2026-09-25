/**
 * ErrorBoundary — catches render errors anywhere in the subtree and shows a
 * friendly fallback instead of a blank screen.
 *
 * React requires a class component for error boundaries — hooks cannot catch
 * render-phase errors. This is the only class component in the codebase.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <MyFeature />
 *   </ErrorBoundary>
 *
 *   // Custom fallback:
 *   <ErrorBoundary fallback={<p>Something went wrong.</p>}>
 *     <MyFeature />
 *   </ErrorBoundary>
 */

import { Component, type ReactNode } from "react"

type ErrorBoundaryProps = {
  children: ReactNode
  /**
   * Optional custom fallback UI.
   * Defaults to the built-in error card with a reload button.
   */
  fallback?: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    // Log in development; swap in a real error-reporting service (e.g. Sentry)
    // when deploying to production.
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack)
    }
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    // Use caller-supplied fallback if provided
    if (this.props.fallback) return this.props.fallback

    // Built-in fallback card
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center bg-base px-6 text-center"
      >
        {/* Decorative corner accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-8 top-8 h-14 w-14 border-l border-t border-accent/20"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-8 top-8 h-14 w-14 border-r border-t border-accent/20"
        />

        {/* Icon */}
        <div className="mb-6 text-4xl" aria-hidden="true">
          ⚠
        </div>

        {/* Heading */}
        <h1 className="mb-3 font-display text-4xl text-accent">Something went wrong</h1>

        {/* Error message (development only) */}
        {import.meta.env.DEV && this.state.error && (
          <p className="mb-8 max-w-lg font-mono text-xs text-text/40">
            {this.state.error.message}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={this.handleReset}
            className="
              border border-accent/30 px-6 py-3
              font-sans text-xs uppercase tracking-widest text-accent/70
              transition-colors duration-300
              hover:border-accent/60 hover:bg-accent/10
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent
            "
          >
            Try again
          </button>
          <button
            onClick={this.handleReload}
            className="
              border border-text/15 px-6 py-3
              font-sans text-xs uppercase tracking-widest text-text/40
              transition-colors duration-300
              hover:border-text/30 hover:text-text/60
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent
            "
          >
            Reload page
          </button>
        </div>
      </div>
    )
  }
}
