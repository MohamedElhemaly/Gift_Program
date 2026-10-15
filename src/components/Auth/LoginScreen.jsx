import React, { useState } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import { LogIn, ShieldAlert, KeyRound, Mail, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginScreen() {
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const { signIn, signUp, loading, error, clearError } = useAuthStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    setInfoMessage('');

    if (isSignUpMode) {
      const res = await signUp(email, password);
      if (res.success && res.message) {
        setInfoMessage(res.message);
      }
    } else {
      await signIn(email, password);
    }
  };

  const handleQuickDemoLogin = async () => {
    setEmail('admin@giftprogram.com');
    setPassword('admin123456');
    await signIn('admin@giftprogram.com', 'admin123456');
  };

  return (
    <div className="min-h-screen bg-[#f9f9f9] flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md bg-white border border-[#ccc] rounded-lg shadow-md p-6 sm:p-8">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-50 text-[#007bff] mb-3">
            <LogIn className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 border-b-2 border-[#007bff] pb-2 inline-block">
            {isSignUpMode ? 'إنشاء حساب مسؤول جديد' : 'تسجيل دخول لوحة التحكم'}
          </h2>
          <p className="text-gray-500 text-xs mt-2">
            برنامج طباعة داتا الأطباء وتوزيع الإحصائيات (A4 Grid)
          </p>
        </div>

        {/* Supabase Status Banner */}
        <div className={`mb-5 p-3 rounded text-xs flex items-center gap-2 border ${
          isSupabaseConfigured
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
            : 'bg-amber-50 text-amber-800 border-amber-200'
        }`}>
          {isSupabaseConfigured ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>مشروع <strong>Supabase</strong> متصل بنجاح وجاهز.</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>مفاتيح Supabase غير مفعلة (الوضع التجريبي متاح).</span>
            </>
          )}
        </div>

        {/* Info Message */}
        {infoMessage && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-blue-600" />
            <span>{infoMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">البريد الإلكتروني للآدمن:</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full pl-3 pr-9 py-2 border border-[#ccc] rounded text-sm focus:outline-none focus:border-[#007bff] focus:ring-1 focus:ring-[#007bff]"
              />
              <Mail className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">كلمة المرور:</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-3 pr-9 py-2 border border-[#ccc] rounded text-sm focus:outline-none focus:border-[#007bff] focus:ring-1 focus:ring-[#007bff]"
              />
              <KeyRound className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 bg-[#007bff] hover:bg-[#0056b3] text-white font-bold rounded text-sm transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>جاري المعالجة...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>{isSignUpMode ? 'إنشاء الحساب والدخول' : 'تسجيل الدخول'}</span>
              </>
            )}
          </button>
        </form>

        {/* Toggle between Sign In and Sign Up */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUpMode(!isSignUpMode);
              clearError();
              setInfoMessage('');
            }}
            className="text-xs text-gray-700 hover:text-blue-600 font-bold"
          >
            {isSignUpMode
              ? 'لديك حساب بالفعل؟ تسجيل الدخول'
              : 'ليس لديك حساب بعد؟ إنشاء حساب مسؤول جديد'}
          </button>
        </div>

        {/* Demo Fast Login Option */}
        <div className="mt-4 pt-3 border-t border-gray-200 text-center">
          <button
            type="button"
            onClick={handleQuickDemoLogin}
            className="text-xs text-blue-600 hover:text-blue-800 underline font-semibold"
          >
            تسجيل دخول سريع للتجربة (Demo Admin Mode)
          </button>
        </div>

      </div>
    </div>
  );
}
