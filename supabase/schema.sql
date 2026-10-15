-- ==============================================================================
-- 1. EXTENSIONS & SCHEMAS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. TABLES DEFINITION
-- ==============================================================================

-- 2.1 LOCATIONS (المحافظة - المدينة/المركز - المنطقة)
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    governorate TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    region TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_locations_gov_city_region UNIQUE (governorate, city, region)
);

-- Index for fast grouping and lookup
CREATE INDEX IF NOT EXISTS idx_locations_hierarchy ON public.locations(governorate, city, region);

-- 2.2 DOCTORS (بيانات الأطباء)
CREATE TABLE IF NOT EXISTS public.doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    specialty TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    mobile TEXT NOT NULL DEFAULT '',
    home_tel TEXT NOT NULL DEFAULT '',
    is_inactive BOOLEAN NOT NULL DEFAULT false,
    is_moved BOOLEAN NOT NULL DEFAULT false,
    moved_from TEXT NOT NULL DEFAULT '',
    merged_codes TEXT[] NOT NULL DEFAULT '{}'::text[],
    has_manual_edits BOOLEAN NOT NULL DEFAULT false,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_doctors_code ON public.doctors(doc_code);
CREATE INDEX IF NOT EXISTS idx_doctors_location ON public.doctors(location_id);
CREATE INDEX IF NOT EXISTS idx_doctors_inactive ON public.doctors(is_inactive);

-- 2.3 STATISTICS (إحصائيات الحالات: قديم وجديد)
CREATE TABLE IF NOT EXISTS public.statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE UNIQUE,
    old_stats INTEGER NOT NULL DEFAULT 0,
    new_stats INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_statistics_doctor_id ON public.statistics(doctor_id);

-- 2.4 AUDIT LOGS (سجل العمليات للتتبع والمراجعة)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL, -- 'MOVE', 'COMBINE', 'INLINE_EDIT', 'TOGGLE_INACTIVE', 'IMPORT_EXCEL', 'UPDATE_STATS'
    description TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ==============================================================================
-- 3. TRIGGERS FOR AUTO-UPDATING updated_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_locations_updated_at ON public.locations;
CREATE TRIGGER trg_locations_updated_at
BEFORE UPDATE ON public.locations
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

DROP TRIGGER IF EXISTS trg_doctors_updated_at ON public.doctors;
CREATE TRIGGER trg_doctors_updated_at
BEFORE UPDATE ON public.doctors
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- Migration: Add missing columns if tables already exist
ALTER TABLE public.doctors 
ADD COLUMN IF NOT EXISTS is_moved BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS moved_from TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS merged_codes TEXT[] NOT NULL DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS has_manual_edits BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.locations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_doctors_moved ON public.doctors(is_moved);
CREATE INDEX IF NOT EXISTS idx_doctors_display_order ON public.doctors(display_order);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- ==============================================================================
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop previous restrictive policies if they exist
DROP POLICY IF EXISTS "Allow authenticated read on locations" ON public.locations;
DROP POLICY IF EXISTS "Allow authenticated insert/update/delete on locations" ON public.locations;
DROP POLICY IF EXISTS "Allow authenticated read on doctors" ON public.doctors;
DROP POLICY IF EXISTS "Allow authenticated insert/update/delete on doctors" ON public.doctors;
DROP POLICY IF EXISTS "Allow authenticated read on statistics" ON public.statistics;
DROP POLICY IF EXISTS "Allow authenticated insert/update/delete on statistics" ON public.statistics;
DROP POLICY IF EXISTS "Allow authenticated read on audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow authenticated insert on audit_logs" ON public.audit_logs;

-- Policies for Authenticated & Anon Users
DROP POLICY IF EXISTS "Allow all on locations" ON public.locations;
CREATE POLICY "Allow all on locations" ON public.locations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on doctors" ON public.doctors;
CREATE POLICY "Allow all on doctors" ON public.doctors FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on statistics" ON public.statistics;
CREATE POLICY "Allow all on statistics" ON public.statistics FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on audit_logs" ON public.audit_logs;
CREATE POLICY "Allow all on audit_logs" ON public.audit_logs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 5. REAL-TIME REPLICATION
-- ==============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'doctors'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.doctors;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'statistics'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.statistics;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'locations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
    END IF;
