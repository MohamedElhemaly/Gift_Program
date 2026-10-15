import React, { useEffect, useState } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { useDoctorStore } from './store/useDoctorStore';
import { doctorService } from './services/doctorService';
import { isSupabaseConfigured } from './lib/supabase';
import { handleExportPDF } from './utils/printHelper';

import LoginScreen from './components/Auth/LoginScreen';
import ControlPanel from './components/Controls/ControlPanel';
import ReportView from './components/Grid/ReportView';
import MoveModal from './components/Modals/MoveModal';
import CombineModal from './components/Modals/CombineModal';
import DoctorDetailModal from './components/Modals/DoctorDetailModal';

import { LogOut, User, Database } from 'lucide-react';

export default function App() {
  const { user, loading: authLoading, initAuth, signOut, isDemoMode } = useAuthStore();
  const {
    displayedDoctors,
    loadFromDB,
    loading: docsLoading,
    setStatus,
    maximizedDoctorIndex,
    closeMaximizeModal,
  } = useDoctorStore();

  const [selectedPages, setSelectedPages] = useState(null);

  // Initialize Auth on mount
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  // Load doctors once authenticated
  useEffect(() => {
    if (user) {
      loadFromDB();
    }
  }, [user, loadFromDB]);

  // Set up real-time sync with Supabase
  useEffect(() => {
    if (user && isSupabaseConfigured && !isDemoMode) {
      const unsubscribe = doctorService.subscribeToChanges(({ table, payload }) => {
        console.log(`Real-time update on ${table}:`, payload);
        setStatus('تم استلام تحديث جديد من السيرفر...');
        loadFromDB();
      });
      return () => {
        unsubscribe();
      };
    }
  }, [user, isDemoMode, loadFromDB, setStatus]);

  const totalPages = Math.ceil(displayedDoctors.length / 21);

  const handlePrintRequest = (rangeStr) => {
    handleExportPDF(rangeStr, totalPages, setSelectedPages);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f9f9f9]" dir="rtl">
        <div className="text-center p-6 bg-white border border-[#ccc] rounded shadow-sm">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#007bff] mx-auto mb-3"></div>
          <p className="text-gray-700 font-bold">جاري تحميل النظام والمصادقة...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#333]" dir="rtl">
      {/* Top Navigation Bar (Hidden on Print) */}
      <nav className="no-print bg-white border-b border-[#ddd] px-6 py-2.5 flex items-center justify-between shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow">
            طب
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-800 leading-tight">
              برنامج طباعة داتا الأطباء
            </h1>
            <p className="text-[11px] text-gray-500">
              النسخة السحابية الشاملة (A4 Print Grid & Real-time Supabase)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {/* Supabase Status Indicator */}
          <div
            className={`px-2.5 py-1 rounded-full flex items-center gap-1.5 font-medium ${
              isSupabaseConfigured && !isDemoMode
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-700 border border-amber-200'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>{isSupabaseConfigured && !isDemoMode ? 'Supabase متصل' : 'الوضع التجريبي'}</span>
          </div>

          {/* User Email */}
          <div className="flex items-center gap-1.5 text-gray-700 font-semibold bg-gray-100 px-3 py-1 rounded">
            <User className="w-3.5 h-3.5 text-gray-500" />
            <span>{user.email || 'المدير'}</span>
          </div>

          {/* Sign Out */}
          <button
            onClick={() => signOut()}
            className="flex items-center gap-1 text-red-600 hover:text-red-800 font-bold px-2 py-1 hover:bg-red-50 rounded transition-colors"
            title="تسجيل الخروج"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-[1300px] mx-auto p-4 sm:p-6">
        {/* Control Panel (Hidden on Print) */}
        <ControlPanel onPrint={handlePrintRequest} />

        {/* Loading Indicator */}
        {docsLoading && (
          <div className="no-print my-6 p-4 text-center bg-white border border-[#ccc] rounded">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#007bff] mx-auto mb-2"></div>
            <p className="text-sm font-bold text-gray-700">جاري تحميل داتا الأطباء...</p>
          </div>
        )}

        {/* 21-item A4 Grid Report View */}
        <ReportView selectedPages={selectedPages} />

        {/* Modals for Move, Combine, and Maximize */}
        <MoveModal />
        <CombineModal />
        <DoctorDetailModal
          isOpen={maximizedDoctorIndex !== -1}
          index={maximizedDoctorIndex}
          onClose={closeMaximizeModal}
        />
      </main>
    </div>
  );
}
