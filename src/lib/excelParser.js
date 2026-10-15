import * as XLSX from 'xlsx';

export const COL_DEFS = {
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

/**
 * Smart Column Mapping scanning all keys from the top rows
 */
export function getColumnMapping(dataArray) {
  const map = {};
  if (!Array.isArray(dataArray) || dataArray.length === 0) return map;

  // Gather all unique keys from the first 50 rows
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
 * Read Excel file to JSON array
 */
export async function readExcelFile(file) {
  if (!file) return [];
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        resolve(json);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Main parser merging Docs, Old, and New sheets
 */
export async function parseAndMergeSheets({ docsFile, oldFile, newFile }) {
  const [docsData, oldData, newData] = await Promise.all([
    readExcelFile(docsFile),
    readExcelFile(oldFile),
    readExcelFile(newFile),
  ]);

  if (!docsData.length && !oldData.length && !newData.length) {
    throw new Error('برجاء رفع شيت واحد على الأقل!');
  }

  const docsMapConf = getColumnMapping(docsData);
  const oldMapConf = getColumnMapping(oldData);
  const newMapConf = getColumnMapping(newData);

  const doctorsMap = {};

  function processDataset(dataset, mapConf, type) {
    if (!dataset || dataset.length === 0) return;

    dataset.forEach((row) => {
      let idCode = row[mapConf.code];
      if (idCode === undefined || idCode === null) return;
      idCode = String(idCode).trim();
      if (idCode === '') return;

      if (!doctorsMap[idCode]) {
        let n = row[mapConf.name] || '';
        if (n && !String(n).includes('أ.د/')) {
          n = 'أ.د/ ' + n;
        }

        const gvr = String(row[mapConf.gvr] || '').trim();
        const city = String(row[mapConf.city] || '').trim();
        const region = String(row[mapConf.region] || '').trim();

        doctorsMap[idCode] = {
          doc_code: idCode,
          name: n,
          specialty: String(row[mapConf.specialty] || '').trim(),
          address: String(row[mapConf.address] || '').trim(),
          gvr,
          city,
          region,
          pageGvr: gvr,
          pageCity: city,
          pageRegion: region,
          mobile: String(row[mapConf.mobile] || '').trim(),
          home_tel: String(row[mapConf.home_tel] || '').trim(),
          old_stats: '',
          new_stats: '',
          is_moved: false,
          moved_from: '',
          is_inactive: false,
          merged_codes: [],
        };
      }

      let countKey =
        type === 'docs'
          ? mapConf.count_general
          : type === 'old'
          ? mapConf.count_old
          : mapConf.count_new;

      if (!countKey && type === 'old') countKey = mapConf.count_general;
      if (!countKey && type === 'new') countKey = mapConf.count_general;

      const countVal = row[countKey];
      if (countVal !== undefined && countVal !== null) {
        if (type === 'docs' || type === 'old') {
          doctorsMap[idCode].old_stats = countVal;
        } else {
          doctorsMap[idCode].new_stats = countVal;
        }
      }
    });
  }

  processDataset(docsData, docsMapConf, 'docs');
  processDataset(oldData, oldMapConf, 'old');
  processDataset(newData, newMapConf, 'new');

  return Object.values(doctorsMap);
}

/**
 * Parse sheets for "تحديث الحالات فقط" (Old & New stats only)
 */
export async function parseStatsOnly({ oldFile, newFile }) {
  const [oldData, newData] = await Promise.all([
    readExcelFile(oldFile),
    readExcelFile(newFile),
  ]);

  if (!oldData.length && !newData.length) {
    throw new Error('برجاء رفع شيت القديم أو الجديد على الأقل!');
  }

  const oldMapConf = getColumnMapping(oldData);
  const newMapConf = getColumnMapping(newData);

  const updatesMap = {};

  oldData.forEach((r) => {
    const code = r[oldMapConf.code];
    if (code) {
      const c = String(code).trim();
      const val = r[oldMapConf.count_old] !== undefined ? r[oldMapConf.count_old] : r[oldMapConf.count_general];
      if (val !== undefined) {
        if (!updatesMap[c]) updatesMap[c] = { doc_code: c };
        updatesMap[c].old_stats = val;
      }
    }
  });

  newData.forEach((r) => {
    const code = r[newMapConf.code];
    if (code) {
      const c = String(code).trim();
      const val = r[newMapConf.count_new] !== undefined ? r[newMapConf.count_new] : r[newMapConf.count_general];
      if (val !== undefined) {
        if (!updatesMap[c]) updatesMap[c] = { doc_code: c };
        updatesMap[c].new_stats = val;
      }
    }
  });

  return Object.values(updatesMap);
}
