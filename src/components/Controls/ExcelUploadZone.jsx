import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud,
  FileSpreadsheet,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Database,
  Layers,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import ProgressBar from './ProgressBar';
import { parseAndMergeSheets, parseStatsOnly } from '../../lib/excelParser';
import { doctorService } from '../../services/doctorService';
import { useDoctorStore } from '../../store/useDoctorStore';
import { queryClient } from '../../lib/queryClient';
import { QUERY_KEYS } from '../../hooks/useDoctorQueries';
import toast from 'react-hot-toast';

export default function ExcelUploadZone({ onClose }) {
  const { rebuildData, hardResetDoctors } = useDoctorStore();

  const [docsFile, setDocsFile] = useState(null);
  const [oldFile, setOldFile] = useState(null);
  const [newFile, setNewFile] = useState(null);

  // Hard Reset Mode & Confirmation Modal States
  const [isHardReset, setIsHardReset] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Upload & Progress States (Smooth persistent bar - NO flickering toasts)
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStatus, setProgressStatus] = useState('');
  const [progressSubText, setProgressSubText] = useState('');
  const [uploadError, setUploadError] = useState(null);

  // Mode: 'full' (Full Import / Upsert) | 'stats' (Update Stats Only)
  const [activeTab, setActiveTab] = useState('full');

  // Dropzone for Main Doctors File
  const {
    getRootProps: getDocsRootProps,
    getInputProps: getDocsInputProps,
    isDragActive: isDocsDragActive,
  } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles?.[0]) setDocsFile(acceptedFiles[0]);
    },
  });

  // Dropzone for Old Stats File
  const {
    getRootProps: getOldRootProps,
    getInputProps: getOldInputProps,
    isDragActive: isOldDragActive,
  } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles?.[0]) setOldFile(acceptedFiles[0]);
    },
  });

  // Dropzone for New Stats File
  const {
    getRootProps: getNewRootProps,
    getInputProps: getNewInputProps,
    isDragActive: isNewDragActive,
  } = useDropzone({
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles?.[0]) setNewFile(acceptedFiles[0]);
    },
  });

  // Main Upload and Upsert Handler (Supports Smart Upsert and Hard Reset)
  const handleStartUpload = async (forceHardReset = null) => {
    const runHardReset = forceHardReset !== null ? forceHardReset : isHardReset;

    if (activeTab === 'full') {
      if (!docsFile && !oldFile && !newFile) {
        toast.error('برجاء إفلات أو اختيار ملف إكسيل واحد على الأقل (.xlsx / .xls)!');
        return;
      }

      setIsProcessing(true);
      setUploadError(null);
      setProgressPercent(10);
      setProgressStatus(
        runHardReset
          ? 'جاري تشغيل المعالجة بالخلفية وتطهير البيانات وإعادة الضبط الصارم (Hard Reset)...'
          : 'جاري تشغيل المعالجة بالخلفية وتطهير البيانات من الرموز العشوائية (Web Worker)...'
      );
      setProgressSubText(
        runHardReset
          ? 'Bypassing Smart Upsert, preparing fresh overwrite, and sanitizing records...'
          : 'Sanitizing special symbols (%%%, ***) and decoding sheets...'
      );

      try {
        // 1. Web Worker parses and sanitizes all strings
        const mergedList = await parseAndMergeSheets({
          docsFile,
          oldFile,
          newFile,
          onProgress: (msg) => {
            setProgressStatus(msg);
            setProgressPercent((prev) => Math.min(35, prev + 5));
          },
        });

        if (!mergedList || mergedList.length === 0) {
          throw new Error('لم يتم استخراج أي سجلات صالحة من الملفات المحددة.');
        }

        setProgressPercent(40);
        setProgressStatus(
          runHardReset
            ? `تم تطهير ${mergedList.length} طبيب! جاري تصفير التعديلات وتطبيق الضبط الصارم فورياً...`
            : `تم تطهير واستخراج ${mergedList.length} طبيب بنجاح! جاري التحديث الفوري على الشاشة...`
        );
        setProgressSubText(`Doctors parsed: ${mergedList.length}`);

        // 2. Render instantly in Zustand store
        if (runHardReset) {
          hardResetDoctors(mergedList);
        } else {
          rebuildData(mergedList);
        }
        queryClient.setQueryData(QUERY_KEYS.DOCTORS, mergedList);

        setProgressPercent(50);
        setProgressStatus(
          runHardReset
            ? `جاري الكتابة الإجبارية في قاعدة البيانات ومسح السجلات التجريبية (Force Overwrite)...`
            : `جاري المزامنة مع قاعدة البيانات السحابية (Smart Upsert)...`
        );
        setProgressSubText(
          runHardReset
            ? 'Overwriting database, resetting flags, and purging extraneous mock doctors...'
            : 'Preserving manual edits & upserting to Supabase...'
        );

        // 3. Batch Upsert / Hard Reset in Supabase with exact 0-100% calculation
        await doctorService.upsertDoctorsBatch(
          mergedList,
          (statusMsg, current, total) => {
            if (total && total > 0) {
              const calcPercent = 50 + Math.round((current / total) * 48);
              setProgressPercent(calcPercent);
              setProgressStatus(statusMsg || `جاري حفظ السجلات (${current} من ${total})...`);
              setProgressSubText(`${current} / ${total} records processed`);
            } else {
              setProgressStatus(statusMsg);
            }
          },
          { hardReset: runHardReset }
        );

        setProgressPercent(100);
        setProgressStatus(
          runHardReset
            ? `اكتملت إعادة الضبط الصارم بنجاح! تم مسح التعديلات اليدوية السابقة ومطابقة ${mergedList.length} طبيب مع الإكسيل بدقة 100%.`
            : `اكتملت المزامنة بنجاح! تم حفظ وتحديث ${mergedList.length} طبيب في قاعدة البيانات.`
        );
        setProgressSubText(
          runHardReset ? 'Hard reset and database overwrite completed.' : 'Database sync completed successfully.'
        );

        // Invalidate queries to ensure all tabs have fresh data
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DOCTORS });

        toast.success(
          runHardReset
            ? 'تمت إعادة ضبط البيانات بالكامل ومطابقتها مع الإكسيل!'
            : 'تم الاستيراد والمزامنة بنجاح!'
        );

        // Automatically reset files after short pause
        setTimeout(() => {
          setIsProcessing(false);
          setDocsFile(null);
          setOldFile(null);
          setNewFile(null);
          setIsHardReset(false);
          if (onClose) onClose();
        }, 1500);

      } catch (err) {
        console.error('Upload error:', err);
        setUploadError(err.message);
        setProgressStatus('حدث خطأ أثناء معالجة الملفات: ' + err.message);
        setIsProcessing(false);
        toast.error('فشل الاستيراد: ' + err.message);
      }
    } else {
      // STATS ONLY MODE
      if (!oldFile && !newFile) {
        toast.error('برجاء رفع شيت القديم أو الجديد للتحديث!');
        return;
      }

      setIsProcessing(true);
      setUploadError(null);
      setProgressPercent(15);
      setProgressStatus('جاري قراءة إحصائيات الحالات عبر الـ Web Worker...');
      setProgressSubText('Reading stats sheets...');

      try {
        const statsList = await parseStatsOnly({
          oldFile,
          newFile,
          onProgress: (msg) => {
            setProgressStatus(msg);
            setProgressPercent((prev) => Math.min(40, prev + 5));
          },
        });

        if (!statsList || statsList.length === 0) {
          throw new Error('لم يتم العثور على أرقام حالات صالحة في الشيتات المحددة.');
        }

        setProgressPercent(50);
        setProgressStatus(`تم العثور على إحصائيات لـ ${statsList.length} طبيب. جاري حفظها في السحابة...`);
        setProgressSubText(`Updating statistics for ${statsList.length} doctors...`);

        // Update in Supabase
        const result = await doctorService.updateStatisticsOnlyBatch(statsList, (msg) => {
          setProgressStatus(msg);
          setProgressPercent((prev) => Math.min(95, prev + 5));
        });

        // Invalidate queries to refresh store
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DOCTORS });

        setProgressPercent(100);
        setProgressStatus(`تم تحديث إحصائيات ${result.count} طبيب بنجاح في قاعدة البيانات!`);
        setProgressSubText('Statistics updated successfully.');

        setTimeout(() => {
          setIsProcessing(false);
          setOldFile(null);
          setNewFile(null);
          if (onClose) onClose();
        }, 1500);

      } catch (err) {
        console.error('Stats update error:', err);
        setUploadError(err.message);
        setProgressStatus('خطأ في تحديث الإحصائيات: ' + err.message);
        setIsProcessing(false);
        toast.error('فشل التحديث: ' + err.message);
      }
    }
  };

  return (
    <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4 text-right">
      {/* Title Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <UploadCloud className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">
              استيراد وتحديث شيتات الإكسيل (Smart Upsert & Data Sanitization)
            </h3>
            <p className="text-xs text-slate-500">
              يدعم ملفات .xlsx و .xls ويقوم بتطهير البيانات تلقائياً من الرموز العشوائية وحماية التعديلات اليدوية
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('full')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'full'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>1. استيراد وتحديث شامل (Upsert لجميع الأطباء)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'stats'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>2. تحديث أرقام الحالات فقط (Stats Only - شيت القديم / الجديد)</span>
        </button>
      </div>

      {/* Drag-and-Drop Zones */}
      <div className={`grid gap-3 ${activeTab === 'full' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
        
        {/* 1. Doctors Sheet Zone (Only in Full Mode) */}
        {activeTab === 'full' && (
          <div
            {...getDocsRootProps()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              isDocsDragActive
                ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                : docsFile
                ? 'border-emerald-400 bg-emerald-50/50'
                : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'
            }`}
          >
            <input {...getDocsInputProps()} />
            <FileSpreadsheet
              className={`w-7 h-7 mx-auto mb-2 ${
                docsFile ? 'text-emerald-600' : 'text-blue-500'
              }`}
            />
            <div className="font-bold text-xs text-slate-800">
              {docsFile ? docsFile.name : '1. شيت الأطباء الأساسي'}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {docsFile
                ? `${(docsFile.size / 1024).toFixed(1)} KB (انقر للتغيير)`
                : 'اسحب وأفلت شيت الأطباء (.xlsx / .xls)'}
            </div>
            {docsFile && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDocsFile(null);
                }}
                className="mt-2 text-[10px] text-rose-600 font-bold bg-white px-2 py-0.5 rounded border border-rose-200 hover:bg-rose-50"
              >
                إلغاء الملف
              </button>
            )}
          </div>
        )}

        {/* 2. Old Stats Zone */}
        <div
          {...getOldRootProps()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
            isOldDragActive
              ? 'border-amber-500 bg-amber-50/80 scale-[1.01]'
              : oldFile
              ? 'border-emerald-400 bg-emerald-50/50'
              : 'border-slate-300 bg-white hover:border-amber-400 hover:bg-slate-50'
          }`}
        >
          <input {...getOldInputProps()} />
          <FileSpreadsheet
            className={`w-7 h-7 mx-auto mb-2 ${
              oldFile ? 'text-emerald-600' : 'text-amber-500'
            }`}
          />
          <div className="font-bold text-xs text-slate-800">
            {oldFile ? oldFile.name : 'شيت الحالات السابقة (قديم)'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {oldFile
              ? `${(oldFile.size / 1024).toFixed(1)} KB (انقر للتغيير)`
              : 'اسحب شيت القديم أو انقر للاختيار'}
          </div>
          {oldFile && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOldFile(null);
              }}
              className="mt-2 text-[10px] text-rose-600 font-bold bg-white px-2 py-0.5 rounded border border-rose-200 hover:bg-rose-50"
            >
              إلغاء الملف
            </button>
          )}
        </div>

        {/* 3. New Stats Zone */}
        <div
          {...getNewRootProps()}
          className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
            isNewDragActive
              ? 'border-emerald-500 bg-emerald-50/80 scale-[1.01]'
              : newFile
              ? 'border-emerald-400 bg-emerald-50/50'
              : 'border-slate-300 bg-white hover:border-emerald-400 hover:bg-slate-50'
          }`}
        >
          <input {...getNewInputProps()} />
          <FileSpreadsheet
            className={`w-7 h-7 mx-auto mb-2 ${
              newFile ? 'text-emerald-600' : 'text-emerald-500'
            }`}
          />
          <div className="font-bold text-xs text-slate-800">
            {newFile ? newFile.name : 'شيت الحالات الجديدة (جديد)'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {newFile
              ? `${(newFile.size / 1024).toFixed(1)} KB (انقر للتغيير)`
              : 'اسحب شيت الجديد أو انقر للاختيار'}
          </div>
          {newFile && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setNewFile(null);
              }}
              className="mt-2 text-[10px] text-rose-600 font-bold bg-white px-2 py-0.5 rounded border border-rose-200 hover:bg-rose-50"
            >
              إلغاء الملف
            </button>
          )}
        </div>

      </div>

      {/* Hard Reset Mode Option Card (Only in Full Import Mode) */}
      {activeTab === 'full' && (
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isHardReset
              ? 'bg-rose-50/90 border-rose-300 text-rose-950 shadow-xs ring-1 ring-rose-200'
              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
          }`}
        >
          <label className="flex items-start sm:items-center justify-between gap-3 cursor-pointer select-none">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={isHardReset}
                onChange={(e) => setIsHardReset(e.target.checked)}
                className="mt-0.5 sm:mt-0 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500 cursor-pointer"
              />
              <div>
                <div className="font-bold text-xs flex items-center gap-1.5 text-slate-900">
                  <RotateCcw className={`w-3.5 h-3.5 ${isHardReset ? 'text-rose-600' : 'text-slate-500'}`} />
                  <span>رفع وإعادة ضبط البيانات (Hard Reset / Force Sync)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {isHardReset
                    ? '⚠️ سيتم مسح أي تعديلات يدوية سابقة وإعادة البيانات تماماً كما هي في ملف الإكسيل.'
                    : 'تجاوز المزامنة الذكية ومسح أي تعديلات يدوية سابقة لإعادة التطبيق إلى حالة الإكسيل الأصلية تماماً.'}
                </p>
              </div>
            </div>

            <div className="flex-shrink-0">
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  isHardReset
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title="سيتم مسح أي تعديلات يدوية سابقة وإعادة البيانات تماماً كما هي في ملف الإكسيل"
              >
                {isHardReset ? '⚡ وضع إعادة الضبط نشط' : 'الافتراضي: حماية التعديلات'}
              </span>
            </div>
          </label>
        </div>
      )}

      {/* Progress Bar (Visible during processing) */}
      {isProcessing && (
        <ProgressBar
          percentage={progressPercent}
          statusText={progressStatus}
          subText={progressSubText}
          error={uploadError}
        />
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Database className={`w-4 h-4 flex-shrink-0 ${isHardReset ? 'text-rose-600' : 'text-blue-600'}`} />
          <span className="leading-snug">
            {isHardReset
              ? '⚠️ وضع إعادة الضبط الصارم مفعل: سيتم مسح أي تعديلات يدوية واستبدال البيانات كلياً.'
              : 'المزامنة الذكية تحمي تلقائياً أي طبيب تم نقله أو تعديله يدوياً من المسح.'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
          {/* Distinct Secondary Hard Reset Button (Only in Full Mode) */}
          {activeTab === 'full' && (
            <button
              type="button"
              onClick={() => {
                if (!docsFile && !oldFile && !newFile) {
                  toast.error('برجاء إفلات أو اختيار ملف إكسيل أولاً!');
                  return;
                }
                setShowConfirmModal(true);
              }}
              disabled={isProcessing || (!docsFile && !oldFile && !newFile)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs shadow-2xs transition-all disabled:opacity-50 cursor-pointer active:scale-95"
              title="سيتم مسح أي تعديلات يدوية سابقة وإعادة البيانات تماماً كما هي في ملف الإكسيل"
            >
              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              <span>رفع وإعادة ضبط البيانات (Hard Reset)</span>
            </button>
          )}

          {/* Standard Primary Upload Button */}
          <button
            type="button"
            onClick={() => {
              if (isHardReset) {
                if (!docsFile && !oldFile && !newFile) {
                  toast.error('برجاء إفلات أو اختيار ملف إكسيل أولاً!');
                  return;
                }
                setShowConfirmModal(true);
              } else {
                handleStartUpload(false);
              }
            }}
            disabled={isProcessing || (!docsFile && !oldFile && !newFile)}
            className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer ${
              isHardReset
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
            }`}
            title={
              isHardReset
                ? 'سيتم مسح أي تعديلات يدوية سابقة وإعادة البيانات تماماً كما هي في ملف الإكسيل'
                : 'بدء الاستيراد الذكي مع حماية التعديلات اليدوية'
            }
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isProcessing
                ? 'جاري المعالجة والمزامنة...'
                : isHardReset
                ? 'بدء الرفع وإعادة الضبط (Hard Reset)'
                : 'بدء الاستيراد الذكي (Smart Upsert)'}
            </span>
          </button>
        </div>
      </div>

      {/* Secondary Confirmation Modal for Hard Reset */}
      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 text-right shadow-2xl border border-rose-200 space-y-4"
            dir="rtl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 shadow-xs">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  تأكيد إعادة ضبط البيانات (Hard Reset)
                </h3>
                <p className="text-xs text-rose-600 font-bold mt-0.5">
                  تحذير: سيتم مسح أي تعديلات يدوية سابقة وإعادة البيانات تماماً كما هي في ملف الإكسيل
                </p>
              </div>
            </div>

            <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-2 leading-relaxed">
              <p className="font-bold text-rose-950">
                عند تأكيد هذا الإجراء سيتم تنفيذ ما يلي فوراً:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-700 text-[11px] pr-1">
                <li><b className="text-rose-900">مسح كافة التعديلات اليدوية:</b> إعادة الأسماء والتخصصات والعناوين والهواتف لحالتها الأصلية.</li>
                <li><b className="text-rose-900">إلغاء عمليات النقل والدمج:</b> استعادة أماكن الأطباء الأصلية وإلغاء حالات الإيقاف (Inactive).</li>
                <li><b className="text-rose-900">مسح البيانات التجريبية:</b> حذف أي أطباء أو خانات تمت إضافتها يدوياً ولا توجد في الشيت.</li>
                <li><b className="text-rose-900">تحديث كامل للشبكة:</b> إعادة بناء الصفحات وطباعة التقرير مطابقة 100% لملف الإكسيل المرفوع.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إلغاء وتراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirmModal(false);
                  handleStartUpload(true);
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>نعم، استمر مع إعادة الضبط (Force Sync)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
