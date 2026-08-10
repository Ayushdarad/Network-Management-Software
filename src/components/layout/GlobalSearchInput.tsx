import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import type { SearchResult } from '../../lib/globalSearch';

interface GlobalSearchInputProps {
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onNavigate?: () => void;
}

export default function GlobalSearchInput({ className, inputRef: externalRef, onNavigate }: GlobalSearchInputProps) {
  const navigate = useNavigate();
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef ?? internalRef;
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);

  const { results, loading } = useGlobalSearch(query);

  const handleSelect = useCallback((item: SearchResult) => {
    navigate(item.path);
    setQuery('');
    setOpen(false);
    setSelected(0);
    onNavigate?.();
  }, [navigate, onNavigate]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Global Ctrl+K shortcut — focus this input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [inputRef]);

  // Reset selection when results change
  useEffect(() => { setSelected(0); }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter' && results[selected]) {
      e.preventDefault();
      handleSelect(results[selected]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  const showDropdown = open && (query.length > 0 || results.length > 0);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 bg-white/3 focus-within:border-blue-500/40 focus-within:bg-white/6 transition-colors">
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search devices, alerts, pages..."
          className="w-44 sm:w-52 lg:w-64 bg-transparent text-sm text-white placeholder-slate-500 outline-none"
        />
        {loading && query.length > 0 && (
          <Loader2 size={12} className="text-slate-500 animate-spin shrink-0" />
        )}
        <kbd className="hidden lg:inline text-[10px] px-1.5 py-0.5 rounded bg-white/8 text-slate-500 font-mono shrink-0">Ctrl K</kbd>
      </div>

      {showDropdown && (
        <div
          className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl border border-white/10 shadow-2xl overflow-hidden"
          style={{ background: 'rgba(7,13,26,0.98)', minWidth: '320px' }}
        >
          <div className="max-h-80 overflow-y-auto py-1">
            {results.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-500">
                {loading ? 'Searching…' : `No results for "${query}"`}
              </div>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    {category}
                  </div>
                  {items.map(item => {
                    const idx = results.indexOf(item);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleSelect(item)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left',
                          idx === selected ? 'bg-blue-500/15 text-white' : 'text-slate-300 hover:bg-white/5',
                        )}
                      >
                        <Icon size={14} className={idx === selected ? 'text-blue-400' : 'text-slate-500 shrink-0'} />
                        <div className="flex-1 min-w-0">
                          <div className="truncate font-medium">{item.label}</div>
                          {item.subtitle && (
                            <div className="text-[11px] text-slate-500 truncate">{item.subtitle}</div>
                          )}
                        </div>
                        {idx === selected && <ArrowRight size={12} className="text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          {results.length > 0 && (
            <div className="border-t border-white/6 px-3 py-1.5 flex gap-3 text-[10px] text-slate-600">
              <span><kbd className="font-mono bg-white/6 px-1 rounded">↑↓</kbd> navigate</span>
              <span><kbd className="font-mono bg-white/6 px-1 rounded">↵</kbd> open</span>
              <span><kbd className="font-mono bg-white/6 px-1 rounded">esc</kbd> close</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
