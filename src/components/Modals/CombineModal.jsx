import React, { useState, useEffect, useRef } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
import { useCombineDoctorsMutation } from '../../hooks/useDoctorQueries';

export default function CombineModal() {
  const {
    isCombineModalOpen,
    activeModalIndex,
    displayedDoctors,
    closeCombineModal,
    confirmCombine,
  } = useDoctorStore();

  const combineDoctorsMutation = useCombineDoctorsMutation();

  const [inputCode, setInputCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (isCombineModalOpen) {
      setInputCode('');
      setErrorMsg('');
      setTimeout(() => inputRef.current?.focus(), 100);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') closeCombineModal();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isCombineModalOpen, closeCombineModal]);

  if (!isCombineModalOpen || activeModalIndex === -1) return null;

  const currentDoc = displayedDoctors[activeModalIndex];

  const handleConfirm = async () => {
    setErrorMsg('');
    const code = inputCode.trim();
    if (!code) {
      setErrorMsg('برجاء إدخال كود الطبيب!');
      return;
    }

    try {
      // 1. Instant store update
      await confirmCombine(code);

      // 2. Optimistic TanStack Query mutation
      if (currentDoc) {
        combineDoctorsMutation.mutate({
          targetCode: currentDoc.doc_code,
          sourceCode: code,
        });
      }
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div className="modal-overlay" onClick={closeCombineModal}>
      <div
        className="modal-content text-right"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold pb-2 mb-2 border-b-2 border-purple-700 text-purple-700">
          🔗 دمج طبيبين
        </h3>

        <p className="font-bold text-xs text-gray-700 mb-2 leading-relaxed">
          سيتم سحب بيانات الطبيب المختار وجمع إحصائياته مع الطبيب الحالي (
          <span className="text-purple-800 font-extrabold">{currentDoc?.name || currentDoc?.doc_code}</span>
          ) وسيتم تفريغ خليته:
        </p>

        {errorMsg && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded font-bold">
            {errorMsg}
          </div>
        )}

        <label className="block text-xs font-bold text-gray-700 mb-1">
          أدخل كود الطبيب الذي تريد سحبه:
        </label>
        <input
          ref={inputRef}
          type="text"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="اكتب كود الطبيب هنا..."
          className="w-full p-2.5 mb-3 border border-[#ccc] rounded text-base font-bold text-center tracking-wider focus:outline-none focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
        />

        <div className="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={closeCombineModal}
            className="px-4 py-2 bg-[#ccc] text-black font-bold rounded text-sm hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-4 py-2 bg-purple-700 text-white font-bold rounded text-sm hover:bg-purple-800 transition-colors"
          >
            تأكيد الدمج
          </button>
        </div>
      </div>
    </div>
  );
}
