import { create } from 'zustand';
import { doctorService } from '../services/doctorService';

export const useDoctorStore = create((set, get) => ({
  rawDoctors: [],
  displayedDoctors: [],
  locations: [],
  loading: false,
  statusMessage: null, // { text: string, isError: boolean }
  
  // Auto-Save Realtime Status
  autoSaveState: 'saved', // 'saved' | 'saving' | 'error'
  lastSavedTime: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
  setAutoSaveState: (state) => set({
    autoSaveState: state,
    lastSavedTime: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
  }),

  // Distribution Mode: 'continuous' (21 doctors/page - full boxes, no blanks) | 'by_region' (per-region A4 pages)
  distributionMode: 'continuous',
  setDistributionMode: (mode) => {
    set({ distributionMode: mode });
    get().rebuildData();
  },

  // Toggle empty padding slots on screen (always preserved in print)
  showEmptySlotsOnScreen: false,
  toggleShowEmptySlots: () => set((state) => ({ showEmptySlotsOnScreen: !state.showEmptySlotsOnScreen })),

  // Multi-Criteria Filtering System
  filters: {
    governorate: '',
    city: '',
    region: '',
    specialty: '',
    searchTerm: '',
    status: 'all', // 'all' | 'active' | 'inactive' | 'moved'
  },

  setFilter: (key, value) => {
    const cur = get().filters;
    const updated = { ...cur, [key]: value };
    if (key === 'governorate' && value !== cur.governorate) {
      updated.city = '';
      updated.region = '';
    } else if (key === 'city' && value !== cur.city) {
      updated.region = '';
    }
    set({ filters: updated });
    get().rebuildData();
  },

  resetFilters: () => {
    set({
      filters: {
        governorate: '',
        city: '',
        region: '',
        specialty: '',
        searchTerm: '',
        status: 'all',
      },
    });
    get().rebuildData(get().rawDoctors);
  },

  getFilteredDoctors: () => {
    const { rawDoctors, filters } = get();
    if (!rawDoctors || rawDoctors.length === 0) return [];
    if (!filters) return rawDoctors;

    const gvr = (filters.governorate || '').trim();
    const city = (filters.city || '').trim();
    const reg = (filters.region || '').trim();
    const spec = (filters.specialty || '').trim();
    const term = (filters.searchTerm || '').trim().toLowerCase();
    const status = filters.status || 'all';

    return rawDoctors.filter((doc) => {
      if (!doc.name && !doc.doc_code && !doc.specialty && !doc.address && !doc.mobile && !doc.old_stats && !doc.new_stats) {
        return false;
      }

      if (gvr && (doc.pageGvr || doc.gvr || '').trim() !== gvr) return false;
      if (city && (doc.pageCity || doc.city || '').trim() !== city) return false;
      if (reg && (doc.pageRegion || doc.region || '').trim() !== reg) return false;
      if (spec && (doc.specialty || '').trim() !== spec) return false;

      if (status === 'active' && doc.is_inactive) return false;
      if (status === 'inactive' && !doc.is_inactive) return false;
      if (status === 'moved' && !doc.is_moved) return false;

      if (term) {
        const nameMatch = doc.name && doc.name.toLowerCase().includes(term);
        const codeMatch = doc.doc_code && String(doc.doc_code).toLowerCase().includes(term);
        const addrMatch = doc.address && doc.address.toLowerCase().includes(term);
        const mobMatch = doc.mobile && String(doc.mobile).includes(term);
        const homeMatch = doc.home_tel && String(doc.home_tel).includes(term);
        if (!nameMatch && !codeMatch && !addrMatch && !mobMatch && !homeMatch) return false;
      }

      return true;
    });
  },

  getUniqueFilterOptions: () => {
    const raw = get().rawDoctors || [];
    const { filters } = get();

    const governorates = new Set();
    const cities = new Set();
    const regions = new Set();
    const specialties = new Set();

    for (let i = 0; i < raw.length; i++) {
      const d = raw[i];
      const g = (d.pageGvr || d.gvr || '').trim();
      const c = (d.pageCity || d.city || '').trim();
      const r = (d.pageRegion || d.region || '').trim();
      const s = (d.specialty || '').trim();

      if (g) governorates.add(g);
      if (c && (!filters?.governorate || g === filters.governorate)) cities.add(c);
      if (r && (!filters?.city || c === filters.city) && (!filters?.governorate || g === filters.governorate)) regions.add(r);
      if (s) specialties.add(s);
    }

    return {
      governorates: Array.from(governorates).sort(),
      cities: Array.from(cities).sort(),
      regions: Array.from(regions).sort(),
      specialties: Array.from(specialties).sort(),
    };
  },

  // Modals state
  activeModalIndex: -1,
  isMoveModalOpen: false,
  isCombineModalOpen: false,
  maximizedDoctorIndex: -1,
  isAddDoctorModalOpen: false,
  addDoctorInitialData: null,

  openAddDoctorModal: (initialData = null) => set({ isAddDoctorModalOpen: true, addDoctorInitialData: initialData }),
  closeAddDoctorModal: () => set({ isAddDoctorModalOpen: false, addDoctorInitialData: null }),

  openMaximizeModal: (index) => set({ maximizedDoctorIndex: index }),
  closeMaximizeModal: () => set({ maximizedDoctorIndex: -1 }),

  // Status message helper
  setStatus: (text, isError = false) => {
    set({ statusMessage: { text, isError } });
    if (!isError) {
      setTimeout(() => {
        const cur = get().statusMessage;
        if (cur && cur.text === text) {
          set({ statusMessage: null });
        }
      }, 5000);
    }
  },
  clearStatus: () => set({ statusMessage: null }),

  /**
   * Load data from database or cache
   */
  loadFromDB: async () => {
    // 1. Instant Cache Load (Stale-While-Revalidate)
    const cached = localStorage.getItem('gift_program_doctors_data');
    let hasLoadedCache = false;
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          set({ rawDoctors: parsed, loading: false });
          get().rebuildData(parsed);
          hasLoadedCache = true;
        }
      } catch (e) {}
    }
    
    if (!hasLoadedCache) {
      set({ loading: true });
    }

    try {
      const docs = await doctorService.fetchDoctors();
      set({ rawDoctors: docs, loading: false });
      get().rebuildData(docs);
      
      const locs = await doctorService.fetchLocations();
      set({ locations: locs });
    } catch (err) {
      console.error('Failed to load doctors:', err);
      if (!hasLoadedCache) {
        get().setStatus('حدث خطأ أثناء تحميل البيانات: ' + err.message, true);
        set({ loading: false });
      }
    }
  },

  /**
   * The core 21-item sorting, group-by, and padding algorithm - OPTIMIZED FOR 15,000+ ITEMS
   */
  rebuildData: (inputDocs = null) => {
    let list = inputDocs;
    if (!list) {
      const hasActiveFilters = Object.entries(get().filters || {}).some(([k, v]) => v && v !== 'all');
      list = hasActiveFilters ? get().getFilteredDoctors() : get().rawDoctors;
    }
    if (!list || list.length === 0) {
      set({ displayedDoctors: [] });
      return;
    }

    const mode = get().distributionMode || 'continuous';

    // =========================================================================
    // MODE 1: CONTINUOUS FLOW (التوزيع المتتالي الكامل - كل صفحة 21 طبيب بالكامل بدون خانات فارغة)
    // =========================================================================
    if (mode === 'continuous') {
      // 1. Sort doctors systematically by Governorate > City > Region > Name
      const realDocs = list.filter((d) => d && (d.name || d.doc_code || d.specialty || d.address));
      realDocs.sort((a, b) => {
        const gA = (a.pageGvr || a.gvr || '').localeCompare(b.pageGvr || b.gvr || '', 'ar');
        if (gA !== 0) return gA;
        const cA = (a.pageCity || a.city || '').localeCompare(b.pageCity || b.city || '', 'ar');
        if (cA !== 0) return cA;
        const rA = (a.pageRegion || a.region || '').localeCompare(b.pageRegion || b.region || '', 'ar');
        if (rA !== 0) return rA;
        return (a.name || '').localeCompare(b.name || '', 'ar');
      });

      // 2. Pad only the very final page to a multiple of 21 for print alignment
      const rem = realDocs.length % 21;
      const needed = (realDocs.length === 0) ? 21 : (rem !== 0 ? 21 - rem : 0);

      const continuousList = [...realDocs];
      const lastDoc = continuousList[continuousList.length - 1] || {};
      for (let i = 0; i < needed; i++) {
        continuousList.push({
          pageGvr: lastDoc.pageGvr || '',
          pageCity: lastDoc.pageCity || '',
          pageRegion: lastDoc.pageRegion || '',
          pageGvr_modified: false,
          pageCity_modified: false,
          pageRegion_modified: false,
          name: '',
          specialty: '',
          address: '',
          mobile: '',
          home_tel: '',
          old_stats: '',
          new_stats: '',
          counter: '',
          doc_code: '',
          is_moved: false,
          moved_from: '',
          is_inactive: false,
          merged_codes: [],
          is_blank_placeholder: true,
        });
      }

      // 3. Assign 1..21 counter for each A4 page
      for (let idx = 0; idx < continuousList.length; idx++) {
        const pageItemIndex = (idx % 21) + 1;
        const d = continuousList[idx];
        d.counter = (d.doc_code || d.name) ? pageItemIndex : '';
      }

      if (inputDocs) {
        set({ displayedDoctors: continuousList, rawDoctors: inputDocs });
      } else {
        set({ displayedDoctors: continuousList });
      }
      return;
    }

    // =========================================================================
    // MODE 2: BY REGION (توزيع حسب المنطقة - النمط الأصلي للطباعة)
    // =========================================================================
    const groups = {};
    for (let i = 0; i < list.length; i++) {
      const doc = list[i];
      const gvr = (doc.pageGvr || doc.gvr || '').trim();
      const city = (doc.pageCity || doc.city || '').trim();
      const reg = (doc.pageRegion || doc.region || '').trim();
      const key = `${gvr || 'بدون محافظة'}::${city || 'بدون مدينة'}::${reg || 'بدون منطقة'}`;

      if (!groups[key]) groups[key] = [];
      groups[key].push({
        ...doc,
        pageGvr: gvr,
        pageCity: city,
        pageRegion: reg,
      });
    }

    const formattedList = [];
    const groupKeys = Object.keys(groups).sort();

    for (let k = 0; k < groupKeys.length; k++) {
      const gDocs = groups[groupKeys[k]];
      const cGvr = gDocs[0].pageGvr || '';
      const cCity = gDocs[0].pageCity || '';
      const cReg = gDocs[0].pageRegion || '';
      const cGvrMod = Boolean(gDocs[0].pageGvr_modified);
      const cCityMod = Boolean(gDocs[0].pageCity_modified);
      const cRegMod = Boolean(gDocs[0].pageRegion_modified);

      // Trim trailing blank doctors
      while (gDocs.length > 0) {
        const last = gDocs[gDocs.length - 1];
        if (!last.name && !last.specialty && !last.address && !last.old_stats && !last.new_stats && !last.doc_code) {
          gDocs.pop();
        } else {
          break;
        }
      }

      // Pad up to a multiple of 21
      const rem = gDocs.length % 21;
      const needed = (gDocs.length === 0) ? 21 : (rem !== 0 ? 21 - rem : 0);

      for (let i = 0; i < needed; i++) {
        gDocs.push({
          pageGvr: cGvr,
          pageCity: cCity,
          pageRegion: cReg,
          pageGvr_modified: cGvrMod,
          pageCity_modified: cCityMod,
          pageRegion_modified: cRegMod,
          name: '',
          specialty: '',
          address: '',
          mobile: '',
          home_tel: '',
          old_stats: '',
          new_stats: '',
          counter: '',
          doc_code: '',
          is_moved: false,
          moved_from: '',
          is_inactive: false,
          merged_codes: [],
          is_blank_placeholder: true,
        });
      }

      // Assign counters (1..N) to real doctors and push into formattedList
      for (let idx = 0; idx < gDocs.length; idx++) {
        const d = gDocs[idx];
        d.counter = (d.doc_code || d.name) ? idx + 1 : '';
        formattedList.push(d);
      }
    }

    if (inputDocs) {
      set({ displayedDoctors: formattedList, rawDoctors: inputDocs });
    } else {
      set({ displayedDoctors: formattedList });
    }
  },

  setRawDoctorsAndRebuild: (docs) => {
    set({ rawDoctors: docs });
    get().rebuildData(docs);
  },

  setLocations: (locs) => set({ locations: locs }),

  /**
   * Inline Edit Handler with Auto-Save
   */
  updateInlineItem: async (index, field, value) => {
    const list = [...get().displayedDoctors];
    const item = list[index];
    if (!item) return;

    const oldVal = String(item[field] || '').trim();
    const newVal = String(value || '').trim();
    if (newVal === oldVal) return;

    item[field] = newVal;
    item[field + '_modified'] = true;
    item[field + '_updated'] = false;

    // Keep rawDoctors updated too
    const raw = get().rawDoctors.map((d) => {
      if ((item.id && d.id === item.id) || (item.doc_code && d.doc_code === item.doc_code)) {
        return { ...d, [field]: newVal };
      }
      return d;
    });

    set({ displayedDoctors: list, rawDoctors: raw });
    get().setAutoSaveState('saving');

    // Auto-save to Supabase if doctor exists
    if (item.id || item.doc_code) {
      try {
        await doctorService.updateDoctorField(item.id, item.doc_code, field, newVal);
        get().setAutoSaveState('saved');
      } catch (err) {
        console.error('Failed to update field on DB:', err);
        get().setAutoSaveState('error');
      }
    } else {
      get().setAutoSaveState('saved');
    }
  },

  /**
   * Page Header (Governorate / City / Region) Inline Edit Handler with Auto-Save
   */
  updatePageHeader: async (startIndex, field, value) => {
    const list = [...get().displayedDoctors];
    const oldVal = String(list[startIndex]?.[field] || '').trim();
    const newVal = String(value || '').trim();
    if (newVal === oldVal) return;

    get().setAutoSaveState('saving');

    // Update the 21 items in this specific page
    for (let i = 0; i < 21; i++) {
      if (list[startIndex + i]) {
        list[startIndex + i][field] = newVal;
        list[startIndex + i][field + '_modified'] = true;
      }
    }

    set({ displayedDoctors: list });
    get().rebuildData();
    get().setAutoSaveState('saved');
  },

  /**
   * Toggle Inactive with Optimistic UI
   */
  toggleInactive: (index, explicitState = null) => {
    const list = [...get().displayedDoctors];
    const doc = list[index];
    if (!doc) return false;

    const newState = explicitState !== null ? Boolean(explicitState) : !Boolean(doc.is_inactive);
    doc.is_inactive = newState;

    // Also update rawDoctors so filtered or rebuilt data retains the optimistic state
    const raw = [...get().rawDoctors];
    const rawIndex = raw.findIndex(
      (d) =>
        (doc.id && d.id === doc.id) ||
        (doc.doc_code && String(d.doc_code).trim() === String(doc.doc_code).trim())
    );
    if (rawIndex !== -1) {
      raw[rawIndex] = { ...raw[rawIndex], is_inactive: newState };
    }

    set({ displayedDoctors: list, rawDoctors: raw });
    get().setAutoSaveState('saving');
    return newState;
  },

  /**
   * Open / Close Modals
   */
  openMoveModal: (index) => set({ activeModalIndex: index, isMoveModalOpen: true }),
  closeMoveModal: () => set({ activeModalIndex: -1, isMoveModalOpen: false }),

  openCombineModal: (index) => set({ activeModalIndex: index, isCombineModalOpen: true }),
  closeCombineModal: () => set({ activeModalIndex: -1, isCombineModalOpen: false }),

  /**
   * Confirm Move with Auto-Save
   */
  confirmMove: async (destination) => {
    const { activeModalIndex, displayedDoctors, rawDoctors } = get();
    if (activeModalIndex === -1) return;

    const doc = displayedDoctors[activeModalIndex];
    if (!doc) return;

    const { gvr, city, region } = destination;
    const locParts = [doc.pageGvr, doc.pageCity, doc.pageRegion].map((s) => String(s || '').trim()).filter(Boolean);
    const oldLoc = locParts.length > 0 ? locParts.join(' - ') : (doc.moved_from || 'موقع سابق');

    doc.is_moved = true;
    doc.moved_from = oldLoc;
    doc.pageGvr = gvr;
    doc.pageCity = city;
    doc.pageRegion = region;
    doc.pageGvr_modified = true;
    doc.pageCity_modified = true;
    doc.pageRegion_modified = true;

    // Keep rawDoctors updated too so rebuildData preserves the moved status
    const rawList = (rawDoctors || []).map((d) => {
      if ((doc.id && d.id === doc.id) || (doc.doc_code && String(d.doc_code).trim() === String(doc.doc_code).trim())) {
        return {
          ...d,
          is_moved: true,
          moved_from: oldLoc,
          pageGvr: gvr,
          pageCity: city,
          pageRegion: region,
          pageGvr_modified: true,
          pageCity_modified: true,
          pageRegion_modified: true,
        };
      }
      return d;
    });
    set({ rawDoctors: rawList });

    get().closeMoveModal();
    get().rebuildData();
    get().setAutoSaveState('saving');

    try {
      await doctorService.moveDoctor(doc, gvr, city, region);
      get().setAutoSaveState('saved');
      get().setStatus(`تم نقل الطبيب بنجاح إلى: ${gvr} - ${city} - ${region}`);
    } catch (err) {
      console.error('Failed to move doctor on DB:', err);
      get().setAutoSaveState('error');
      get().setStatus('خطأ أثناء النقل: ' + err.message, true);
    }
  },

  /**
   * Confirm Combine with Auto-Save
   */
  /**
   * Confirm Combine with Optimistic UI
   */
  confirmCombine: (sourceCode) => {
    const { activeModalIndex, displayedDoctors, rawDoctors } = get();
    if (activeModalIndex === -1) return;

    const targetDoc = displayedDoctors[activeModalIndex];
    if (!targetDoc) return;

    const codeToMerge = String(sourceCode).trim();
    if (String(targetDoc.doc_code).trim() === codeToMerge) {
      throw new Error('لا يمكنك دمج الطبيب مع نفسه!');
    }

    const rawList = [...rawDoctors];
    let sourceInRaw = rawList.find(
      (d) => String(d.doc_code).trim().toLowerCase() === codeToMerge.toLowerCase()
    );

    if (!sourceInRaw) {
      sourceInRaw = displayedDoctors.find(
        (d) => String(d.doc_code).trim().toLowerCase() === codeToMerge.toLowerCase()
      );
    }

    if (!sourceInRaw) {
      throw new Error('لم يتم العثور على طبيب يحمل هذا الكود!');
    }

    const sourceStatsOld = parseInt(sourceInRaw.old_stats, 10) || 0;
    const sourceStatsNew = parseInt(sourceInRaw.new_stats, 10) || 0;

    // Combine stats on target
    targetDoc.old_stats = (parseInt(targetDoc.old_stats, 10) || 0) + sourceStatsOld;
    targetDoc.new_stats = (parseInt(targetDoc.new_stats, 10) || 0) + sourceStatsNew;
    targetDoc.old_stats_modified = true;
    targetDoc.new_stats_modified = true;
    targetDoc.old_stats_updated = false;
    targetDoc.new_stats_updated = false;

    if (!targetDoc.merged_codes) targetDoc.merged_codes = [];
    if (sourceInRaw.doc_code && !targetDoc.merged_codes.includes(sourceInRaw.doc_code)) {
      targetDoc.merged_codes.push(sourceInRaw.doc_code);
    }
    if (sourceInRaw.merged_codes && sourceInRaw.merged_codes.length) {
      targetDoc.merged_codes.push(...sourceInRaw.merged_codes);
    }

    // Also update target in rawList
    const targetInRaw = rawList.find(
      (d) => String(d.doc_code).trim() === String(targetDoc.doc_code).trim()
    );
    if (targetInRaw) {
      targetInRaw.old_stats = targetDoc.old_stats;
      targetInRaw.new_stats = targetDoc.new_stats;
      targetInRaw.merged_codes = [...targetDoc.merged_codes];
      targetInRaw.old_stats_modified = true;
      targetInRaw.new_stats_modified = true;
    }

    // Clear source doc in displayedDoctors if visible
    const sourceInDisplayed = displayedDoctors.find(
      (d) => String(d.doc_code).trim() === codeToMerge
    );
    if (sourceInDisplayed) {
      Object.assign(sourceInDisplayed, {
        name: '',
        specialty: '',
        address: '',
        mobile: '',
        home_tel: '',
        old_stats: '',
        new_stats: '',
        is_inactive: false,
        is_moved: false,
        moved_from: '',
        merged_codes: [],
      });
    }

    // Clear source in rawList if present
    const srcInRawList = rawList.find(
      (d) => String(d.doc_code).trim().toLowerCase() === codeToMerge.toLowerCase()
    );
    if (srcInRawList) {
      Object.assign(srcInRawList, {
        name: '',
        specialty: '',
        address: '',
        mobile: '',
        home_tel: '',
        old_stats: '',
        new_stats: '',
        is_inactive: false,
        is_moved: false,
        moved_from: '',
        merged_codes: [],
      });
    }

    get().closeCombineModal();
    set({ displayedDoctors: [...displayedDoctors], rawDoctors: rawList });
    get().setAutoSaveState('saving');
  },

  /**
   * Add a blank A4 page (21 blank cells)
   */
  addBlankPage: (gvr = 'صفحة إضافية', city = 'مدينة إضافية', region = 'فارغة') => {
    const list = [...get().displayedDoctors];
    for (let i = 0; i < 21; i++) {
      list.push({
        pageGvr: gvr.trim(),
        pageCity: city.trim(),
        pageRegion: region.trim(),
        pageGvr_modified: true,
        pageCity_modified: true,
        pageRegion_modified: true,
        name: '',
        specialty: '',
        address: '',
        mobile: '',
        home_tel: '',
        old_stats: '',
        new_stats: '',
        counter: '',
        doc_code: '',
        is_moved: false,
        moved_from: '',
        is_inactive: false,
        merged_codes: [],
      });
    }
    get().rebuildData(list);
    get().setStatus('تمت إضافة صفحة فارغة جديدة بنجاح.');
  },

  /**
   * Add a new Doctor (Create) with Auto-Save
   */
  addDoctor: async (doctorData) => {
    set({ loading: true });
    get().setAutoSaveState('saving');
    try {
      const res = await doctorService.addDoctor(doctorData);
      const newDoc = res.doctor || doctorData;

      const raw = [...get().rawDoctors, newDoc];
      get().rebuildData(raw);
      get().setAutoSaveState('saved');

      get().setStatus(`تمت إضافة الطبيب "${newDoc.name || newDoc.doc_code}" بنجاح!`);
      set({ loading: false, isAddDoctorModalOpen: false, addDoctorInitialData: null });
      return { success: true };
    } catch (err) {
      console.error('Failed to add doctor:', err);
      get().setAutoSaveState('error');
      get().setStatus('فشل إضافة الطبيب: ' + err.message, true);
      set({ loading: false });
      return { success: false, error: err.message };
    }
  },

  /**
   * Delete a Doctor (Delete) with Auto-Save
   */
  deleteDoctor: async (index) => {
    const list = [...get().displayedDoctors];
    const doc = list[index];
    if (!doc) return;

    const docName = doc.name || doc.doc_code || 'هذا الطبيب';
    if (!window.confirm(`هل أنت متأكد من حذف الطبيب: "${docName}" نهائياً من قاعدة البيانات؟`)) {
      return;
    }

    get().setAutoSaveState('saving');

    if (doc.id || doc.doc_code) {
      try {
        await doctorService.deleteDoctor(doc);
        get().setAutoSaveState('saved');
      } catch (err) {
        console.error('Failed to delete on DB:', err);
        get().setAutoSaveState('error');
      }
    } else {
      get().setAutoSaveState('saved');
    }

    // Filter out from rawDoctors
    const raw = get().rawDoctors.filter((d) => {
      if (doc.id && d.id) return d.id !== doc.id;
      if (doc.doc_code && d.doc_code) return String(d.doc_code).trim() !== String(doc.doc_code).trim();
      return true;
    });

    get().rebuildData(raw);
    get().setStatus(`تم حذف الطبيب (${docName}) بنجاح.`);
  },

  /**
   * Clear doctor slot (revert slot to empty placeholder) with Auto-Save
   */
  clearDoctorSlot: async (index) => {
    const list = [...get().displayedDoctors];
    const doc = list[index];
    if (!doc) return;

    if (!window.confirm('هل تريد تفريغ بيانات هذه الخانة؟')) return;

    get().setAutoSaveState('saving');

    if (doc.id || doc.doc_code) {
      try {
        await doctorService.deleteDoctor(doc);
        get().setAutoSaveState('saved');
      } catch (err) {
        console.error('Failed to clear slot in DB:', err);
        get().setAutoSaveState('error');
      }
    } else {
      get().setAutoSaveState('saved');
    }

    Object.assign(doc, {
      id: null,
      name: '',
      specialty: '',
      address: '',
      mobile: '',
      home_tel: '',
      old_stats: '',
      new_stats: '',
      doc_code: '',
      counter: '',
      is_moved: false,
      moved_from: '',
      is_inactive: false,
      merged_codes: [],
      is_blank_placeholder: true,
      name_modified: false,
      doc_code_modified: false,
    });

    set({ displayedDoctors: [...list] });
    get().setStatus('تم تفريغ الخانة بنجاح.');
  },

  /**
   * Delete entire page with Auto-Save
   */
  deletePage: async (startIndex) => {
    const list = get().displayedDoctors;
    const pageSlice = list.slice(startIndex, startIndex + 21);
    if (!pageSlice.length) return;

    const firstDoc = pageSlice[0] || {};
    const locName = `${firstDoc.pageGvr || ''} - ${firstDoc.pageCity || ''} - ${firstDoc.pageRegion || ''}`;

    if (!window.confirm(`هل أنت متأكد من حذف صفحة (${locName}) بالكامل بجميع أطبائها؟`)) {
      return;
    }

    get().setAutoSaveState('saving');

    const realDocs = pageSlice.filter((d) => d.id || d.doc_code);
    for (const d of realDocs) {
      try {
        await doctorService.deleteDoctor(d);
      } catch (err) {
        console.error('Delete doctor error:', err);
      }
    }

    const realCodes = new Set(realDocs.map((d) => String(d.doc_code).trim()));
    const realIds = new Set(realDocs.filter((d) => d.id).map((d) => d.id));

    const newRaw = get().rawDoctors.filter((d) => {
      if (d.id && realIds.has(d.id)) return false;
      if (d.doc_code && realCodes.has(String(d.doc_code).trim())) return false;
      return true;
    });

    get().rebuildData(newRaw);
    get().setAutoSaveState('saved');
    get().setStatus(`تم حذف صفحة (${locName}) بنجاح.`);
  },
}));
