import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
import { handleExportPDF } from '../../utils/printHelper';
import {
  Printer,
  X,
  FileText,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';

export default function PrintSettingsModal() {
  const {
    isPrintModalOpen,
    closePrintModal,
    displayedDoctors,
    rawDoctors,
    filters,
  } = useDoctorStore();

  const [printMode, setPrintMode] = useState('all'); // 'all' | 'range'
  const [rangeInput, setRangeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);

  const totalPages = Math.ceil((displayedDoctors?.length || 0) / 21);
  const filteredDoctorsCount = (displayedDoctors || []).filter(
    (d) => d.name || d.doc_code
  ).length;
  const totalRawCount = (rawDoctors || []).filter(
    (d) => d.name || d.doc_code
  ).length;

  useEffect(() => {
    if (isPrintModalOpen) {
      setPrintMode('all');
      setRangeInput(totalPages > 1 ? `1-${Math.min(totalPages, 3)}` : '1');
      setErrorMsg('');
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') closePrintModal();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isPrintModalOpen, totalPages, closePrintModal]);

  useEffect(() => {
    if (isPrintModalOpen && printMode === 'range') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [printMode, isPrintModalOpen]);

  // Parse and validate custom page range
  const parsedRange = useMemo(() => {
    if (printMode === 'all') {
      const all = [];
      for (let i = 1; i <= totalPages; i++) all.push(i);
      return { isValid: true, pages: all, error: '' };
    }

    const input = (rangeInput || '').trim();
    if (!input) {
      return { isValid: false, pages: [], error: 'يرجى إدخال نطاق الصفحات (مثال: 1-3)' };
    }

    let sel = [];
    const parts = input.split(',');
    for (const p of parts) {
      const part = p.trim();
      if (!part) continue;
      if (part.includes('-')) {
        const [sStr, eStr] = part.split('-');
        const s = parseInt(sStr, 10);
        const e = parseInt(eStr, 10);
        if (isNaN(s) || isNaN(e) || s < 1 || s > e) {
          return { isValid: false, pages: [], error: `صيغة النطاق "${part}" غير صحيحة` };
        }
        for (let i = s; i <= e; i++) sel.push(i);
      } else {
        const n = parseInt(part, 10);
        if (isNaN(n) || n < 1) {
          return { isValid: false, pages: [], error: `رقم الصفحة "${part}" غير صالح` };
        }
        sel.push(n);
      }
    }

    // Deduplicate and sort
    sel = Array.from(new Set(sel)).sort((a, b) => a - b);

    // Validate bounds
    const outOfBounds = sel.filter((p) => p > totalPages);
    if (outOfBounds.length > 0) {
      return {
        isValid: false,
        pages: sel,
        error: `الصفحة ${outOfBounds.join(', ')} أكبر من إجمالي الصفحات المتاحة (${totalPages})`,
      };
    }

    if (sel.length === 0) {
      return { isValid: false, pages: [], error: 'لم يتم تحديد أي صفحات صحيحة' };
    }

    return { isValid: true, pages: sel, error: '' };
  }, [printMode, rangeInput, totalPages]);

  if (!isPrintModalOpen) return null;

  const handleStartPrint = () => {
    if (printMode === 'range' && !parsedRange.isValid) {
      setErrorMsg(parsedRange.error || 'يرجى تصحيح نطاق الصفحات');
      return;
    }

    const targetRangeStr = printMode === 'all' ? 'الكل' : rangeInput.trim();
    closePrintModal();
    handleExportPDF(targetRangeStr, totalPages);
  };

  const handleKeyDownInput = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (parsedRange.isValid) {
        handleStartPrint();
      }
    }
  };

  // Format active filters summary text
  const activeFiltersSummary = [];
  if (filters?.governorate) activeFiltersSummary.push(`المحافظة: ${filters.governorate}`);
  if (filters?.city) activeFiltersSummary.push(`المدينة: ${filters.city}`);
  if (filters?.region) activeFiltersSummary.push(`المنطقة: ${filters.region}`);
  if (filters?.specialty) activeFiltersSummary.push(`التخصص: ${filters.specialty}`);
  if (filters?.status && filters.status !== 'all') {
    const statusLabel =
      filters.status === 'active'
        ? 'النشطين فقط'
        : filters.status === 'inactive'
        ? 'المتوقفين فقط'
        : 'المنقولين فقط';
    activeFiltersSummary.push(`الحالة: ${statusLabel}`);
  }
  if (filters?.searchTerm) activeFiltersSummary.push(`البحث: "${filters.searchTerm}"`);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in no-print"
      onClick={closePrintModal}
      dir="rtl"
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                إعدادات الطباعة وتصدير PDF
              </h3>
              <p className="text-[11px] text-emerald-100 mt-0.5">
                تحديد الصفحات والمزامنة التامة مع داتا الفلترة المعروضة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePrintModal}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Active Filter Synchronization Banner (What You See Is What You Print) */}
          <div className="p-3.5 bg-emerald-50/90 rounded-xl border border-emerald-200 text-xs space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <Filter className="w-3.5 h-3.5 text-emerald-700" />
                <span>البيانات المراد طباعتها (مزامنة فورية):</span>
              </div>
              <span className="font-extrabold text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                {totalPages} صفحة A4 (إجمالي {filteredDoctorsCount} طبيب)
              </span>
            </div>

            <div className="text-[11px] text-emerald-800 font-medium leading-relaxed">
              {activeFiltersSummary.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="text-emerald-950 font-bold">الفلاتر المطبقة:</span>
                  {activeFiltersSummary.map((item, idx) => (
                    <span
                      key={idx}
                      className="bg-white/90 border border-emerald-200 text-emerald-900 px-2 py-0.5 rounded-md font-semibold text-[10px]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-emerald-700">
                  عرض كافة الأطباء بدون فلتر (قاعدة البيانات كاملة: {totalRawCount} طبيب)
                </span>
              )}
            </div>
          </div>

          {/* Option 1: Print All Filtered Pages */}
          <label
            onClick={() => setPrintMode('all')}
            className={`block p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
              printMode === 'all'
                ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="printRangeMode"
                checked={printMode === 'all'}
                onChange={() => setPrintMode('all')}
                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              <div className="flex-1">
                <div className="font-extrabold text-sm text-slate-800 flex items-center justify-between">
                  <span>طباعة كافة الصفحات المفلترة (All Pages)</span>
                  <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                    1 - {totalPages}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  طباعة جميع الصفحات الـ {totalPages} المحتوية على داتا الفلترة الحالية (21 خانة/صفحة).
                </p>
              </div>
            </div>
          </label>

          {/* Option 2: Print Custom Range */}
          <div
            onClick={() => setPrintMode('range')}
            className={`p-3.5 rounded-xl border-2 transition-all ${
              printMode === 'range'
                ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="flex items-start gap-3">
              <input
                type="radio"
                name="printRangeMode"
                checked={printMode === 'range'}
                onChange={() => setPrintMode('range')}
                className="w-4 h-4 text-emerald-600 focus:ring-emerald-500 mt-1 cursor-pointer"
              />
              <div className="flex-1 space-y-2.5">
                <div>
                  <div className="font-extrabold text-sm text-slate-800">
                    تحديد نطاق أو أرقام صفحات معينة (Custom Page Range)
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    اختر أرقام الصفحات المطلوبة (النطاق المتاح: من 1 إلى {totalPages}).
                  </p>
                </div>

                {/* Range Input Field */}
                <div className="relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={rangeInput}
                    onChange={(e) => {
                      setRangeInput(e.target.value);
                      setErrorMsg('');
                    }}
                    onFocus={() => setPrintMode('range')}
                    onKeyDown={handleKeyDownInput}
                    placeholder={`مثال: 1-3 أو 2 أو 1, 4, ${totalPages}`}
                    className="w-full text-sm font-mono font-bold p-2.5 pr-3 pl-3 border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 text-center tracking-wider"
                  />
                </div>

                {/* Quick Presets for Convenient Range Selection */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-slate-500 font-bold select-none">
                    اختصارات سريعة:
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPrintMode('range');
                      setRangeInput('1');
                    }}
                    className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded border border-slate-200 transition-colors cursor-pointer"
                  >
                    الصفحة 1 فقط
                  </button>
                  {totalPages >= 3 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrintMode('range');
                        setRangeInput('1-3');
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded border border-slate-200 transition-colors cursor-pointer"
                    >
                      أول 3 صفحات (1-3)
                    </button>
                  )}
                  {totalPages >= 5 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrintMode('range');
                        setRangeInput('1-5');
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded border border-slate-200 transition-colors cursor-pointer"
                    >
                      أول 5 صفحات (1-5)
                    </button>
                  )}
                  {totalPages > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrintMode('range');
                        setRangeInput(String(totalPages));
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded border border-slate-200 transition-colors cursor-pointer"
                    >
                      الصفحة الأخيرة ({totalPages})
                    </button>
                  )}
                </div>

                {/* Validation Status & Live Selected Count */}
                {printMode === 'range' && (
                  <div className="pt-1">
                    {parsedRange.isValid ? (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>
                          سيتم طباعة {parsedRange.pages.length} صفحة:{' '}
                          <span className="font-mono text-emerald-900">
                            [{parsedRange.pages.join('، ')}]
                          </span>{' '}
                          (تشمل الأطباء من رقم{' '}
                          {(parsedRange.pages[0] - 1) * 21 + 1} إلى{' '}
                          {Math.min(
                            parsedRange.pages[parsedRange.pages.length - 1] * 21,
                            filteredDoctorsCount
                          )}
                          )
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs text-rose-700 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                        <span>{parsedRange.error || errorMsg}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Business Logic Assurance Note */}
          <div className="text-[10px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-normal">
            ℹ️ <b>آلية التقطيع A4:</b> يقوم محرك الطباعة تلقائياً بتقسيم الأطباء المفلترين إلى مجموعات تضم 21 طبيب لكل ورقة A4، مع ترويسة مستقلة لكل صفحة وطباعة بالأبيض والأسود بدقة 100%.
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={closePrintModal}
            className="px-4 py-2 rounded-xl text-slate-700 bg-white border border-slate-300 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleStartPrint}
            disabled={printMode === 'range' && !parsedRange.isValid}
            className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xs ${
              printMode === 'all' || parsedRange.isValid
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-200 hover:shadow-md'
                : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>
              {printMode === 'all'
                ? `بدء طباعة كافة الـ ${totalPages} صفحة`
                : `بدء طباعة الصفحات المحددة (${parsedRange.pages.length} صفحة)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
