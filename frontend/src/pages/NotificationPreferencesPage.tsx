/**
 * NotificationPreferencesPage
 *
 * Displays and allows updating notification preferences.
 *
 * Implements Task 10.4
 * Validates: Requirement 9.4
 */

import { useState, useEffect, useCallback } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { getPreferences, updatePreferences } from '../services/notification-api';
import type { NotificationPreferences } from '../services/notification-api';
import styles from './NotificationPreferencesPage.module.css';

const DEFAULT_CATEGORIES = ['asset', 'procurement', 'maintenance', 'compliance', 'system'];

export function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrefs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getPreferences();
      setPrefs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preferences');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrefs();
  }, [fetchPrefs]);

  const handleToggle = async (key: 'emailEnabled' | 'pushEnabled') => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    try {
      const result = await updatePreferences({ [key]: updated[key] });
      setPrefs(result);
    } catch {
      // Revert on failure
      setPrefs(prefs);
    }
  };

  const handleCategoryToggle = async (category: string) => {
    if (!prefs) return;
    const updatedCategories = {
      ...prefs.categories,
      [category]: !prefs.categories[category],
    };
    const updated = { ...prefs, categories: updatedCategories };
    setPrefs(updated);
    try {
      const result = await updatePreferences({ categories: updatedCategories });
      setPrefs(result);
    } catch {
      setPrefs(prefs);
    }
  };

  if (isLoading) {
    return (
      <PageLayout
        title="Notification Preferences"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Notification Preferences' }]}
        maxWidth="xl"
      >
        <p className={styles.loading}>Loading preferences…</p>
      </PageLayout>
    );
  }

  if (error || !prefs) {
    return (
      <PageLayout
        title="Notification Preferences"
        breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Notification Preferences' }]}
        maxWidth="xl"
      >
        <div className={styles.error}>
          <p>{error || 'Failed to load preferences'}</p>
          <button className={styles.retryButton} onClick={fetchPrefs} type="button">
            Retry
          </button>
        </div>
      </PageLayout>
    );
  }

  const categories = Object.keys(prefs.categories).length > 0
    ? Object.keys(prefs.categories)
    : DEFAULT_CATEGORIES;

  return (
    <PageLayout
      title="Notification Preferences"
      description="Choose how and when you receive notifications"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Notification Preferences' }]}
      maxWidth="xl"
    >
      <div className={styles.container}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Delivery Channels</h2>
          <p className={styles.sectionDescription}>Control how notifications are delivered to you.</p>

          <div className={styles.settingRow}>
            <label htmlFor="pref-email" className={styles.settingLabel}>Email notifications</label>
            <button
              id="pref-email"
              type="button"
              role="switch"
              aria-checked={prefs.emailEnabled}
              className={styles.toggle}
              onClick={() => handleToggle('emailEnabled')}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>

          <div className={styles.settingRow}>
            <label htmlFor="pref-push" className={styles.settingLabel}>Push notifications</label>
            <button
              id="pref-push"
              type="button"
              role="switch"
              aria-checked={prefs.pushEnabled}
              className={styles.toggle}
              onClick={() => handleToggle('pushEnabled')}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Categories</h2>
          <p className={styles.sectionDescription}>Enable or disable notifications by category.</p>

          {categories.map((cat) => (
            <div key={cat} className={styles.settingRow}>
              <label htmlFor={`pref-cat-${cat}`} className={styles.settingLabel}>{cat}</label>
              <button
                id={`pref-cat-${cat}`}
                type="button"
                role="switch"
                aria-checked={prefs.categories[cat] ?? true}
                className={styles.toggle}
                onClick={() => handleCategoryToggle(cat)}
              >
                <span className={styles.toggleKnob} />
              </button>
            </div>
          ))}
        </section>
      </div>
    </PageLayout>
  );
}
