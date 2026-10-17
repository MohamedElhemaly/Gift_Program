import React, { useState, useMemo, useEffect } from 'react';
import {
  Combobox,
  ComboboxInput,
  ComboboxButton,
  ComboboxOptions,
  ComboboxOption,
} from '@headlessui/react';
import { useDoctorStore, normalizeArabicText } from '../../store/useDoctorStore';
import { useMoveDoctorMutation } from '../../hooks/useDoctorQueries';
import { cleanDoctorName, cleanGeneralText } from '../../services/doctorService';
import {
  ArrowRightLeft,
  X,
  MapPin,
  MapPinned,
  Building2,
  Navigation,
  PlusCircle,
  Hash,
  Search,
  Check,
  ChevronsUpDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function MoveModal() {
  const {
    isMoveModalOpen,
    activeModalIndex,
    displayedDoctors,
    rawDoctors,
    locations,
    closeMoveModal,
    confirmMove,
  } = useDoctorStore();

  const moveDoctorMutation = useMoveDoctorMutation();

  const [selectedLocation, setSelectedLocation] = useState(null);
  const [query, setQuery] = useState('');

  const [newGvr, setNewGvr] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newRegion, setNewRegion] = useState('');

  // Reset modal state on open or when active doctor changes
  useEffect(() => {
    if (isMoveModalOpen) {
      setSelectedLocation(null);
      setQuery('');
      setNewGvr('');
      setNewCity('');
      setNewRegion('');
    }
  }, [isMoveModalOpen, activeModalIndex]);

  // Global Escape key handler
  useEffect(() => {
    if (!isMoveModalOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeMoveModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMoveModalOpen, closeMoveModal]);

  // Extract ALL unique locations from rawDoctors, locations table, and displayedDoctors
  const locationList = useMemo(() => {
    const locSet = new Set();

    const addLoc = (g, c, r) => {
      const gClean = (g || '').trim();
      const cClean = (c || '').trim();
      const rClean = (r || '').trim();
      if (gClean || cClean || rClean) {
        locSet.add(`${gClean}::${cClean}::${rClean}`);
      }
    };

    if (Array.isArray(rawDoctors)) {
      rawDoctors.forEach((d) =>
        addLoc(
          d.pageGvr || d.gvr || d.location?.governorate,
          d.pageCity || d.city || d.location?.city,
          d.pageRegion || d.region || d.location?.region
        )
      );
    }

    if (Array.isArray(locations)) {
      locations.forEach((loc) =>
        addLoc(loc.governorate || loc.gvr, loc.city, loc.region)
      );
    }

    if (Array.isArray(displayedDoctors)) {
      displayedDoctors.forEach((d) =>
        addLoc(
          d.pageGvr || d.gvr || d.location?.governorate,
          d.pageCity || d.city || d.location?.city,
          d.pageRegion || d.region || d.location?.region
        )
      );
    }

    const sortedRaw = Array.from(locSet).sort((a, b) => a.localeCompare(b, 'ar'));

    return sortedRaw.map((loc) => {
      const [g, c, r] = loc.split('::');
      const parts = [g, c, r].filter(Boolean);
      return {
        value: loc,
        gvr: g || 'غير محدد',
        city: c || '',
        region: r || '',
        label: parts.join(' - ') || 'بدون تحديد',
        isNew: false,
      };
    });
  }, [rawDoctors, locations, displayedDoctors]);

  // Filtered locations with instant Arabic normalization
  const filteredLocations = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return locationList;

    const normQuery = normalizeArabicText(trimmed);
    return locationList.filter((loc) => {
      const normLabel = normalizeArabicText(loc.label);
      const normGvr = normalizeArabicText(loc.gvr);
      const normCity = normalizeArabicText(loc.city);
      const normReg = normalizeArabicText(loc.region);
      return (
        normLabel.includes(normQuery) ||
        normGvr.includes(normQuery) ||
        normCity.includes(normQuery) ||
        normReg.includes(normQuery)
      );
    });
  }, [locationList, query]);

  if (!isMoveModalOpen || activeModalIndex === -1) return null;

  const currentDoc = displayedDoctors[activeModalIndex];
  if (!currentDoc) return null;

  const currentLocParts = [currentDoc.pageGvr, currentDoc.pageCity, currentDoc.pageRegion]
    .map((s) => cleanGeneralText(s))
    .filter(Boolean);
  const currentLocLabel = currentLocParts.length > 0 ? currentLocParts.join(' - ') : 'بدون موقع محدد';

  const isNewSelected = selectedLocation?.isNew || selectedLocation?.value === 'NEW';

  const handleClear = () => {
    setSelectedLocation(null);
    setQuery('');
    setNewGvr('');
    setNewCity('');
    setNewRegion('');
  };

  const handleConfirm = () => {
    if (!selectedLocation) {
      toast.error('يرجى اختيار الوجهة الجديدة!');
      return;
    }

    let g = '', c = '', r = '';
    if (isNewSelected) {
      g = newGvr.trim();
      c = newCity.trim();
      r = newRegion.trim();
      if (!g && !c && !r) {
        toast.error('يرجى إدخال بيانات الوجهة الجديدة على الأقل المحافظة أو المدينة!');
        return;
      }
    } else {
      const parts = (selectedLocation.value || '').split('::');
      g = parts[0] || '';
      c = parts[1] || '';
      r = parts[2] || '';
    }

    // 1. Instant store update with yellow highlight & moved status
    confirmMove({ gvr: g, city: c, region: r });

    // 2. Optimistic TanStack Query mutation for Supabase persistence
    if (currentDoc && (currentDoc.id || currentDoc.doc_code)) {
      moveDoctorMutation.mutate({
        doctor: currentDoc,
        newGvr: g,
        newCity: c,
        newRegion: r,
      });
    }
  };

  const isConfirmDisabled =
    !selectedLocation ||
    (isNewSelected && !newGvr.trim() && !newCity.trim() && !newRegion.trim());

  return (
    <div
      className="modal-overlay animate-fadeIn p-4 overflow-y-auto"
      onClick={closeMoveModal}
    >
      <div
        className="modal-content w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-7 text-right my-auto relative"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-100 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 shadow-2xs">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 leading-snug">
                نقل الطبيب لوجهة جديدة
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {cleanDoctorName(currentDoc.name) || currentDoc.name || 'طبيب بدون اسم'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeMoveModal}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Doctor Info & Current Location */}
        <div className="my-4 p-3.5 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-blue-600" />
              <span>كود الطبيب:</span>
              <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 shadow-2xs">
                {cleanGeneralText(currentDoc.doc_code) || 'غير محدد'}
              </span>
            </span>
            {currentDoc.specialty && (
              <span className="text-[11px] font-semibold text-slate-500 truncate max-w-[150px]">
                {cleanGeneralText(currentDoc.specialty)}
              </span>
            )}
          </div>

          <div className="text-xs text-slate-700 flex items-center gap-1.5 pt-1 border-t border-slate-200/80">
            <MapPinned className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="font-bold text-slate-600">الموقع الحالي:</span>
            <span className="font-semibold text-slate-900 truncate">{currentLocLabel}</span>
          </div>
        </div>

        {/* =========================================================================
            HEADLESS UI COMBOBOX (Native Focus Trapping, No Blur Conflict, Smooth RTL)
            ========================================================================= */}
        <div className="space-y-2 mb-4 relative">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>اختر الوجهة المستهدفة:</span>
            </label>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full shadow-2xs">
              {locationList.length} موقع مسجل
            </span>
          </div>

          <Combobox
            value={selectedLocation}
            onChange={(val) => {
              setSelectedLocation(val);
              if (val?.isNew && val.presetRegion) {
                setNewRegion(val.presetRegion);
              }
            }}
            onClose={() => setQuery('')}
            immediate
          >
            <div className="relative">
              <ComboboxInput
                className={`w-full pr-10 pl-16 py-3 bg-white border ${
                  selectedLocation && !isNewSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/15 font-bold text-blue-950 bg-blue-50/20'
                    : isNewSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/15 font-bold text-indigo-950 bg-indigo-50/20'
                    : 'border-slate-300 hover:border-blue-400 focus:border-blue-500 text-slate-800'
                } rounded-2xl text-xs sm:text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all shadow-2xs`}
                displayValue={(loc) => loc?.label || ''}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث بالاسم أو اختر الوجهة... (مثال: سموحة، دمنهور)"
                dir="rtl"
                autoComplete="off"
              />

              {/* Leading Icon (Right in RTL) */}
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                {selectedLocation ? (
                  <MapPin className="w-4 h-4 text-blue-600" />
                ) : (
                  <Search className="w-4 h-4 text-slate-400" />
                )}
              </div>

              {/* Trailing Action Buttons (Left in RTL) */}
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 z-10">
                {(query || selectedLocation) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClear();
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="مسح التحديد والبحث"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <ComboboxButton
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="عرض خيارات الوجهات"
                >
                  <ChevronsUpDown className="w-4 h-4" />
                </ComboboxButton>
              </div>
            </div>

            <ComboboxOptions
              anchor={{ to: 'bottom start', gap: 6 }}
              className="w-[var(--input-width)] max-h-64 rounded-2xl bg-white shadow-2xl border border-slate-200 z-[9999] overflow-y-auto divide-y divide-slate-100 p-1 outline-none text-right"
              dir="rtl"
            >
              {/* Header Status in Dropdown */}
              <div className="p-2 px-3 border-b border-slate-100 bg-slate-50/90 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                <span>
                  {query.trim()
                    ? `نتائج البحث: ${filteredLocations.length} من أصل ${locationList.length}`
                    : `كل الوجهات المسجلة (${locationList.length})`}
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setSelectedLocation({
                      value: 'NEW',
                      label: query.trim() ? `➕ وجهة جديدة: "${query.trim()}"` : '➕ وجهة جديدة غير مسجلة',
                      isNew: true,
                      presetRegion: query.trim(),
                    });
                    if (query.trim()) setNewRegion(query.trim());
                  }}
                  className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer flex items-center gap-1"
                >
                  <PlusCircle className="w-3 h-3" />
                  <span>وجهة جديدة</span>
                </button>
              </div>

              {/* Dynamic Option for Custom Location if query typed */}
              {query.trim() && (
                <ComboboxOption
                  value={{
                    value: 'NEW',
                    label: `➕ وجهة جديدة: "${query.trim()}"`,
                    isNew: true,
                    presetRegion: query.trim(),
                  }}
                  className="p-2.5 px-3 rounded-xl cursor-pointer data-[focus]:bg-blue-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                      <PlusCircle className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-blue-900 block">
                        ➕ استخدام "{query.trim()}" كوجهة جديدة...
                      </span>
                      <span className="text-[10px] text-blue-600">كتابة المحافظة والمدينة والحي يدوياً</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    يدوي
                  </span>
                </ComboboxOption>
              )}

              {/* Filtered Database Locations */}
              {filteredLocations.map((loc) => {
                const isCurrent = currentLocLabel === loc.label;
                return (
                  <ComboboxOption
                    key={loc.value}
                    value={loc}
                    className="p-2.5 px-3 rounded-xl cursor-pointer data-[focus]:bg-slate-100 data-[selected]:bg-blue-50 transition-colors flex items-center justify-between group"
                  >
                    {({ selected, focus }) => (
                      <>
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <MapPin
                            className={`w-3.5 h-3.5 flex-shrink-0 ${
                              selected
                                ? 'text-blue-600'
                                : focus
                                ? 'text-blue-500'
                                : 'text-slate-400'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap text-xs">
                              <span className="font-extrabold text-slate-900 bg-slate-100 group-data-[focus]:bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                {loc.gvr}
                              </span>
                              {loc.city && (
                                <>
                                  <span className="text-slate-300 font-bold">›</span>
                                  <span className="font-bold text-slate-800">{loc.city}</span>
                                </>
                              )}
                              {loc.region && (
                                <>
                                  <span className="text-slate-300 font-bold">›</span>
                                  <span className="text-slate-600">{loc.region}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0 mr-2">
                          {isCurrent && (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded">
                              الموقع الحالي
                            </span>
                          )}
                          {selected && (
                            <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </ComboboxOption>
                );
              })}

              {/* Empty Search Fallback */}
              {filteredLocations.length === 0 && (
                <div className="p-5 text-center text-slate-500">
                  <p className="text-xs font-bold text-slate-700 mb-1">
                    لا توجد مواقع مطابقة للبحث "{query}"
                  </p>
                  <p className="text-[11px] text-slate-400 mb-3">
                    يمكنك تسجيل هذا الموقع كوجهة جديدة وتحديد بياناته
                  </p>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedLocation({
                        value: 'NEW',
                        label: `➕ وجهة جديدة: "${query.trim()}"`,
                        isNew: true,
                        presetRegion: query.trim(),
                      });
                      setNewRegion(query.trim());
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>إضافة "{query}" كوجهة جديدة</span>
                  </button>
                </div>
              )}
            </ComboboxOptions>
          </Combobox>
        </div>

        {/* Custom New Location Input Fields */}
        {isNewSelected && (
          <div className="space-y-3 mb-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-200 animate-fadeIn">
            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5 mb-2">
              <PlusCircle className="w-4 h-4 text-blue-600" />
              <span>إدخال بيانات الموقع الجديد يدوياً:</span>
            </span>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-slate-500" />
                <span>المحافظة:</span>
              </label>
              <input
                type="text"
                value={newGvr}
                onChange={(e) => setNewGvr(e.target.value)}
                placeholder="مثال: البحيرة"
                className="w-full p-2 px-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Navigation className="w-3 h-3 text-slate-500" />
                <span>المدينة / المركز:</span>
              </label>
              <input
                type="text"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                placeholder="مثال: دمنهور"
                className="w-full p-2 px-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-500" />
                <span>المنطقة / الشارع:</span>
              </label>
              <input
                type="text"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                placeholder="مثال: شبرا"
                className="w-full p-2 px-3 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}

        {/* Transfer Route Preview */}
        {selectedLocation && (
          <div className="mb-4 p-3 bg-gradient-to-r from-slate-50 via-blue-50/50 to-indigo-50/50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-2xs animate-fadeIn">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-slate-400 block mb-0.5">من الموقع الحالي:</span>
              <span className="font-bold text-slate-700 truncate block">{currentLocLabel}</span>
            </div>
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white text-blue-600 border border-blue-200 shadow-2xs flex-shrink-0">
              <ArrowRightLeft className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <span className="text-[10px] font-bold text-blue-600 block mb-0.5 text-right">إلى الوجهة المستهدفة:</span>
              <span className="font-extrabold text-blue-900 truncate block text-right">
                {isNewSelected
                  ? [newGvr, newCity, newRegion].filter(Boolean).join(' - ') || 'وجهة جديدة مخصصة'
                  : selectedLocation.label}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={closeMoveModal}
            className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={isConfirmDisabled}
            onClick={handleConfirm}
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-blue-600 disabled:hover:to-indigo-600 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>نقل الطبيب الآن</span>
          </button>
        </div>
      </div>
    </div>
  );
}
