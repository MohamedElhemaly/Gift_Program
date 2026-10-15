-- ==============================================================================
-- Migration Script: Add Missing Columns & Update Policies in Supabase
-- شغّل هذا الكود في Supabase Dashboard -> SQL Editor لحل مشكلة schema cache فوراً
-- ==============================================================================

-- 1. إضافة الأعمدة الناقصة لجدول الأطباء doctors
ALTER TABLE public.doctors 
ADD COLUMN IF NOT EXISTS is_moved BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS moved_from TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS merged_codes TEXT[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS has_manual_edits BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

-- 2. إضافة عمود updated_at لجدول locations
ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- 3. إضافة عمود metadata لجدول audit_logs
ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 4. فهارس إضافية للبحث السريع
CREATE INDEX IF NOT EXISTS idx_doctors_moved ON public.doctors(is_moved);
CREATE INDEX IF NOT EXISTS idx_doctors_display_order ON public.doctors(display_order);

-- 5. تحديث سياسات الحماية RLS لتسمح بالعمل بكامل الصلاحيات
DROP POLICY IF EXISTS "Allow authenticated read on locations" ON public.locations;
DROP POLICY IF EXISTS "Allow authenticated insert/update/delete on locations" ON public.locations;
DROP POLICY IF EXISTS "Allow authenticated read on doctors" ON public.doctors;
DROP POLICY IF EXISTS "Allow authenticated insert/update/delete on doctors" ON public.doctors;
DROP POLICY IF EXISTS "Allow authenticated read on statistics" ON public.statistics;
DROP POLICY IF EXISTS "Allow authenticated insert/update/delete on statistics" ON public.statistics;
DROP POLICY IF EXISTS "Allow authenticated read on audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow authenticated insert on audit_logs" ON public.audit_logs;

DROP POLICY IF EXISTS "Allow all on locations" ON public.locations;
CREATE POLICY "Allow all on locations" ON public.locations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on doctors" ON public.doctors;
CREATE POLICY "Allow all on doctors" ON public.doctors FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on statistics" ON public.statistics;
CREATE POLICY "Allow all on statistics" ON public.statistics FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on audit_logs" ON public.audit_logs;
CREATE POLICY "Allow all on audit_logs" ON public.audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. إعادة تحميل كاش PostgREST لتحديث Schema Cache فوراً
NOTIFY pgrst, 'reload config';
