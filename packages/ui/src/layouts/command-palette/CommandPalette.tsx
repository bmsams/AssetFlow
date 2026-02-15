import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  type KeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CommandPalette.module.css';

export interface CommandItem {
  id: string;
  label: string;
  path?: string;
  action?: () => void;
  group: string;
  icon?: string;
  keywords?: string[];
}

interface CommandPaletteProps {
  items: CommandItem[];
  onSelect?: (item: CommandItem) => void;
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

export function CommandPalette({ items, onSelect }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  let navigate: ReturnType<typeof useNavigate>;
  try { navigate = useNavigate(); } catch { navigate = () => {}; }

  const open = useCallback(() => { setIsOpen(true); setQuery(''); setFocusedIndex(0); }, []);
  const close = useCallback(() => { setIsOpen(false); setQuery(''); }, []);

  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => { if (!prev) { setQuery(''); setFocusedIndex(0); } return !prev; });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const results = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter((item) =>
      fuzzyMatch(item.label, query) || item.keywords?.some((kw) => fuzzyMatch(kw, query))
    );
  }, [items, query]);

  const groupedResults = useMemo(() => {
    const groups: { group: string; items: CommandItem[] }[] = [];
    const groupMap = new Map<string, CommandItem[]>();
    for (const item of results) {
      const existing = groupMap.get(item.group);
      if (existing) { existing.push(item); }
      else {
        const arr = [item];
        groupMap.set(item.group, arr);
        groups.push({ group: item.group, items: arr });
      }
    }
    return groups;
  }, [results]);

  const flatResults = useMemo(() => results, [results]);

  const selectItem = useCallback((item: CommandItem) => {
    if (onSelect) onSelect(item);
    if (item.path) navigate(item.path);
    if (item.action) item.action();
    close();
  }, [close, navigate, onSelect]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, flatResults.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatResults[focusedIndex]) selectItem(flatResults[focusedIndex]);
        break;
    }
  }, [close, flatResults, focusedIndex, selectItem]);

  useEffect(() => { setFocusedIndex(0); }, [query]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-label="Command palette" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={styles.palette}>
        <div className={styles.searchRow}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            className={styles.searchInput}
            placeholder="Search pages, actions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className={styles.shortcut}>ESC</span>
        </div>

        <div ref={resultsRef} className={styles.results}>
          {results.length === 0 ? (
            <div className={styles.empty}>No results found</div>
          ) : (
            groupedResults.map(({ group, items: groupItems }) => (
              <div key={group}>
                <div className={styles.groupLabel}>{group}</div>
                {groupItems.map((item) => {
                  const globalIdx = flatResults.indexOf(item);
                  return (
                    <div
                      key={item.id}
                      className={`${styles.resultItem} ${globalIdx === focusedIndex ? styles.focused : ''}`}
                      onClick={() => selectItem(item)}
                      onMouseEnter={() => setFocusedIndex(globalIdx)}
                    >
                      {item.icon && <span className={styles.resultIcon}>{item.icon}</span>}
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className={styles.footer}>
          <span className={styles.footerKey}><kbd className={styles.footerKbd}>&#8593;&#8595;</kbd> Navigate</span>
          <span className={styles.footerKey}><kbd className={styles.footerKbd}>&#8629;</kbd> Select</span>
          <span className={styles.footerKey}><kbd className={styles.footerKbd}>esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
