import { useDoctorStore } from '../store/useDoctorStore';

/**
 * HTML Escaping helper
 */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Strict print stylesheet matching the exact 21-item A4 specification
 */
function getPrintStyles() {
  let inheritedStyles = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((el) => {
    inheritedStyles += el.outerHTML;
  });

  const strictPrintCSS = `
    <style>
      @page {
        size: A4 portrait;
        margin: 0 !important;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        font-family: 'Arial', 'Tahoma', 'Segoe UI', sans-serif;
        direction: rtl;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .page {
        margin: 0 !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        width: 210mm !important;
        height: 297mm !important;
        max-height: 297mm !important;
        padding: 10mm !important;
        page-break-after: always !important;
        page-break-inside: avoid !important;
        overflow: hidden !important;
        background: white !important;
        box-sizing: border-box !important;
      }
      .print-original-header {
        display: flex !important;
        justify-content: space-between !important;
        font-weight: bold !important;
        font-size: 18px !important;
        margin-bottom: 10px !important;
        padding: 0 20px !important;
        height: 10mm !important;
        max-height: 10mm !important;
        overflow: hidden !important;
        align-items: center !important;
        box-sizing: border-box !important;
      }
      .print-original-header div {
        flex: 1 !important;
        text-align: center !important;
      }
      .print-original-header div:first-child {
        text-align: right !important;
      }
      .print-original-header div:last-child {
        text-align: left !important;
      }
      .grid-container {
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        grid-template-rows: repeat(7, calc(255mm / 7)) !important;
        height: 255mm !important;
        max-height: 255mm !important;
        border-top: 2px solid black !important;
        border-right: 2px solid black !important;
        border-bottom: none !important;
        border-left: none !important;
        background: white !important;
        gap: 0 !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      .grid-item {
        border: none !important;
        border-bottom: 2px solid black !important;
        border-left: 2px solid black !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        padding: 5px 6px !important;
        margin: 0 !important;
        background: white !important;
        height: calc(255mm / 7) !important;
        max-height: calc(255mm / 7) !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: space-between !important;
      }
      .top-row {
        display: flex !important;
        justify-content: space-between !important;
        align-items: flex-start !important;
        margin-bottom: 2px !important;
      }
      .left-actions {
        display: flex !important;
        gap: 3px !important;
      }
      .code-box {
        border: 1px solid black !important;
        min-width: 35px !important;
        height: 22px !important;
        line-height: 20px !important;
        text-align: center !important;
        font-size: 11px !important;
        font-weight: bold !important;
        background: #f4f4f4 !important;
        padding: 0 4px !important;
      }
      .boxes-wrapper {
        display: flex !important;
        gap: 5px !important;
      }
      .box {
        border: 1px solid black !important;
        width: 45px !important;
        height: 25px !important;
        line-height: 23px !important;
        text-align: center !important;
        font-weight: bold !important;
        background: white !important;
      }
      .doc-info {
        text-align: right !important;
        line-height: 1.25 !important;
        overflow: hidden !important;
        max-height: calc(255mm / 7 - 42px) !important;
      }
      .doc-name {
        font-weight: bold !important;
        font-size: 13.5px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        line-height: 1.2 !important;
      }
      .doc-info > div {
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      .bottom-row {
        display: flex !important;
        justify-content: space-between !important;
        font-size: 11px !important;
        margin-top: auto !important;
        font-weight: bold !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      .moved-text {
        font-size: 10px !important;
        font-weight: bold !important;
        margin-top: 2px !important;
        background: #fff !important;
        padding: 1px 3px !important;
        border-radius: 2px !important;
        display: inline-block !important;
        border: 1px solid !important;
        line-height: 1.1 !important;
      }
      .note-moved { color: #d9534f !important; border-color: #d9534f !important; }
      .note-merged { color: #800080 !important; border-color: #800080 !important; }
      .modified { background-color: #ffeb3b !important; }
      .moved-highlight { background-color: #ffe6e6 !important; }
      .updated-stats { background-color: #d4edda !important; }
      .inactive-doc { background-color: transparent !important; }
      .inactive-doc > * { display: none !important; }
    </style>
  `;

  return inheritedStyles + strictPrintCSS;
}

