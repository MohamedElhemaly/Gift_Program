import React, { useState, useEffect } from 'react';
import { useDoctorStore } from '../../store/useDoctorStore';
import DecentFilterDropdown from './DecentFilterDropdown';
import {
  Search,
  RotateCcw,
  Building2,
  MapPin,
  Navigation,
  Stethoscope,
  Activity,
  SlidersHorizontal,
  X,
  Sparkles,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { label: 'جميع الحالات (نشط وغير نشط)', value: 'all' },
  { label: 'الأطباء النشطين فقط', value: 'active' },
  { label: 'الأطباء الموقوفين فقط', value: 'inactive' },
  { label: 'الأطباء المنقولين فقط', value: 'moved' },
];

export default function AdvancedFilterBar() {
  const {
    filters,
    setFilter,
    resetFilters,
    getUniqueFilterOptions,
    displayedDoctors,
    rawDoctors,
  } = useDoctorStore();

  const [localSearch, setLocalSearch] = useState(filters?.searchTerm || '');

  // Keep local search synchronized with store filter
  useEffect(() => {
    setLocalSearch(filters?.searchTerm || '');
  }, [filters?.searchTerm]);

  // Fast debounced search input (150ms for instantaneous responsiveness)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== (filters?.searchTerm || '')) {
        setFilter('searchTerm', localSearch);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const { governorates, cities, regions, specialties } = getUniqueFilterOptions();

  const hasGov = Boolean(filters?.governorate);
  const hasCity = Boolean(filters?.city);
  const hasReg = Boolean(filters?.region);
  const hasSpec = Boolean(filters?.specialty);
  const hasStatus = Boolean(filters?.status && filters.status !== 'all');
  const hasSearch = Boolean(filters?.searchTerm);

  const activeFilterCount =
    (hasGov ? 1 : 0) +
    (hasCity ? 1 : 0) +
    (hasReg ? 1 : 0) +
    (hasSpec ? 1 : 0) +
    (hasStatus ? 1 : 0) +
    (hasSearch ? 1 : 0);

  const statusLabel =
    STATUS_OPTIONS.find((s) => s.value === filters?.status)?.label || filters?.status;

  const totalRawCount = (rawDoctors || []).filter((d) => d.name || d.doc_code).length;
  const filteredCount = (displayedDoctors || []).filter((d) => d.name || d.doc_code).length;

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3.5 transition-all duration-200">
      
      {/* Search Input Bar + Quick Reset */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Unified Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder="بحث فوري (ابحث باسم الطبيب، الكود، التخصص، العنوان، الموبايل)..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full text-xs sm:text-sm font-semibold pr-10 pl-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 placeholder:font-normal"
          />
          {localSearch && (
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                setFilter('searchTerm', '');
              }}
              className="absolute left-3 top-3 text-slate-400 hover:text-slate-700 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
              title="مسح نص البحث"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Reset All Filters Button */}
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setLocalSearch('');
              resetFilters();
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer shadow-2xs whitespace-nowrap"
            title="إعادة ضبط ومسح جميع الفلاتر"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>مسح جميع الفلاتر ({activeFilterCount})</span>
          </button>
        )}
      </div>

      {/* Decent Dropdowns Bar (No overflow-x-auto to prevent popover clipping!) */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        
        {/* 1. Governorate Filter */}
        <DecentFilterDropdown
          title="المحافظة"
          icon={Building2}
          options={governorates}
          value={filters?.governorate || ''}
          onChange={(val) => setFilter('governorate', val)}
          placeholder="ابحث عن محافظة..."
          allLabel="كل المحافظات"
          emptyText="لا توجد محافظات مطابقة"
        />

        {/* 2. City Filter (Cascades with Governorate) */}
        <DecentFilterDropdown
          title="المدينة / المركز"
          icon={MapPin}
          options={cities}
          value={filters?.city || ''}
          onChange={(val) => setFilter('city', val)}
          placeholder="ابحث عن مدينة أو مركز..."
          allLabel="كل المدن والمراكز"
          emptyText="لا توجد مدن مطابقة"
          disabled={governorates.length === 0}
        />

        {/* 3. Region Filter (Cascades with City) */}
        <DecentFilterDropdown
          title="المنطقة"
          icon={Navigation}
          options={regions}
          value={filters?.region || ''}
          onChange={(val) => setFilter('region', val)}
          placeholder="ابحث عن منطقة أو حي..."
          allLabel="كل المناطق"
          emptyText="لا توجد مناطق مطابقة"
          disabled={cities.length === 0}
        />

        {/* 4. Specialty Filter */}
        <DecentFilterDropdown
          title="التخصص"
          icon={Stethoscope}
          options={specialties}
          value={filters?.specialty || ''}
          onChange={(val) => setFilter('specialty', val)}
          placeholder="ابحث عن تخصص طبي..."
          allLabel="كل التخصصات"
          emptyText="لا توجد تخصصات مطابقة"
        />

        {/* 5. Status Filter */}
        <DecentFilterDropdown
          title="الحالة"
          icon={Activity}
          options={STATUS_OPTIONS}
          value={filters?.status || 'all'}
          onChange={(val) => setFilter('status', val)}
          placeholder="اختر الحالة..."
          allLabel="جميع الحالات"
        />

      </div>

      {/* Active Filter Chips & Counter */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100 flex-wrap animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 select-none">
            <SlidersHorizontal className="w-3 h-3 text-slate-400" />
            <span>الفلاتر النشطة ({activeFilterCount}):</span>
          </span>

          {/* Governorate Chip */}
          {hasGov && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200 shadow-2xs">
              <Building2 className="w-3 h-3 text-blue-500" />
              <span>المحافظة: {filters.governorate}</span>
              <button
                type="button"
                onClick={() => setFilter('governorate', '')}
                className="hover:text-red-600 p-0.5 rounded hover:bg-blue-100 transition-colors cursor-pointer"
                title="إلغاء فلتر المحافظة"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* City Chip */}
          {hasCity && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
              <MapPin className="w-3 h-3 text-emerald-500" />
              <span>المدينة: {filters.city}</span>
              <button
                type="button"
                onClick={() => setFilter('city', '')}
                className="hover:text-red-600 p-0.5 rounded hover:bg-emerald-100 transition-colors cursor-pointer"
                title="إلغاء فلتر المدينة"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Region Chip */}
          {hasReg && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 shadow-2xs">
              <Navigation className="w-3 h-3 text-purple-500" />
              <span>المنطقة: {filters.region}</span>
              <button
                type="button"
                onClick={() => setFilter('region', '')}
                className="hover:text-red-600 p-0.5 rounded hover:bg-purple-100 transition-colors cursor-pointer"
                title="إلغاء فلتر المنطقة"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Specialty Chip */}
          {hasSpec && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-50 text-cyan-800 border border-cyan-200 shadow-2xs">
              <Stethoscope className="w-3 h-3 text-cyan-500" />
              <span>التخصص: {filters.specialty}</span>
              <button
                type="button"
                onClick={() => setFilter('specialty', '')}
                className="hover:text-red-600 p-0.5 rounded hover:bg-cyan-100 transition-colors cursor-pointer"
                title="إلغاء فلتر التخصص"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Status Chip */}
          {hasStatus && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
              <Activity className="w-3 h-3 text-amber-500" />
              <span>الحالة: {statusLabel}</span>
              <button
                type="button"
                onClick={() => setFilter('status', 'all')}
                className="hover:text-red-600 p-0.5 rounded hover:bg-amber-100 transition-colors cursor-pointer"
                title="إلغاء فلتر الحالة"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Search Term Chip */}
          {hasSearch && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300 shadow-2xs">
              <Search className="w-3 h-3 text-slate-500" />
              <span>البحث: "{filters.searchTerm}"</span>
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  setFilter('searchTerm', '');
                }}
                className="hover:text-red-600 p-0.5 rounded hover:bg-slate-200 transition-colors cursor-pointer"
                title="إلغاء نص البحث"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}

          {/* Match Count Badge */}
          <span className="mr-auto text-xs font-bold text-blue-700 bg-blue-50/90 px-3 py-1 rounded-lg border border-blue-200 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-500" />
            <span>عرض {filteredCount} من أصل {totalRawCount} طبيب</span>
          </span>
        </div>
      )}

    </div>
  );
}
