import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<any, any> {
  constructor(props: Props) {
    super(props);
    // @ts-ignore
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    // @ts-ignore
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black text-white p-10 text-center">
          <div className="space-y-6">
            <h1 className="text-4xl font-black">عذراً، حدث خطأ ما</h1>
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-brand-500 rounded-full font-bold"
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      );
    }

    // @ts-ignore
    return this.props.children;
  }
}

