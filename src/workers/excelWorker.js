import * as XLSX from 'xlsx';

const COL_DEFS = {
  code: ['doctor code', 'doctor co', 'id', 'code', 'كود'],
  name: ['doctor name', 'name', 'اسم'],
  specialty: ['doctor spec', 'specialty', 'spec', 'تخصص'],
  address: ['address', 'العنوان'],
  gvr: ['governe', 'governorate', 'gov', 'gvr', 'محافظة', 'محافظه'],
  city: ['city', 'المدينة', 'مدينة', 'مركز', 'center'],
  region: ['region', 'المنطقة'],
  mobile: ['mobile no', 'mobile', 'موبايل', 'رقم', 'موبيل', 'جوال'],
  home_tel: ['home tel', 'تليفون', 'ارضي', 'tel'],
  count_general: ['patient count', 'حالات'],
  count_old: ['old', 'قديم'],
  count_new: ['new', 'جديد'],
};

function getColumnMapping(dataArray) {
  const map = {};
  if (!Array.isArray(dataArray) || dataArray.length === 0) return map;

  const allKeysSet = new Set();
  const limit = Math.min(dataArray.length, 50);
  for (let i = 0; i < limit; i++) {
    if (dataArray[i]) {
      Object.keys(dataArray[i]).forEach((k) => allKeysSet.add(k));
    }
  }

  const rowKeys = Array.from(allKeysSet).map((k) => ({
    orig: k,
    low: String(k).toLowerCase().trim(),
  }));

  for (const field in COL_DEFS) {
    const possibles = COL_DEFS[field];
    const match =
      rowKeys.find((rk) => possibles.some((p) => rk.low === p.toLowerCase())) ||
      rowKeys.find((rk) => possibles.some((p) => rk.low.includes(p.toLowerCase())));

    if (match) {
      map[field] = match.orig;
    }
  }

  return map;
}

/**
/**
 * Sanitizes dirty Excel strings:
 * Replaces % and noise symbols (*, #, _, ~, ^) with space, and normalizes excess whitespace.
 */
function sanitizeString(val) {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/[%*#_~^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitizes doctor name and ensures proper clean prefix
 */
function sanitizeDoctorName(val) {
  if (val === undefined || val === null) return '';
  const str = sanitizeString(val);
  const withoutPrefix = str
    .replace(/^أ\.?\s*د\s*\/?:?\s*/i, '')
    .replace(/^د\s*\/?:?\s*/i, '')
    .trim();
  if (!withoutPrefix) return '';
  return 'أ.د/ ' + withoutPrefix;
}

function parseBuffer(buffer) {
  if (!buffer) return [];
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: '' });
}

self.onmessage = async (e) => {
  const { type, payload, id } = e.data;

  try {
    if (type === 'PARSE_AND_MERGE') {
      const { docsBuffer, oldBuffer, newBuffer } = payload;

      self.postMessage({ id, type: 'PROGRESS', message: 'جاري فك تشفير وتفكيك ملفات الإكسيل...' });
      const docsData = parseBuffer(docsBuffer);
      const oldData = parseBuffer(oldBuffer);
      const newData = parseBuffer(newBuffer);

      if (!docsData.length && !oldData.length && !newData.length) {
        throw new Error('لم يتم العثور على أي بيانات داخل الملفات المرفوعة!');
      }

      self.postMessage({ id, type: 'PROGRESS', message: 'جاري مطابقة الأعمدة وتطهير البيانات ودمج الإحصائيات...' });
      const docsMapConf = getColumnMapping(docsData);
      const oldMapConf = getColumnMapping(oldData);
      const newMapConf = getColumnMapping(newData);

      const doctorsMap = {};

      function processDataset(dataset, mapConf, sheetType) {
        if (!dataset || dataset.length === 0) return;

        dataset.forEach((row) => {
          let idCode = row[mapConf.code];
          if (idCode === undefined || idCode === null) return;
          idCode = sanitizeString(idCode);
          if (idCode === '') return;

          if (!doctorsMap[idCode]) {
            let n = sanitizeDoctorName(row[mapConf.name] || '');

            const gvr = sanitizeString(row[mapConf.gvr] || '');
            const city = sanitizeString(row[mapConf.city] || '');
            const region = sanitizeString(row[mapConf.region] || '');

            doctorsMap[idCode] = {
              doc_code: idCode,
              name: n,
              specialty: sanitizeString(row[mapConf.specialty] || ''),
              address: sanitizeString(row[mapConf.address] || ''),
              gvr,
              city,
              region,
              pageGvr: gvr,
              pageCity: city,
              pageRegion: region,
              mobile: sanitizeString(row[mapConf.mobile] || ''),
              home_tel: sanitizeString(row[mapConf.home_tel] || ''),
              old_stats: '',
              new_stats: '',
              is_moved: false,
              moved_from: '',
              is_inactive: false,
              merged_codes: [],
            };
          }

          let countKey =
            sheetType === 'docs'
              ? mapConf.count_general
              : sheetType === 'old'
              ? mapConf.count_old
              : mapConf.count_new;

          if (!countKey && sheetType === 'old') countKey = mapConf.count_general;
          if (!countKey && sheetType === 'new') countKey = mapConf.count_general;

          const countVal = row[countKey];
          if (countVal !== undefined && countVal !== null) {
            const parsedCount = parseInt(String(countVal).trim(), 10) || 0;
            if (sheetType === 'docs' || sheetType === 'old') {
              doctorsMap[idCode].old_stats = parsedCount;
            } else {
              doctorsMap[idCode].new_stats = parsedCount;
            }
          }
        });
      }

      processDataset(docsData, docsMapConf, 'docs');
      processDataset(oldData, oldMapConf, 'old');
      processDataset(newData, newMapConf, 'new');

      const result = Object.values(doctorsMap);
      self.postMessage({ id, type: 'SUCCESS', result });
    } else if (type === 'PARSE_STATS_ONLY') {
      const { oldBuffer, newBuffer } = payload;

      const oldData = parseBuffer(oldBuffer);
      const newData = parseBuffer(newBuffer);

      if (!oldData.length && !newData.length) {
        throw new Error('برجاء رفع شيت القديم أو الجديد على الأقل!');
      }

      const oldMapConf = getColumnMapping(oldData);
      const newMapConf = getColumnMapping(newData);
      const updatesMap = {};

      oldData.forEach((r) => {
        const code = r[oldMapConf.code];
        if (code) {
          const c = sanitizeString(code);
          const val = r[oldMapConf.count_old] !== undefined ? r[oldMapConf.count_old] : r[oldMapConf.count_general];
          if (val !== undefined && val !== null) {
            if (!updatesMap[c]) updatesMap[c] = { doc_code: c };
            updatesMap[c].old_stats = parseInt(String(val).trim(), 10) || 0;
          }
        }
      });

      newData.forEach((r) => {
        const code = r[newMapConf.code];
        if (code) {
          const c = sanitizeString(code);
          const val = r[newMapConf.count_new] !== undefined ? r[newMapConf.count_new] : r[newMapConf.count_general];
          if (val !== undefined && val !== null) {
            if (!updatesMap[c]) updatesMap[c] = { doc_code: c };
            updatesMap[c].new_stats = parseInt(String(val).trim(), 10) || 0;
          }
        }
      });

      const result = Object.values(updatesMap);
      self.postMessage({ id, type: 'SUCCESS', result });
    }
  } catch (err) {
    self.postMessage({ id, type: 'ERROR', error: err.message });
  }
};
