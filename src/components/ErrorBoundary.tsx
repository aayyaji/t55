import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4" dir="rtl">
          <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
            <h2 className="text-2xl font-display font-bold text-red-500">عذراً، حدث خطأ ما</h2>
            <p className="text-[var(--text-secondary)]">
              {this.state.error?.message || 'حدث خطأ غير متوقع في التطبيق.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-full transition-colors"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

