import React, { useState, useMemo, useEffect, useRef, useLayoutEffect } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import A4Page from './A4Page';
import { useDoctorStore } from '../../store/useDoctorStore';
import {
  ChevronRight,
  ChevronLeft,
  ChevronsRight,
  ChevronsLeft,
  Search,
  Layers,
  FileSpreadsheet,
  UserPlus,
  Printer,
  X,
  Target,
  Hash,
  Lock,
  Unlock,
  Zap,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportView({ selectedPages = null }) {
  const {
    displayedDoctors,
    rawDoctors,
    openAddDoctorModal,
    autoSaveState,
    filters,
    setFilter,
    resetFilters,
    openPrintModal,
    targetPageJump,
    setTargetPageJump,
  } = useDoctorStore();

  const isReadOnly = Boolean(
    (filters?.governorate && filters.governorate.trim()) ||
    (filters?.city && filters.city.trim()) ||
    (filters?.region && filters.region.trim()) ||
    (filters?.specialty && filters.specialty.trim()) ||
    (filters?.searchTerm && filters.searchTerm.trim()) ||
    (filters?.status && filters.status !== 'all')
  );

  // Screen Pagination & Jump State
  const [currentPage, setCurrentPage] = useState(1);
  const [pagesPerPage, setPagesPerPage] = useState(10);
  const [jumpInput, setJumpInput] = useState('');
  const [jumpDocCodeInput, setJumpDocCodeInput] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(null);

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

  // SCREEN MODE & VIRTUALIZATION CALCULATION
  const effectiveTotalPages = allPages.length;
  const isAllMode = pagesPerPage === 'ALL';
  const shouldVirtualize = isAllMode || pagesPerPage >= 50;

  const maxPage = isAllMode ? 1 : Math.ceil(effectiveTotalPages / pagesPerPage);
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), maxPage || 1);

  const visiblePages = useMemo(() => {
    if (isAllMode) return allPages;
    return allPages.slice((safeCurrentPage - 1) * pagesPerPage, safeCurrentPage * pagesPerPage);
  }, [isAllMode, allPages, safeCurrentPage, pagesPerPage]);

  const itemsToVirtualize = visiblePages;

  // DOM Virtualization reference & offset measurement
  const parentRef = useRef(null);
  const [parentOffset, setParentOffset] = useState(0);

  useLayoutEffect(() => {
    const updateOffset = () => {
      if (parentRef.current) {
        const rect = parentRef.current.getBoundingClientRect();
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        setParentOffset(Math.round(rect.top + scrollY));
      }
    };
    updateOffset();
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, [isReadOnly, displayedDoctors?.length, pagesPerPage]);

  // Window Virtualizer for silky smooth 60fps scrolling on low-end hardware
  const virtualizer = useWindowVirtualizer({
    count: shouldVirtualize ? itemsToVirtualize.length : 0,
    estimateSize: () => 1400,
    overscan: 2,
    scrollMargin: parentOffset,
    getItemKey: (index) => itemsToVirtualize[index]?.pageNum ?? index,
  });

  // Auto-Navigate when a new doctor is added to a newly created page
  useEffect(() => {
    if (targetPageJump) {
      if (isAllMode) {
        virtualizer.scrollToIndex(targetPageJump - 1, { align: 'start', behavior: 'smooth' });
      } else if (shouldVirtualize) {
        const targetBatch = Math.floor((targetPageJump - 1) / pagesPerPage) + 1;
        if (safeCurrentPage !== targetBatch) {
          setCurrentPage(targetBatch);
        }
        const indexInBatch = (targetPageJump - 1) % pagesPerPage;
        setTimeout(() => {
          virtualizer.scrollToIndex(indexInBatch, { align: 'start', behavior: 'smooth' });
        }, 80);
      } else {
        const targetBatch = Math.floor((targetPageJump - 1) / pagesPerPage) + 1;
        setCurrentPage(targetBatch);
        setTimeout(() => {
          const el = document.getElementById(`page-${targetPageJump}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 150);
      }
      setTargetPageJump(null);
    }
  }, [targetPageJump, isAllMode, shouldVirtualize, pagesPerPage, safeCurrentPage, setTargetPageJump, virtualizer]);

  // PRINT MODE: If selectedPages is active, render the requested print pages (Pure Static HTML - Unvirtualized)
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

  if (!displayedDoctors || displayedDoctors.length === 0) {
    return null;
  }

  const handleJump = (e) => {
    e.preventDefault();
    const target = parseInt(jumpInput, 10);
    if (!isNaN(target) && target >= 1 && target <= totalPages) {
      if (isAllMode) {
        virtualizer.scrollToIndex(target - 1, { align: 'start', behavior: 'smooth' });
      } else if (shouldVirtualize) {
        const targetBatch = Math.floor((target - 1) / pagesPerPage) + 1;
        if (safeCurrentPage !== targetBatch) {
          setCurrentPage(targetBatch);
        }
        const indexInBatch = (target - 1) % pagesPerPage;
        setTimeout(() => {
          virtualizer.scrollToIndex(indexInBatch, { align: 'start', behavior: 'smooth' });
        }, 80);
      } else {
        const newBatch = Math.floor((target - 1) / pagesPerPage) + 1;
        if (safeCurrentPage !== newBatch) {
          setCurrentPage(newBatch);
        }
        setTimeout(() => {
          const el = document.getElementById(`page-${target}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
      setJumpInput('');
    } else {
      toast.error(`رقم الصفحة غير صالح. النطاق المتاح: من 1 إلى ${totalPages}`);
    }
  };

  const handleJumpByDocCode = (e) => {
    e.preventDefault();
    const rawInput = (jumpDocCodeInput || '').trim();
    if (!rawInput) {
      toast.error('يرجى إدخال كود الطبيب للانتقال إليه');
      return;
    }

    // Normalize input (supporting Arabic numerals as well as English)
    const normInput = rawInput
      .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      .toLowerCase();

    // 1. Search the currently filtered dataset
    const doctorIndex = (displayedDoctors || []).findIndex((d) => {
      if (!d.doc_code) return false;
      const c = String(d.doc_code)
        .replace(/[٠-٩]/g, (x) => '٠١٢٣٤٥٦٧٨٩'.indexOf(x))
        .trim()
        .toLowerCase();
      return c === normInput;
    });

    if (doctorIndex === -1) {
      // 2. Check if doctor exists in raw database (e.g., hidden by active filters)
      const existsInRaw = (rawDoctors || []).some((d) => {
        if (!d.doc_code) return false;
        const c = String(d.doc_code)
          .replace(/[٠-٩]/g, (x) => '٠١٢٣٤٥٦٧٨٩'.indexOf(x))
          .trim()
          .toLowerCase();
        return c === normInput;
      });

      if (existsInRaw) {
        toast.error(`الطبيب بكود "${rawInput}" موجود ولكن مستبعد بالفلاتر الحالية`, {
          icon: '🔍',
          duration: 4000,
        });
      } else {
        toast.error(`لم يتم العثور على طبيب بالكود: "${rawInput}"`);
      }
      return;
    }

    // Doctor found!
    const foundDoc = displayedDoctors[doctorIndex];
    const targetPage = Math.floor(doctorIndex / 21) + 1;

    // React highlight state
    setHighlightedIndex(doctorIndex);

    // User feedback toast
    const docNameLabel = foundDoc.name ? ` (${foundDoc.name})` : '';
    toast.success(`تم الانتقال للطبيب${docNameLabel} في صفحة ${targetPage}`, {
      icon: '🎯',
      duration: 3500,
    });

    // Clear input
    setJumpDocCodeInput('');

    // Scroll to page
    if (isAllMode) {
      virtualizer.scrollToIndex(targetPage - 1, { align: 'start', behavior: 'smooth' });
    } else if (shouldVirtualize) {
      const targetBatch = Math.floor((targetPage - 1) / pagesPerPage) + 1;
      if (safeCurrentPage !== targetBatch) {
        setCurrentPage(targetBatch);
      }
      const indexInBatch = (targetPage - 1) % pagesPerPage;
      setTimeout(() => {
        virtualizer.scrollToIndex(indexInBatch, { align: 'start', behavior: 'smooth' });
      }, 80);
    } else {
      const targetBatch = Math.floor((targetPage - 1) / pagesPerPage) + 1;
      if (safeCurrentPage !== targetBatch) {
        setCurrentPage(targetBatch);
      }
    }

    // Smooth scroll & trigger highlight animation with DOM retry
    const attemptScrollAndHighlight = (retryCount = 0) => {
      const cardEl = document.getElementById(`item-${doctorIndex}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        cardEl.classList.add('jump-highlight');
        setTimeout(() => {
          cardEl.classList.remove('jump-highlight');
          setHighlightedIndex(null);
        }, 3000);
      } else if (retryCount < 10) {
        setTimeout(() => attemptScrollAndHighlight(retryCount + 1), 120);
      } else {
        const pageEl = document.getElementById(`page-${targetPage}`);
        if (pageEl) {
          pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        setTimeout(() => setHighlightedIndex(null), 3000);
      }
    };

    setTimeout(() => attemptScrollAndHighlight(0), 120);
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
                إجمالي الأطباء المعروضين: {displayedDoctors.filter(d => d.name || d.doc_code).length} طبيب
                {totalPages > 0 && ` (${totalPages} صفحة مقسمة إلى 21 خانة)`}
              </p>
            </div>
          </div>

          {/* Quick Actions (Add Doctor & Print) */}
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => openAddDoctorModal()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors cursor-pointer"
                title="إضافة طبيب جديد"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة طبيب</span>
              </button>
            )}

            <button
              type="button"
              onClick={openPrintModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
              title="خيارات وإعدادات الطباعة وتحديد نطاق الصفحات"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة ({totalPages} صفحة)</span>
            </button>
          </div>

          {/* Quick Search on Screen synchronized with Zustand filters.searchTerm */}
          <div className="flex items-center gap-2 flex-1 max-w-xs min-w-[200px]">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-gray-400 absolute right-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                placeholder="بحث سريع (طبيب / كود / محافظة)..."
                value={filters?.searchTerm || ''}
                onChange={(e) => {
                  setFilter('searchTerm', e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs pr-9 pl-7 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
              />
              {filters?.searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setFilter('searchTerm', '');
                    setCurrentPage(1);
                  }}
                  className="absolute left-2 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                  title="مسح البحث"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
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
                  if (val === 'ALL' || val >= 50) {
                    toast.success('تم تفعيل التمرير الافتراضي الخفيف (DOM Virtualization) - حماية كاملة من التجمد', {
                      icon: '⚡',
                      duration: 3000,
                    });
                  }
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none"
              >
                <option value={5}>5 صفحات</option>
                <option value={10}>10 صفحات</option>
                <option value={20}>20 صفحة</option>
                <option value={50}>50 صفحة (Virtual)</option>
                <option value="ALL">عرض الكل (Virtual ⚡)</option>
              </select>

              {shouldVirtualize && (
                <span
                  className="hidden md:inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full select-none"
                  title="تقنية DOM Virtualization نشطة لحماية الذاكرة وضمان سرعة 60fps فائقة للأجهزة الضعيفة"
                >
                  <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span>عرض افتراضي خفيف</span>
                </span>
              )}
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

            {/* Jump Section: Jump to Page & Jump to Doctor by Code */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* 1. Jump to specific page */}
              <form onSubmit={handleJump} className="flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  placeholder="صفحة..."
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                  className="w-16 text-center border border-slate-200 rounded-lg px-1.5 py-1 text-xs font-bold focus:border-blue-500 focus:outline-none"
                  title="الانتقال لرقم الصفحة"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer"
                  title="انتقال للصفحة"
                >
                  انتقال
                </button>
              </form>

              <div className="h-5 w-px bg-slate-200 mx-0.5 hidden sm:block"></div>

              {/* 2. Jump to Doctor by Code (البحث والانتقال بكود الطبيب) */}
              <form onSubmit={handleJumpByDocCode} className="flex items-center gap-1">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    placeholder="كود الطبيب..."
                    value={jumpDocCodeInput}
                    onChange={(e) => setJumpDocCodeInput(e.target.value)}
                    className="w-24 sm:w-28 pr-7 pl-2 py-1 text-xs font-bold border border-slate-200 rounded-lg focus:bg-white focus:border-blue-500 focus:outline-none text-right transition-all"
                    dir="rtl"
                    title="أدخل كود الطبيب للانتقال المباشر وتحديد بطاقته"
                  />
                  <Hash className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
                </div>
                <button
                  type="submit"
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-900 text-white font-bold px-2.5 py-1 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer"
                  title="انتقال وتحديد بطاقة الطبيب بالكود"
                >
                  <Target className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">انتقال</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* 🔒 Strict Read-Only Mode Sticky Alert Banner (Active during any search or filter) */}
      {isReadOnly && (
        <div className="no-print sticky top-[138px] z-30 mb-6 bg-gradient-to-r from-amber-50 via-amber-100/70 to-amber-50 border-2 border-amber-300 text-amber-950 px-4 py-3 rounded-2xl shadow-sm backdrop-blur-md flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs flex-shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-amber-950">
                  وضع القراءة فقط مفعّل (أثناء الفلترة والبحث)
                </span>
                <span className="bg-amber-200/90 text-amber-900 text-[10px] font-bold px-2.5 py-0.5 rounded-full select-none border border-amber-300">
                  🔒 التعديل معطل لحماية البيانات
                </span>
              </div>
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                وضع القراءة فقط: يرجى مسح الفلاتر والبحث للتمكن من التعديل
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:scale-95 shadow-xs hover:shadow transition-all cursor-pointer flex-shrink-0"
            title="مسح جميع الفلاتر ومصطلح البحث واستعادة وضع التعديل فوراً"
          >
            <Unlock className="w-4 h-4" />
            <span>مسح الفلاتر والبحث (استعادة التعديل)</span>
          </button>
        </div>
      )}

      {/* Rendered A4 Pages: DOM Virtualization OR Standard Static Mode */}
      {visiblePages.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-500">
          لم يتم العثور على أطباء مطابقين لشروط الفلترة المحددة.
        </div>
      ) : shouldVirtualize ? (
        <div
          ref={parentRef}
          className="virtualized-page-list relative w-full"
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const page = itemsToVirtualize[virtualRow.index];
            if (!page) return null;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start - (virtualizer.options.scrollMargin || 0)}px)`,
                  display: 'flow-root',
                }}
              >
                <A4Page
                  pageDocs={page.pageDocs}
                  pageNum={page.pageNum}
                  startIndex={page.startIndex}
                  isVisible={true}
                  highlightedIndex={highlightedIndex}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <div ref={parentRef} className="standard-page-list">
          {visiblePages.map((p) => (
            <A4Page
              key={`page-${p.pageNum}`}
              pageDocs={p.pageDocs}
              pageNum={p.pageNum}
              startIndex={p.startIndex}
              isVisible={true}
              highlightedIndex={highlightedIndex}
            />
          ))}
        </div>
      )}

      {/* Lightweight non-blocking floating indicator during rapid scrolling */}
      {shouldVirtualize && virtualizer.isScrolling && (
        <div className="no-print fixed bottom-6 left-6 z-50 bg-slate-900/90 text-white text-xs font-bold px-3.5 py-2 rounded-xl shadow-lg backdrop-blur-md flex items-center gap-2 pointer-events-none transition-all">
          <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
          <span>جاري عرض الصفحات بسلاسة...</span>
        </div>
      )}

      {/* Completion Banner when viewing ALL pages */}
      {isAllMode && effectiveTotalPages > 0 && (
        <div className="no-print text-center my-8 text-xs font-bold text-gray-400 flex items-center justify-center gap-2">
          <span>✨ تم استعراض كامل التقرير ({effectiveTotalPages} صفحة / {displayedDoctors.length} خانة طبيب)</span>
        </div>
      )}

      {/* Bottom Pagination Bar when pages are long and not in ALL mode */}
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
