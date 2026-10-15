import React, { useState, useMemo } from 'react';
import A4Page from './A4Page';
import { useDoctorStore } from '../../store/useDoctorStore';
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft, Search, Layers, FileSpreadsheet, UserPlus } from 'lucide-react';

export default function ReportView({ selectedPages = null }) {
  const { displayedDoctors, openAddDoctorModal, autoSaveState } = useDoctorStore();

  // Screen Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pagesPerPage, setPagesPerPage] = useState(10);
  const [jumpInput, setJumpInput] = useState('');
  const [filterQuery, setFilterQuery] = useState('');

  const totalPages = Math.ceil((displayedDoctors?.length || 0) / 21);

  // Group doctors into pages
  const allPages = useMemo(() => {
    if (!displayedDoctors || displayedDoctors.length === 0) return [];
    const p = [];
    let num = 1;
    for (let i = 0; i < displayedDoctors.length; i += 21) {
      p.push({
        pageNum: num,
        startIndex: i,
        pageDocs: displayedDoctors.slice(i, i + 21),
      });
      num++;
    }
    return p;
  }, [displayedDoctors]);

  // Filter pages by governorate, city, region, or doctor query on screen
  const filteredPages = useMemo(() => {
    if (!filterQuery.trim()) return allPages;
    const q = filterQuery.toLowerCase().trim();
    return allPages.filter(({ pageDocs }) => {
      return pageDocs.some((d) => {
        return (
          (d.name && d.name.toLowerCase().includes(q)) ||
          (d.doc_code && String(d.doc_code).toLowerCase().includes(q)) ||
          (d.pageGvr && d.pageGvr.toLowerCase().includes(q)) ||
          (d.pageCity && d.pageCity.toLowerCase().includes(q)) ||
          (d.pageRegion && d.pageRegion.toLowerCase().includes(q)) ||
          (d.specialty && d.specialty.toLowerCase().includes(q))
        );
      });
    });
  }, [allPages, filterQuery]);

  if (!displayedDoctors || displayedDoctors.length === 0) {
    return null;
  }

  // PRINT MODE: If selectedPages is active, render the requested print pages
  if (selectedPages !== null && selectedPages.length > 0) {
    return (
      <div id="reportContainer" className="my-6">
        {allPages
          .filter((p) => selectedPages.includes(p.pageNum))
          .map((p) => (
            <A4Page
              key={`page-${p.pageNum}`}
              pageDocs={p.pageDocs}
              pageNum={p.pageNum}
              startIndex={p.startIndex}
              isVisible={true}
            />
          ))}
      </div>
    );
  }

  // SCREEN MODE: Paginate to keep the browser silky smooth
  const effectiveTotalPages = filteredPages.length;
  const maxPage = pagesPerPage === 'ALL' ? 1 : Math.ceil(effectiveTotalPages / pagesPerPage);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), maxPage || 1);

  const visiblePages = pagesPerPage === 'ALL'
    ? filteredPages
    : filteredPages.slice((safeCurrentPage - 1) * pagesPerPage, safeCurrentPage * pagesPerPage);

  const handleJump = (e) => {
    e.preventDefault();
    const target = parseInt(jumpInput, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      // Find the page in filtered pages
      const foundIdx = filteredPages.findIndex((p) => p.pageNum === target);
      if (foundIdx !== -1) {
        if (pagesPerPage !== 'ALL') {
          const newBatch = Math.floor(foundIdx / pagesPerPage) + 1;
          setCurrentPage(newBatch);
        }
        setJumpInput('');
        // Smooth scroll to page element
        setTimeout(() => {
          const el = document.getElementById(`page-${target}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      } else {
        alert(`الصفحة ${target} غير مطابقة لفلتر البحث الحالي.`);
      }
    }
  };

  return (
    <div id="reportContainer" className="my-6">
      {/* On-Screen Navigation & Performance Pagination Toolbar (Hidden on Print) */}
      <div className="no-print bg-white border border-slate-200 rounded-2xl shadow-sm p-4 mb-6 sticky top-14 z-40 backdrop-blur-md bg-white/95">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Summary Info & Live AutoSave Indicator */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-800 text-sm">
                  تقرير الأطباء (شبكة A4 المعتمدة)
                </h3>
                <span className="bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {totalPages} صفحة A4
                </span>
                {/* Auto-Save Live Status */}
                {autoSaveState === 'saving' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    جاري الحفظ...
                  </span>
                ) : autoSaveState === 'error' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                    حفظ محلي
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                    تم الحفظ تلقائياً
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                إجمالي الأطباء: {displayedDoctors.filter(d => d.name || d.doc_code).length} طبيب
                {filteredPages.length !== allPages.length && ` (المطابق للبحث: ${filteredPages.length} صفحة)`}
              </p>
            </div>
          </div>

          {/* Add Doctor Quick Button */}
          <button
            type="button"
            onClick={() => openAddDoctorModal()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
            title="إضافة طبيب جديد"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة طبيب</span>
          </button>

          {/* Quick Search on Screen */}
          <div className="flex items-center gap-2 flex-1 max-w-xs min-w-[200px]">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5" />
              <input
                type="text"
                placeholder="بحث سريع (طبيب / كود / محافظة)..."
                value={filterQuery}
                onChange={(e) => {
                  setFilterQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-3 text-xs">
            {/* Pages per view dropdown */}
            <div className="flex items-center gap-1.5 text-gray-600 font-medium">
              <Layers className="w-3.5 h-3.5 text-gray-400" />
              <span>عرض:</span>
              <select
                value={pagesPerPage}
                onChange={(e) => {
                  const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                  setPagesPerPage(val);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none"
              >
                <option value={5}>5 صفحات</option>
                <option value={10}>10 صفحات</option>
                <option value={20}>20 صفحة</option>
                <option value={50}>50 صفحة</option>
                <option value="ALL">عرض الكل</option>
              </select>
            </div>

            {/* Prev / Next buttons */}
            {pagesPerPage !== 'ALL' && maxPage > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="الصفحة الأولى"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  disabled={safeCurrentPage === 1}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="الصفحة السابقة"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <span className="font-bold text-gray-700 px-2">
                  مجموعة {safeCurrentPage} من {maxPage}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, maxPage))}
                  disabled={safeCurrentPage === maxPage}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="الصفحة التالية"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage(maxPage)}
                  disabled={safeCurrentPage === maxPage}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="الصفحة الأخيرة"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Jump to specific page */}
            <form onSubmit={handleJump} className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={totalPages}
                placeholder="رقم..."
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                className="w-16 text-center border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-bold focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-1 rounded-lg text-xs transition-colors"
              >
                انتقال
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Rendered A4 Pages */}
      {visiblePages.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
          لم يتم العثور على صفحات مطابقة لكلمة البحث "{filterQuery}".
        </div>
      ) : (
        visiblePages.map((p) => (
          <A4Page
            key={`page-${p.pageNum}`}
            pageDocs={p.pageDocs}
            pageNum={p.pageNum}
            startIndex={p.startIndex}
            isVisible={true}
          />
        ))
      )}

      {/* Bottom Pagination Bar when pages are long */}
      {pagesPerPage !== 'ALL' && maxPage > 1 && (
        <div className="no-print flex items-center justify-center gap-3 my-8">
          <button
            onClick={() => {
              setCurrentPage((p) => Math.max(p - 1, 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={safeCurrentPage === 1}
            className="flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs shadow-xs disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
            <span>الصفحات السابقة</span>
          </button>

          <span className="text-xs text-gray-500 font-bold">
            عرض الصفحات {((safeCurrentPage - 1) * pagesPerPage) + 1} إلى {Math.min(safeCurrentPage * pagesPerPage, effectiveTotalPages)} من إجمالي {totalPages} صفحة
          </span>

          <button
            onClick={() => {
              setCurrentPage((p) => Math.min(p + 1, maxPage));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={safeCurrentPage === maxPage}
            className="flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-50 text-gray-700 font-bold px-4 py-2 rounded-xl text-xs shadow-xs disabled:opacity-40"
          >
            <span>الصفحات التالية</span>
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
