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
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught React Error:', error, errorInfo);
  }

  private handleReset = () => {
    localStorage.removeItem('mediconnect-auth');
    window.location.href = '/login';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-slate-800 font-sans">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 border border-rose-200 text-rose-600 rounded-2xl flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Session View Issue</h2>
              <p className="text-xs text-slate-500 mt-1">
                A temporary session state issue occurred while rendering your dashboard.
              </p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-mono text-slate-600 break-words text-left">
              {this.state.error?.message || 'Unexpected React rendering error'}
            </div>
            <button
              onClick={this.handleReset}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
            >
              Reset Session & Sign In Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
