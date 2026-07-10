import { Component } from "react";
import { AlertIcon } from "./icons";
import { Button } from "./Button";

export class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info);
    }
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-svh items-center justify-center bg-rockstar-atmosphere px-6">
        <div className="flex max-w-sm flex-col items-center gap-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-rockstar-surface-elevated text-rockstar-tan">
            <AlertIcon width={26} height={26} />
          </span>
          <div className="space-y-1.5">
            <h1 className="text-xl font-semibold text-rockstar-text-primary">
              Something went wrong
            </h1>
            <p className="text-sm text-rockstar-text-secondary">
              Rockstar hit an unexpected error. Try returning home - if this keeps
              happening, refresh the page.
            </p>
          </div>
          <Button onClick={this.handleReload}>Back to home</Button>
        </div>
      </div>
    );
  }
}
