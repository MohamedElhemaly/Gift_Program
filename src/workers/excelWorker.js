import * as XLSX from 'xlsx';

const COL_DEFS = {
  code: ['doctor code', 'doctor co', 'id', 'code', 'كود', 'كود الطبيب', 'كود_الطبيب'],
  name: ['doctor name', 'name', 'اسم', 'اسم الطبيب', 'الطبيب', 'اسم_الطبيب'],
  specialty: [
    'doctor spec', 'specialty', 'speciality', 'spec', 'تخصص', 'التخصص', 'تخصص الطبيب',
    'مجال', 'المجال', 'المهنة', 'doctor_spec', 'doctor spec.'
  ],
  address: [
    'address', 'العنوان', 'عنوان', 'مقر العيادة', 'العيادة', 'مقر', 'مقر العمل',
    'عنوان العيادة', 'العنوان والعيادة', 'clinic address', 'clinic', 'clinic_address'
  ],
  gvr: ['governe', 'governorate', 'gov', 'gvr', 'محافظة', 'محافظه', 'المحافظة'],
  city: ['city', 'المدينة', 'مدينة', 'مركز', 'center', 'المركز'],
  region: ['region', 'المنطقة', 'منطقة', 'حي', 'الحي'],
  mobile: [
    'mobile no.', 'mobile no', 'mobile', 'موبايل', 'رقم', 'موبيل', 'جوال',
    'الموبايل', 'المحمول', 'هاتف محمول', 'موبايل العيادة', 'phone', 'cell', 'mobile_no'
  ],
  home_tel: [
    'home tel.', 'home tel', 'تليفون', 'ارضي', 'أرضي', 'الأرضي', 'tel',
    'هاتف', 'الهاتف', 'تليفون العيادة', 'ارضي العيادة', 'phone2', 'landline', 'home_tel'
  ],
  count_general: ['patient count', 'حالات', 'العدد', 'الحالات', 'اجمالي'],
  count_old: ['old', 'قديم', 'القديم', 'الحالات القديمة', 'حالات سابقة'],
  count_new: ['new', 'جديد', 'الجديد', 'الحالات الجديدة', 'حالات جديدة'],
};

function normalizeKey(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[._\-\s]+/g, ' ')
    .trim();
}

function getColumnMapping(dataArray) {
  const map = {};
  if (!Array.isArray(dataArray) || dataArray.length === 0) return map;

  const allKeysSet = new Set();
  const limit = Math.min(dataArray.length, 500);
  for (let i = 0; i < limit; i++) {
    if (dataArray[i]) {
      Object.keys(dataArray[i]).forEach((k) => allKeysSet.add(k));
    }
  }

  const rowKeys = Array.from(allKeysSet).map((k) => ({
    orig: k,
    norm: normalizeKey(k),
  }));

  for (const field in COL_DEFS) {
    const possibles = COL_DEFS[field].map(normalizeKey);
    // 1. Exact normalized match
    let match = rowKeys.find((rk) => possibles.some((p) => rk.norm === p));
    // 2. Substring match
    if (!match) {
      match = rowKeys.find((rk) => possibles.some((p) => rk.norm.includes(p) || p.includes(rk.norm)));
    }

    if (match) {
      map[field] = match.orig;
    }
  }

  return map;
}

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

          const rawSpec = sanitizeString(row[mapConf.specialty] || '');
          const rawAddr = sanitizeString(row[mapConf.address] || '');
          const rawMob = sanitizeString(row[mapConf.mobile] || '');
          const rawHome = sanitizeString(row[mapConf.home_tel] || '');
          const rawName = sanitizeDoctorName(row[mapConf.name] || '');
          const gvr = sanitizeString(row[mapConf.gvr] || '');
          const city = sanitizeString(row[mapConf.city] || '');
          const region = sanitizeString(row[mapConf.region] || '');

          if (!doctorsMap[idCode]) {
            doctorsMap[idCode] = {
              doc_code: idCode,
              name: rawName,
              specialty: rawSpec,
              address: rawAddr,
              gvr,
              city,
              region,
              pageGvr: gvr,
              pageCity: city,
              pageRegion: region,
              mobile: rawMob,
              home_tel: rawHome,
              old_stats: '',
              new_stats: '',
              is_moved: false,
              moved_from: '',
              is_inactive: false,
              merged_codes: [],
            };
          } else {
            // Merge in non-empty values from subsequent sheets or rows
            if (!doctorsMap[idCode].name && rawName) doctorsMap[idCode].name = rawName;
            if (!doctorsMap[idCode].specialty && rawSpec) doctorsMap[idCode].specialty = rawSpec;
            if (!doctorsMap[idCode].address && rawAddr) doctorsMap[idCode].address = rawAddr;
            if (!doctorsMap[idCode].mobile && rawMob) doctorsMap[idCode].mobile = rawMob;
            if (!doctorsMap[idCode].home_tel && rawHome) doctorsMap[idCode].home_tel = rawHome;
            if (!doctorsMap[idCode].pageGvr && gvr) {
              doctorsMap[idCode].gvr = gvr;
              doctorsMap[idCode].pageGvr = gvr;
            }
            if (!doctorsMap[idCode].pageCity && city) {
              doctorsMap[idCode].city = city;
              doctorsMap[idCode].pageCity = city;
            }
            if (!doctorsMap[idCode].pageRegion && region) {
              doctorsMap[idCode].region = region;
              doctorsMap[idCode].pageRegion = region;
            }
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
