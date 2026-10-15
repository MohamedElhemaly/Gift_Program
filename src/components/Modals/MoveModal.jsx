import React, { useState, useMemo, useEffect } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
import { useMoveDoctorMutation } from '../../hooks/useDoctorQueries';

export default function MoveModal() {
  const {
    isMoveModalOpen,
    activeModalIndex,
    displayedDoctors,
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

  // Extract unique locations from current data
  const uniqueLocations = useMemo(() => {
    const locSet = new Set();
    displayedDoctors.forEach((d) => {
      if (d.pageGvr || d.pageCity || d.pageRegion) {
        locSet.add(`${d.pageGvr || ''}::${d.pageCity || ''}::${d.pageRegion || ''}`);
      }
    });
    return Array.from(locSet).sort();
  }, [displayedDoctors]);

  if (!isMoveModalOpen || activeModalIndex === -1) return null;

  const currentDoc = displayedDoctors[activeModalIndex];

  const handleConfirm = () => {
    if (!selectedDest) {
      alert('برجاء اختيار الوجهة!');
      return;
    }

    let g = '', c = '', r = '';
    if (selectedDest === 'NEW') {
      g = newGvr.trim();
      c = newCity.trim();
      r = newRegion.trim();
      if (!g && !c && !r) {
        alert('برجاء إدخال بيانات الوجهة الجديدة!');
        return;
      }
    } else {
      const parts = selectedDest.split('::');
      g = parts[0] || '';
      c = parts[1] || '';
      r = parts[2] || '';
    }

    // 1. Instant store update
    confirmMove({ gvr: g, city: c, region: r });

    // 2. Optimistic TanStack Query mutation
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
    <div className="modal-overlay" onClick={closeMoveModal}>
      <div
        className="modal-content text-right"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-800 border-b-2 border-[#007bff] pb-2 mb-3">
          🔄 نقل الطبيب: {currentDoc?.name || currentDoc?.doc_code}
        </h3>

        <label className="block text-xs font-bold text-gray-700 mb-1">
          اختر الوجهة من القائمة:
        </label>
        <select
          value={selectedDest}
          onChange={(e) => setSelectedDest(e.target.value)}
          className="w-full p-2.5 mb-3 border border-[#ccc] rounded text-sm bg-white"
        >
          <option value="">-- اختر الوجهة --</option>
          {uniqueLocations.map((loc) => {
            const [g, c, r] = loc.split('::');
            return (
              <option key={loc} value={loc}>
                {g || 'بدون محافظة'} - {c || 'بدون مدينة'} - {r || 'بدون منطقة'}
              </option>
            );
          })}
          <option value="NEW" className="text-blue-600 font-bold">
            ➕ إضافة وجهة جديدة...
          </option>
        </select>

        {isNewSelected && (
          <div className="space-y-2 mb-3 bg-gray-50 p-3 rounded border border-gray-200">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                المحافظة الجديدة:
              </label>
              <input
                type="text"
                value={newGvr}
                onChange={(e) => setNewGvr(e.target.value)}
                placeholder="مثال: البحيرة"
                className="w-full p-2 border border-[#ccc] rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                المدينة / المركز الجديد:
              </label>
              <input
                type="text"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                placeholder="مثال: دمنهور"
                className="w-full p-2 border border-[#ccc] rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                المنطقة الجديدة:
              </label>
              <input
                type="text"
                value={newRegion}
                onChange={(e) => setNewRegion(e.target.value)}
                placeholder="مثال: شبرا"
                className="w-full p-2 border border-[#ccc] rounded text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={closeMoveModal}
            className="px-4 py-2 bg-[#ccc] text-black font-bold rounded text-sm hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 bg-[#007bff] text-white font-bold rounded text-sm hover:bg-[#0056b3] transition-colors"
          >
            نقل الآن
          </button>
        </div>
      </div>
    </div>
  );
}
