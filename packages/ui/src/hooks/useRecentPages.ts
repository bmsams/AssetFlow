import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'ams_recent_pages';
const MAX_RECENT = 10;

export interface RecentPage {
  path: string;
  label: string;
  timestamp: number;
}

export function useRecentPages() {
  const [recentPages, setRecentPages] = useState<RecentPage[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(recentPages)); } catch {}
  }, [recentPages]);

  const addRecentPage = useCallback((path: string, label: string) => {
    setRecentPages((prev) => {
      const filtered = prev.filter((p) => p.path !== path);
      return [{ path, label, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT);
    });
  }, []);

  return { recentPages, addRecentPage };
}
