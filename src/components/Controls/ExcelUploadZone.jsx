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
} from 'lucide-react';
import ProgressBar from './ProgressBar';
import { parseAndMergeSheets, parseStatsOnly } from '../../lib/excelParser';
import { doctorService } from '../../services/doctorService';
import { useDoctorStore } from '../../store/useDoctorStore';
import { queryClient } from '../../lib/queryClient';
import { QUERY_KEYS } from '../../hooks/useDoctorQueries';
import toast from 'react-hot-toast';

export default function ExcelUploadZone({ onClose }) {
  const { rebuildData } = useDoctorStore();

  const [docsFile, setDocsFile] = useState(null);
  const [oldFile, setOldFile] = useState(null);
  const [newFile, setNewFile] = useState(null);

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

  // Main Upload and Smart Upsert Handler
  const handleStartUpload = async () => {
    if (activeTab === 'full') {
      if (!docsFile && !oldFile && !newFile) {
        toast.error('برجاء إفلات أو اختيار ملف إكسيل واحد على الأقل (.xlsx / .xls)!');
        return;
      }

      setIsProcessing(true);
      setUploadError(null);
      setProgressPercent(10);
      setProgressStatus('جاري تشغيل المعالجة بالخلفية وتطهير البيانات من الرموز العشوائية (Web Worker)...');
      setProgressSubText('Sanitizing special symbols (%%%, ***) and decoding sheets...');

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
        setProgressStatus(`تم تطهير واستخراج ${mergedList.length} طبيب بنجاح! جاري التحديث الفوري على الشاشة...`);
        setProgressSubText(`Doctors parsed: ${mergedList.length}`);

        // 2. Render instantly in Zustand store
        rebuildData(mergedList);
        queryClient.setQueryData(QUERY_KEYS.DOCTORS, mergedList);

        setProgressPercent(50);
        setProgressStatus(`جاري المزامنة مع قاعدة البيانات السحابية (Smart Upsert)...`);
        setProgressSubText(`Preserving manual edits & upserting to Supabase...`);

        // 3. Smart Batch Upsert in Supabase with exact 0-100% calculation
        await doctorService.upsertDoctorsBatch(mergedList, (statusMsg, current, total) => {
          if (total && total > 0) {
            const calcPercent = 50 + Math.round((current / total) * 48);
            setProgressPercent(calcPercent);
            setProgressStatus(statusMsg || `جاري حفظ السجلات (${current} من ${total})...`);
            setProgressSubText(`${current} / ${total} records processed`);
          } else {
            setProgressStatus(statusMsg);
          }
        });

        setProgressPercent(100);
        setProgressStatus(`اكتملت المزامنة بنجاح! تم حفظ وتحديث ${mergedList.length} طبيب في قاعدة البيانات.`);
        setProgressSubText('Database sync completed successfully.');

        // Final success notification ONLY (no flickering during batch)
        toast.success(`تم استيراد وحفظ ${mergedList.length} طبيب بنجاح في قاعدة البيانات!`);

        // Invalidate queries to ensure all tabs have fresh data
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DOCTORS });

        // Automatically reset files after short pause
        setTimeout(() => {
          setIsProcessing(false);
          setDocsFile(null);
          setOldFile(null);
          setNewFile(null);
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

        toast.success(`تم تحديث حالات ${result.count} طبيب بنجاح!`);

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
      <div className="flex items-center justify-between pt-2">
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <Database className="w-4 h-4 text-blue-600" />
          <span>المزامنة الذكية تحمي تلقائياً أي طبيب تم نقله أو تعديله يدوياً من المسح.</span>
        </div>

        <button
          type="button"
          onClick={handleStartUpload}
          disabled={isProcessing || (!docsFile && !oldFile && !newFile)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isProcessing ? 'جاري المعالجة والمزامنة...' : 'بدء الاستيراد والمزامنة السحابية'}</span>
        </button>
      </div>
    </div>
  );
}
