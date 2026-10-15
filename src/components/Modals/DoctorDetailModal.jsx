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
  Trash2,
  MapPinned,
  Calculator,
  User,
  ShieldCheck,
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

  useEffect(() => {
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

  const specVal = doc.specialty || doc.spec || doc.doctor_spec || '';
  const addrVal = doc.address || doc.clinic_address || doc.addr || '';
  const mobileVal = doc.mobile || doc.phone || doc.mobile_no || '';
  const homeTelVal = doc.home_tel || doc.tel || doc.landline || '';

  const locationParts = [doc.pageGvr, doc.pageCity, doc.pageRegion]
    .map((s) => cleanGeneralText(s))
    .filter(Boolean);
  const locationLabel = locationParts.length > 0 ? locationParts.join(' - ') : 'بدون تحديد موقع';

  return (
    <div className="modal-overlay animate-fadeIn" onClick={onClose}>
      <div
        className="modal-content w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 sm:p-7 text-right max-h-[92vh] overflow-y-auto"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* =========================================================================
            1. HEADER SECTION & 2. ACTION TOOLBAR
            - Large bold Doctor's Name
            - doc_code and current location as subtle badges
            - Modern cohesive button group toolbar
            ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-200">
          {/* Doctor Title and Subtle Badges */}
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 font-black flex items-center justify-center text-sm flex-shrink-0 shadow-2xs">
                #{doc.counter || index + 1}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
                {cleanDoctorName(doc.name) || doc.name || 'طبيب بدون اسم (خانة شاغرة)'}
              </h2>
            </div>

            {/* Badges: Code, Location, Status */}
            <div className="flex items-center gap-2 flex-wrap pt-0.5">
              {/* Doctor Code Badge */}
              <div
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs"
                title="كود الطبيب (معرّف أساسي محمي)"
              >
                <Hash className="w-3 h-3 text-blue-500" />
                <span>كود: {cleanGeneralText(doc.doc_code) || 'غير محدد'}</span>
                <span className="text-[10px] bg-blue-200/70 text-blue-900 px-1 py-0.2 rounded font-sans font-normal flex items-center gap-0.5">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  محمي
                </span>
              </div>

              {/* Location Badge */}
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                title="الموقع الحالي للصفحة"
              >
                <MapPinned className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate max-w-[280px]">{locationLabel}</span>
              </div>

              {/* Status Badges */}
              {doc.is_inactive && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 shadow-2xs">
                  <UserX className="w-3 h-3 text-rose-600" />
                  <span>موقوف مؤقتاً</span>
                </span>
              )}

              {doc.is_moved && (
                <span
                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs italic"
                  title={`منقول من: ${cleanGeneralText(doc.moved_from) || 'موقع سابق'}`}
                >
                  <ArrowRightLeft className="w-3 h-3 text-amber-700 not-italic" />
                  <span>
                    كان في: <span className="not-italic font-semibold">{cleanGeneralText(doc.moved_from) || 'موقع سابق'}</span>
                  </span>
                </span>
              )}

              {doc.merged_codes && doc.merged_codes.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300 shadow-2xs">
                  <GitMerge className="w-3 h-3 text-purple-600" />
                  <span>+ مدمج مع: {doc.merged_codes.join(', ')}</span>
                </span>
              )}
            </div>
          </div>

          {/* Action Toolbar (Modern Cohesive Button Group) */}
          <div className="flex items-center gap-1.5 flex-shrink-0 self-start">
            <div className="inline-flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200 shadow-2xs">
              {/* Move Button */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openMoveModal(index);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 hover:bg-white hover:shadow-2xs transition-all cursor-pointer"
                title="نقل الطبيب لموقع آخر"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                <span>نقل</span>
              </button>

              <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

              {/* Combine / Merge Button */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  openCombineModal(index);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-purple-700 hover:bg-white hover:shadow-2xs transition-all cursor-pointer"
                title="دمج طبيب آخر مع هذا الطبيب"
              >
                <GitMerge className="w-3.5 h-3.5 text-purple-600" />
                <span>دمج</span>
              </button>

              <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

              {/* Toggle Inactive Button */}
              <button
                type="button"
                onClick={handleToggleInactive}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  doc.is_inactive
                    ? 'text-emerald-700 hover:bg-white hover:shadow-2xs'
                    : 'text-amber-700 hover:bg-white hover:shadow-2xs'
                }`}
                title={doc.is_inactive ? 'إعادة تفعيل الطبيب' : 'إيقاف مؤقت (إخفاء في الطباعة)'}
              >
                {doc.is_inactive ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تفعيل</span>
                  </>
                ) : (
                  <>
                    <UserX className="w-3.5 h-3.5 text-amber-600" />
                    <span>إيقاف</span>
                  </>
                )}
              </button>

              <div className="w-[1px] h-4 bg-slate-300 mx-0.5" />

              {/* Clear / Delete Slot Button */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  clearDoctorSlot(index);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-rose-600 hover:bg-white hover:shadow-2xs transition-all cursor-pointer"
                title="تفريغ بيانات هذه الخانة"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>تفريغ</span>
              </button>
            </div>

            {/* Quick Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            MODAL BODY
            ========================================================================= */}
        <div className="space-y-5 my-5">
          {/* =========================================================================
              4. STATISTICS HIGHLIGHT BOX
              Old Stats, New Stats, and Counter in distinct colored box separating numbers
              ========================================================================= */}
          <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/40 border border-blue-200/80 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black text-blue-900 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span>إحصائيات وترتيب الطبيب</span>
              </span>
              <span className="text-[11px] font-bold text-blue-700 bg-white/80 border border-blue-200 px-2.5 py-0.5 rounded-full shadow-2xs">
                إجمالي الحالات: {(parseInt(doc.old_stats, 10) || 0) + (parseInt(doc.new_stats, 10) || 0)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* Counter / Position */}
              <div className="bg-white p-2.5 rounded-xl border border-blue-100 shadow-2xs">
                <label className="block text-[11px] font-bold text-slate-600 mb-1 text-center">
                  المسلسل (م)
                </label>
                <input
                  type="text"
                  value={doc.counter || ''}
                  onChange={(e) => handleFieldChange('counter', e.target.value)}
                  placeholder="1"
                  className="w-full p-2 border border-slate-200 rounded-lg text-sm font-black text-center text-slate-800 bg-slate-50/60 hover:bg-white focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                />
              </div>

              {/* Old Stats */}
              <div className="bg-white p-2.5 rounded-xl border border-amber-200 shadow-2xs">
                <label className="block text-[11px] font-bold text-amber-800 mb-1 flex items-center justify-center gap-1">
                  <Activity className="w-3 h-3 text-amber-600" />
                  <span>الحالات القديمة</span>
                </label>
                <input
                  type="number"
                  value={doc.old_stats !== undefined && doc.old_stats !== null ? doc.old_stats : ''}
                  onChange={(e) => handleFieldChange('old_stats', e.target.value)}
                  placeholder="0"
                  className="w-full p-2 border border-amber-200 rounded-lg text-sm font-black text-center text-amber-900 bg-amber-50/30 hover:bg-white focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all outline-none"
                />
              </div>

              {/* New Stats */}
              <div className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
                <label className="block text-[11px] font-bold text-emerald-800 mb-1 flex items-center justify-center gap-1">
                  <Sparkles className="w-3 h-3 text-emerald-600" />
                  <span>الحالات الجديدة</span>
                </label>
                <input
                  type="number"
                  value={doc.new_stats !== undefined && doc.new_stats !== null ? doc.new_stats : ''}
                  onChange={(e) => handleFieldChange('new_stats', e.target.value)}
                  placeholder="0"
                  className="w-full p-2 border border-emerald-200 rounded-lg text-sm font-black text-center text-emerald-900 bg-emerald-50/30 hover:bg-white focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
                />
              </div>
            </div>
          </div>

          {/* =========================================================================
              3. FORM GRID LAYOUT
              - Doctor Full Name
              - Row 1 (Contact): Mobile Phone (Col 1) | Home Phone (Col 2)
              - Row 2 (Details): Specialty (Col 1) | Address (Col 2)
              - Premium inputs: soft gray backgrounds, smooth borders, focus rings
              ========================================================================= */}
          <div className="space-y-4">
            {/* Doctor Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>اسم الطبيب بالكامل:</span>
              </label>
              <input
                type="text"
                value={doc.name || ''}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="مثال: أ.د/ محمد أحمد علي"
                className="w-full p-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              />
            </div>

            {/* Row 1 (Contact): Mobile Phone (Column 1) | Home Phone (Column 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Column 1: Mobile Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                  <span>رقم الهاتف المحمول (موبايل):</span>
                </label>
                <input
                  type="text"
                  value={mobileVal}
                  onChange={(e) => handleFieldChange('mobile', e.target.value)}
                  placeholder="مثال: 01012345678"
                  className="w-full p-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm font-mono font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                />
              </div>

              {/* Column 2: Home Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>رقم الهاتف الأرضي:</span>
                </label>
                <input
                  type="text"
                  value={homeTelVal}
                  onChange={(e) => handleFieldChange('home_tel', e.target.value)}
                  placeholder="مثال: 035555555"
                  className="w-full p-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm font-mono font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                />
              </div>
            </div>

            {/* Row 2 (Details): Specialty (Column 1) | Address (Column 2) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Column 1: Specialty */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                  <span>التخصص الطبي:</span>
                </label>
                <input
                  type="text"
                  value={specVal}
                  onChange={(e) => handleFieldChange('specialty', e.target.value)}
                  placeholder="مثال: استشاري باطنة وكبد"
                  className="w-full p-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                />
              </div>

              {/* Column 2: Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>العنوان ومقر العيادة:</span>
                </label>
                <input
                  type="text"
                  value={addrVal}
                  onChange={(e) => handleFieldChange('address', e.target.value)}
                  placeholder="مثال: شارع سعد زغلول - برج الأطباء"
                  className="w-full p-2.5 px-3.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            5. FOOTER
            Clear, wide primary button to Save & Close / Minimize (تصغير والعودة للشبكة)
            ========================================================================= */}
        <div className="pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.99] text-white font-bold text-sm sm:text-base rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Minimize2 className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>تصغير والعودة للشبكة</span>
          </button>
        </div>
      </div>
    </div>
  );
}
