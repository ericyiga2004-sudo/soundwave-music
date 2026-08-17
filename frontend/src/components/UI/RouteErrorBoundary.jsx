import { Component } from "react";

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error("SoundWave route error:", error);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="sw-route-error" role="alert">
        <strong>This page did not finish loading.</strong>
        <p>The app is still running. Retry this page without losing your music session.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload page</button>
      </div>
    );
  }
}

export default RouteErrorBoundary;
