import React from 'react';
import DoctorCard from './DoctorCard';
import { useDoctorStore } from '../../store/useDoctorStore';
import { MapPin, Building2, Navigation, FileText, UserPlus, Trash2 } from 'lucide-react';

function A4Page({ pageDocs, pageNum, startIndex, isVisible = true }) {
  const { updatePageHeader, openAddDoctorModal, deletePage } = useDoctorStore();

  const firstDoc = pageDocs[0] || {};
  const gvr = firstDoc.pageGvr || '';
  const city = firstDoc.pageCity || '';
  const region = firstDoc.pageRegion || '';

  const mGvr = firstDoc.pageGvr_modified ? 'modified' : '';
  const mCity = firstDoc.pageCity_modified ? 'modified' : '';
  const mReg = firstDoc.pageRegion_modified ? 'modified' : '';

  const handleHeaderBlur = (field, e) => {
    const val = e.currentTarget.innerText.trim();
    updatePageHeader(startIndex, field, val);
  };

  if (!isVisible) return null;

  const realCount = pageDocs.filter((d) => d.name || d.doc_code).length;

  return (
    <div
      className="page bg-white max-w-full rounded-xl shadow-md border border-gray-200 p-4 sm:p-6 mx-auto mb-8 transition-all
        print:w-[210mm] print:h-[297mm] print:p-[10mm] print:m-0 print:rounded-none print:shadow-none print:border-none print:overflow-hidden print:page-break-after-always"
      id={`page-${pageNum}`}
    >
      {/* Page indicator (5mm in print) */}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3 h-[5mm] print:text-[10px] print:text-[#999] print:mb-[5px]">
        <div className="flex items-center gap-2 font-bold">
          <FileText className="w-3.5 h-3.5 text-blue-500 no-print" />
          <span>صفحة {pageNum}</span>
          <span className="no-print bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
            {realCount} طبيب مسجل {21 - realCount > 0 ? `(+ ${21 - realCount} خانة شاغرة متبقية للطباعة)` : ''}
          </span>
        </div>

        {/* Page Actions Toolbar (Hidden on Print) */}
        <div className="no-print flex items-center gap-2">
          <button
            type="button"
            onClick={() => openAddDoctorModal({ pageGvr: gvr, pageCity: city, pageRegion: region })}
            className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            title="إضافة طبيب جديد لهذه الصفحة"
          >
            <UserPlus className="w-3 h-3" />
            <span>إضافة طبيب للصفحة</span>
          </button>

          <button
            type="button"
            onClick={() => deletePage(startIndex)}
            className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
            title="حذف هذه الصفحة بالكامل"
          >
            <Trash2 className="w-3 h-3" />
            <span>حذف الصفحة</span>
          </button>
        </div>
      </div>

      {/* 1. On-Screen Modern Executive Header Bar */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {/* Governorate (المحافظة) */}
        <div className="flex items-center gap-2 p-2.5 px-3 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-blue-400 transition-all">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-500 flex-shrink-0">المحافظة:</span>
          <div
            className={`flex-1 font-bold text-sm text-slate-800 outline-none px-1.5 py-0.5 rounded cursor-text hover:bg-slate-50 ${mGvr}`}
            contentEditable={true}
            suppressContentEditableWarning={true}
            data-placeholder="اكتب اسم المحافظة..."
            onBlur={(e) => handleHeaderBlur('pageGvr', e)}
            title="المحافظة (انقر للتعديل وسيتم الفرز تلقائياً)"
          >
            {gvr}
          </div>
        </div>

        {/* City / Center (المدينة / المركز) */}
        <div className="flex items-center gap-2 p-2.5 px-3 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-emerald-400 transition-all">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-500 flex-shrink-0">المدينة / المركز:</span>
          <div
            className={`flex-1 font-bold text-sm text-slate-800 outline-none px-1.5 py-0.5 rounded cursor-text hover:bg-slate-50 ${mCity}`}
            contentEditable={true}
            suppressContentEditableWarning={true}
            data-placeholder="اكتب اسم المدينة..."
            onBlur={(e) => handleHeaderBlur('pageCity', e)}
            title="المدينة (انقر للتعديل وسيتم الفرز تلقائياً)"
          >
            {city}
          </div>
        </div>

        {/* Region (المنطقة) */}
        <div className="flex items-center gap-2 p-2.5 px-3 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-purple-400 transition-all">
          <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
            <Navigation className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-slate-500 flex-shrink-0">المنطقة:</span>
          <div
            className={`flex-1 font-bold text-sm text-slate-800 outline-none px-1.5 py-0.5 rounded cursor-text hover:bg-slate-50 ${mReg}`}
            contentEditable={true}
            suppressContentEditableWarning={true}
            data-placeholder="اكتب اسم المنطقة..."
            onBlur={(e) => handleHeaderBlur('pageRegion', e)}
            title="المنطقة (انقر للتعديل وسيتم الفرز تلقائياً)"
          >
            {region}
          </div>
        </div>
      </div>

      {/* 2. Print-Only Header (Strictly Matching Original HTML) */}
      <div className="print-original-header">
        <div className={mGvr}>{gvr}</div>
        <div className={mCity}>{city}</div>
        <div className={mReg}>{region}</div>
      </div>

      {/* Grid Container (255mm: 3 columns x 7 rows in print) */}
      <div className="grid-container grid grid-cols-1 md:grid-cols-3 gap-2.5
        print:grid-cols-3 print:grid-rows-7 print:gap-0 print:h-[255mm] print:border-t-2 print:border-r-2 print:border-black">
        {pageDocs.map((doc, j) => (
          <DoctorCard
            key={`${doc.id || doc.doc_code || 'blank'}-${startIndex + j}`}
            doc={doc}
            index={startIndex + j}
          />
        ))}
      </div>
    </div>
  );
}

export default React.memo(A4Page);
