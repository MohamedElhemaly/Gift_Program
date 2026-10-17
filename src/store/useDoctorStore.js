import { create } from 'zustand';
import { doctorService } from '../services/doctorService';

export function normalizeArabicText(str) {
  if (str === undefined || str === null) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic diacritics / tashkeel
    .replace(/\s+/g, ' ');
}

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
    const term = (filters.searchTerm || '').trim();
    const status = filters.status || 'all';

    const normGvr = normalizeArabicText(gvr);
    const normCity = normalizeArabicText(city);
    const normReg = normalizeArabicText(reg);
    const normSpec = normalizeArabicText(spec);
    const normTerm = normalizeArabicText(term);

    return rawDoctors.filter((doc) => {
      if (!doc.name && !doc.doc_code && !doc.specialty && !doc.address && !doc.mobile && !doc.old_stats && !doc.new_stats) {
        return false;
      }

      const docGvr = normalizeArabicText(doc.pageGvr || doc.gvr);
      const docCity = normalizeArabicText(doc.pageCity || doc.city);
      const docReg = normalizeArabicText(doc.pageRegion || doc.region);
      const docSpec = normalizeArabicText(doc.specialty || doc.spec || doc.doctor_spec);

      if (normGvr && docGvr !== normGvr) return false;
      if (normCity && docCity !== normCity) return false;
      if (normReg && docReg !== normReg) return false;
      if (normSpec && docSpec !== normSpec) return false;

      if (status === 'active' && doc.is_inactive) return false;
      if (status === 'inactive' && !doc.is_inactive) return false;
      if (status === 'moved' && !doc.is_moved) return false;

      if (normTerm) {
        const nameMatch = normalizeArabicText(doc.name).includes(normTerm);
        const codeMatch = String(doc.doc_code || '').toLowerCase().includes(normTerm);
        const specMatch = docSpec.includes(normTerm);
        const addrMatch = normalizeArabicText(doc.address || doc.clinic_address).includes(normTerm);
        const gvrMatch = docGvr.includes(normTerm);
        const cityMatch = docCity.includes(normTerm);
        const regMatch = docReg.includes(normTerm);
        const mobMatch = String(doc.mobile || doc.phone || '').includes(normTerm);
        const homeMatch = String(doc.home_tel || doc.tel || '').includes(normTerm);
        if (!nameMatch && !codeMatch && !specMatch && !addrMatch && !gvrMatch && !cityMatch && !regMatch && !mobMatch && !homeMatch) {
          return false;
        }
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

    const curGvrNorm = normalizeArabicText(filters?.governorate);
    const curCityNorm = normalizeArabicText(filters?.city);

    for (let i = 0; i < raw.length; i++) {
      const d = raw[i];
      const g = (d.pageGvr || d.gvr || '').trim();
      const c = (d.pageCity || d.city || '').trim();
      const r = (d.pageRegion || d.region || '').trim();
      const s = (d.specialty || d.spec || d.doctor_spec || '').trim();

      const gNorm = normalizeArabicText(g);
      const cNorm = normalizeArabicText(c);

      if (g) governorates.add(g);
      if (c && (!curGvrNorm || gNorm === curGvrNorm)) cities.add(c);
      if (r && (!curCityNorm || cNorm === curCityNorm) && (!curGvrNorm || gNorm === curGvrNorm)) regions.add(r);
      if (s) specialties.add(s);
    }

    return {
      governorates: Array.from(governorates).sort((a, b) => a.localeCompare(b, 'ar')),
      cities: Array.from(cities).sort((a, b) => a.localeCompare(b, 'ar')),
      regions: Array.from(regions).sort((a, b) => a.localeCompare(b, 'ar')),
      specialties: Array.from(specialties).sort((a, b) => a.localeCompare(b, 'ar')),
    };
  },

  // Modals state
  activeModalIndex: -1,
  isMoveModalOpen: false,
  isCombineModalOpen: false,
  maximizedDoctorIndex: -1,
  isAddDoctorModalOpen: false,
  addDoctorInitialData: null,
  isPrintModalOpen: false,

  openPrintModal: () => set({ isPrintModalOpen: true }),
  closePrintModal: () => set({ isPrintModalOpen: false }),

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
   * STRICT LOCATION-BASED PAGINATION & CHUNKING ALGORITHM (NO LOCATION MIXING)
   * 1. Group dataset by location hierarchy (pageGvr -> pageCity -> pageRegion)
   * 2. For each location group, chunk into 21 items
   * 3. Pad the last chunk of each location group with empty placeholders to reach 21 items
   * 4. Enforce page breaks between different locations so no two locations ever share an A4 page
   */
  rebuildData: (inputDocs = null) => {
    let list = inputDocs;
    if (!list) {
      const f = get().filters || {};
      const hasActiveFilters = Boolean(
        (f.governorate && f.governorate.trim()) ||
        (f.city && f.city.trim()) ||
        (f.region && f.region.trim()) ||
        (f.specialty && f.specialty.trim()) ||
        (f.searchTerm && f.searchTerm.trim()) ||
        (f.status && f.status !== 'all')
      );
      list = hasActiveFilters ? get().getFilteredDoctors() : get().rawDoctors;
    }

    if (!list || list.length === 0) {
      set({ displayedDoctors: [] });
      return;
    }

    // Keep only real doctor objects (ignore pure empty padding from previous state)
    const realDocs = list.filter(
      (d) => d && (d.name || d.doc_code || d.specialty || d.address || d.id)
    );

    if (realDocs.length === 0) {
      set({ displayedDoctors: [] });
      return;
    }

    // 1. Group strictly by location hierarchy (pageGvr -> pageCity -> pageRegion)
    const groups = {};
    for (let i = 0; i < realDocs.length; i++) {
      const doc = realDocs[i];
      const gvr = (doc.pageGvr || doc.gvr || 'غير محدد').trim();
      const city = (doc.pageCity || doc.city || '').trim();
      const reg = (doc.pageRegion || doc.region || '').trim();
      const key = `${gvr}::${city || 'بدون مدينة'}::${reg || 'بدون منطقة'}`;

      if (!groups[key]) groups[key] = [];
      groups[key].push({
        ...doc,
        pageGvr: gvr,
        pageCity: city,
        pageRegion: reg,
      });
    }

    // 2. Sort location groups hierarchically (Governorate -> City -> Region)
    const groupKeys = Object.keys(groups).sort((a, b) => {
      const [gvrA, cityA, regA] = a.split('::');
      const [gvrB, cityB, regB] = b.split('::');

      const isAUnk = gvrA === 'غير محدد';
      const isBUnk = gvrB === 'غير محدد';
      if (isAUnk && !isBUnk) return 1;
      if (!isAUnk && isBUnk) return -1;

      const gCmp = gvrA.localeCompare(gvrB, 'ar');
      if (gCmp !== 0) return gCmp;

      const cCmp = (cityA || '').localeCompare(cityB || '', 'ar');
      if (cCmp !== 0) return cCmp;

      return (regA || '').localeCompare(regB || '', 'ar');
    });

    const formattedList = [];

    // 3. Process each location group and apply the strict padding rule
    for (let k = 0; k < groupKeys.length; k++) {
      const gDocs = groups[groupKeys[k]];

      // Sort doctors inside this specific location group
      gDocs.sort((a, b) => {
        const isFallbackA = (a.name || '').startsWith('طبيب (كود:');
        const isFallbackB = (b.name || '').startsWith('طبيب (كود:');
        if (!isFallbackA && isFallbackB) return -1;
        if (isFallbackA && !isFallbackB) return 1;

        const nA = (a.name || '').trim();
        const nB = (b.name || '').trim();
        if (nA && !nB) return -1;
        if (!nA && nB) return 1;
        if (nA && nB) {
          const nCmp = nA.localeCompare(nB, 'ar');
          if (nCmp !== 0) return nCmp;
        }

        return (parseInt(a.doc_code, 10) || 0) - (parseInt(b.doc_code, 10) || 0);
      });

      const cGvr = gDocs[0].pageGvr || 'غير محدد';
      const cCity = gDocs[0].pageCity || '';
      const cReg = gDocs[0].pageRegion || '';
      const cGvrMod = Boolean(gDocs[0].pageGvr_modified);
      const cCityMod = Boolean(gDocs[0].pageCity_modified);
      const cRegMod = Boolean(gDocs[0].pageRegion_modified);

      // 4. The Padding Rule: If the last chunk has fewer than 21 doctors, pad to 21
      const rem = gDocs.length % 21;
      const needed = gDocs.length === 0 ? 21 : rem !== 0 ? 21 - rem : 0;

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

      // 5. Assign page counter (1 to 21) on each page
      for (let idx = 0; idx < gDocs.length; idx++) {
        const d = gDocs[idx];
        const pageItemIndex = (idx % 21) + 1;
        d.counter = d.doc_code || d.name ? pageItemIndex : '';
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
