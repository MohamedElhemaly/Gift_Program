import React, { useState } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
import BlankPageModal from '../Modals/BlankPageModal';
import ExcelUploadZone from './ExcelUploadZone';
import AdvancedFilterBar from './AdvancedFilterBar';
import {
  FileSpreadsheet,
  RefreshCw,
  PlusCircle,
  Printer,
  UserPlus,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function ControlPanel({ onPrint }) {
  const {
    rawDoctors,
    displayedDoctors,
    openAddDoctorModal,
    autoSaveState,
    lastSavedTime,
    filters,
    showEmptySlotsOnScreen,
    toggleShowEmptySlots,
    distributionMode,
    setDistributionMode,
    openPrintModal,
    statusMessage,
  } = useDoctorStore();

  const [isBlankPageModalOpen, setIsBlankPageModalOpen] = useState(false);
  const [isExcelOpen, setIsExcelOpen] = useState(false);

  const hasActiveFilters = Object.entries(filters || {}).some(
    ([k, v]) => v && v !== 'all'
  );

  const totalRawCount = (rawDoctors || []).filter((d) => d.name || d.doc_code).length;
  const currentFilteredCount = (displayedDoctors || []).filter(
    (d) => d.name || d.doc_code
  ).length;
  const currentTotalPages = Math.ceil((displayedDoctors?.length || 0) / 21);

  const hasData = displayedDoctors.length > 0;

  return (
    <div className="controls controls-card no-print space-y-4">
      {/* 🟢 System Command & Status Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl shadow-2xs">
        {/* Right side: Cloud sync status & live counts */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Cloud Auto-Save Pill */}
          <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
            {autoSaveState === 'saving' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-600 animate-spin" />
                <span className="text-amber-700">جاري الحفظ في السحابة...</span>
              </>
            ) : autoSaveState === 'error' ? (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                <span className="text-red-700">حفظ محلي (فشل الاتصال بالسحابة)</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-800">الحفظ السحابي مفعل فوراً</span>
              </>
            )}
            {lastSavedTime && (
              <span className="text-[10px] text-slate-400 font-normal border-r border-slate-200 pr-2 mr-1 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {lastSavedTime}
              </span>
            )}
          </div>

          {/* Total Data Count Badge */}
          <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-slate-700 flex items-center gap-1.5">
            <span className="text-slate-400">إجمالي الأطباء:</span>
            <span className="font-bold text-blue-700 font-mono">{totalRawCount}</span>
          </div>

          {/* Active Filtered Count */}
          {hasActiveFilters && (
            <div className="text-xs font-bold px-3 py-1.5 rounded-xl bg-blue-600 text-white shadow-xs flex items-center gap-1.5 animate-in fade-in">
              <Sparkles className="w-3.5 h-3.5 text-blue-200" />
              <span>المعروض: {currentFilteredCount} طبيب ({currentTotalPages} صفحة A4)</span>
            </div>
          )}
        </div>

        {/* Left side: Location badge & Blank slots toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Strict Location-Based Pagination Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-xl border border-blue-200 text-blue-900 text-xs font-bold shadow-2xs select-none">
            <span>🗺️ توزيع معتمد حسب المنطقة (صفحة مستقلة لكل موقع)</span>
          </div>

          {/* Toggle Empty Slots on Screen */}
          <button
            type="button"
            onClick={toggleShowEmptySlots}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              showEmptySlotsOnScreen
                ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
            }`}
            title="التبديل بين إظهار شبكة الـ 21 خانة كاملة (بالخانات الشاغرة للطباعة) أو إخفاء الخانات الفارغة"
          >
            <span>{showEmptySlotsOnScreen ? '👁️ إخفاء الخانات الشاغرة' : '🖨️ إظهار خانات الـ 21 للطباعة'}</span>
          </button>
        </div>
      </div>

      {/* 🔍 1. Modern Enterprise Filter & Search Bar */}
      <AdvancedFilterBar />

      {/* 📁 2. Excel Import / Update Zone Toggle */}
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsExcelOpen(!isExcelOpen)}
            className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>استيراد وتحديث شيتات الإكسيل (Excel Drag & Drop / Smart Upsert)</span>
            <span className="text-[11px] text-slate-400 font-normal">
              {isExcelOpen ? '▲ إخفاء أدوات الاستيراد' : '▼ إظهار أدوات السحب والإفلات والمزامنة السحابية'}
            </span>
          </button>
        </div>

        {isExcelOpen && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <ExcelUploadZone onClose={() => setIsExcelOpen(false)} />
          </div>
        )}
      </div>

      {/* Error alert banner (if any) */}
      {statusMessage && statusMessage.isError && (
        <div className="font-bold p-3 rounded-xl text-xs border bg-rose-50 text-rose-800 border-rose-200">
          {statusMessage.text}
        </div>
      )}

      {/* 🚀 3. Primary Actions Bar (Add Doctor, Add Blank Page, Print Options) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={hasActiveFilters}
            onClick={() => openAddDoctorModal()}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-white font-bold rounded-xl transition-all shadow-xs text-xs ${
              hasActiveFilters
                ? 'bg-slate-400 cursor-not-allowed opacity-60'
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow cursor-pointer'
            }`}
            title={hasActiveFilters ? 'معطل في وضع القراءة فقط (امسح الفلاتر للإضافة)' : 'إضافة طبيب جديد'}
          >
            <UserPlus className="w-4 h-4" />
            <span>➕ إضافة طبيب جديد</span>
          </button>

          <button
            type="button"
            disabled={hasActiveFilters}
            onClick={() => setIsBlankPageModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-4 py-2.5 font-bold rounded-xl border text-xs shadow-2xs transition-all ${
              hasActiveFilters
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 cursor-pointer'
            }`}
            title={hasActiveFilters ? 'معطل في وضع القراءة فقط (امسح الفلاتر للإضافة)' : 'إضافة صفحة فارغة'}
          >
            <PlusCircle className="w-4 h-4 text-slate-500" />
            <span>➕ إضافة صفحة فارغة</span>
          </button>
        </div>

        {/* Print Settings Button */}
        {hasData && (
          <div className="flex items-center gap-2.5 bg-emerald-50/80 p-1.5 px-3 rounded-xl border border-emerald-200 shadow-2xs flex-wrap">
            <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 select-none">
              <span>جاهز للطباعة:</span>
              <span className="font-mono font-bold bg-emerald-200/70 text-emerald-950 px-2.5 py-0.5 rounded-lg text-xs">
                {currentTotalPages} صفحة A4
              </span>
            </div>

            <button
              type="button"
              onClick={openPrintModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-white font-bold rounded-lg cursor-pointer transition-all bg-emerald-600 hover:bg-emerald-700 text-xs shadow-xs hover:shadow-md"
              title="فتح إعدادات وخيارات الطباعة وتحديد نطاق الصفحات بدقة"
            >
              <Printer className="w-4 h-4" />
              <span>إعدادات وخيارات الطباعة</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal for adding blank page */}
      <BlankPageModal
        isOpen={isBlankPageModalOpen}
        onClose={() => setIsBlankPageModalOpen(false)}
      />
    </div>
  );
}
