import React, { useState, useMemo, useEffect } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
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

  const [selectedDest, setSelectedDest] = useState('');
  const [newGvr, setNewGvr] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newRegion, setNewRegion] = useState('');

  useEffect(() => {
    if (isMoveModalOpen) {
      setSelectedDest('');
      setNewGvr('');
      setNewCity('');
      setNewRegion('');

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') closeMoveModal();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isMoveModalOpen, closeMoveModal]);

  // Extract ALL unique locations from the database (rawDoctors, locations table, and displayedDoctors)
  const uniqueLocations = useMemo(() => {
    const locSet = new Set();

    if (Array.isArray(rawDoctors)) {
      rawDoctors.forEach((d) => {
        const g = (d.pageGvr || d.gvr || '').trim();
        const c = (d.pageCity || d.city || '').trim();
        const r = (d.pageRegion || d.region || '').trim();
        if (g || c || r) {
          locSet.add(`${g}::${c}::${r}`);
        }
      });
    }

    if (Array.isArray(locations)) {
      locations.forEach((loc) => {
        const g = (loc.governorate || '').trim();
        const c = (loc.city || '').trim();
        const r = (loc.region || '').trim();
        if (g || c || r) {
          locSet.add(`${g}::${c}::${r}`);
        }
      });
    }

    if (Array.isArray(displayedDoctors)) {
      displayedDoctors.forEach((d) => {
        const g = (d.pageGvr || d.gvr || '').trim();
        const c = (d.pageCity || d.city || '').trim();
        const r = (d.pageRegion || d.region || '').trim();
        if (g || c || r) {
          locSet.add(`${g}::${c}::${r}`);
        }
      });
    }

    return Array.from(locSet).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [rawDoctors, locations, displayedDoctors]);

  if (!isMoveModalOpen || activeModalIndex === -1) return null;

  const currentDoc = displayedDoctors[activeModalIndex];
  if (!currentDoc) return null;

  const currentLocParts = [currentDoc.pageGvr, currentDoc.pageCity, currentDoc.pageRegion]
    .map((s) => cleanGeneralText(s))
    .filter(Boolean);
  const currentLocLabel = currentLocParts.length > 0 ? currentLocParts.join(' - ') : 'بدون موقع محدد';

  const handleConfirm = () => {
    if (!selectedDest) {
      toast.error('يرجى اختيار الوجهة الجديدة!');
      return;
    }

    let g = '', c = '', r = '';
    if (selectedDest === 'NEW') {
      g = newGvr.trim();
      c = newCity.trim();
      r = newRegion.trim();
      if (!g && !c && !r) {
        toast.error('يرجى إدخال بيانات الوجهة الجديدة على الأقل المحافظة أو المدينة!');
        return;
      }
    } else {
      const parts = selectedDest.split('::');
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

  const isNewSelected = selectedDest === 'NEW';

  return (
    <div className="modal-overlay animate-fadeIn" onClick={closeMoveModal}>
      <div
        className="modal-content w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 sm:p-7 text-right"
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
        <div className="my-4 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-600 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-blue-600" />
              <span>كود الطبيب:</span>
              <span className="font-mono font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {cleanGeneralText(currentDoc.doc_code) || 'غير محدد'}
              </span>
            </span>
          </div>

          <div className="text-xs text-slate-700 flex items-center gap-1.5 pt-1 border-t border-slate-200/80">
            <MapPinned className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
            <span className="font-bold text-slate-600">الموقع الحالي:</span>
            <span className="font-semibold text-slate-900 truncate">{currentLocLabel}</span>
          </div>
        </div>

        {/* Location Selection Dropdown */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>اختر الوجهة من قاعدة البيانات:</span>
            </label>
            <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              {uniqueLocations.length} موقع متاح
            </span>
          </div>

          <select
            value={selectedDest}
            onChange={(e) => setSelectedDest(e.target.value)}
            className="w-full p-2.5 px-3 bg-white hover:bg-slate-50 focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
          >
            <option value="">-- اختر الوجهة من القائمة الكاملة --</option>
            {uniqueLocations.map((loc) => {
              const [g, c, r] = loc.split('::');
              const label = [g, c, r].filter(Boolean).join(' - ') || 'بدون تحديد';
              return (
                <option key={loc} value={loc}>
                  {label}
                </option>
              );
            })}
            <option value="NEW" className="text-blue-600 font-bold bg-blue-50">
              ➕ إضافة وجهة جديدة غير مسجلة...
            </option>
          </select>
        </div>

        {/* Custom New Location Inputs */}
        {isNewSelected && (
          <div className="space-y-3 mb-5 p-4 bg-blue-50/50 rounded-2xl border border-blue-200 animate-fadeIn">
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
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>نقل الطبيب الآن</span>
          </button>
        </div>
      </div>
    </div>
  );
}
