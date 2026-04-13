import React, { useState, useEffect, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export const ErrorBoundary: React.FC<Props> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('حدث خطأ غير متوقع.');

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      setHasError(true);
      try {
        const parsed = JSON.parse(event.error?.message || '');
        if (parsed.error && parsed.error.includes('permissions')) {
          setErrorMessage('ليس لديك صلاحية للقيام بهذا الإجراء.');
        }
      } catch (e) {
        // Not a JSON error
      }
    };

    window.addEventListener('error', errorHandler);
    return () => window.removeEventListener('error', errorHandler);
  }, []);

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-primary)] p-4" dir="rtl">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-4">
          <h2 className="text-2xl font-display font-bold text-red-500">عذراً، حدث خطأ ما</h2>
          <p className="text-[var(--text-secondary)]">{errorMessage}</p>
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

  return <>{children}</>;
};

