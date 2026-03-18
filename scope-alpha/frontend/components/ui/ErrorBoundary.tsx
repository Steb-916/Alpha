"use client";
import { Component, type ReactNode } from "react";
import { GlassButton } from "./GlassButton";

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
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <span className="text-xl">⚠</span>
            </div>
            <h3 className="text-lg font-display font-bold mb-2" style={{ color: "var(--text-primary)" }}>Something went wrong</h3>
            <p className="text-sm mb-4 font-mono" style={{ color: "var(--text-muted)" }}>
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <GlassButton
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </GlassButton>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
