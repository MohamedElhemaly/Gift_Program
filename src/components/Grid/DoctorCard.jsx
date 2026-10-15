import React from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
import {
  Maximize2,
  ArrowRightLeft,
  GitMerge,
  UserX,
  UserCheck,
  Trash2,
  Plus,
  Smartphone,
  Phone,
  Hash,
  Activity,
  Sparkles,
  MapPin,
  Stethoscope
} from 'lucide-react';

function DoctorCard({ doc, index }) {
  const {
    updateInlineItem,
    openMoveModal,
    openCombineModal,
    toggleInactive,
    openMaximizeModal,
    deleteDoctor,
    openAddDoctorModal,
  } = useDoctorStore();

  const handleBlur = (field, e) => {
    const val = e.currentTarget.innerText.trim();
    updateInlineItem(index, field, val);
  };

  const getModClass = (field) => {
    if (doc[field + '_updated']) return 'updated-stats';
    if (doc[field + '_modified']) return 'modified';
    return '';
  };

  const hasData = Boolean(doc.doc_code || doc.name);
  const movedClass = doc.is_moved ? 'moved-highlight' : '';
  const inactiveClass = doc.is_inactive ? 'inactive-doc' : '';

  return (
    <div
      className={`grid-item relative overflow-hidden transition-all duration-200 h-full
        ${hasData 
          ? 'bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-blue-400' 
          : 'bg-slate-50/60 rounded-xl border border-dashed border-slate-300 hover:bg-white hover:border-blue-300 hover:shadow-xs'}
        print:rounded-none print:shadow-none print:border-b-2 print:border-l-2 print:border-black print:border-solid print:bg-white print:p-[6px]
        ${movedClass} ${inactiveClass}`}
      id={`item-${index}`}
    >
      {/* =========================================================================
          1. MODERN SCREEN VIEW (With sleek scrollbar inside each box)
          ========================================================================= */}
      <div className="no-print p-2 sm:p-2.5 flex flex-col justify-between h-full gap-2 overflow-y-auto custom-card-scroll">
        
        {/* Top Header: Code, Serial, & Actions */}
        <div className="flex justify-between items-center gap-2">
          {/* Right: Serial Badge & Doctor Code */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Serial Counter Badge */}
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 cursor-text ${getModClass('counter')}`}
              contentEditable={true}
              suppressContentEditableWarning={true}
              data-placeholder="م"
              onClick={(e) => e.currentTarget.focus()}
              onBlur={(e) => handleBlur('counter', e)}
              title="المسلسل (انقر للتعديل)"
            >
              <Hash className="w-3 h-3 text-slate-400" />
              <span>{doc.counter || index + 1}</span>
            </span>

            {/* Doctor Code Badge - with separate label so editing code is easy */}
            <div
              className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 hover:border-blue-400 shadow-2xs ${getModClass('doc_code')}`}
              title="كود الطبيب (انقر للتعديل)"
            >
              <span className="text-[10px] text-blue-500 font-sans font-semibold select-none">كود:</span>
              <span
                className="outline-none cursor-text px-1 rounded hover:bg-white min-w-[20px]"
                contentEditable={true}
                suppressContentEditableWarning={true}
                data-placeholder="..."
                onClick={(e) => e.currentTarget.focus()}
                onBlur={(e) => handleBlur('doc_code', e)}
              >
                {doc.doc_code || ''}
              </span>
            </div>
          </div>

          {/* Left: Quick Actions Toolbar */}
          <div className="flex items-center gap-0.5 bg-slate-100/90 p-0.5 rounded-lg border border-slate-200">
            {/* Maximize Button */}
            <button
              type="button"
              className="p-1 rounded-md text-slate-700 hover:bg-white hover:text-blue-700 transition-colors cursor-pointer"
              onClick={() => openMaximizeModal(index)}
              title="تكبير وتعديل كامل"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            {/* Move Button */}
            <button
              type="button"
              className="p-1 rounded-md text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer"
              onClick={() => openMoveModal(index)}
              title="نقل الطبيب لوجهة أخرى"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </button>

            {/* Combine / Merge Button */}
            <button
              type="button"
              className="p-1 rounded-md text-purple-600 hover:bg-purple-100 hover:text-purple-800 transition-colors cursor-pointer"
              onClick={() => openCombineModal(index)}
              title="دمج طبيب آخر مع هذا الطبيب"
            >
              <GitMerge className="w-3.5 h-3.5" />
            </button>

            {/* Toggle Inactive Button */}
            <button
              type="button"
              className={`p-1 rounded-md transition-colors cursor-pointer ${
                doc.is_inactive
                  ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                  : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
              }`}
              onClick={() => toggleInactive(index)}
              title={doc.is_inactive ? 'إعادة تفعيل الطبيب' : 'إيقاف مؤقت (إخفاء في الطباعة)'}
            >
              {doc.is_inactive ? (
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <UserX className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Delete Doctor Button */}
            {hasData && (
              <button
                type="button"
                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                onClick={() => deleteDoctor(index)}
                title="حذف هذا الطبيب نهائياً"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Empty Slot Helper Button */}
        {!hasData && (
          <button
            type="button"
            onClick={() => openAddDoctorModal({ pageGvr: doc.pageGvr, pageCity: doc.pageCity, pageRegion: doc.pageRegion })}
            className="my-auto flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-dashed border-blue-300 text-blue-600 bg-blue-50/50 hover:bg-blue-100 hover:border-blue-400 font-bold text-xs transition-all cursor-pointer"
            title="انقر لإضافة طبيب في هذه الخانة مباشرة"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة طبيب هنا</span>
          </button>
        )}

        {/* Stats Section: Labeled Dual Badges */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200/70">
          {/* Old Stats (القديم) */}
          <div
            className={`flex items-center justify-between px-2 py-1 rounded bg-white border border-amber-200/80 hover:border-amber-400 cursor-text transition-colors ${getModClass('old_stats')}`}
            contentEditable={true}
            suppressContentEditableWarning={true}
            data-placeholder="0"
            onClick={(e) => e.currentTarget.focus()}
            onBlur={(e) => handleBlur('old_stats', e)}
            title="الحالات السابقة (انقر للتعديل)"
          >
            <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1 select-none">
              <Activity className="w-3 h-3 text-amber-500" />
              القديم:
            </span>
            <span className="font-mono font-bold text-xs text-slate-800">
              {doc.old_stats !== undefined && doc.old_stats !== null ? doc.old_stats : ''}
            </span>
          </div>

          {/* New Stats (الجديد) */}
          <div
            className={`flex items-center justify-between px-2 py-1 rounded bg-white border border-emerald-200/80 hover:border-emerald-400 cursor-text transition-colors ${getModClass('new_stats')}`}
            contentEditable={true}
            suppressContentEditableWarning={true}
            data-placeholder="0"
            onClick={(e) => e.currentTarget.focus()}
            onBlur={(e) => handleBlur('new_stats', e)}
            title="الحالات الجديدة (انقر للتعديل)"
          >
            <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 select-none">
              <Sparkles className="w-3 h-3 text-emerald-500" />
              الجديد:
            </span>
            <span className="font-mono font-bold text-xs text-slate-800">
              {doc.new_stats !== undefined && doc.new_stats !== null ? doc.new_stats : ''}
            </span>
          </div>
        </div>

        {/* Doctor Information Body */}
        <div className="flex flex-col gap-1 text-right flex-grow">
          {/* Doctor Name */}
          <div
            className={`font-bold text-[15px] text-slate-900 leading-snug px-1 py-0.5 rounded hover:bg-blue-50/50 cursor-text transition-colors ${getModClass('name')}`}
            contentEditable={true}
            suppressContentEditableWarning={true}
            data-placeholder="اسم الطبيب..."
            onClick={(e) => e.currentTarget.focus()}
            onBlur={(e) => handleBlur('name', e)}
            title="اسم الطبيب (انقر للتعديل)"
          >
            {doc.name || ''}
          </div>

          {/* Specialty */}
          <div
            className={`inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50/70 border border-blue-100 px-2 py-0.5 rounded-md w-fit cursor-text hover:border-blue-300 transition-colors ${getModClass('specialty')}`}
            contentEditable={true}
            suppressContentEditableWarning={true}
            data-placeholder="التخصص..."
            onClick={(e) => e.currentTarget.focus()}
            onBlur={(e) => handleBlur('specialty', e)}
            title="التخصص (انقر للتعديل)"
          >
            <Stethoscope className="w-3 h-3 text-blue-500 flex-shrink-0" />
            <span>{doc.specialty || ''}</span>
          </div>

          {/* Address */}
          <div
            className={`text-xs text-slate-600 px-1 py-0.5 rounded hover:bg-slate-100/70 cursor-text transition-colors flex items-start gap-1 leading-relaxed ${getModClass('address')}`}
            contentEditable={true}
            suppressContentEditableWarning={true}
            data-placeholder="العنوان والعيادة..."
            onClick={(e) => e.currentTarget.focus()}
            onBlur={(e) => handleBlur('address', e)}
            title="العنوان ومقر العيادة (انقر للتعديل)"
          >
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>{doc.address || ''}</span>
          </div>

          {/* Moved Notice Badge */}
          {doc.is_moved && doc.moved_from && (
            <div className="mt-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 w-fit">
              كان في: {doc.moved_from}
            </div>
          )}

          {/* Merged Notice Badge */}
          {doc.merged_codes && doc.merged_codes.length > 0 && (
            <div className="mt-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 w-fit">
              + مدمج مع: {doc.merged_codes.join(', ')}
            </div>
          )}
        </div>

        {/* Bottom Contacts Row */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700 font-medium mt-auto">
          {/* Mobile */}
          <div
            className={`flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-slate-100/60 cursor-text ${getModClass('mobile')}`}
            contentEditable={true}
            suppressContentEditableWarning={true}
            data-placeholder="موبايل..."
            onClick={(e) => e.currentTarget.focus()}
            onBlur={(e) => handleBlur('mobile', e)}
            title="رقم الموبايل (انقر للتعديل)"
          >
            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
            <span>{doc.mobile || ''}</span>
          </div>

          {/* Landline */}
          <div
            className={`flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-slate-100/60 cursor-text ${getModClass('home_tel')}`}
            contentEditable={true}
            suppressContentEditableWarning={true}
            data-placeholder="أرضي..."
            onClick={(e) => e.currentTarget.focus()}
            onBlur={(e) => handleBlur('home_tel', e)}
            title="رقم الهاتف الأرضي (انقر للتعديل)"
          >
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>{doc.home_tel || ''}</span>
          </div>
        </div>

      </div>

      {/* =========================================================================
          2. STRICT PRINT VIEW (Visible ONLY on Print: hidden print:flex)
          Exact original layout matching lines 423-447 of the original HTML file.
          ========================================================================= */}
      <div className="hidden print:flex print:flex-col print:justify-between print:h-full">
        {/* Top Row: Actions (hidden in print CSS) + Code (Left) & Stats (Right) */}
        <div className="top-row">
          <div className="left-actions">
            <div className={`code-box ${getModClass('doc_code')}`}>
              {doc.doc_code || ''}
            </div>
          </div>
          <div className="boxes-wrapper">
            <div className={`box ${getModClass('old_stats')}`}>
              {doc.old_stats !== undefined && doc.old_stats !== null ? doc.old_stats : ''}
            </div>
            <div className={`box ${getModClass('new_stats')}`}>
         