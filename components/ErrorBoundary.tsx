"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorRecovery } from "@/components/ErrorRecovery";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

// Wraps the current planning step, so a crash there leaves the header,
// progress sidebar and chat usable. Offers the same recovery as the
// full-page error screens — "Try again" alone just re-crashes when the
// saved trip itself is what the step can't render.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[step error]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <ErrorRecovery inline error={this.state.error} reset={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
