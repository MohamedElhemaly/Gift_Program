import * as XLSX from 'xlsx';

export const COL_DEFS = {
  code: ['doctor code', 'doctor co', 'id', 'code', 'كود', 'كود الطبيب', 'كود_الطبيب', 'رقم الطبيب'],
  name: ['doctor name', 'name', 'اسم', 'اسم الطبيب', 'الطبيب', 'اسم_الطبيب', 'دكتور', 'اسم الدكتور'],
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

const GOV_CITY_MAP = {
  'الإسكندرية': ['اسكندرية', 'الإسكندرية', 'سموحة', 'سيدى جابر', 'سيدي جابر', 'محرم بك', 'لوران', 'فيكتوريا', 'الازاريطه', 'الأزارطة', 'العصافرة', 'ميامى', 'ميامي', 'سيدي بشر', 'محطة الرمل', 'العجمي', 'العجمى', 'الابراهيمية', 'الإبراهيمية', 'بولكلي', 'كليوباترا', 'المندرة', 'رشدي', 'جناكليس', 'كامب شيزار', 'سبورتنج', 'المعمورة', 'المعموره'],
  'البحيرة': ['البحيرة', 'دمنهور', 'كفر الدوار', 'ايتاي البارود', 'إيتاي البارود', 'كوم حمادة', 'ابو حمص', 'أبو حمص', 'حوش عيسى', 'الدلنجات', 'رشيد', 'ابو المطامير', 'أبو المطامير', 'ادكو', 'إدكو', 'شبراخيت', 'الرحمانية', 'المحمودية', 'وادي النطرون'],
  'الغربية': ['الغربية', 'طنطا', 'المحلة', 'المحله', 'زفتى', 'زفتي', 'كفر الزيات', 'سمنود', 'بسيون', 'قطور', 'السنطة'],
  'القاهرة': ['القاهرة', 'مدينة نصر', 'مصر الجديدة', 'المعادي', 'المعادى', 'حلوان', 'شبرا', 'عين شمس', 'المرج', 'الزيتون', 'المطرية', 'العباسية', 'التجمع', 'الرحاب', 'الشروق', 'بدر', 'المقطم', 'الزمالك', 'وسط البلد'],
  'الجيزة': ['الجيزة', 'الدقي', 'الدقى', 'المهندسين', 'الهرم', 'فيصل', 'العجوزة', '6 اكتوبر', 'أكتوبر', 'الشيخ زايد', 'الحوامدية', 'البدرشين', 'الصف', 'أطفيح', 'العياط'],
  'كفر الشيخ': ['كفر الشيخ', 'دسوق', 'فوه', 'مطوبس', 'سيدي سالم', 'بيلا', 'الحامول', 'بلطيم', 'قلين', 'الرياض'],
  'المنوفية': ['المنوفية', 'شبين الكوم', 'منوف', 'اشمون', 'أشمون', 'قويسنا', 'بركة السبع', 'تلا', 'الشهداء', 'السادات', 'سرس الليان'],
  'الدقهلية': ['الدقهلية', 'المنصورة', 'ميت غمر', 'السنبلاوين', 'دكرنس', 'بلقاس', 'شربين', 'المنزلة', 'طلخا', 'نبروه'],
  'القليوبية': ['القليوبية', 'بنها', 'شبرا الخيمة', 'قليوب', 'الخانكة', 'القناطر الخيرية', 'طوخ', 'شبين القناطر', 'العبور', 'قها', 'كفر شكر']
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
  const s = String(val).trim();
  if (s === 'NO' || s === 'null' || s === 'undefined') return '';
  return s
    .replace(/[%*#_~^]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function inferDoctorLocation(rawGvr, rawCity, rawReg, rawAddress, code) {
  let gvr = cleanGeneralText(rawGvr);
  let city = cleanGeneralText(rawCity);
  let reg = cleanGeneralText(rawReg);
  const addr = cleanGeneralText(rawAddress);

  if (gvr === 'الاسكندرية') gvr = 'الإسكندرية';

  if (!gvr) {
    const textToScan = `${city} ${reg} ${addr} ${code}`;
    for (const [govName, cityList] of Object.entries(GOV_CITY_MAP)) {
      for (const c of cityList) {
        if (textToScan.includes(c)) {
          gvr = govName;
          if (!city) city = c;
          break;
        }
      }
      if (gvr) break;
    }
  }

  return {
    gvr: gvr || 'غير محدد',
    city: city || '',
    region: reg || '',
  };
}

export function cleanDoctorName(val, code) {
  if (val === undefined || val === null) return `طبيب (كود: ${code || ''})`;
  const raw = String(val).trim();
  if (!raw) return `طبيب (كود: ${code || ''})`;

  const cleaned = raw.replace(/[%*#_~^]/g, ' ').replace(/\s+/g, ' ').trim();
  const withoutPrefix = cleaned
    .replace(/^أ\.?\s*د\s*\/?:?\s*/i, '')
    .replace(/^د\s*\/?:?\s*/i, '')
    .trim();

  if (!withoutPrefix || /^\d+$/.test(withoutPrefix)) {
    return `طبيب (كود: ${code || ''})`;
  }

  return 'أ.د/ ' + withoutPrefix;
}

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

async function fileToArrayBuffer(file) {
  if (!file) return null;
  return await file.arrayBuffer();
}

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

export async function parseAndMergeSheets({ docsFile, oldFile, newFile, onProgress = null }) {
  if (!docsFile && !oldFile && !newFile) {
    throw new Error('برجاء رفع شيت واحد على الأقل!');
  }

  try {
    const [docsBuffer, oldBuffer, newBuffer] = await Promise.all([
      fileToArrayBuffer(docsFile),
      fileToArrayBuffer(oldFile),
      fileToArrayBuffer(newFile),
    ]);

    return await runInWorker('PARSE_AND_MERGE', { docsBuffer, oldBuffer, newBuffer }, onProgress);
  } catch (workerError) {
    console.warn('Falling back to synchronous main thread parsing:', workerError);

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

      dataset.forEach((row, rowIdx) => {
        let rawCode = row[mapConf.code];
        if (rawCode === undefined || rawCode === null) return;
        let idCode = String(rawCode).trim();
        if (idCode === '') return;

        let rawName = row[mapConf.name];
        let rawAddr = cleanGeneralText(row[mapConf.address] || '');
        let rawMob = cleanGeneralText(row[mapConf.mobile] || '');
        let rawHome = cleanGeneralText(row[mapConf.home_tel] || '');
        let rawSpec = cleanGeneralText(row[mapConf.specialty] || '');

        if (idCode.length > 25 && /^[0-9]+$/.test(String(rawName || '').trim())) {
          rawAddr = idCode;
          rawMob = String(rawName).trim();
          idCode = `MISC_${rowIdx + 1}`;
          rawName = `طبيب عيادة (${rawAddr.slice(0, 20)}...)`;
        }

        const loc = inferDoctorLocation(
          row[mapConf.gvr],
          row[mapConf.city],
          row[mapConf.region],
          rawAddr,
          idCode
        );

        const finalName = cleanDoctorName(rawName, idCode);

        if (!doctorsMap[idCode]) {
          doctorsMap[idCode] = {
            doc_code: idCode,
            name: finalName,
            specialty: rawSpec,
            address: rawAddr,
            gvr: loc.gvr,
            city: loc.city,
            region: loc.region,
            pageGvr: loc.gvr,
            pageCity: loc.city,
            pageRegion: loc.region,
            mobile: rawMob,
            home_tel: rawHome,
            old_stats: '',
            new_stats: '',
            is_moved: false,
            moved_from: '',
            is_inactive: false,
            merged_codes: [],
            display_order: rowIdx + 1,
          };
        } else {
          if ((!doctorsMap[idCode].name || doctorsMap[idCode].name.startsWith('طبيب (كود:')) && finalName) {
            doctorsMap[idCode].name = finalName;
          }
          if (!doctorsMap[idCode].specialty && rawSpec) doctorsMap[idCode].specialty = rawSpec;
          if (!doctorsMap[idCode].address && rawAddr) doctorsMap[idCode].address = rawAddr;
          if (!doctorsMap[idCode].mobile && rawMob) doctorsMap[idCode].mobile = rawMob;
          if (!doctorsMap[idCode].home_tel && rawHome) doctorsMap[idCode].home_tel = rawHome;
          if (doctorsMap[idCode].pageGvr === 'غير محدد' && loc.gvr !== 'غير محدد') {
            doctorsMap[idCode].gvr = loc.gvr;
            doctorsMap[idCode].pageGvr = loc.gvr;
            doctorsMap[idCode].city = loc.city;
            doctorsMap[idCode].pageCity = loc.city;
            doctorsMap[idCode].region = loc.region;
            doctorsMap[idCode].pageRegion = loc.region;
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
        if (countVal !== undefined && countVal !== null && countVal !== '') {
          const parsedCount = parseInt(String(countVal).trim(), 10) || 0;
          if (type === 'docs' || type === 'old') {
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

    return Object.values(doctorsMap);
  }
}

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
        if (val !== undefined && val !== null && val !== '') {
          if (!updatesMap[c]) updatesMap[c] = { doc_code: c };
          updatesMap[c].old_stats = parseInt(String(val).trim(), 10) || 0;
        }
      }
    });

    newData.forEach((r) => {
      const code = r[newMapConf.code];
      if (code) {
        const c = String(code).trim();
        const val = r[newMapConf.count_new] !== undefined ? r[newMapConf.count_new] : r[newMapConf.count_general];
        if (val !== undefined && val !== null && val !== '') {
          if (!updatesMap[c]) updatesMap[c] = { doc_code: c };
          updatesMap[c].new_stats = parseInt(String(val).trim(), 10) || 0;
        }
      }
    });

    return Object.values(updatesMap);
  }
}
