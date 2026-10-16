import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Check, ChevronDown, X } from 'lucide-react';
import { normalizeArabicText } from '../../store/useDoctorStore';

export default function DecentFilterDropdown({
  title,
  icon: Icon,
  options = [],
  value = '',
  onChange,
  placeholder = 'بحث...',
  allLabel = 'الكل',
  emptyText = 'لا توجد نتائج مطابقة',
  disabled = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Normalize options to { label, value } array
  const normalizedOptions = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'object' && opt !== null) {
        return { label: opt.label, value: opt.value };
      }
      return { label: String(opt), value: String(opt) };
    });
  }, [options]);

  // Filter options based on search query with Arabic normalization
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const query = normalizeArabicText(searchTerm);
    return normalizedOptions.filter((opt) =>
      normalizeArabicText(opt.label).includes(query)
    );
  }, [normalizedOptions, searchTerm]);

  const isSelected = Boolean(value && value !== 'all');
  const selectedLabel = useMemo(() => {
    if (!isSelected) return allLabel;
    const match = normalizedOptions.find((o) => o.value === value);
    return match ? match.label : value;
  }, [normalizedOptions, value, isSelected, allLabel]);

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-right" ref={containerRef}>
      {/* Decent Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150 border cursor-pointer select-none shadow-2xs min-w-[130px] sm:min-w-[145px] ${
          disabled
            ? 'opacity-40 bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
            : isSelected
            ? 'bg-blue-50/90 border-blue-400 text-blue-800 ring-2 ring-blue-500/15 shadow-xs'
            : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-slate-50'
        }`}
        title={`${title}: ${selectedLabel}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {Icon && (
            <Icon
              className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                isSelected ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'
              }`}
            />
          )}
          <div className="flex flex-col items-start leading-tight min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-semibold">{title}</span>
            <span
              className={`text-xs truncate max-w-[105px] sm:max-w-[125px] ${
                isSelected ? 'text-blue-800 font-black' : 'text-slate-600 font-medium'
              }`}
            >
              {selectedLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Quick Clear ✕ Button on Trigger */}
          {isSelected && (
            <span
              onClick={handleClear}
              className="p-1 text-blue-500 hover:text-white hover:bg-blue-600 rounded-md transition-all cursor-pointer"
              title={`إلغاء فلتر ${title}`}
            >
              <X className="w-3 h-3" />
            </span>
          )}

          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
            }`}
          />
        </div>
      </button>

      {/* Popover Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 max-w-[90vw] bg-white rounded-2xl shadow-2xl border border-slate-200/90 py-2 animate-in fade-in zoom-in-95 duration-150 transform origin-top-right">
          {/* Header with Title and Search Input */}
          <div className="px-3 pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1.5 text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                {Icon && <Icon className="w-3.5 h-3.5 text-blue-600" />}
                <span>اختيار {title}</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                {options.length} متاح
              </span>
            </div>

            {/* Internal Search Box (only if > 4 items) */}
            {normalizedOptions.length > 4 && (
              <div className="relative flex items-center mt-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={placeholder}
                  className="w-full text-xs font-semibold pr-8 pl-7 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute left-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Options Scroll List */}
          <div className="max-h-60 overflow-y-auto px-1.5 py-1.5 space-y-0.5 text-xs">
            {/* Show All / Reset Option */}
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-bold transition-colors cursor-pointer ${
                !isSelected
                  ? 'bg-blue-50 text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span>{allLabel} (عرض الكل)</span>
              {!isSelected && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
            </button>

            {/* Separator */}
            {filteredOptions.length > 0 && <div className="h-px bg-slate-100 my-1" />}

            {/* Filtered Items */}
            {filteredOptions.length === 0 ? (
              <div className="text-center py-6 text-xs text-slate-400 font-medium">
                {emptyText}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isItemActive = value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-right transition-colors cursor-pointer ${
                      isItemActive
                        ? 'bg-blue-600 text-white font-bold shadow-2xs'
                        : 'text-slate-700 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <span className="truncate pr-1">{opt.label}</span>
                    {isItemActive && <Check className="w-4 h-4 text-white flex-shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Status */}
          {isSelected && (
            <div className="px-3 pt-2 pb-1 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between font-medium">
              <span>محدد: <strong className="text-slate-700">{selectedLabel}</strong></span>
              <button
                type="button"
                onClick={handleClear}
                className="text-red-500 hover:text-red-700 font-bold transition-colors cursor-pointer"
              >
                مسح التحديد
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