/**
 * Generate print HTML for a single doctor card
 */
function renderDoctorCardHTML(doc) {
  if (doc.is_inactive) {
    return `<div class="grid-item inactive-doc"></div>`;
  }

  const hasData = Boolean(doc.doc_code || doc.name);
  if (!hasData) {
    return `<div class="grid-item"></div>`;
  }

  const getModClass = (f) => {
    if (doc[f + '_updated']) return 'updated-stats';
    if (doc[f + '_modified']) return 'modified';
    return '';
  };

  const movedClass = doc.is_moved ? 'moved-highlight' : '';

  return `
    <div class="grid-item ${movedClass}">
      <div class="top-row">
        <div class="left-actions">
          <div class="code-box ${getModClass('doc_code')}">${escapeHTML(doc.doc_code || '')}</div>
        </div>
        <div class="boxes-wrapper">
          <div class="box ${getModClass('old_stats')}">${doc.old_stats !== undefined && doc.old_stats !== null ? escapeHTML(String(doc.old_stats)) : ''}</div>
          <div class="box ${getModClass('new_stats')}">${doc.new_stats !== undefined && doc.new_stats !== null ? escapeHTML(String(doc.new_stats)) : ''}</div>
          <div class="box ${getModClass('counter')}">${doc.counter !== undefined && doc.counter !== null ? escapeHTML(String(doc.counter)) : ''}</div>
        </div>
      </div>
      <div class="doc-info">
        <div class="doc-name ${getModClass('name')}">${escapeHTML(doc.name || '')}</div>
        <div class="${getModClass('specialty')}">${escapeHTML(doc.specialty || '')}</div>
        <div class="${getModClass('address')}">${escapeHTML(doc.address || '')}</div>
        ${doc.is_moved && doc.moved_from ? `<div class="moved-text note-moved">كان في: ${escapeHTML(doc.moved_from)}</div>` : ''}
        ${doc.merged_codes && doc.merged_codes.length ? `<div class="moved-text note-merged">+ مدمج مع: ${escapeHTML(doc.merged_codes.join(', '))}</div>` : ''}
      </div>
      <div class="bottom-row">
        <div class="${getModClass('mobile')}">${escapeHTML(doc.mobile || '')}</div>
        <div class="${getModClass('home_tel')}">${escapeHTML(doc.home_tel || '')}</div>
      </div>
    </div>
  `;
}

/**
 * Generate full printable pages HTML
 */
function generatePrintHTML(selectedPages, displayedDoctors) {
  let pagesHtml = '';

  selectedPages.forEach((pageNum) => {
    const startIndex = (pageNum - 1) * 21;
    const pageDocs = displayedDoctors.slice(startIndex, startIndex + 21);

    const firstDoc = pageDocs[0] || {};
    const lastRealDoc = [...pageDocs].reverse().find((d) => d.name || d.doc_code) || firstDoc;

    const gvr = firstDoc.pageGvr === lastRealDoc.pageGvr || !lastRealDoc.pageGvr
      ? (firstDoc.pageGvr || '')
      : `${firstDoc.pageGvr} / ${lastRealDoc.pageGvr}`;

    const city = firstDoc.pageCity === lastRealDoc.pageCity || !lastRealDoc.pageCity
      ? (firstDoc.pageCity || '')
      : `${firstDoc.pageCity} / ${lastRealDoc.pageCity}`;

    const region = firstDoc.pageRegion === lastRealDoc.pageRegion || !lastRealDoc.pageRegion
      ? (firstDoc.pageRegion || '')
      : `${firstDoc.pageRegion || 'مناطق متعددة'} / ${lastRealDoc.pageRegion || 'مناطق متعددة'}`;

    const mGvr = firstDoc.pageGvr_modified ? 'modified' : '';
    const mCity = firstDoc.pageCity_modified ? 'modified' : '';
    const mReg = firstDoc.pageRegion_modified ? 'modified' : '';

    let cardsHtml = '';
    for (let j = 0; j < 21; j++) {
      const doc = pageDocs[j] || {};
      cardsHtml += renderDoctorCardHTML(doc);
    }

    pagesHtml += `
      <div class="page" id="page-${pageNum}">
        <div class="print-original-header">
          <div class="${mGvr}">${escapeHTML(gvr)}</div>
          <div class="${mCity}">${escapeHTML(city)}</div>
          <div class="${mReg}">${escapeHTML(region)}</div>
        </div>
        <div class="grid-container">
          ${cardsHtml}
        </div>
      </div>
    `;
  });

  return pagesHtml;
}

