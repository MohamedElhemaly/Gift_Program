import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  loading: true,
  error: null,
  isDemoMode: false,

  initAuth: async () => {
    set({ loading: true, error: null });

    if (!isSupabaseConfigured || !supabase) {
      // If Supabase keys are not set yet, check localStorage for demo mode
      const savedDemo = localStorage.getItem('gift_program_demo_user');
      if (savedDemo) {
        set({ user: JSON.parse(savedDemo), isDemoMode: true, loading: false });
      } else {
        set({ user: null, loading: false });
      }
      return;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      const savedAuth = localStorage.getItem('gift_program_auth_user');
      const savedDemo = localStorage.getItem('gift_program_demo_user');
      const fallbackUser = savedAuth ? JSON.parse(savedAuth) : (savedDemo ? JSON.parse(savedDemo) : null);

      set({
        session,
        user: session?.user || fallbackUser,
        isDemoMode: Boolean(!session?.user && fallbackUser),
        loading: false,
      });

      // Listen for auth state changes
      supabase.auth.onAuthStateChange((_event, currentSession) => {
        set({
          session: currentSession,
          user: currentSession?.user || get().user,
          loading: false,
        });
      });
    } catch (err) {
      console.error('Auth initialization error:', err);
      set({ error: err.message, loading: false });
    }
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });

    if (!isSupabaseConfigured || !supabase) {
      // Demo / offline login fallback
      if (email && password) {
        const demoUser = {
          id: 'demo-admin-id',
          email,
          user_metadata: { role: 'admin', full_name: 'مدير النظام (تجريبي)' },
        };
        localStorage.setItem('gift_program_demo_user', JSON.stringify(demoUser));
        set({ user: demoUser, isDemoMode: true, loading: false });
        return { success: true };
      }
      set({ error: 'برجاء إدخال البريد الإلكتروني وكلمة المرور', loading: false });
      return { success: false, error: 'برجاء إدخال البريد الإلكتروني وكلمة المرور' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        localStorage.setItem('gift_program_auth_user', JSON.stringify(data.user));
      }

      set({
        user: data.user,
        session: data.session,
        loading: false,
        isDemoMode: false,
      });
      return { success: true };
    } catch (err) {
      const msg = err.message === 'Invalid login credentials' 
        ? 'بيانات تسجيل الدخول غير صحيحة (تأكد من البريد وكلمة المرور)' 
        : err.message;
      set({ error: msg, loading: false });
      return { success: false, error: msg };
    }
  },

  signUp: async (email, password) => {
    set({ loading: true, error: null });

    if (!isSupabaseConfigured || !supabase) {
      return get().signIn(email, password);
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (data.session) {
        if (data.user) {
          localStorage.setItem('gift_program_auth_user', JSON.stringify(data.user));
        }
        set({
          user: data.user,
          session: data.session,
          loading: false,
          isDemoMode: false,
        });
        return { success: true };
      } else {
        set({ loading: false });
        return {
          success: true,
          requireEmailConfirmation: true,
          message: 'تم إنشاء الحساب بنجاح! إذا كان خيار Confirm Email مفعلاً في Supabase، يرجى تأكيده أو تسجيل الدخول الآن.',
        };
      }
    } catch (err) {
      set({ error: err.message, loading: false });
      return { success: false, error: err.message };
    }
  },

  signOut: async () => {
    set({ loading: true });
    localStorage.removeItem('gift_program_auth_user');
    localStorage.removeItem('gift_program_demo_user');

    if (get().isDemoMode || !supabase) {
      set({ user: null, session: null, isDemoMode: false, loading: false });
      return;
    }

    try {
      await supabase.auth.signOut();
      set({ user: null, session: null, isDemoMode: false, loading: false });
    } catch (err) {
      console.error('SignOut error:', err);
      set({ user: null, session: null, isDemoMode: false, error: err.message, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
