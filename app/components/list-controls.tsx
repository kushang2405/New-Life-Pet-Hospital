'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Input, Select } from './ui';

export const PAGE_SIZE = 10;

export function paginate<T>(items: T[], requestedPage: number, pageSize = PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(requestedPage, 1), totalPages);
  const start = (page - 1) * pageSize;
  return { rows: items.slice(start, start + pageSize), page, totalPages, total: items.length };
}

type ListToolbarProps = {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  filter: string;
  onFilter: (value: string) => void;
  filterLabel: string;
  filterOptions: { value: string; label: string }[];
};

export function ListToolbar({ search, onSearch, searchPlaceholder, filter, onFilter, filterLabel, filterOptions }: ListToolbarProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3 mb-4">
      <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
      <Select value={filter} onChange={(e) => onFilter(e.target.value)} options={[{ value: '', label: `All ${filterLabel}` }, ...filterOptions]} />
    </div>
  );
}

type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  onPage: (page: number) => void;
};

const navButton = 'w-9 h-9 rounded-lg border border-line flex items-center justify-center text-ink/70 transition-colors hover:bg-lilac hover:text-plum disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-ink/70';

export function Pagination({ page, totalPages, total, pageSize = PAGE_SIZE, onPage }: PaginationProps) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
      <span className="text-xs text-ink/55">Showing {from} to {to} of {total}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page" className={navButton}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-semibold text-ink/70 min-w-[88px] text-center">Page {page} of {totalPages}</span>
        <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Next page" className={navButton}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
