import React, { useState, useEffect, useRef } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
import { useCombineDoctorsMutation } from '../../hooks/useDoctorQueries';
import { cleanDoctorName } from '../../services/doctorService';
import {
  GitMerge,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  ArrowDown,
  Layers,
  Loader2,
  Hash,
  Activity,
} from 'lucide-react';

export default function CombineModal() {
  const {
    isCombineModalOpen,
    activeModalIndex,
    displayedDoctors,
    rawDoctors,
    closeCombineModal,
    confirmCombine,
  } = useDoctorStore();

  const combineDoctorsMutation = useCombineDoctorsMutation();

  const [inputCode, setInputCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isCombineModalOpen) {
      setInputCode('');
      setErrorMsg('');
      setIsSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 120);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') closeCombineModal();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isCombineModalOpen, closeCombineModal]);

  if (!isCombineModalOpen || activeModalIndex === -1 || !displayedDoctors[activeModalIndex]) {
    return null;
  }

  const currentDoc = displayedDoctors[activeModalIndex];
  const targetCode = String(currentDoc.doc_code || '').trim();
  const targetName = cleanDoctorName(currentDoc.name) || currentDoc.name || 'طبيب بدون اسم';
  const targetOldStats = parseInt(currentDoc.old_stats, 10) || 0;
  const targetNewStats = parseInt(currentDoc.new_stats, 10) || 0;

  // Search for the source doctor in rawDoctors and displayedDoctors
  const trimmedInput = inputCode.trim();

  let searchResult = { status: 'idle', doctor: null };
  if (!trimmedInput) {
    searchResult = { status: 'idle', doctor: null };
  } else if (trimmedInput.toLowerCase() === targetCode.toLowerCase()) {
    searchResult = { status: 'self', doctor: null };
  } else {
    // Search through rawDoctors (full dataset) and fallback to displayedDoctors
    const found =
      rawDoctors?.find((d) => String(d.doc_code || '').trim().toLowerCase() === trimmedInput.toLowerCase()) ||
      displayedDoctors?.find((d) => String(d.doc_code || '').trim().toLowerCase() === trimmedInput.toLowerCase());

    if (found) {
      searchResult = { status: 'found', doctor: found };
    } else {
      searchResult = { status: 'not_found', doctor: null };
    }
  }

  const sourceDoc = searchResult.doctor;
  const sourceName = sourceDoc ? cleanDoctorName(sourceDoc.name) || sourceDoc.name || 'طبيب بدون اسم' : '';
  const sourceCode = sourceDoc ? String(sourceDoc.doc_code || '').trim() : '';
  const sourceOldStats = sourceDoc ? parseInt(sourceDoc.old_stats, 10) || 0 : 0;
  const sourceNewStats = sourceDoc ? parseInt(sourceDoc.new_stats, 10) || 0 : 0;

  // Expected combined stats
  const combinedOldStats = targetOldStats + sourceOldStats;
  const combinedNewStats = targetNewStats + sourceNewStats;

  const isConfirmEnabled = searchResult.status === 'found' && Boolean(sourceDoc) && !isSubmitting;

  const handleConfirm = async () => {
    if (!isConfirmEnabled || !sourceDoc) return;
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      // 1. Instant Optimistic UI Update in Zustand Store
      confirmCombine(sourceCode);

      // 2. Persistent Mutation to Supabase via TanStack Query
      await combineDoctorsMutation.mutateAsync({
        targetCode: currentDoc.doc_code,
        sourceCode: sourceCode,
      });

      closeCombineModal();
    } catch (err) {
      console.error('Combine error:', err);
      setErrorMsg(err.message || 'حدث خطأ أثناء تنفيذ عملية الدمج');
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isConfirmEnabled) {
        handleConfirm();
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in"
      onClick={closeCombineModal}
      dir="rtl"
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-700 to-indigo-800 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <GitMerge className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-base leading-tight">
                دمج طبيبين (Combine / Merge)
              </h3>
              <p className="text-[11px] text-purple-200 mt-0.5">
                تأكيد مرحلي آمن لمنع أخطاء الدمج اليدوي
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCombineModal}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          
          {/* Target Doctor Information (Top Banner) */}
          <div className="p-3.5 bg-purple-50/90 rounded-xl border border-purple-200 shadow-2xs">
            <div className="text-[11px] text-purple-700 font-bold mb-1.5 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-600" />
              <span>الدمج إلى (Merging into):</span>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-extrabold text-sm text-purple-950">
                {targetName}
              </span>
              <span className="inline-flex items-center gap-1 font-mono text-xs font-bold px-2.5 py-0.5 bg-purple-100 text-purple-800 rounded-md border border-purple-300">
                كود: {targetCode}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-purple-200/70 text-[11px] text-purple-800 flex items-center justify-between flex-wrap gap-2 font-semibold">
              <div className="flex items-center gap-3">
                <span>قديم: <b className="font-mono text-xs">{targetOldStats}</b></span>
                <span>جديد: <b className="font-mono text-xs">{targetNewStats}</b></span>
              </div>
              <span className="text-[10px] bg-purple-200/70 text-purple-900 px-2 py-0.5 rounded">
                المجموع: <b className="font-mono text-xs">{targetOldStats + targetNewStats}</b> حالة
              </span>
            </div>
          </div>

          {/* Error Message if any */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Step 1: Input & Search for Source Doctor */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              أدخل كود الطبيب المراد سحبه (Source Doctor Code):
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="اكتب كود الطبيب هنا (مثال: 10452)..."
                className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-center tracking-wider focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-200 transition-all font-mono"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Search className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Dynamic Search Feedback & Step 2 Confirmation */}
          {searchResult.status === 'self' && (
            <div className="p-3 bg-amber-50 border border-amber-300 text-amber-800 text-xs rounded-xl font-bold flex items-center gap-2 animate-fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>لا يمكنك دمج الطبيب مع نفسه! برجاء كتابة كود طبيب آخر.</span>
            </div>
          )}

          {searchResult.status === 'not_found' && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-bold flex items-center gap-2 animate-fade-in">
              <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>لم يتم العثور على طبيب بهذا الكود (Doctor with this code was not found).</span>
            </div>
          )}

          {searchResult.status === 'found' && sourceDoc && (
            <div className="p-4 bg-amber-50/90 border-2 border-amber-300 rounded-xl space-y-3 shadow-xs animate-fade-in">
              {/* Alert & Main Confirmation Question */}
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-amber-200/60 rounded-lg text-amber-700 flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="text-xs font-bold text-amber-950 leading-relaxed">
                  هل أنت متأكد من سحب بيانات{' '}
                  <span className="text-purple-900 underline font-extrabold px-1 bg-amber-100 rounded">
                    {sourceName}
                  </span>{' '}
                  (كود: <span className="font-mono">{sourceCode}</span>) ودمجها في{' '}
                  <span className="text-purple-900 underline font-extrabold px-1 bg-amber-100 rounded">
                    {targetName}
                  </span>{' '}
                  (كود: <span className="font-mono">{targetCode}</span>)؟
                </div>
              </div>

              {/* Stats Preview Card */}
              <div className="bg-white/90 rounded-xl p-3 border border-amber-200 text-xs space-y-2">
                <div className="grid grid-cols-2 gap-2 pb-2 border-b border-amber-100 text-[11px]">
                  <div>
                    <span className="text-slate-500 font-semibold block">الطبيب المسحوب:</span>
                    <span className="font-bold text-slate-800">{sourceName}</span>
                    <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                      قديم: <b>{sourceOldStats}</b> | جديد: <b>{sourceNewStats}</b>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block">الطبيب المستهدف:</span>
                    <span className="font-bold text-slate-800">{targetName}</span>
                    <div className="text-[10px] text-slate-600 font-mono mt-0.5">
                      قديم: <b>{targetOldStats}</b> | جديد: <b>{targetNewStats}</b>
                    </div>
                  </div>
                </div>

                {/* Resulting Combined Stats */}
                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold text-amber-900 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    النتيجة بعد الدمج:
                  </span>
                  <div className="font-mono font-extrabold text-xs text-purple-950 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200">
                    قديم: <span className="text-blue-700">{combinedOldStats}</span> | جديد:{' '}
                    <span className="text-emerald-700">{combinedNewStats}</span> (المجموع:{' '}
                    <span className="text-purple-700">{combinedOldStats + combinedNewStats}</span>)
                  </div>
                </div>
              </div>

              {/* Consequence Note */}
              <p className="text-[10px] text-amber-800 font-medium leading-normal">
                ⚠️ <b>تنبيه:</b> سيتم تفريغ خانة الطبيب المصدر وإبقاء الخلية فارغة في مكانها،
                وسوف يظهر كود الطبيب المدمج داخل بطاقة الطبيب المستهدف (مدمج مع: {sourceCode}).
              </p>
            </div>
          )}

        </div>

        {/* Modal Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={closeCombineModal}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-slate-700 bg-white border border-slate-300 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isConfirmEnabled}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-xs ${
              isConfirmEnabled
                ? 'bg-purple-700 hover:bg-purple-800 text-white cursor-pointer shadow-purple-200 hover:shadow-md'
                : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed opacity-60'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري الدمج والحفظ...</span>
              </>
            ) : (
              <>
                <GitMerge className="w-4 h-4" />
                <span>تأكيد الدمج</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
