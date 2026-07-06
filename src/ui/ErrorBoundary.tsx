import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * A render fault in the WebGL scene must never leave a blank page:
 * this boundary swaps the canvas for a calm message and keeps the HUD alive.
 */
export class SceneErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('Scene render fault:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="scene-fallback">
          <p>The observatory hit turbulence.</p>
          <p className="scene-fallback-sub">Reload the page to try again.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