END $$;

-- ==============================================================================
-- 6. STORED PROCEDURES / HELPER RPC FUNCTIONS
-- ==============================================================================

-- 6.1 RPC: Atomic Merge/Combine Doctor
CREATE OR REPLACE FUNCTION public.combine_doctors(
    p_target_code TEXT,
    p_source_code TEXT,
    p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_target RECORD;
    v_source RECORD;
    v_target_stats RECORD;
    v_source_stats RECORD;
    v_new_old_stats INT;
    v_new_new_stats INT;
    v_merged_arr TEXT[];
BEGIN
    -- Check target doctor
    SELECT * INTO v_target FROM public.doctors WHERE doc_code = p_target_code;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطبيب المستهدف غير موجود');
    END IF;

    -- Check source doctor
    SELECT * INTO v_source FROM public.doctors WHERE doc_code = p_source_code;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'الطبيب المراد دمجه غير موجود');
    END IF;

    IF v_target.id = v_source.id THEN
        RETURN jsonb_build_object('success', false, 'message', 'لا يمكن دمج الطبيب مع نفسه');
    END IF;

    -- Fetch stats
    SELECT * INTO v_target_stats FROM public.statistics WHERE doctor_id = v_target.id;
    SELECT * INTO v_source_stats FROM public.statistics WHERE doctor_id = v_source.id;

    v_new_old_stats := COALESCE(v_target_stats.old_stats, 0) + COALESCE(v_source_stats.old_stats, 0);
    v_new_new_stats := COALESCE(v_target_stats.new_stats, 0) + COALESCE(v_source_stats.new_stats, 0);

    -- Prepare merged codes array
    v_merged_arr := COALESCE(v_target.merged_codes, '{}'::text[]);
    IF NOT (p_source_code = ANY(v_merged_arr)) THEN
        v_merged_arr := array_append(v_merged_arr, p_source_code);
    END IF;
    IF v_source.merged_codes IS NOT NULL AND array_length(v_source.merged_codes, 1) > 0 THEN
        v_merged_arr := array_cat(v_merged_arr, v_source.merged_codes);
    END IF;

    -- Update target doctor & statistics
    UPDATE public.doctors
    SET merged_codes = v_merged_arr,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_target.id;

    INSERT INTO public.statistics (doctor_id, old_stats, new_stats, last_updated)
    VALUES (v_target.id, v_new_old_stats, v_new_new_stats, timezone('utc'::text, now()))
    ON CONFLICT (doctor_id) DO UPDATE
    SET old_stats = EXCLUDED.old_stats,
        new_stats = EXCLUDED.new_stats,
        last_updated = EXCLUDED.last_updated;

    -- Clear source doctor (leave empty cell / reset data as per original business logic)
    UPDATE public.doctors
    SET name = '',
        specialty = '',
        address = '',
        mobile = '',
        home_tel = '',
        is_inactive = false,
        is_moved = false,
        moved_from = '',
        merged_codes = '{}'::text[],
        updated_at = timezone('utc'::text, now())
    WHERE id = v_source.id;

    UPDATE public.statistics
    SET old_stats = 0,
        new_stats = 0,
        last_updated = timezone('utc'::text, now())
    WHERE doctor_id = v_source.id;

    -- Log to audit_logs
    INSERT INTO public.audit_logs (user_id, action_type, description, metadata)
    VALUES (
        p_user_id,
        'COMBINE',
        format('تم دمج الطبيب كود (%s) مع الطبيب كود (%s)', p_source_code, p_target_code),
        jsonb_build_object(
            'target_code', p_target_code,
            'source_code', p_source_code,
            'combined_old_stats', v_new_old_stats,
            'combined_new_stats', v_new_new_stats
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'target_code', p_target_code,
        'source_code', p_source_code,
        'new_old_stats', v_new_old_stats,
        'new_new_stats', v_new_new_stats
    );
END;
$$;
