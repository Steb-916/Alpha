"use client";
import { Component, type ReactNode } from "react";
import { NeuButton } from "./NeuButton";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex items-center justify-center min-h-[200px] p-8">
          <div className="text-center max-w-md">
            <div className="w-12 h-12 rounded-xl bg-negative/10 border border-negative/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-xl">⚠</span>
            </div>
            <h3 className="text-lg font-display font-bold text-text-primary mb-2">Something went wrong</h3>
            <p className="text-sm text-text-muted mb-4 font-mono">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <NeuButton
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </NeuButton>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
