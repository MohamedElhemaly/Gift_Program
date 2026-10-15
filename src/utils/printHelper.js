/**
 * Parse page range string and trigger browser print dialog
 */
export function handleExportPDF(pageRangeStr, totalPages, setSelectedPages) {
  if (totalPages === 0) {
    alert('لا توجد بيانات لطباعتها!');
    return;
  }

  const input = (pageRangeStr || '').trim();
  let sel = [];

  if (!input || input === 'الكل') {
    for (let i = 1; i <= totalPages; i++) sel.push(i);
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

  sel = sel.filter((p) => p >= 1 && p <= totalPages);
  if (!sel.length) {
    alert('صيغة الصفحات غير صحيحة!');
    return;
  }

  // Filter visible pages for printing
  setSelectedPages(sel);

  setTimeout(() => {
    window.print();
    // Reset to show all pages again after printing
    setTimeout(() => {
      setSelectedPages(null);
    }, 500);
  }, 300);
}
