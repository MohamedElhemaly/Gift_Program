import React from 'react';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function ProgressBar({
  percentage = 0,
  statusText = '',
  subText = '',
  isIndeterminate = false,
  error = null,
}) {
  const clampedPercentage = Math.min(100, Math.max(0, Math.round(percentage)));

  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-2.5 transition-all">
      {/* Top Header: Status & Percentage */}
      <div className="flex items-center justify-between text-xs font-bold text-slate-800">
        <div className="flex items-center gap-2">
          {error ? (
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          ) : clampedPercentage >= 100 ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          ) : (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
          )}
          <span className={error ? 'text-rose-700' : 'text-slate-800'}>
            {statusText || 'جاري معالجة البيانات...'}
          </span>
        </div>

        <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          {isIndeterminate ? 'جاري التحضير...' : `${clampedPercentage}%`}
        </span>
      </div>

      {/* Progress Bar Track */}
      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${
            error
              ? 'bg-rose-500'
              : clampedPercentage >= 100
              ? 'bg-emerald-500'
              : isIndeterminate
              ? 'bg-blue-600 animate-pulse w-full'
              : 'bg-gradient-to-r from-blue-500 to-indigo-600 shadow-xs'
          }`}
          style={{ width: isIndeterminate ? '100%' : `${clampedPercentage}%` }}
        />
      </div>

      {/* Optional Subtext */}
      {subText && (
        <div className="text-[11px] text-slate-500 text-left font-mono" dir="ltr">
          {subText}
        </div>
      )}
    </div>
  );
}
