import React, { useState, useEffect } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';

export default function BlankPageModal({ isOpen, onClose }) {
  const { addBlankPage } = useDoctorStore();

  const [gvr, setGvr] = useState('صفحة إضافية');
  const [city, setCity] = useState('مدينة إضافية');
  const [region, setRegion] = useState('فارغة');

  if (!isOpen) return null;

  const handleConfirm = () => {
    addBlankPage(gvr || 'صفحة إضافية', city || 'مدينة إضافية', region || 'فارغة');
    onClose();
  };

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Enter') handleConfirm();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gvr, city, region, onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content text-right"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-gray-800 border-b-2 border-[#17a2b8] pb-2 mb-3">
          ➕ إضافة صفحة فارغة جديدة (21 خانة A4)
        </h3>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              اسم المحافظة:
            </label>
            <input
              type="text"
              value={gvr}
              onChange={(e) => setGvr(e.target.value)}
              placeholder="مثال: الإسكندرية"
              className="w-full p-2 border border-[#ccc] rounded text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              اسم المدينة / المركز:
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="مثال: وسط"
              className="w-full p-2 border border-[#ccc] rounded text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              اسم المنطقة:
            </label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="مثال: محطة الرمل"
              className="w-full p-2 border border-[#ccc] rounded text-sm"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#ccc] text-black font-bold rounded text-sm hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 bg-[#17a2b8] text-white font-bold rounded text-sm hover:bg-[#117a8b] transition-colors"
          >
            ➕ إنشاء الصفحة
          </button>
        </div>
      </div>
    </div>
  );
}
