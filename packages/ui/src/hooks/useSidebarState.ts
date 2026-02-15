import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'ams_sidebar_state';

interface SidebarState {
  collapsed: boolean;
  collapsedGroups: string[];
  favorites: string[];
}

const DEFAULT_STATE: SidebarState = {
  collapsed: false,
  collapsedGroups: [],
  favorites: [],
};

export function useSidebarState() {
  const [state, setState] = useState<SidebarState>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : DEFAULT_STATE;
    } catch {
      return DEFAULT_STATE;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const toggleCollapsed = useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed }));
  }, []);

  const toggleGroup = useCallback((groupTitle: string) => {
    setState((prev) => ({
      ...prev,
      collapsedGroups: prev.collapsedGroups.includes(groupTitle)
        ? prev.collapsedGroups.filter((g) => g !== groupTitle)
        : [...prev.collapsedGroups, groupTitle],
    }));
  }, []);

  const addFavorite = useCallback((path: string) => {
    setState((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(path) ? prev.favorites : [...prev.favorites, path],
    }));
  }, []);

  const removeFavorite = useCallback((path: string) => {
    setState((prev) => ({ ...prev, favorites: prev.favorites.filter((f) => f !== path) }));
  }, []);

  const reorderFavorites = useCallback((fromIndex: number, toIndex: number) => {
    setState((prev) => {
      const newFavorites = [...prev.favorites];
      const [moved] = newFavorites.splice(fromIndex, 1);
      newFavorites.splice(toIndex, 0, moved);
      return { ...prev, favorites: newFavorites };
    });
  }, []);

  const isFavorite = useCallback((path: string) => state.favorites.includes(path), [state.favorites]);
  const isGroupCollapsed = useCallback((groupTitle: string) => state.collapsedGroups.includes(groupTitle), [state.collapsedGroups]);

  return { collapsed: state.collapsed, favorites: state.favorites, toggleCollapsed, toggleGroup, isGroupCollapsed, addFavorite, removeFavorite, reorderFavorites, isFavorite };
}
