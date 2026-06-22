import { Component, type ReactNode } from "react"

interface Props {
  children: ReactNode
  /** Rendered when a child throws. Receives a reset() to retry. */
  fallback: (error: Error, reset: () => void) => ReactNode
}

interface State {
  error: Error | null
}

/** Catches render errors in a subtree so one bad page can't blank the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error("Render error:", error)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return this.props.fallback(this.state.error, this.reset)
    }
    return this.props.children
  }
}
