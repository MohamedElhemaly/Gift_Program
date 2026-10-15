import React, { useRef, useState, useEffect } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
import { doctorService } from '../../services/doctorService';
import { parseAndMergeSheets, parseStatsOnly } from '../../lib/excelParser';
import { queryClient } from '../../lib/queryClient';
import { QUERY_KEYS } from '../../hooks/useDoctorQueries';
import toast from 'react-hot-toast';
import BlankPageModal from '../Modals/BlankPageModal';
import {
  FileSpreadsheet,
  RefreshCw,
  PlusCircle,
  Printer,
  UserPlus,
  Filter,
  Search,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  MapPin,
  Stethoscope,
  X,
  Sparkles,
} from 'lucide-react';

export default function ControlPanel({ onPrint }) {
  const {
    rawDoctors,
    displayedDoctors,
    rebuildData,
    addBlankPage,
    setStatus,
    statusMessage,
    openAddDoctorModal,
    autoSaveState,
    lastSavedTime,
    filters,
    setFilter,
    resetFilters,
    getUniqueFilterOptions,
    showEmptySlotsOnScreen,
    toggleShowEmptySlots,
    distributionMode,
    setDistributionMode,
  } = useDoctorStore();

  const [loadingAction, setLoadingAction] = useState(false);
  const [pageRange, setPageRange] = useState('الكل');
  const [isBlankPageModalOpen, setIsBlankPageModalOpen] = useState(false);
  const [isExcelOpen, setIsExcelOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState(filters?.searchTerm || '');

  useEffect(() => {
    setLocalSearch(filters?.searchTerm || '');
  }, [filters?.searchTerm]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== (filters?.searchTerm || '')) {
        setFilter('searchTerm', localSearch);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch]);

  // File Input Refs
  const docsFileRef = useRef(null);
  const oldFileRef = useRef(null);
  const newFileRef = useRef(null);

  const updateOldFileRef = useRef(null);
  const updateNewFileRef = useRef(null);

  // Get dynamic unique options for dropdowns
  const { governorates, cities, regions, specialties } = getUniqueFilterOptions();

  const hasActiveFilters = Object.entries(filters || {}).some(
    ([k, v]) => v && v !== 'all'
  );

  const totalRawCount = (rawDoctors || []).filter((d) => d.name || d.doc_code).length;
  const currentFilteredCount = (displayedDoctors || []).filter(
    (d) => d.name || d.doc_code
  ).length;
  const currentTotalPages = Math.ceil((displayedDoctors?.length || 0) / 21);

  /**
   * 1. Generate Report from Excel (Upsert to DB via Web Worker)
   */
  const handleGenerateReport = async () => {
    const docsFile = docsFileRef.current?.files?.[0];
    const oldFile = oldFileRef.current?.files?.[0];
    const newFile = newFileRef.current?.files?.[0];

    if (!docsFile && !oldFile && !newFile) {
      toast.error('برجاء رفع شيت واحد على الأقل!');
      return;
    }

    setLoadingAction(true);
    setStatus('جاري استخراج البيانات في خلفية النظام (Web Worker)...');

    try {
      // 1. Non-blocking Web Worker parsing
      const mergedList = await parseAndMergeSheets({
        docsFile,
        oldFile,
        newFile,
        onProgress: (msg) => setStatus(msg),
      });

      // 2. Render IMMEDIATELY on screen - ZERO DELAY!
      rebuildData(mergedList);
      try {
        localStorage.setItem('gift_program_doctors_data', JSON.stringify(mergedList));
      } catch (e) {
        // quota exceeded for massive datasets, TanStack Query manages in-memory caching
      }
      queryClient.setQueryData(QUERY_KEYS.DOCTORS, mergedList);
      toast.success(`تم استخراج ${mergedList.length} طبيب وبناء التقرير بنجاح!`);
      setStatus(`تم استخراج ${mergedList.length} طبيب! جاري المزامنة مع قاعدة البيانات في السحابة...`);

      // 3. Upsert to Supabase in background
      doctorService.upsertDoctorsBatch(mergedList, (msg) => setStatus(msg))
        .then((result) => {
          setStatus(`تم تأكيد حفظ ${result.count} طبيب بنجاح في قاعدة البيانات.`);
          toast.success(`تم تأكيد مزامنة ${result.count} طبيب مع قاعدة البيانات.`);
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DOCTORS });
        })
        .catch((err) => {
          console.warn('Sync notice:', err);
        });

    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء قراءة الملف: ' + err.message);
      setStatus('حدث خطأ أثناء قراءة الملف: ' + err.message, true);
    } finally {
      setLoadingAction(false);
    }
  };

  /**
   * 2. Update Stats Only (Excel via Web Worker)
   */
  const handleUpdateStatsOnly = async () => {
    if (displayedDoctors.length === 0) {
      toast.error('لا توجد بيانات حالية! ارفع شيت الأطباء أولاً.');
      return;
    }

    const oldFile = updateOldFileRef.current?.files?.[0];
    const newFile = updateNewFileRef.current?.files?.[0];

    if (!oldFile && !newFile) {
      toast.error('برجاء رفع شيت القديم أو الجديد للتحديث!');
      return;
    }

    setLoadingAction(true);
    setStatus('جاري تحديث الحالات عبر الـ Web Worker...');

    try {
      const statsList = await parseStatsOnly({
        oldFile,
        newFile,
        onProgress: (msg) => setStatus(msg),
      });

      // Apply updates in local store immediately
      const list = [...displayedDoctors];
      let counter = 0;
      statsList.forEach((st) => {
        const found = list.find(
          (d) => String(d.doc_code).trim() === String(st.doc_code).trim()
        );
        if (found) {
          if (st.old_stats !== undefined && found.old_stats !== st.old_stats) {
            found.old_stats = st.old_stats;
            found.old_stats_updated = true;
            found.old_stats_modified = false;
            counter++;
          }
          if (st.new_stats !== undefined && found.new_stats !== st.new_stats) {
            found.new_stats = st.new_stats;
            found.new_stats_updated = true;
            found.new_stats_modified = false;
            counter++;
          }
        }
      });

      rebuildData(list);
      queryClient.setQueryData(QUERY_KEYS.DOCTORS, list);
      toast.success(`تم تحديث إحصائيات ${counter} طبيب فوراً!`);
      setStatus(`تم تحديث ${counter} حالة على الشاشة فوراً! جاري المزامنة في السحابة...`);

      // Sync to Supabase in background
      doctorService.updateStatisticsOnlyBatch(statsList, (msg) => setStatus(msg))
        .then((result) => {
          setStatus(`تم تأكيد تحديث ${result.count} حالة بنجاح في قاعدة البيانات.`);
          toast.success(`تم تأكيد حفظ الحالات في قاعدة البيانات.`);
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DOCTORS });
        });
    } catch (err) {
      console.error(err);
      toast.error('خطأ في التحديث: ' + err.message);
      setStatus('خطأ في التحديث: ' + err.message, true);
    } finally {
      setLoadingAction(false);
    }
  };

  const hasData = displayedDoctors.length > 0;

  return (
    <div className="controls controls-card no-print space-y-4">
      {/* 🟢 Real-time Auto-Save & Cloud Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-gradient-to-r from-slate-50 to-blue-50/50 border border-slate-200 rounded-xl shadow-xs">
        <div className="flex items-center gap-2.5">
          {autoSaveState === 'saving' ? (
            <div className="flex items-center gap-2 text-amber-700 bg-amber-100/80 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>جاري الحفظ التلقائي في السحابة (Supabase)...</span>
            </div>
          ) : autoSaveState === 'error' ? (
            <div className="flex items-center gap-2 text-red-700 bg-red-100/80 px-3 py-1 rounded-full text-xs font-bold">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>تعذر الاتصال بالسحابة - تم الحفظ محلياً في المتصفح</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-800 bg-emerald-100/80 px-3 py-1 rounded-full text-xs font-bold shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>الحفظ التلقائي السحابي مفعل: كل تعديل يُحفظ فوراً في قاعدة البيانات</span>
            </div>
          )}

          {lastSavedTime && (
            <span className="text-[11px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              آخر حفظ: {lastSavedTime}
            </span>
          )}
        </div>

        {/* Quick Stats Summary */}
        <div className="flex items-center gap-2.5 text-xs flex-wrap">
          <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-gray-700 font-semibold shadow-xs">
            إجمالي الداتا: <span className="font-bold text-blue-600">{totalRawCount}</span> طبيب
          </div>
          {hasActiveFilters && (
            <div className="bg-blue-600 text-white px-3 py-1 rounded-lg font-bold shadow-xs flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              المعروض بعد الفلترة: {currentFilteredCount} طبيب ({currentTotalPages} صفحة A4)
            </div>
          )}

          {/* Distribution Mode Toggle (Continuous Full 21 vs By Region) */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 px-1 select-none">نمط العرض:</span>
            <button
              type="button"
              onClick={() => setDistributionMode('continuous')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                distributionMode === 'continuous'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="ملء جميع صفحات الـ 21 خانة بأطباء متتاليين بالكامل بدون أي خانات فارغة"
            >
              📄 توزيع متتالي كامل (21/صفحة ممتلئة)
            </button>
            <button
              type="button"
              onClick={() => setDistributionMode('by_region')}
              className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                distributionMode === 'by_region'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="تخصيص صفحة مستقلة لكل منطقة جغرافية"
            >
              🗺️ صفحة لكل منطقة
            </button>
          </div>

          {/* Toggle Empty Slots on Screen */}
          <button
            type="button"
            onClick={toggleShowEmptySlots}
            className={`px-3 py-1 rounded-lg font-bold border transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              showEmptySlotsOnScreen
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
            title="التبديل بين إظهار شبكة الـ 21 خانة كاملة (بالخانات الشاغرة للطباعة) أو إخفاء الخانات الفارغة"
          >
            <span>{showEmptySlotsOnScreen ? '👁️ إخفاء الخانات الشاغرة على الشاشة' : '🖨️ إظهار خانات الـ 21 الفارغة للطباعة'}</span>
          </button>
        </div>
      </div>

      {/* 🔍 1. نظام الفلترة والبحث المتقدم (Multi-Criteria Filtering) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
            <Filter className="w-4 h-4 text-blue-600" />
            <span>نظام الفلترة والبحث المتقدم</span>
            {hasActiveFilters && (
              <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                فلتر مفعّل
              </span>
            )}
          </h3>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-red-600 hover:text-red-800 font-bold flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة تعيين الفلاتر (عرض الكل)</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* فلتر المحافظة */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
              <Building2 className="w-3 h-3 text-gray-400" />
              <span>المحافظة:</span>
            </label>
            <select
              value={filters?.governorate || ''}
              onChange={(e) => setFilter('governorate', e.target.value)}
              className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">جميع المحافظات ({governorates.length})</option>
              {governorates.map((gov) => (
                <option key={gov} value={gov}>
                  {gov}
                </option>
              ))}
            </select>
          </div>

          {/* فلتر المدينة / المركز */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-gray-400" />
              <span>المدينة / المركز:</span>
            </label>
            <select
              value={filters?.city || ''}
              onChange={(e) => setFilter('city', e.target.value)}
              className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">جميع المدن ({cities.length})</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          {/* فلتر المنطقة */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-gray-400" />
              <span>المنطقة:</span>
            </label>
            <select
              value={filters?.region || ''}
              onChange={(e) => setFilter('region', e.target.value)}
              className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">جميع المناطق ({regions.length})</option>
              {regions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

          {/* فلتر التخصص */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
              <Stethoscope className="w-3 h-3 text-gray-400" />
              <span>التخصص:</span>
            </label>
            <select
              value={filters?.specialty || ''}
              onChange={(e) => setFilter('specialty', e.target.value)}
              className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="">جميع التخصصات ({specialties.length})</option>
              {specialties.map((spec) => (
                <option key={spec} value={spec}>
                  {spec}
                </option>
              ))}
            </select>
          </div>

          {/* فلتر الحالة */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
              <span>الحالة:</span>
            </label>
            <select
              value={filters?.status || 'all'}
              onChange={(e) => setFilter('status', e.target.value)}
              className="w-full text-xs font-semibold p-2 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">الكل (نشط وغير نشط)</option>
              <option value="active">الأطباء النشطين فقط</option>
              <option value="inactive">الأطباء المتوقفين فقط</option>
              <option value="moved">الأطباء المنقولين فقط</option>
            </select>
          </div>

          {/* بحث بالاسم / الكود / الموبايل */}
          <div>
            <label className="block text-[11px] font-bold text-gray-600 mb-1 flex items-center gap-1">
              <Search className="w-3 h-3 text-gray-400" />
              <span>اسم الطبيب / الكود:</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث بالاسم أو الكود..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full text-xs p-2 pl-7 border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {localSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalSearch('');
                    setFilter('searchTerm', '');
                  }}
                  className="absolute left-2 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 📁 2. قسم استيراد وتحديث شيتات الإكسيل (طي / فتح اختياري) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setIsExcelOpen(!isExcelOpen)}
            className="flex items-center gap-2 text-sm font-bold text-[#007bff] hover:text-[#0056b3] cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>استيراد وتحديث شيتات الإكسيل (Excel Sync / Upsert)</span>
            <span className="text-[11px] text-gray-400 font-normal">
              {isExcelOpen ? '▲ إخفاء' : '▼ إظهار أدوات الاستيراد'}
            </span>
          </button>
        </div>

        {isExcelOpen && (
          <div className="mt-4 pt-3 border-t border-slate-100 space-y-4">
            {/* استيراد تقرير كامل */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 mb-2">
                1. استيراد أطباء جدد أو شيت كامل (Upsert):
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="border border-slate-200 p-2.5 rounded-lg bg-slate-50">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    شيت الدكاترة:
                  </label>
                  <input
                    type="file"
                    ref={docsFileRef}
                    accept=".xlsx, .xls"
                    className="text-xs text-gray-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-gray-300 file:bg-white file:text-xs file:font-semibold cursor-pointer w-full"
                  />
                </div>

                <div className="border border-slate-200 p-2.5 rounded-lg bg-slate-50">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    شيت القديم:
                  </label>
                  <input
                    type="file"
                    ref={oldFileRef}
                    accept=".xlsx, .xls"
                    className="text-xs text-gray-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-gray-300 file:bg-white file:text-xs file:font-semibold cursor-pointer w-full"
                  />
                </div>

                <div className="border border-slate-200 p-2.5 rounded-lg bg-slate-50">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    شيت الجديد:
                  </label>
                  <input
                    type="file"
                    ref={newFileRef}
                    accept=".xlsx, .xls"
                    className="text-xs text-gray-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-gray-300 file:bg-white file:text-xs file:font-semibold cursor-pointer w-full"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={loadingAction}
                onClick={handleGenerateReport}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-white font-bold rounded-lg cursor-pointer transition-colors bg-[#007bff] hover:bg-[#0056b3] text-xs shadow-xs disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{loadingAction ? 'جاري المعالجة والمزامنة...' : 'مزامنة وحفظ الشيت في السحابة'}</span>
              </button>
            </div>

            {/* تحديث أرقام الحالات فقط */}
            <div className="pt-3 border-t border-slate-100">
              <h4 className="text-xs font-bold text-gray-700 mb-2">
                2. تحديث أرقام الحالات فقط (بدون تعديل العناوين):
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="border border-slate-200 p-2.5 rounded-lg bg-slate-50">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    شيت القديم:
                  </label>
                  <input
                    type="file"
                    ref={updateOldFileRef}
                    accept=".xlsx, .xls"
                    className="text-xs text-gray-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-gray-300 file:bg-white file:text-xs file:font-semibold cursor-pointer w-full"
                  />
                </div>

                <div className="border border-slate-200 p-2.5 rounded-lg bg-slate-50">
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    شيت الجديد:
                  </label>
                  <input
                    type="file"
                    ref={updateNewFileRef}
                    accept=".xlsx, .xls"
                    className="text-xs text-gray-600 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-gray-300 file:bg-white file:text-xs file:font-semibold cursor-pointer w-full"
                  />
                </div>
              </div>

              <button
                type="button"
                disabled={loadingAction}
                onClick={handleUpdateStatsOnly}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-white font-bold rounded-lg cursor-pointer transition-colors bg-slate-700 hover:bg-slate-800 text-xs shadow-xs disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تحديث الحالات فقط</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* تنبيه الحالة إن وجد */}
      {statusMessage && (
        <div
          className={`font-bold p-3 rounded-lg text-xs border ${
            statusMessage.isError
              ? 'bg-[#f8d7da] text-[#721c24] border-[#f5c6cb]'
              : 'bg-[#d4edda] text-[#155724] border-[#c3e6cb]'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* 🚀 3. أزرار الإجراءات الرئيسية والطباعة */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openAddDoctorModal()}
            className="btn btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-white font-bold rounded-lg cursor-pointer transition-colors bg-blue-600 hover:bg-blue-700 shadow-xs text-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>➕ إضافة طبيب جديد</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBlankPageModalOpen(true)}
            className="btn btn-info inline-flex items-center gap-1.5 px-4 py-2 text-white font-bold rounded-lg cursor-pointer transition-colors bg-[#17a2b8] hover:bg-[#117a8b] text-xs shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>➕ إضافة صفحة فارغة</span>
          </button>
        </div>

        {/* خيارات الطباعة */}
        {hasData && (
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 px-3 rounded-xl border border-slate-200">
            <label className="font-bold text-gray-700 text-xs">الصفحات:</label>
            <input
              type="text"
              value={pageRange}
              onChange={(e) => setPageRange(e.target.value)}
              placeholder="مثال: 1-3 أو الكل"
              className="p-1.5 border border-slate-300 rounded text-center font-bold text-xs w-28 bg-white focus:outline-none focus:border-green-500"
            />
            <button
              type="button"
              onClick={() => onPrint(pageRange)}
              className="btn btn-success inline-flex items-center gap-1.5 px-4 py-1.5 text-white font-bold rounded-lg cursor-pointer transition-colors bg-[#28a745] hover:bg-[#218838] text-xs shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>📥 طباعة / PDF</span>
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