/**
 * Create a non-intrusive floating progress indicator during print document assembly
 */
function showPrintOverlay(pageCount) {
  const overlay = document.createElement('div');
  overlay.id = 'print-prep-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(15, 23, 42, 0.95);
    color: white;
    padding: 12px 24px;
    border-radius: 9999px;
    font-size: 13px;
    font-weight: bold;
    z-index: 999999;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    gap: 10px;
    backdrop-filter: blur(8px);
    direction: rtl;
    border: 1px solid rgba(255, 255, 255, 0.15);
  `;
  overlay.innerHTML = `
    <svg style="animation: spin 1s linear infinite; width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
      <path d="M12 2a10 10 0 0 1 10 10"></path>
    </svg>
    <span>جاري تجهيز ${pageCount} صفحة للطباعة (بدون تجميد المتصفح)...</span>
    <style>@keyframes spin { 100% { transform: rotate(360deg); } }</style>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Massive Document Printing Engine
 * Prints hundreds or 700+ pages instantly via an isolated hidden iframe
 * ensuring the main application thread never freezes or lags.
 */
export function handleExportPDF(pageRangeStr, totalPages, setSelectedPages = null) {
  const doctorsList = useDoctorStore.getState().displayedDoctors || [];
  const actualTotalPages = totalPages || Math.ceil(doctorsList.length / 21);

  if (actualTotalPages === 0 || doctorsList.length === 0) {
    alert('لا توجد بيانات لطباعتها!');
    return;
  }

  const input = (pageRangeStr || '').trim();
  let sel = [];

  if (!input || input === 'الكل') {
    for (let i = 1; i <= actualTotalPages; i++) sel.push(i);
  } else {
    input.split(',').forEach((p) => {
      const part = p.trim();
      if (part.includes('-')) {
        const [s, e] = part.split('-').map(Number);
        if (s && e && s <= e) {
          for (let i = s; i <= e; i++) sel.push(i);
        }
      } else {
        const n = Number(part);
        if (n) sel.push(n);
      }
    });
  }

  sel = sel.filter((p) => p >= 1 && p <= actualTotalPages);
  if (!sel.length) {
    alert('صيغة الصفحات غير صحيحة!');
    return;
  }

  // 1. Show non-blocking preparing overlay
  const overlay = showPrintOverlay(sel.length);

  // 2. Build isolated hidden iframe to handle rendering off the main React tree
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed; top:-99999px; left:-99999px; width:0; height:0; border:none; visibility:hidden;';
  document.body.appendChild(iframe);

  const cleanup = () => {
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    if (iframe && iframe.parentNode) {
      setTimeout(() => {
        try {
          iframe.parentNode.removeChild(iframe);
        } catch (e) {}
      }, 1000);
    }
  };

  // Generate HTML and write into iframe document
  setTimeout(() => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      const printStyles = getPrintStyles();
      const pagesContent = generatePrintHTML(sel, doctorsList);

      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8" />
            <title>طباعة داتا الأطباء (${sel.length} صفحة)</title>
            ${printStyles}
          </head>
          <body>
            ${pagesContent}
          </body>
        </html>
      `);
      iframeDoc.close();

      // Wait a tick for iframe CSS and layout calculation
      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }

        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        // Setup afterprint or safety timeout cleanup
        iframe.contentWindow.addEventListener('afterprint', cleanup);
        setTimeout(cleanup, 5000);
      }, 350);

    } catch (err) {
      console.error('Error during isolated iframe print generation:', err);
      cleanup();
      // Fallback to standard window.print if iframe creation is restricted by browser security
      if (setSelectedPages) {
        setSelectedPages(sel);
        setTimeout(() => {
          window.print();
          setSelectedPages(null);
        }, 300);
      }
    }
  }, 50);
}
