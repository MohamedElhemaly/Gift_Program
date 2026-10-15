import React, { useEffect } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
import {
  useUpdateDoctorFieldMutation,
  useToggleInactiveMutation,
} from '../../hooks/useDoctorQueries';
import { cleanDoctorName, cleanGeneralText } from '../../services/doctorService';
import {
  Minimize2,
  X,
  ArrowRightLeft,
  GitMerge,
  UserX,
  UserCheck,
  Smartphone,
  Phone,
  MapPin,
  Stethoscope,
  Activity,
  Sparkles,
  Hash,
  Save
} from 'lucide-react';

export default function DoctorDetailModal({ isOpen, onClose, index }) {
  const {
    displayedDoctors,
    updateInlineItem,
    openMoveModal,
    openCombineModal,
    toggleInactive,
    clearDoctorSlot,
  } = useDoctorStore();

  const updateFieldMutation = useUpdateDoctorFieldMutation();
  const toggleInactiveMutation = useToggleInactiveMutation();

  React.useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen || index === -1 || !displayedDoctors[index]) return null;

  const doc = displayedDoctors[index];

  const handleFieldChange = (field, value) => {
    let cleanVal = value;
    if (field === 'name') {
      cleanVal = cleanDoctorName(value);
    } else if (field !== 'old_stats' && field !== 'new_stats' && field !== 'counter') {
      cleanVal = cleanGeneralText(value);
    }
    updateInlineItem(index, field, cleanVal);
    if (doc.id || doc.doc_code) {
      updateFieldMutation.mutate({
        id: doc.id,
        docCode: doc.doc_code,
        field,
        value: cleanVal,
      });
    }
  };

  const handleToggleInactive = () => {
    const currentInactive = Boolean(doc.is_inactive);
    const targetState = !currentInactive;
    toggleInactive(index, targetState);
    if (doc.id || doc.doc_code) {
      toggleInactiveMutation.mutate({
        doctor: doc,
        targetState,
      });
    }
  };

  const getModClass = (field) => {
    if (doc[field + '_updated']) return 'bg-emerald-50 border-emerald-300';
    if (doc[field + '_modified']) return 'bg-amber-50 border-amber-300';
    return 'bg-white border-slate-300';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 text-right max-h-[90vh] overflow-y-auto"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
              #{doc.counter || index + 1}
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">
                {cleanDoctorName(doc.name) || doc.name || 'طبيب بدون اسم (خانة فارغة)'}
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                كود الطبيب: {cleanGeneralText(doc.doc_code) || 'غير محدد'} | صفحة: {cleanGeneralText(doc.pageGvr) || 'بدون محافظة'} - {cleanGeneralText(doc.pageCity) || ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Quick Actions in Modal */}
            <button
              type="button"
              onClick={() => {
                onClose();
                openMoveModal(index);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold text-xs border border-blue-200 transition-colors"
              title="نقل الطبيب"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>نقل</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                openCombineModal(index);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-xs border border-purple-200 transition-colors"
              title="دمج طبيب آخر"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>دمج</span>
            </button>

            <button
              type="button"
              onClick={handleToggleInactive}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-xs border transition-colors ${
                doc.is_inactive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
              }`}
            >
              {doc.is_inactive ? (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تفعيل</span>
                </>
              ) : (
                <>
                  <UserX className="w-3.5 h-3.5" />
                  <span>إيقاف</span>
                </>
              )}
            </button>

            {/* Clear Doctor Slot */}
            <button
              type="button"
              onClick={() => {
                onClose();
                clearDoctorSlot(index);
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-xs border border-amber-200 transition-colors"
              title="تفريغ بيانات هذه الخانة"
            >
              <span>تفريغ</span>
            </button>
            {/* Minimize / Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors mr-2"
              title="تصغير / إغلاق"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body in Maximized View */}
        <div className="space-y-4">
          
          {/* Row 1: Code & Counter & Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            {/* Code (Strictly Read-Only) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-blue-600" />
                  <span>كود الطبيب:</span>
                </span>
                <span className="text-[10px] text-amber-700 font-normal bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                  محمي
                </span>
              </label>
              <input
                type="text"
                value={doc.doc_code || ''}
                readOnly
                disabled
                title="كود الطبيب معرّف أساسي محمي للقراءة فقط ولا يمكن تعديله"
                className="w-full p-2 border border-slate-200 rounded-lg text-sm font-mono font-bold bg-slate-100 text-slate-600 cursor-not-allowed select-all"
              />
            </div>

            {/* Serial Counter */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المسلسل (م):
              </label>
              <input
                type="text"
                value={doc.counter || ''}
                onChange={(e) => handleFieldChange('counter', e.target.value)}
                placeholder="1"
                className={`w-full p-2 border rounded-lg text-sm font-bold text-center focus:outline-blue-500 ${getModClass('counter')}`}
              />
            </div>

            {/* Old Stats */}
            <div>
              <label className="block text-xs font-bold text-amber-800 mb-1 flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-amber-600" />
                <span>الحالات القديمة:</span>
              </label>
              <input
                type="number"
                value={doc.old_stats || ''}
                onChange={(e) => handleFieldChange('old_stats', e.target.value)}
                placeholder="0"
                className={`w-full p-2 border rounded-lg text-sm font-bold text-center focus:outline-amber-500 ${getModClass('old_stats')}`}
              />
            </div>

            {/* New Stats */}
            <div>
              <label className="block text-xs font-bold text-emerald-800 mb-1 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>الحالات الجديدة:</span>
              </label>
              <input
                type="number"
                value={doc.new_stats || ''}
                onChange={(e) => handleFieldChange('new_stats', e.target.value)}
                placeholder="0"
                className={`w-full p-2 border rounded-lg text-sm font-bold text-center focus:outline-emerald-500 ${getModClass('new_stats')}`}
              />
            </div>
          </div>

          {/* Row 2: Doctor Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اسم الطبيب بالكامل:
            </label>
            <input
              type="text"
              value={doc.name || ''}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder="مثال: أ.د/ محمد أحمد علي"
              className={`w-full p-2.5 border rounded-lg text-base font-bold text-slate-900 focus:outline-blue-500 ${getModClass('name')}`}
            />
          </div>

          {/* Row 3: Specialty & Location */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                <span>التخصص الطبي:</span>
              </label>
              <input
                type="text"
                value={doc.specialty || ''}
                onChange={(e) => handleFieldChange('specialty', e.target.value)}
                placeholder="مثال: استشاري باطنة وكبد"
                className={`w-full p-2 border rounded-lg text-sm focus:outline-blue-500 ${getModClass('specialty')}`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                <span>العنوان ومقر العيادة:</span>
              </label>
              <input
                type="text"
                value={doc.address || ''}
                onChange={(e) => handleFieldChange('address', e.target.value)}
                placeholder="مثال: شارع سعد زغلول - برج الأطباء"
                className={`w-full p-2 border rounded-lg text-sm focus:outline-blue-500 ${getModClass('address')}`}
              />
            </div>
          </div>

          {/* Row 4: Phone Numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                <span>رقم الهاتف المحمول (موبايل):</span>
              </label>
              <input
                type="text"
                value={doc.mobile || ''}
                onChange={(e) => handleFieldChange('mobile', e.target.value)}
                placeholder="01012345678"
                className={`w-full p-2 border rounded-lg text-sm font-mono focus:outline-blue-500 ${getModClass('mobile')}`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>رقم الهاتف الأرضي:</span>
              </label>
              <input
                type="text"
                value={doc.home_tel || ''}
                onChange={(e) => handleFieldChange('home_tel', e.target.value)}
                placeholder="035555555"
                className={`w-full p-2 border rounded-lg text-sm font-mono focus:outline-blue-500 ${getModClass('home_tel')}`}
              />
            </div>
          </div>

          {/* Moved / Merged Info Badges */}
          {(doc.is_moved || (doc.merged_codes && doc.merged_codes.length > 0)) && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap gap-2">
              {doc.is_moved && (
                <div className="text-xs font-bold px-2.5 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1.5 italic">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700 not-italic select-none" />
                  <span>
                    كان في: <span className="not-italic font-semibold">{doc.moved_from || 'موقع سابق'}</span>
                  </span>
                </div>
              )}
              {doc.merged_codes && doc.merged_codes.length > 0 && (
                <div className="text-xs font-bold px-2.5 py-1 rounded bg-purple-100 text-purple-800 border border-purple-300">
                  + مدمج مع الأكواد: {doc.merged_codes.join(', ')}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="flex justify-end items-center gap-2 pt-4 mt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-colors shadow-sm"
          >
            <Minimize2 className="w-4 h-4" />
            <span>تصغير والعودة للشبكة</span>
          </button>
        </div>

      </div>
    </div>
  );
}
