import * as XLSX from 'xlsx';

export const COL_DEFS = {
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
    let match = rowKeys.find((rk) => possibles.some((p) => rk.norm === p));
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

        const rawSpec = cleanGeneralText(row[mapConf.specialty] || '');
        const rawAddr = cleanGeneralText(row[mapConf.address] || '');
        const rawMob = cleanGeneralText(row[mapConf.mobile] || '');
        const rawHome = cleanGeneralText(row[mapConf.home_tel] || '');
        const rawName = cleanDoctorName(row[mapConf.name] || '');
        const gvr = cleanGeneralText(row[mapConf.gvr] || '');
        const city = cleanGeneralText(row[mapConf.city] || '');
        const region = cleanGeneralText(row[mapConf.region] || '');

        if (!doctorsMap[idCode]) {
          doctorsMap[idCode] = {
            doc_code: cleanGeneralText(idCode),
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
