import { useState, useCallback, useEffect, useMemo } from 'react';

export interface CommandItem {
  id: string;
  label: string;
  path?: string;
  action?: () => void;
  group: string;
  icon?: string;
  keywords?: string[];
}

function fuzzyMatch(text: string, query: string): boolean {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  let qi = 0;
  for (let i = 0; i < lower.length && qi < q.length; i++) {
    if (lower[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function useCommandPalette(items: CommandItem[]) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const open = useCallback(() => { setIsOpen(true); setQuery(''); }, []);
  const close = useCallback(() => { setIsOpen(false); setQuery(''); }, []);
  const toggle = useCallback(() => { setIsOpen((p) => { if (!p) setQuery(''); return !p; }); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, toggle, close]);

  const results = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter((item) =>
      fuzzyMatch(item.label, query) ||
      item.keywords?.some((kw) => fuzzyMatch(kw, query))
    );
  }, [items, query]);

  const groupedResults = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    for (const item of results) {
      const existing = groups.get(item.group) || [];
      existing.push(item);
      groups.set(item.group, existing);
    }
    return groups;
  }, [results]);

  return { isOpen, query, setQuery, results, groupedResults, open, close };
}
