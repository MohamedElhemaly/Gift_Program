import React, { useRef, useState } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
import { doctorService } from '../../services/doctorService';
import { parseAndMergeSheets, parseStatsOnly } from '../../lib/excelParser';
import BlankPageModal from '../Modals/BlankPageModal';
import { FileSpreadsheet, RefreshCw, Save, PlusCircle, Printer, FolderOpen, UserPlus } from 'lucide-react';

export default function ControlPanel({ onPrint }) {
  const {
    displayedDoctors,
    rebuildData,
    addBlankPage,
    exportJSON,
    importJSON,
    setStatus,
    statusMessage,
    openAddDoctorModal,
  } = useDoctorStore();

  const [loadingAction, setLoadingAction] = useState(false);
  const [pageRange, setPageRange] = useState('الكل');
  const [isBlankPageModalOpen, setIsBlankPageModalOpen] = useState(false);

  // File Input Refs
  const docsFileRef = useRef(null);
  const oldFileRef = useRef(null);
  const newFileRef = useRef(null);

  const loadJsonRef = useRef(null);

  const updateOldFileRef = useRef(null);
  const updateNewFileRef = useRef(null);

  /**
   * 1. Generate Report from Excel (Upsert to DB)
   */
  const handleGenerateReport = async () => {
    const docsFile = docsFileRef.current?.files?.[0];
    const oldFile = oldFileRef.current?.files?.[0];
    const newFile = newFileRef.current?.files?.[0];

    if (!docsFile && !oldFile && !newFile) {
      alert('برجاء رفع شيت واحد على الأقل!');
      return;
    }

    setLoadingAction(true);
    setStatus('جاري استخراج البيانات والمزامنة مع قاعدة البيانات...');

    try {
      const mergedList = await parseAndMergeSheets({ docsFile, oldFile, newFile });
      
      // Upsert to Supabase with live progress callback
      const result = await doctorService.upsertDoctorsBatch(mergedList, (msg) => setStatus(msg));

      // Rebuild in Zustand Store
      rebuildData(mergedList);

      if (result.warning) {
        setStatus(`تم بناء التقرير وعرض ${result.count} طبيب بنجاح!`);
      } else {
        setStatus(`تم إنشاء التقرير بنجاح وحفظ ${result.count} طبيب في قاعدة البيانات.`);
      }
    } catch (err) {
      console.error(err);
      setStatus('حدث خطأ: ' + err.message, true);
    } finally {
      setLoadingAction(false);
    }
  };

  /**
   * 2. Load JSON Backup
   */
  const handleLoadJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        importJSON(parsed);
      } catch (err) {
        alert('خطأ في قراءة ملف الحفظ، تأكد من اختيار ملف .json الصحيح.');
      }
    };
    reader.readAsText(file);
  };

  /**
   * 3. Update Stats Only (Excel)
   */
  const handleUpdateStatsOnly = async () => {
    if (displayedDoctors.length === 0) {
      alert('أنشئ تقرير أولاً أو ارفع ملف حفظ!');
      return;
    }

    const oldFile = updateOldFileRef.current?.files?.[0];
    const newFile = updateNewFileRef.current?.files?.[0];

    if (!oldFile && !newFile) {
      alert('برجاء رفع شيت القديم أو الجديد للتحديث!');
      return;
    }

    setLoadingAction(true);
    setStatus('جاري تحديث الحالات...');

    try {
      const statsList = await parseStatsOnly({ oldFile, newFile });
      const result = await doctorService.updateStatisticsOnlyBatch(statsList, (msg) => setStatus(msg));

      // Apply updates in local store
      const list = [...displayedDoctors];
      let counter = 0;
      statsList.forEach((st) => {
        const found = list.find((d) => String(d.doc_code).trim() === String(st.doc_code).trim());
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
      setStatus(
        result.count > 0
          ? `تم تحديث ${result.count} حالة بنجاح في قاعدة البيانات.`
          : 'لم يتم العثور على أرقام جديدة تختلف عن الحالية.'
      );
    } catch (err) {
      console.error(err);
      setStatus('خطأ في التحديث: ' + err.message, true);
    } finally {
      setLoadingAction(false);
    }
  };

  /**
   * Add Blank Page dialog
   */
  const handleAddBlankPage = () => {
    const g = prompt('اسم المحافظة:', 'صفحة إضافية');
    if (g === null) return;
    const c = prompt('اسم المدينة / المركز:', 'مدينة إضافية');
    if (c === null) return;
    const r = prompt('اسم المنطقة:', 'فارغة');
    if (r === null) return;

    addBlankPage(g, c, r);
  };

  const hasData = displayedDoctors.length > 0;

  return (
    <div className="controls controls-card no-print">
      {/* 1. إنشاء تقرير جديد من الإكسيل */}
      <h3 className="controls-heading text-[#007bff] flex items-center gap-2">
        <FileSpreadsheet className="w-4 h-4 inline-block" />
        1. إنشاء تقرير جديد من الإكسيل
      </h3>

      <div className="input-group flex items-center my-2.5">
        <label className="inline-block w-[220px] font-bold text-gray-700">شيت الدكاترة:</label>
        <input
          type="file"
          ref={docsFileRef}
          accept=".xlsx, .xls"
          className="text-sm text-gray-700 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:bg-gray-50 file:text-xs file:font-semibold hover:file:bg-gray-100 cursor-pointer"
        />
      </div>

      <div className="input-group flex items-center my-2.5">
        <label className="inline-block w-[220px] font-bold text-gray-700">شيت القديم:</label>
        <input
          type="file"
          ref={oldFileRef}
          accept=".xlsx, .xls"
          className="text-sm text-gray-700 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:bg-gray-50 file:text-xs file:font-semibold hover:file:bg-gray-100 cursor-pointer"
        />
      </div>

      <div className="input-group flex items-center my-2.5">
        <label className="inline-block w-[220px] font-bold text-gray-700">شيت الجديد:</label>
        <input
          type="file"
          ref={newFileRef}
          accept=".xlsx, .xls"
          className="text-sm text-gray-700 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:bg-gray-50 file:text-xs file:font-semibold hover:file:bg-gray-100 cursor-pointer"
        />
      </div>

      <button
        type="button"
        disabled={loadingAction}
        onClick={handleGenerateReport}
        className="btn btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-bold rounded cursor-pointer transition-colors bg-[#007bff] hover:bg-[#0056b3] mt-2.5 ml-1.5 disabled:opacity-50"
      >
        <FileSpreadsheet className="w-4 h-4" />
        <span>{loadingAction ? 'جاري المعالجة والمزامنة...' : 'إنشاء التقرير'}</span>
      </button>

      <hr className="my-5 border-0 border-t border-[#ddd]" />

      {/* 2. استكمال عمل محفوظ سابقاً */}
      <h3 className="controls-heading text-[#007bff] flex items-center gap-2">
        <FolderOpen className="w-4 h-4 inline-block" />
        2. استكمال عمل محفوظ سابقاً
      </h3>

      <div className="input-group flex items-center my-2.5">
        <label className="inline-block w-[220px] font-bold text-gray-700">ارفع ملف الحفظ (.json):</label>
        <input
          type="file"
          ref={loadJsonRef}
          accept=".json"
          onChange={handleLoadJson}
          className="text-sm text-gray-700 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:bg-gray-50 file:text-xs file:font-semibold hover:file:bg-gray-100 cursor-pointer"
        />
      </div>

      <hr className="my-5 border-0 border-t border-[#ddd]" />

      {/* 3. تحديث أرقام الحالات (للتحديث فقط) */}
      <h3 className="controls-heading text-[#007bff] flex items-center gap-2">
        <RefreshCw className="w-4 h-4 inline-block" />
        3. تحديث أرقام الحالات (للتحديث فقط)
      </h3>

      <div className="input-group flex items-center my-2.5">
        <label className="inline-block w-[220px] font-bold text-gray-700">شيت القديم:</label>
        <input
          type="file"
          ref={updateOldFileRef}
          accept=".xlsx, .xls"
          className="text-sm text-gray-700 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:bg-gray-50 file:text-xs file:font-semibold hover:file:bg-gray-100 cursor-pointer"
        />
      </div>

      <div className="input-group flex items-center my-2.5">
        <label className="inline-block w-[220px] font-bold text-gray-700">شيت الجديد:</label>
        <input
          type="file"
          ref={updateNewFileRef}
          accept=".xlsx, .xls"
          className="text-sm text-gray-700 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:bg-gray-50 file:text-xs file:font-semibold hover:file:bg-gray-100 cursor-pointer"
        />
      </div>

      <button
        type="button"
        disabled={loadingAction}
        onClick={handleUpdateStatsOnly}
        className="btn btn-secondary inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-bold rounded cursor-pointer transition-colors bg-[#6c757d] hover:bg-[#5a6268] mt-2.5 ml-1.5 disabled:opacity-50"
      >
        <RefreshCw className="w-4 h-4" />
        <span>🔄 تحديث الحالات فقط</span>
      </button>

      {/* الحالة / التنبيه */}
      {statusMessage && (
        <div
          className={`font-bold mt-3 p-2.5 rounded text-sm border ${
            statusMessage.isError
              ? 'bg-[#f8d7da] text-[#721c24] border-[#f5c6cb]'
              : 'bg-[#d4edda] text-[#155724] border-[#c3e6cb]'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      <hr className="my-5 border-0 border-t border-[#ddd]" />

      {/* أزرار الإجراءات */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => openAddDoctorModal()}
          className="btn btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-bold rounded cursor-pointer transition-colors bg-blue-600 hover:bg-blue-700 shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>➕ إضافة طبيب جديد</span>
        </button>

        <button
          type="button"
          onClick={() => setIsBlankPageModalOpen(true)}
          className="btn btn-info inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-bold rounded cursor-pointer transition-colors bg-[#17a2b8] hover:bg-[#117a8b]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>➕ إضافة صفحة فارغة</span>
        </button>

        {hasData && (
          <>
            <button
              type="button"
              onClick={exportJSON}
              className="btn btn-warning inline-flex items-center gap-1.5 px-5 py-2.5 text-black font-bold rounded cursor-pointer transition-colors bg-[#ffc107] hover:bg-[#e0a800]"
            >
              <Save className="w-4 h-4" />
              <span>💾 حفظ نسخة (.json)</span>
            </button>

            {/* خيارات الطباعة */}
            <div className="inline-flex items-center gap-2 mr-3 pr-3 border-r-2 border-[#ccc]">
              <label className="font-bold text-gray-700">اختر الصفحات:</label>
              <input
                type="text"
                value={pageRange}
                onChange={(e) => setPageRange(e.target.value)}
                placeholder="مثال: 1-3"
                className="p-2 border border-[#ccc] rounded w-[180px] text-center font-bold text-sm"
              />
              <button
                type="button"
                onClick={() => onPrint(pageRange)}
                className="btn btn-success inline-flex items-center gap-1.5 px-5 py-2.5 text-white font-bold rounded cursor-pointer transition-colors bg-[#28a745] hover:bg-[#218838]"
              >
                <Printer className="w-4 h-4" />
                <span>📥 طباعة / PDF</span>
              </button>
            </div>
          </>
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
