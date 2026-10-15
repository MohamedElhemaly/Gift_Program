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

export function cleanGeneralText(val) {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/[%*#_~^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanDoctorName(val) {
  if (val === undefined || val === null) return '';
  const str = cleanGeneralText(val);
  const withoutPrefix = str
    .replace(/^أ\.?\s*د\s*\/?:?\s*/i, '')
    .replace(/^د\s*\/?:?\s*/i, '')
    .trim();
  if (!withoutPrefix) return '';
  return 'أ.د/ ' + withoutPrefix;
}

/**
 * Smart Column Mapping scanning all keys from the top rows
 */
export function getColumnMapping(dataArray) {
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
 * Read file to ArrayBuffer
 */
async function fileToArrayBuffer(file) {
  if (!file) return null;
  return await file.arrayBuffer();
}

/**
 * Fallback direct parser if Web Worker is unavailable
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
 * Run task in Web Worker with fallback
 */
function runInWorker(type, payload, onProgress = null) {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(new URL('../workers/excelWorker.js', import.meta.url), {
        type: 'module',
      });

      const id = crypto.randomUUID();

      worker.onmessage = (e) => {
        const data = e.data;
        if (data.id !== id) return;

        if (data.type === 'PROGRESS') {
          if (onProgress) onProgress(data.message);
        } else if (data.type === 'SUCCESS') {
          worker.terminate();
          resolve(data.result);
        } else if (data.type === 'ERROR') {
          worker.terminate();
          reject(new Error(data.error));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        reject(err);
      };

      worker.postMessage({ type, payload, id });
    } catch (workerErr) {
      console.warn('Web Worker creation failed, falling back to main thread:', workerErr);
      reject(workerErr);
    }
  });
}

/**
 * Main parser merging Docs, Old, and New sheets using Web Worker
 */
export async function parseAndMergeSheets({ docsFile, oldFile, newFile, onProgress = null }) {
  if (!docsFile && !oldFile && !newFile) {
    throw new Error('برجاء رفع شيت واحد على الأقل!');
  }

  try {
    // Attempt fast non-blocking worker parsing
    const [docsBuffer, oldBuffer, newBuffer] = await Promise.all([
      fileToArrayBuffer(docsFile),
      fileToArrayBuffer(oldFile),
      fileToArrayBuffer(newFile),
    ]);

    return await runInWorker('PARSE_AND_MERGE', { docsBuffer, oldBuffer, newBuffer }, onProgress);
  } catch (workerError) {
    console.warn('Falling back to synchronous main thread parsing:', workerError);

    // Fallback on main thread
    const [docsData, oldData, newData] = await Promise.all([
      readExcelFile(docsFile),
      readExcelFile(oldFile),
      readExcelFile(newFile),
    ]);

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
          const n = cleanDoctorName(row[mapConf.name] || '');
          const gvr = cleanGeneralText(row[mapConf.gvr] || '');
          const city = cleanGeneralText(row[mapConf.city] || '');
          const region = cleanGeneralText(row[mapConf.region] || '');

          doctorsMap[idCode] = {
            doc_code: cleanGeneralText(idCode),
            name: n,
            specialty: cleanGeneralText(row[mapConf.specialty] || ''),
            address: cleanGeneralText(row[mapConf.address] || ''),
            gvr,
            city,
            region,
            pageGvr: gvr,
            pageCity: city,
            pageRegion: region,
            mobile: cleanGeneralText(row[mapConf.mobile] || ''),
            home_tel: cleanGeneralText(row[mapConf.home_tel] || ''),
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
}

/**
 * Parse sheets for "تحديث الحالات فقط" (Old & New stats only) with Web Worker
 */
export async function parseStatsOnly({ oldFile, newFile, onProgress = null }) {
  if (!oldFile && !newFile) {
    throw new Error('برجاء رفع شيت القديم أو الجديد على الأقل!');
  }

  try {
    const [oldBuffer, newBuffer] = await Promise.all([
      fileToArrayBuffer(oldFile),
      fileToArrayBuffer(newFile),
    ]);

    return await runInWorker('PARSE_STATS_ONLY', { oldBuffer, newBuffer }, onProgress);
  } catch (workerError) {
    console.warn('Falling back to synchronous stats parser:', workerError);

    const [oldData, newData] = await Promise.all([
      readExcelFile(oldFile),
      readExcelFile(newFile),
    ]);

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
}
