import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans" dir="rtl">
          <div className="bg-white max-w-lg w-full rounded-2xl shadow-xl border border-rose-200 p-6 sm:p-8 text-center space-y-5">
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-rose-50">
              <AlertOctagon className="w-9 h-9" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-black text-slate-800">
                حدث خطأ غير متوقع في واجهة البرنامج
              </h1>
              <p className="text-xs text-slate-600 leading-relaxed">
                تم رصد المشكلة ومنع تعطل التطبيق بالكامل. يمكنك الضغط على الزر أدناه لإعادة تشغيل النظام بأمان.
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-left font-mono text-[11px] text-rose-600 overflow-x-auto max-h-32">
                {String(this.state.error.message || this.state.error)}
              </div>
            )}

            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm rounded-xl shadow-md shadow-blue-200 hover:shadow-lg transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة تحميل البرنامج</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
