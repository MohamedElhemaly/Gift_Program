import { supabase, isSupabaseConfigured } from '../lib/supabase';

// Local storage key for demo / offline fallback mode
const LOCAL_STORAGE_KEY = 'gift_program_doctors_data';
const LOCAL_AUDIT_KEY = 'gift_program_audit_logs';

function safeSaveLocalStorage(key, data) {
  try {
    localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
  } catch (e) {
    // Quota exceeded for large 15,000+ datasets, TanStack Query manages in-memory caching
  }
}

export function cleanDoctorName(val) {
  if (!val) return '';
  let str = String(val)
    .replace(/[%*#_~^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const withoutPrefix = str
    .replace(/^أ\.?\s*د\s*\/?:?\s*/i, '')
    .replace(/^د\s*\/?:?\s*/i, '')
    .trim();
  if (!withoutPrefix) return '';
  return 'أ.د/ ' + withoutPrefix;
}

export function cleanGeneralText(val) {
  if (!val) return '';
  return String(val)
    .replace(/[%*#_~^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const doctorService = {
  /**
   * Log an event in the audit_logs table
   */
  async logAudit(actionType, description, metadata = {}) {
    if (!isSupabaseConfigured || !supabase) {
      const logs = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || '[]');
      logs.unshift({
        id: crypto.randomUUID(),
        action_type: actionType,
        description,
        metadata,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(logs.slice(0, 100)));
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const insertData = {
        user_id: user?.id || null,
        action_type: actionType,
        description,
      };
      const res = await supabase.from('audit_logs').insert({
        ...insertData,
        metadata,
      });
      if (res.error && res.error.message && res.error.message.includes('metadata')) {
        await supabase.from('audit_logs').insert(insertData);
      }
    } catch (err) {
      console.warn('Failed to insert audit log:', err);
    }
  },

  /**
   * Fetch all doctors joined with locations and statistics
   */
  async fetchDoctors() {
    if (!isSupabaseConfigured || !supabase) {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      return cached ? JSON.parse(cached) : [];
    }

    try {
      const PAGE_SIZE = 1000;
      let allRecords = [];
      let from = 0;

      while (true) {
        let { data, error } = await supabase
          .from('doctors')
          .select(`
            id,
            doc_code,
            name,
            specialty,
            address,
            mobile,
            home_tel,
            is_inactive,
            is_moved,
            moved_from,
            merged_codes,
            display_order,
            location:locations (
              id,
              governorate,
              city,
              region
            ),
            statistics (
              old_stats,
              new_stats,
              last_updated
            )
          `)
          .order('doc_code', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.warn('Paginated fetch warning:', error.message);
          // Fallback to base columns if extended columns missing
          const baseRes = await supabase
            .from('doctors')
            .select(`
              id,
              doc_code,
              name,
              specialty,
              address,
              mobile,
              home_tel,
              is_inactive,
              location:locations (
                id,
                governorate,
                city,
                region
              ),
              statistics (
                old_stats,
                new_stats,
                last_updated
              )
            `)
            .order('doc_code', { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

          if (baseRes.error) throw baseRes.error;
          data = baseRes.data;
        }

        if (!data || data.length === 0) break;
        allRecords.push(...data);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      // Transform joined data to flat doctor structure matching the original UI model
      const transformed = allRecords.map((doc) => ({
        id: doc.id,
        doc_code: cleanGeneralText(doc.doc_code),
        name: cleanDoctorName(doc.name),
        specialty: cleanGeneralText(doc.specialty),
        address: cleanGeneralText(doc.address),
        mobile: cleanGeneralText(doc.mobile),
        home_tel: cleanGeneralText(doc.home_tel),
        is_inactive: Boolean(doc.is_inactive),
        is_moved: Boolean(doc.is_moved),
        moved_from: cleanGeneralText(doc.moved_from),
        merged_codes: doc.merged_codes || [],
        location_id: doc.location?.id || null,
        pageGvr: cleanGeneralText(doc.location?.governorate),
        pageCity: cleanGeneralText(doc.location?.city),
        pageRegion: cleanGeneralText(doc.location?.region),
        old_stats: doc.statistics?.[0]?.old_stats ?? doc.statistics?.old_stats ?? '',
        new_stats: doc.statistics?.[0]?.new_stats ?? doc.statistics?.new_stats ?? '',
      }));

      // Cache locally for instant offline/reload access
      safeSaveLocalStorage(LOCAL_STORAGE_KEY, transformed);

      return transformed;
    } catch (err) {
      console.warn('fetchDoctors failed on Supabase:', err.message);
      try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        return cached ? JSON.parse(cached) : [];
      } catch (e) {
        return [];
      }
    }
  },

  /**
   * Fetch unique locations for the dropdown
   */
  async fetchLocations() {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('locations')
        .select('id, governorate, city, region')
        .order('governorate', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn('fetchLocations warning:', err.message);
      return [];
    }
  },

  /**
   * Batch upsert doctors, locations, and statistics from Excel import
   */
  async upsertDoctorsBatch(doctorsList, onProgress = null) {
    if (!isSupabaseConfigured || !supabase) {
      safeSaveLocalStorage(LOCAL_STORAGE_KEY, doctorsList);
      await this.logAudit('IMPORT_EXCEL', `تم استيراد ${doctorsList.length} طبيب محلياً (وضع عدم الاتصال).`);
      return { success: true, count: doctorsList.length };
    }

    try {
      // 1. Gather and normalize unique locations
      const locationMap = new Map();
      doctorsList.forEach((d) => {
        const g = (d.pageGvr || '').trim();
        const c = (d.pageCity || '').trim();
        const r = (d.pageRegion || '').trim();
        const key = `${g}:::${c}:::${r}`;
        if (!locationMap.has(key)) {
          locationMap.set(key, { governorate: g, city: c, region: r });
        }
      });

      const locationsToUpsert = Array.from(locationMap.values());
      if (locationsToUpsert.length > 0) {
        if (onProgress) onProgress(`جاري حفظ المناطق والمحافظات (${locationsToUpsert.length} منطقة)...`);
        
        // Chunk locations in batches of 100
        for (let i = 0; i < locationsToUpsert.length; i += 100) {
          const chunk = locationsToUpsert.slice(i, i + 100);
          const { data: upsertedLocs, error: locErr } = await supabase
            .from('locations')
            .upsert(chunk, { onConflict: 'governorate,city,region' })
            .select('id, governorate, city, region');

          if (locErr) {
            console.warn('Location upsert warning:', locErr.message);
          } else if (upsertedLocs) {
            upsertedLocs.forEach((loc) => {
              const key = `${loc.governorate}:::${loc.city}:::${loc.region}`;
              locationMap.set(key, loc.id);
            });
          }
        }
      }

      // 2. Prepare doctor records and upsert in chunks
      const BATCH_SIZE = 400;
      const docIdMap = new Map();
      let useExtendedCols = true;

      for (let i = 0; i < doctorsList.length; i += BATCH_SIZE) {
        const chunk = doctorsList.slice(i, i + BATCH_SIZE);
        const currentCount = Math.min(i + BATCH_SIZE, doctorsList.length);
        if (onProgress) {
          onProgress(`جاري حفظ وتحديث بيانات الأطباء (${currentCount} من ${doctorsList.length})...`, currentCount, doctorsList.length);
        }

        // Query existing doctors in this chunk to preserve manual location/moves/merges/edits
        const chunkCodes = chunk.map((d) => String(d.doc_code).trim());
        let existingMap = new Map();
        try {
          const { data: existingRecords } = await supabase
            .from('doctors')
            .select('doc_code, name, specialty, address, mobile, home_tel, location_id, is_moved, moved_from, merged_codes, is_inactive, has_manual_edits')
            .in('doc_code', chunkCodes);
          if (existingRecords) {
            existingRecords.forEach((r) => existingMap.set(r.doc_code, r));
          }
        } catch (exErr) {
          console.warn('Could not check existing doctors:', exErr);
        }

        const buildRecords = (withExtended) => chunk.map((d) => {
          const code = String(d.doc_code).trim();
          const existing = existingMap.get(code);
          const key = `${(d.pageGvr || '').trim()}:::${(d.pageCity || '').trim()}:::${(d.pageRegion || '').trim()}`;
          
          // If doctor already exists and has manual edits or was moved, STRICTLY PRESERVE all manual changes!
          const hasManual = existing && (Boolean(existing.has_manual_edits) || Boolean(existing.is_moved));

          const finalLocationId = (hasManual && existing.location_id) 
            ? existing.location_id 
            : (locationMap.get(key) || null);

          const rec = {
            doc_code: cleanGeneralText(code),
            name: hasManual ? cleanDoctorName(existing.name) : cleanDoctorName(d.name),
            specialty: hasManual ? cleanGeneralText(existing.specialty) : cleanGeneralText(d.specialty),
            address: hasManual ? cleanGeneralText(existing.address) : cleanGeneralText(d.address),
            mobile: hasManual ? cleanGeneralText(existing.mobile) : cleanGeneralText(d.mobile),
            home_tel: hasManual ? cleanGeneralText(existing.home_tel) : cleanGeneralText(d.home_tel),
            is_inactive: existing ? Boolean(existing.is_inactive) : Boolean(d.is_inactive),
            location_id: finalLocationId,
          };
          if (withExtended) {
            rec.is_moved = existing ? Boolean(existing.is_moved) : Boolean(d.is_moved);
            rec.moved_from = existing ? (existing.moved_from || '') : (d.moved_from || '');
            rec.merged_codes = existing?.merged_codes?.length ? existing.merged_codes : (d.merged_codes || []);
            rec.has_manual_edits = existing ? Boolean(existing.has_manual_edits) : false;
          }
          return rec;
        });

        let doctorsToUpsert = buildRecords(useExtendedCols);
        let { data: upsertedDocs, error: docErr } = await supabase
          .from('doctors')
          .upsert(doctorsToUpsert, { onConflict: 'doc_code' })
          .select('id, doc_code');

        // Check if schema cache error occurred for is_moved or other extended column
        if (docErr && docErr.message && (docErr.message.includes('is_moved') || docErr.message.includes('column'))) {
          console.warn('Extended columns (is_moved) missing in schema cache, retrying with base columns...');
          useExtendedCols = false;
          doctorsToUpsert = buildRecords(false);
          const retryRes = await supabase
            .from('doctors')
            .upsert(doctorsToUpsert, { onConflict: 'doc_code' })
            .select('id, doc_code');

          if (retryRes.error) throw retryRes.error;
          upsertedDocs = retryRes.data;
        } else if (docErr) {
          throw docErr;
        }

        if (upsertedDocs) {
          upsertedDocs.forEach((doc) => docIdMap.set(doc.doc_code, doc.id));
        }
      }

      // 3. Prepare and upsert statistics records in chunks
      const statsToUpsert = doctorsList
        .filter((d) => docIdMap.has(String(d.doc_code).trim()))
        .map((d) => ({
          doctor_id: docIdMap.get(String(d.doc_code).trim()),
          old_stats: parseInt(d.old_stats, 10) || 0,
          new_stats: parseInt(d.new_stats, 10) || 0,
          last_updated: new Date().toISOString(),
        }));

      if (statsToUpsert.length > 0) {
        for (let i = 0; i < statsToUpsert.length; i += BATCH_SIZE) {
          const statsChunk = statsToUpsert.slice(i, i + BATCH_SIZE);
          const currentStatsCount = Math.min(i + BATCH_SIZE, statsToUpsert.length);
          if (onProgress) {
            onProgress(`جاري حفظ إحصائيات الحالات (${currentStatsCount} من ${statsToUpsert.length})...`, currentStatsCount, statsToUpsert.length);
          }
          const { error: statsErr } = await supabase
            .from('statistics')
            .upsert(statsChunk, { onConflict: 'doctor_id' });

          if (statsErr) console.warn('Statistics upsert warning:', statsErr.message);
        }
      }

      // Cache locally as well for fast access
      safeSaveLocalStorage(LOCAL_STORAGE_KEY, doctorsList);

      await this.logAudit(
        'IMPORT_EXCEL',
        `تم استيراد وتحديث ${doctorsList.length} طبيب عبر شيتات الإكسيل.`
      );

      return { success: true, count: doctorsList.length };
    } catch (err) {
      console.error('upsertDoctorsBatch Supabase error:', err);
      // Fallback: save to local storage so user is NEVER blocked!
      safeSaveLocalStorage(LOCAL_STORAGE_KEY, doctorsList);
      return { success: true, count: doctorsList.length, warning: err.message };
    }
  },

  /**
   * Update stats only (Old & New counts)
   */
  async updateStatisticsOnlyBatch(statsList, onProgress = null) {
    if (!isSupabaseConfigured || !supabase) {
      const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      let count = 0;
      statsList.forEach((st) => {
        const found = cached.find((d) => String(d.doc_code).trim() === String(st.doc_code).trim());
        if (found) {
          if (st.old_stats !== undefined) found.old_stats = st.old_stats;
          if (st.new_stats !== undefined) found.new_stats = st.new_stats;
          count++;
        }
      });
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cached));
      await this.logAudit('UPDATE_STATS', `تم تحديث حالات ${count} طبيب.`);
      return { success: true, count };
    }

    try {
      // Lookup doctors by codes in chunks
      const BATCH_SIZE = 400;
      const docIdMap = new Map();

      for (let i = 0; i < statsList.length; i += BATCH_SIZE) {
        const chunk = statsList.slice(i, i + BATCH_SIZE);
        const codes = chunk.map((s) => String(s.doc_code).trim());
        const { data: doctors, error: dErr } = await supabase
          .from('doctors')
          .select('id, doc_code')
          .in('doc_code', codes);

        if (!dErr && doctors) {
          doctors.forEach((d) => docIdMap.set(d.doc_code, d.id));
        }
      }

      const upserts = [];
      statsList.forEach((st) => {
        const doctorId = docIdMap.get(String(st.doc_code).trim());
        if (doctorId) {
          upserts.push({
            doctor_id: doctorId,
            ...(st.old_stats !== undefined ? { old_stats: parseInt(st.old_stats, 10) || 0 } : {}),
            ...(st.new_stats !== undefined ? { new_stats: parseInt(st.new_stats, 10) || 0 } : {}),
            last_updated: new Date().toISOString(),
          });
        }
      });

      if (upserts.length > 0) {
        for (let i = 0; i < upserts.length; i += BATCH_SIZE) {
          const chunk = upserts.slice(i, i + BATCH_SIZE);
          const { error: sErr } = await supabase
            .from('statistics')
            .upsert(chunk, { onConflict: 'doctor_id' });
          if (sErr) console.warn('Statistics update chunk error:', sErr.message);
        }
      }

      await this.logAudit('UPDATE_STATS', `تم تحديث حالات ${upserts.length} طبيب.`);
      return { success: true, count: upserts.length };
    } catch (err) {
      console.warn('updateStatisticsOnlyBatch Supabase error:', err);
      return { success: true, count: statsList.length, warning: err.message };
    }
  },

  /**
   * Update inline editable field
   */
  async updateDoctorField(id, docCode, field, value) {
    if (!isSupabaseConfigured || !supabase) {
      const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      const target = cached.find((d) => d.id === id || String(d.doc_code) === String(docCode));
      if (target) {
        target[field] = value;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cached));
      }
      return;
    }

    try {
      if (field === 'old_stats' || field === 'new_stats') {
        const intVal = parseInt(value, 10) || 0;
        await supabase
          .from('statistics')
          .upsert({
            doctor_id: id,
            [field]: intVal,
            last_updated: new Date().toISOString(),
          }, { onConflict: 'doctor_id' });

        await this.logAudit(
          'INLINE_EDIT',
          `تعديل إحصائية (${field}) للطبيب ${docCode} إلى: ${value}`,
          { doctor_id: id, doc_code: docCode, field, value }
        );
      } else {
        let res = await supabase
          .from('doctors')
          .update({ [field]: value, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (res.error && res.error.message && res.error.message.includes('updated_at')) {
          res = await supabase
            .from('doctors')
            .update({ [field]: value })
            .eq('id', id);
        }
        if (res.error) throw res.error;

        await this.logAudit(
          'INLINE_EDIT',
          `تعديل حقل (${field}) للطبيب ${docCode} إلى: ${value}`,
          { doctor_id: id, doc_code: docCode, field, value }
        );
      }
    } catch (err) {
      console.warn('updateDoctorField warning:', err.message);
    }
  },

  /**
   * Move Doctor to new location
   */
  async moveDoctor(doctor, newGvr, newCity, newRegion) {
    const g = (newGvr || '').trim();
    const c = (newCity || '').trim();
    const r = (newRegion || '').trim();
    const oldLocStr = `${doctor.pageGvr || ''} - ${doctor.pageCity || ''} - ${doctor.pageRegion || ''}`;

    if (!isSupabaseConfigured || !supabase) {
      const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      const doc = cached.find((d) => d.id === doctor.id || String(d.doc_code) === String(doctor.doc_code));
      if (doc) {
        doc.pageGvr = g;
        doc.pageCity = c;
        doc.pageRegion = r;
        doc.is_moved = true;
        doc.moved_from = oldLocStr;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cached));
      }
      await this.logAudit('MOVE', `تم نقل الطبيب ${doctor.name || doctor.doc_code} من (${oldLocStr}) إلى (${g} - ${c} - ${r})`);
      return { success: true };
    }

    try {
      // 1. Get or create location
      const { data: locData, error: locErr } = await supabase
        .from('locations')
        .upsert({ governorate: g, city: c, region: r }, { onConflict: 'governorate,city,region' })
        .select('id')
        .single();

      if (locErr) throw locErr;

      // 2. Update doctor
      const updatePayload = {
        location_id: locData.id,
        is_moved: true,
        moved_from: oldLocStr,
        updated_at: new Date().toISOString(),
      };

      let updateRes = await supabase
        .from('doctors')
        .update(updatePayload)
        .eq('id', doctor.id);

      if (updateRes.error && updateRes.error.message && (updateRes.error.message.includes('is_moved') || updateRes.error.message.includes('column'))) {
        updateRes = await supabase
          .from('doctors')
          .update({ location_id: locData.id })
          .eq('id', doctor.id);
      }

      if (updateRes.error) throw updateRes.error;

      await this.logAudit(
        'MOVE',
        `تم نقل الطبيب ${doctor.name || doctor.doc_code} من (${oldLocStr}) إلى (${g} - ${c} - ${r})`,
        { doctor_id: doctor.id, doc_code: doctor.doc_code, from: oldLocStr, to: `${g} - ${c} - ${r}` }
      );

      return { success: true, location_id: locData.id };
    } catch (err) {
      console.warn('moveDoctor fallback to local:', err.message);
      return { success: true, location_id: null };
    }
  },

  /**
   * Combine two doctors
   */
  async combineDoctors(targetCode, sourceCode) {
    if (!isSupabaseConfigured || !supabase) {
      // Local fallback
      const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      const target = cached.find((d) => String(d.doc_code).trim() === String(targetCode).trim());
      const source = cached.find((d) => String(d.doc_code).trim() === String(sourceCode).trim());

      if (!target || !source) throw new Error('تعذر العثور على الطبيب');

      target.old_stats = (parseInt(target.old_stats, 10) || 0) + (parseInt(source.old_stats, 10) || 0);
      target.new_stats = (parseInt(target.new_stats, 10) || 0) + (parseInt(source.new_stats, 10) || 0);
      if (!target.merged_codes) target.merged_codes = [];
      target.merged_codes.push(source.doc_code);
      if (source.merged_codes) target.merged_codes.push(...source.merged_codes);

      // Clear source doctor
      Object.assign(source, {
        name: '', specialty: '', address: '', mobile: '', home_tel: '',
        old_stats: '', new_stats: '', is_inactive: false, is_moved: false,
        moved_from: '', merged_codes: []
      });

      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cached));
      await this.logAudit('COMBINE', `تم دمج الطبيب ${sourceCode} مع الطبيب ${targetCode}`);
      return { success: true };
    }

    // Call atomic RPC combine_doctors
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.rpc('combine_doctors', {
      p_target_code: String(targetCode).trim(),
      p_source_code: String(sourceCode).trim(),
      p_user_id: user?.id || null,
    });

    if (error) throw error;
    if (data && !data.success) throw new Error(data.message || 'فشلت عملية الدمج');

    return data;
  },

  /**
   * Toggle inactive status of doctor
   */
  async toggleInactive(doctor) {
    const newState = !doctor.is_inactive;

    if (!isSupabaseConfigured || !supabase) {
      const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      const found = cached.find((d) => d.id === doctor.id || String(d.doc_code) === String(doctor.doc_code));
      if (found) {
        found.is_inactive = newState;
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cached));
      }
      return { success: true, is_inactive: newState };
    }

    const { error } = await supabase
      .from('doctors')
      .update({
        is_inactive: newState,
        updated_at: new Date().toISOString(),
      })
      .eq('id', doctor.id);

    if (error) throw error;

    await this.logAudit(
      'TOGGLE_INACTIVE',
      `تم ${newState ? 'إيقاف' : 'إعادة تفعيل'} الطبيب ${doctor.name || doctor.doc_code}`,
      { doctor_id: doctor.id, doc_code: doctor.doc_code, is_inactive: newState }
    );

    return { success: true, is_inactive: newState };
  },

  /**
   * Add a new single doctor
   */
  async addDoctor(doctorData) {
    if (!isSupabaseConfigured || !supabase) {
      const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      const newDoc = {
        id: crypto.randomUUID(),
        ...doctorData,
        is_moved: false,
        moved_from: '',
        is_inactive: false,
        merged_codes: [],
      };
      cached.push(newDoc);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cached));
      await this.logAudit('ADD_DOCTOR', `تمت إضافة الطبيب ${newDoc.name || newDoc.doc_code} محلياً.`);
      return { success: true, doctor: newDoc };
    }

    try {
      // 1. Resolve Location
      const g = (doctorData.pageGvr || '').trim();
      const c = (doctorData.pageCity || '').trim();
      const r = (doctorData.pageRegion || '').trim();
      let locationId = null;

      if (g || c || r) {
        const { data: locData, error: locErr } = await supabase
          .from('locations')
          .upsert({ governorate: g, city: c, region: r }, { onConflict: 'governorate,city,region' })
          .select('id')
          .single();
        if (!locErr && locData) locationId = locData.id;
      }

      // 2. Insert Doctor
      const docPayload = {
        doc_code: String(doctorData.doc_code).trim(),
        name: doctorData.name || '',
        specialty: doctorData.specialty || '',
        address: doctorData.address || '',
        mobile: doctorData.mobile || '',
        home_tel: doctorData.home_tel || '',
        location_id: locationId,
        is_inactive: false,
        is_moved: false,
        moved_from: '',
        merged_codes: [],
      };

      const { data: insertedDoc, error: docErr } = await supabase
        .from('doctors')
        .insert(docPayload)
        .select()
        .single();

      if (docErr) throw docErr;

      // 3. Insert Stats
      const oldStats = parseInt(doctorData.old_stats, 10) || 0;
      const newStats = parseInt(doctorData.new_stats, 10) || 0;
      if (insertedDoc?.id) {
        await supabase.from('statistics').insert({
          doctor_id: insertedDoc.id,
          old_stats: oldStats,
          new_stats: newStats,
        });
      }

      await this.logAudit(
        'ADD_DOCTOR',
        `تمت إضافة طبيب جديد: ${docPayload.name} (كود: ${docPayload.doc_code})`,
        { doctor_id: insertedDoc.id, doc_code: docPayload.doc_code }
      );

      return {
        success: true,
        doctor: {
          ...docPayload,
          id: insertedDoc.id,
          pageGvr: g,
          pageCity: c,
          pageRegion: r,
          old_stats: oldStats,
          new_stats: newStats,
        },
      };
    } catch (err) {
      console.warn('addDoctor Supabase error, falling back locally:', err.message);
      return { success: true, doctor: doctorData, warning: err.message };
    }
  },

  /**
   * Delete a doctor
   */
  async deleteDoctor(doctor) {
    if (!isSupabaseConfigured || !supabase) {
      const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
      const filtered = cached.filter((d) => d.id !== doctor.id && String(d.doc_code) !== String(doctor.doc_code));
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
      await this.logAudit('DELETE_DOCTOR', `تم حذف الطبيب ${doctor.name || doctor.doc_code} محلياً.`);
      return { success: true };
    }

    try {
      if (doctor.id) {
        await supabase.from('statistics').delete().eq('doctor_id', doctor.id);
        const { error } = await supabase.from('doctors').delete().eq('id', doctor.id);
        if (error) throw error;
      } else if (doctor.doc_code) {
        const { error } = await supabase.from('doctors').delete().eq('doc_code', String(doctor.doc_code).trim());
        if (error) throw error;
      }

      await this.logAudit(
        'DELETE_DOCTOR',
        `تم حذف الطبيب ${doctor.name || doctor.doc_code}`,
        { doctor_id: doctor.id, doc_code: doctor.doc_code }
      );

      return { success: true };
    } catch (err) {
      console.warn('deleteDoctor Supabase error:', err.message);
      return { success: true, warning: err.message };
    }
  },

  /**
   * Subscribe to real-time changes
   */
  subscribeToChanges(onChangeCallback) {
    if (!isSupabaseConfigured || !supabase) return () => {};

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctors' },
        (payload) => onChangeCallback({ table: 'doctors', payload })
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'statistics' },
        (payload) => onChangeCallback({ table: 'statistics', payload })
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};
