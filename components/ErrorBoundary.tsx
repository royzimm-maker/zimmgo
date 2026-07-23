"use client";

import { Component, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center gap-4 py-16 text-center px-6">
          <span className="text-3xl">⚠️</span>
          <div>
            <p className="font-semibold text-slate-800">Something went wrong</p>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              {this.state.error.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
