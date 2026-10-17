import React, { useRef, useEffect } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
import {
  useUpdateDoctorFieldMutation,
  useToggleInactiveMutation,
} from '../../hooks/useDoctorQueries';
import { cleanDoctorName, cleanGeneralText } from '../../services/doctorService';
import {
  Maximize2,
  ArrowRightLeft,
  GitMerge,
  UserX,
  UserCheck,
  Plus,
  Smartphone,
  Phone,
  Hash,
  Activity,
  Sparkles,
  MapPin,
  Stethoscope,
  Lock,
} from 'lucide-react';

function DoctorCard({ doc, index, isHighlighted = false }) {
  const {
    updateInlineItem,
    openMoveModal,
    openCombineModal,
    toggleInactive,
    openMaximizeModal,
    openAddDoctorModal,
    addNewDoctorToPage,
    newlyAddedDoctorId,
    setNewlyAddedDoctorId,
    showEmptySlotsOnScreen,
    filters,
  } = useDoctorStore();

  const nameFieldRef = useRef(null);

  // Auto-focus on newly added doctor card
  useEffect(() => {
    if (
      newlyAddedDoctorId &&
      (doc.id === newlyAddedDoctorId || String(doc.doc_code).trim() === String(newlyAddedDoctorId).trim())
    ) {
      const timer = setTimeout(() => {
        if (nameFieldRef.current) {
          nameFieldRef.current.focus();
          nameFieldRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [newlyAddedDoctorId, doc.id, doc.doc_code]);

  const isReadOnly = Boolean(
    (filters?.governorate && filters.governorate.trim()) ||
    (filters?.city && filters.city.trim()) ||
    (filters?.region && filters.region.trim()) ||
    (filters?.specialty && filters.specialty.trim()) ||
    (filters?.searchTerm && filters.searchTerm.trim()) ||
    (filters?.status && filters.status !== 'all')
  );

  const updateFieldMutation = useUpdateDoctorFieldMutation();
  const toggleInactiveMutation = useToggleInactiveMutation();

  const handleBlur = (field, e) => {
    if (isReadOnly) return;
    const val = e.currentTarget.innerText.trim();
    const oldVal = String(doc[field] || '').trim();
    if (val === oldVal) return;

    // 1. Instant optimistic update in local Zustand store
    updateInlineItem(index, field, val);

    // 2. Optimistic TanStack Query mutation for DB persistence & automatic rollback
    if (doc.id || doc.doc_code) {
      updateFieldMutation.mutate({
        id: doc.id,
        docCode: doc.doc_code,
        field,
        value: val,
      });
    }
  };

  const handleToggleInactive = () => {
    if (isReadOnly) return;
    const currentInactive = Boolean(doc.is_inactive);
    const targetState = !currentInactive;

    // 1. Instant optimistic update in Zustand store (changes card color instantly)
    toggleInactive(index, targetState);

    // 2. Persist to Supabase with TanStack Query mutation
    if (doc.id || doc.doc_code) {
      toggleInactiveMutation.mutate({
        doctor: doc,
        targetState,
      });
    }
  };

  const isInactive = Boolean(doc.is_inactive);
  const isMoved = Boolean(doc.is_moved);
  const hasData = Boolean(doc.doc_code || doc.name);

  // Check if doctor has ANY manual modifications (Universal Yellow Highlight)
  const isManuallyModified = Boolean(
    isMoved ||
    doc.is_modified ||
    doc.name_modified ||
    doc.specialty_modified ||
    doc.address_modified ||
    doc.mobile_modified ||
    doc.home_tel_modified ||
    doc.old_stats_modified ||
    doc.new_stats_modified ||
    doc.counter_modified ||
    doc.pageGvr_modified ||
    doc.pageCity_modified ||
    doc.pageRegion_modified ||
    (doc.merged_codes && doc.merged_codes.length > 0)
  );

  const getModClass = (field) => {
    if (doc[field + '_modified']) return 'modified !bg-[#ffeb3b] !text-black font-bold px-1 rounded border !border-yellow-500 shadow-2xs print:!bg-transparent print:!border-0 print:!text-black print:!shadow-none';
    if (doc[field + '_updated']) return 'updated-stats bg-emerald-100 text-emerald-950 px-1 rounded border border-emerald-300 print:!bg-transparent print:!border-0 print:!text-black';
    return '';
  };

  const movedClass = isMoved ? 'moved-highlight' : '';
  const inactiveClass = isInactive ? 'inactive-doc' : '';
  const hideEmptyOnScreen = !hasData && !showEmptySlotsOnScreen;

  // Conditionally apply background theme:
  // 1. Inactive: Light Red (Optimistic UI)
  // 2. Modified (Moved, Inline Edits, Merged): Universal Yellow Highlight (Screen-only)
  // 3. Normal with Data: Clean White
  // 4. Empty slot: Dashed slate
  const cardThemeClass = isInactive
    ? 'bg-rose-100/90 border-rose-300 hover:border-rose-400 shadow-xs ring-1 ring-rose-200'
    : isManuallyModified
    ? 'bg-yellow-100/90 border-yellow-400/90 hover:border-yellow-500 shadow-xs ring-2 ring-yellow-300/80'
    : hasData
    ? 'bg-white border-slate-200 hover:border-blue-400 shadow-xs hover:shadow-md'
    : 'bg-slate-50/50 border-dashed border-slate-300 hover:bg-white hover:border-blue-300';

  const specVal = cleanGeneralText(doc.specialty || doc.spec || doc.doctor_spec || '');
  const addrVal = cleanGeneralText(doc.address || doc.clinic_address || doc.addr || '');
  const mobileVal = cleanGeneralText(doc.mobile || doc.phone || doc.mobile_no || '');
  const homeTelVal = cleanGeneralText(doc.home_tel || doc.tel || doc.landline || '');

  return (
    <div
      className={`grid-item relative transition-all duration-300 p-3 rounded-xl border
        ${hideEmptyOnScreen ? 'hidden print:flex' : ''}
        ${cardThemeClass}
        ${isHighlighted ? 'jump-highlight ring-4 ring-blue-500 scale-[1.02] shadow-xl z-30' : ''}
        print:!bg-white print:!ring-0 print:!rounded-none print:!shadow-none print:border-b-2 print:border-l-2 print:border-black print:border-solid print:p-[6px]
        ${movedClass} ${inactiveClass}`}
      id={`item-${index}`}
      data-doc-code={doc.doc_code || ''}
    >
      {/* =========================================================================
          1. MODERN SCREEN VIEW
          ========================================================================= */}
      <div className="no-print flex flex-col justify-between h-full gap-2.5">
        
        {hasData ? (
          /* ==========================================
             A. REAL DOCTOR CARD (With all details visible)
             ========================================== */
          <>
            {/* Top Row: Serial, Doctor Code, and Action Buttons */}
            <div className="flex justify-between items-center gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Serial Counter Badge */}
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 ${getModClass('counter')}`}
                  title={isReadOnly ? 'وضع القراءة فقط' : 'المسلسل (انقر للتعديل)'}
                >
                  <Hash className="w-3 h-3 text-slate-400 select-none" />
                  <span
                    className={`outline-none min-w-[12px] text-center ${isReadOnly ? 'cursor-default select-text' : 'cursor-text'}`}
                    contentEditable={!isReadOnly}
                    suppressContentEditableWarning={true}
                    data-placeholder="م"
                    onBlur={(e) => handleBlur('counter', e)}
                  >
                    {doc.counter || (index % 21) + 1}
                  </span>
                </span>

                {/* Doctor Code Badge (Strictly READ-ONLY Primary Key) */}
                <div
                  className={`inline-flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs select-none ${getModClass('doc_code')}`}
                  title="كود الطبيب (معرّف أساسي محمي - للقراءة فقط)"
                >
                  <span className="text-[10px] text-blue-500 font-sans font-semibold">كود:</span>
                  <span className="font-mono font-bold px-1 text-blue-950 select-text cursor-default">
                    {doc.doc_code || ''}
                  </span>
                </div>

                {/* Universal Modification Indicator Badge */}
                {isManuallyModified && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded bg-[#ffeb3b] text-black border border-yellow-500 shadow-2xs select-none"
                    title="تم إجراء تعديل يدوي على بيانات هذا الطبيب"
                  >
                    <span>✏️ معدل</span>
                  </span>
                )}
              </div>

              {/* Action Buttons Toolbar */}
              {!isReadOnly ? (
                <div className="flex items-center gap-0.5 bg-slate-100/90 p-0.5 rounded-lg border border-slate-200">
                  <button
                    type="button"
                    className="p-1 rounded-md text-slate-700 hover:bg-white hover:text-blue-700 transition-colors cursor-pointer"
                    onClick={() => openMaximizeModal(index)}
                    title="تكبير وتعديل كامل"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    className="p-1 rounded-md text-blue-600 hover:bg-blue-100 hover:text-blue-800 transition-colors cursor-pointer"
                    onClick={() => openMoveModal(index)}
                    title="نقل الطبيب لوجهة أخرى"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    className="p-1 rounded-md text-purple-600 hover:bg-purple-100 hover:text-purple-800 transition-colors cursor-pointer"
                    onClick={() => openCombineModal(index)}
                    title="دمج طبيب آخر مع هذا الطبيب"
                  >
                    <GitMerge className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    className={`p-1 rounded-md transition-colors cursor-pointer ${
                      doc.is_inactive
                        ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                        : 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                    }`}
                    onClick={handleToggleInactive}
                    title={doc.is_inactive ? 'إعادة تفعيل الطبيب' : 'إيقاف مؤقت (إخفاء في الطباعة)'}
                  >
                    {doc.is_inactive ? (
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <UserX className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="p-1 rounded-md text-slate-600 hover:bg-white hover:text-blue-700 bg-slate-100/90 border border-slate-200 transition-colors cursor-pointer shadow-2xs"
                    onClick={() => openMaximizeModal(index)}
                    title="تكبير وعرض التفاصيل (وضع القراءة فقط)"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>

                  {/* UNLOCKED MOVE BUTTON IN READ-ONLY MODE */}
                  <button
                    type="button"
                    className="flex items-center gap-1 px-1.5 py-1 rounded-md text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer shadow-2xs"
                    onClick={() => openMoveModal(index)}
                    title="نقل الطبيب لوجهة أخرى (متاح دائماً حتى أثناء البحث)"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[10px]">نقل</span>
                  </button>

                  <div
                    className="flex items-center gap-1 bg-amber-50 border border-amber-200/90 px-1.5 py-0.5 rounded-md text-[10px] font-bold text-amber-800 select-none shadow-2xs"
                    title="وضع القراءة فقط: مسح الفلاتر والبحث للتمكن من التعديل"
                  >
                    <Lock className="w-3 h-3 text-amber-600" />
                    <span>قراءة فقط</span>
                  </div>
                </div>
              )}
            </div>

            {/* Doctor Name */}
            <div
              ref={nameFieldRef}
              className={`font-bold text-base text-slate-900 leading-snug px-1.5 py-1 rounded transition-colors border border-transparent ${
                isReadOnly ? 'cursor-default select-text' : 'hover:bg-blue-50/50 cursor-text hover:border-blue-200'
              } ${getModClass('name')}`}
              contentEditable={!isReadOnly}
              suppressContentEditableWarning={true}
              data-placeholder="اسم الطبيب..."
              onClick={(e) => {
                if (!isReadOnly) e.currentTarget.focus();
              }}
              onBlur={(e) => handleBlur('name', e)}
              title={isReadOnly ? 'اسم الطبيب (وضع القراءة فقط)' : 'اسم الطبيب (انقر للتعديل)'}
            >
              {cleanDoctorName(doc.name, doc.doc_code) || doc.name || (doc.is_new ? '' : doc.doc_code ? `طبيب (كود: ${doc.doc_code})` : '')}
            </div>

            {/* Specialty & Address */}
            <div className="flex flex-col gap-1 text-right max-w-full">
              {/* Specialty */}
              <div
                className={`inline-flex items-center gap-1.5 text-xs max-w-full transition-colors ${
                  doc.specialty_modified
                    ? `w-fit ${getModClass('specialty')}`
                    : specVal
                    ? `font-semibold text-blue-700 bg-blue-50/80 border border-blue-100 px-2 py-0.5 rounded-md w-fit ${isReadOnly ? 'cursor-default' : 'cursor-text hover:border-blue-300'}`
                    : `text-slate-400 px-1 py-0.5 rounded ${isReadOnly ? 'cursor-default' : 'cursor-text hover:bg-slate-100/60'} w-fit`
                }`}
                title={isReadOnly ? `التخصص: ${specVal || 'غير محدد'}` : `التخصص: ${specVal || 'انقر للتعديل'}`}
              >
                <Stethoscope className={`w-3.5 h-3.5 flex-shrink-0 select-none ${doc.specialty_modified ? 'text-black' : specVal ? 'text-blue-500' : 'text-slate-400 opacity-60'}`} />
                <span
                  contentEditable={!isReadOnly}
                  suppressContentEditableWarning={true}
                  data-placeholder="التخصص..."
                  className={`outline-none min-w-[30px] truncate max-w-[200px] inline-block align-middle ${isReadOnly ? 'cursor-default' : ''}`}
                  onBlur={(e) => handleBlur('specialty', e)}
                >
                  {specVal}
                </span>
              </div>

              {/* Address */}
              <div
                className={`text-xs text-slate-600 px-1 py-0.5 rounded transition-colors flex items-start gap-1 leading-relaxed max-w-full ${
                  isReadOnly ? 'cursor-default select-text' : 'hover:bg-slate-100/70 cursor-text'
                } ${getModClass('address')}`}
                title={isReadOnly ? `العنوان: ${addrVal || 'غير محدد'}` : `العنوان ومقر العيادة: ${addrVal || 'انقر للتعديل'}`}
              >
                <MapPin className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 select-none ${doc.address_modified ? 'text-black' : 'text-slate-400'}`} />
                <span
                  contentEditable={!isReadOnly}
                  suppressContentEditableWarning={true}
                  data-placeholder="العنوان والعيادة..."
                  className={`outline-none min-w-[50px] flex-1 line-clamp-1 truncate ${isReadOnly ? 'cursor-default' : ''}`}
                  onBlur={(e) => handleBlur('address', e)}
                >
                  {addrVal}
                </span>
              </div>

              {/* Moved Notice Badge */}
              {isMoved && (
                <div
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs w-fit italic"
                  title={`طبيب منقول من: ${cleanGeneralText(doc.moved_from) || 'موقع سابق'}`}
                >
                  <ArrowRightLeft className="w-3 h-3 text-amber-700 flex-shrink-0 not-italic select-none" />
                  <span>
                    كان في: <span className="font-semibold not-italic">{cleanGeneralText(doc.moved_from) || 'موقع سابق'}</span>
                  </span>
                </div>
              )}

              {/* Merged Notice Badge */}
              {doc.merged_codes && doc.merged_codes.length > 0 && (
                <div className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 w-fit">
                  + مدمج مع: {doc.merged_codes.join(', ')}
                </div>
              )}
            </div>

            {/* Stats Row (Old & New Cases) */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200/70">
              {/* Old Stats */}
              <div
                className={`flex items-center justify-between px-2 py-1 rounded transition-colors ${
                  doc.old_stats_modified
                    ? `${getModClass('old_stats')}`
                    : 'bg-white border border-amber-200'
                } ${isReadOnly ? 'cursor-default' : 'hover:border-amber-400 cursor-text'}`}
                title={isReadOnly ? 'الحالات السابقة (للقراءة فقط)' : 'الحالات السابقة (انقر للتعديل)'}
              >
                <span className={`text-[11px] font-bold flex items-center gap-1 select-none ${doc.old_stats_modified ? 'text-black' : 'text-amber-700'}`}>
                  <Activity className={`w-3 h-3 ${doc.old_stats_modified ? 'text-black' : 'text-amber-500'}`} />
                  القديم:
                </span>
                <span
                  className={`font-mono font-bold text-xs outline-none min-w-[15px] text-center ${doc.old_stats_modified ? 'text-black' : 'text-slate-800'} ${isReadOnly ? 'cursor-default' : ''}`}
                  contentEditable={!isReadOnly}
                  suppressContentEditableWarning={true}
                  data-placeholder="0"
                  onBlur={(e) => handleBlur('old_stats', e)}
                >
                  {doc.old_stats !== undefined && doc.old_stats !== null ? doc.old_stats : '0'}
                </span>
              </div>

              {/* New Stats */}
              <div
                className={`flex items-center justify-between px-2 py-1 rounded transition-colors ${
                  doc.new_stats_modified
                    ? `${getModClass('new_stats')}`
                    : 'bg-white border border-emerald-200'
                } ${isReadOnly ? 'cursor-default' : 'hover:border-emerald-400 cursor-text'}`}
                title={isReadOnly ? 'الحالات الجديدة (للقراءة فقط)' : 'الحالات الجديدة (انقر للتعديل)'}
              >
                <span className={`text-[11px] font-bold flex items-center gap-1 select-none ${doc.new_stats_modified ? 'text-black' : 'text-emerald-700'}`}>
                  <Sparkles className={`w-3 h-3 ${doc.new_stats_modified ? 'text-black' : 'text-emerald-500'}`} />
                  الجديد:
                </span>
                <span
                  className={`font-mono font-bold text-xs outline-none min-w-[15px] text-center ${doc.new_stats_modified ? 'text-black' : 'text-slate-800'} ${isReadOnly ? 'cursor-default' : ''}`}
                  contentEditable={!isReadOnly}
                  suppressContentEditableWarning={true}
                  data-placeholder="0"
                  onBlur={(e) => handleBlur('new_stats', e)}
                >
                  {doc.new_stats !== undefined && doc.new_stats !== null ? doc.new_stats : '0'}
                </span>
              </div>
            </div>

            {/* Bottom Row: Phone Contacts */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-700 font-medium gap-1">
              <div
                className={`flex items-center gap-1.5 px-1 py-0.5 rounded min-w-0 max-w-[50%] ${
                  isReadOnly ? 'cursor-default select-text' : 'hover:bg-slate-100/60 cursor-text'
                } ${getModClass('mobile')}`}
                title={isReadOnly ? `موبايل: ${mobileVal || 'غير مسجل'}` : `رقم الموبايل: ${mobileVal || 'انقر للتعديل'}`}
              >
                <Smartphone className="w-3.5 h-3.5 text-slate-400 select-none flex-shrink-0" />
                <span
                  contentEditable={!isReadOnly}
                  suppressContentEditableWarning={true}
                  data-placeholder="موبايل..."
                  className={`outline-none min-w-[35px] truncate font-mono ${isReadOnly ? 'cursor-default' : ''}`}
                  onBlur={(e) => handleBlur('mobile', e)}
                >
                  {mobileVal}
                </span>
              </div>

              <div
                className={`flex items-center gap-1.5 px-1 py-0.5 rounded min-w-0 max-w-[50%] justify-end ${
                  isReadOnly ? 'cursor-default select-text' : 'hover:bg-slate-100/60 cursor-text'
                } ${getModClass('home_tel')}`}
                title={isReadOnly ? `أرضي: ${homeTelVal || 'غير مسجل'}` : `رقم الهاتف الأرضي: ${homeTelVal || 'انقر للتعديل'}`}
              >
                <Phone className="w-3.5 h-3.5 text-slate-400 select-none flex-shrink-0" />
                <span
                  contentEditable={!isReadOnly}
                  suppressContentEditableWarning={true}
                  data-placeholder="أرضي..."
                  className={`outline-none min-w-[35px] truncate font-mono text-left ${isReadOnly ? 'cursor-default' : ''}`}
                  onBlur={(e) => handleBlur('home_tel', e)}
                >
                  {homeTelVal}
                </span>
              </div>
            </div>
          </>
        ) : (
          /* ==========================================
             B. EMPTY PADDING SLOT (Quiet & Unobtrusive)
             ========================================== */
          <div
            onClick={() => openMaximizeModal(index)}
            className="flex flex-col items-center justify-center h-full min-h-[140px] text-center p-3 my-auto cursor-pointer group"
            title="انقر لعرض تفاصيل الخانة الشاغرة"
          >
            <span className="text-xs font-bold text-slate-400 mb-2 select-none flex items-center gap-1 group-hover:text-blue-600 transition-colors">
              <Hash className="w-3 h-3" />
              <span>خانة فارغة للطباعة ({doc.counter || (index % 21) + 1})</span>
              <Maximize2 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity mr-1" />
            </span>
            {!isReadOnly ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  addNewDoctorToPage({ pageGvr: doc.pageGvr, pageCity: doc.pageCity, pageRegion: doc.pageRegion });
                }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border border-dashed border-blue-300 text-blue-600 bg-blue-50/60 hover:bg-blue-100 hover:border-blue-400 font-bold text-xs transition-all cursor-pointer shadow-2xs"
                title="إضافة طبيب في هذه الخانة"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة طبيب في هذه الخانة</span>
              </button>
            ) : (
              <span className="text-[11px] font-medium text-slate-400 bg-slate-50 border border-slate-200/80 px-2.5 py-1 rounded-md select-none group-hover:border-amber-300 transition-colors">
                🔒 خانة شاغرة (وضع القراءة فقط)
              </span>
            )}
          </div>
        )}

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
              {doc.new_stats !== undefined && doc.new_stats !== null ? doc.new_stats : ''}
            </div>
            <div className={`box ${getModClass('counter')}`}>
              {doc.counter !== undefined && doc.counter !== null ? doc.counter : ''}
            </div>
          </div>
        </div>

        {/* Doctor Information */}
        <div className="doc-info">
          <div className={`doc-name ${getModClass('name')}`}>
            {cleanDoctorName(doc.name, doc.doc_code) || doc.name || (doc.doc_code ? `طبيب (كود: ${doc.doc_code})` : '')}
          </div>
          <div className={getModClass('specialty')}>
            {specVal}
          </div>
          <div className={getModClass('address')}>
            {addrVal}
          </div>
          {isMoved && (
            <div className="moved-text note-moved">
              كان في: {cleanGeneralText(doc.moved_from) || 'موقع سابق'}
            </div>
          )}
          {doc.merged_codes && doc.merged_codes.length > 0 && (
            <div className="moved-text note-merged">
              + مدمج مع: {doc.merged_codes.join(', ')}
            </div>
          )}
        </div>

        {/* Bottom Contacts */}
        <div className="bottom-row">
          <div className={getModClass('mobile')}>
            {mobileVal}
          </div>
          <div className={getModClass('home_tel')}>
            {homeTelVal}
          </div>
        </div>
      </div>

    </div>
  );
}

export default React.memo(DoctorCard, (prevProps, nextProps) => {
  return (
    prevProps.doc === nextProps.doc &&
    prevProps.index === nextProps.index
  );
});
