'use client';

import { Component } from 'react';

const DefaultFallback = ({ onRetry }) => (
  <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-3">
    <span className="text-lg shrink-0">⚠️</span>
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-black text-rose-700">यह item load नहीं हो सका</p>
      <p className="text-[11px] text-rose-500">This item could not be loaded</p>
    </div>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 min-h-[32px] px-3 rounded-xl border border-rose-200 bg-white text-[11px] font-bold text-rose-600 hover:bg-rose-100 transition-all"
      >
        Retry
      </button>
    )}
  </div>
);

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return <DefaultFallback onRetry={this.handleReset} />;
    }
    return this.props.children;
  }
}
