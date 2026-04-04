import { useState } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { useTheme } from '../components/theme';
import styles from './SettingsPage.module.css';

type DisplayDensity = 'comfortable' | 'compact' | 'spacious';

const DENSITY_STORAGE_KEY = 'ams-display-density';
const NOTIFICATIONS_STORAGE_KEY = 'ams-notifications';
type NotificationSettings = { email: boolean; inApp: boolean };

function isNotificationSettings(value: unknown): value is NotificationSettings {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<NotificationSettings>;
  return typeof candidate.email === 'boolean' && typeof candidate.inApp === 'boolean';
}

function getStoredDensity(): DisplayDensity {
  const stored = localStorage.getItem(DENSITY_STORAGE_KEY);
  if (stored === 'comfortable' || stored === 'compact' || stored === 'spacious') {
    return stored;
  }
  return 'comfortable';
}

function getStoredNotifications(): NotificationSettings {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (isNotificationSettings(parsed)) {
        return parsed;
      }
    }
  } catch {
    // ignore parse errors
  }
  return { email: true, inApp: true };
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [density, setDensity] = useState<DisplayDensity>(getStoredDensity);
  const [notifications, setNotifications] = useState(getStoredNotifications);

  const handleDensityChange = (value: DisplayDensity) => {
    setDensity(value);
    localStorage.setItem(DENSITY_STORAGE_KEY, value);
  };

  const handleNotificationToggle = (key: 'email' | 'inApp') => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
  };

  return (
    <PageLayout
      title="Settings"
      description="Configure system settings and preferences"
      breadcrumbs={[{ label: 'Dashboard', href: '/' }, { label: 'Settings' }]}
      maxWidth="xl"
    >
      <div className={styles.settingsGrid}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Appearance</h2>
          <p className={styles.sectionDescription}>Customize how AMS looks on your device.</p>

          <div className={styles.settingRow}>
            <label htmlFor="theme-select" className={styles.settingLabel}>Theme</label>
            <select
              id="theme-select"
              className={styles.settingSelect}
              value={theme}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div className={styles.settingRow}>
            <label htmlFor="density-select" className={styles.settingLabel}>Display density</label>
            <select
              id="density-select"
              className={styles.settingSelect}
              value={density}
              onChange={(e) => handleDensityChange(e.target.value as DisplayDensity)}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
              <option value="spacious">Spacious</option>
            </select>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Notifications</h2>
          <p className={styles.sectionDescription}>Choose how you want to be notified.</p>

          <div className={styles.settingRow}>
            <label htmlFor="notif-email" className={styles.settingLabel}>Email notifications</label>
            <button
              id="notif-email"
              type="button"
              role="switch"
              aria-checked={notifications.email}
              className={styles.toggle}
              onClick={() => handleNotificationToggle('email')}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>

          <div className={styles.settingRow}>
            <label htmlFor="notif-inapp" className={styles.settingLabel}>In-app notifications</label>
            <button
              id="notif-inapp"
              type="button"
              role="switch"
              aria-checked={notifications.inApp}
              className={styles.toggle}
              onClick={() => handleNotificationToggle('inApp')}
            >
              <span className={styles.toggleKnob} />
            </button>
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
