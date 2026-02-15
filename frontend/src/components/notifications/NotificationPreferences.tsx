/**
 * NotificationPreferences Component
 * Implements Requirement 13.6: Mobile interface shall implement push notifications for assigned tasks and alerts
 * Implements Requirement 17.2: Allow users to configure notification preferences per event type
 * 
 * Provides UI for managing notification settings
 */

import { useCallback } from 'react';
import { useNotifications } from '../../hooks/useNotifications';
import type { NotificationType, NotificationTypePreference } from '../../types/notification';
import styles from './NotificationPreferences.module.css';

export interface NotificationPreferencesProps {
  /** Title for the preferences section */
  title?: string;
  /** Description text */
  description?: string;
  /** Whether to show global settings */
  showGlobalSettings?: boolean;
  /** Whether to show quiet hours settings */
  showQuietHours?: boolean;
  /** Whether to show channel toggles (push, in-app, email) */
  showChannelToggles?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when preferences change */
  onPreferencesChange?: () => void;
}

/**
 * Toggle switch component
 */
interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

function ToggleSwitch({ id, checked, onChange, disabled = false, label }: ToggleSwitchProps) {
  return (
    <label className={styles.toggleContainer} htmlFor={id}>
      <input
        type="checkbox"
        id={id}
        className={styles.toggleInput}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        aria-label={label}
      />
      <span className={styles.toggleSlider} aria-hidden="true" />
    </label>
  );
}

/**
 * NotificationPreferences component for managing notification settings
 * 
 * @example
 * ```tsx
 * <NotificationPreferences
 *   showGlobalSettings
 *   showQuietHours
 *   onPreferencesChange={() => console.log('Preferences updated')}
 * />
 * ```
 */
export function NotificationPreferences({
  title = 'Notification Preferences',
  description = 'Choose which notifications you want to receive and how.',
  showGlobalSettings = true,
  showQuietHours = true,
  showChannelToggles = true,
  className = '',
  onPreferencesChange,
}: NotificationPreferencesProps) {
  const {
    isSupported,
    isPermissionGranted,
    preferences,
    updatePreferences,
    updateTypePreference,
    requestPermission,
    subscribe,
  } = useNotifications({ autoInitialize: true, autoNavigate: false });

  const handleGlobalToggle = useCallback((key: 'pushEnabled' | 'inAppEnabled' | 'emailEnabled' | 'showBadges' | 'playSound', value: boolean) => {
    updatePreferences({ [key]: value });
    onPreferencesChange?.();
  }, [updatePreferences, onPreferencesChange]);

  const handleQuietHoursChange = useCallback((key: 'quietHoursStart' | 'quietHoursEnd', value: string) => {
    updatePreferences({ [key]: value || undefined });
    onPreferencesChange?.();
  }, [updatePreferences, onPreferencesChange]);

  const handleTypeToggle = useCallback((
    type: NotificationType,
    key: 'enabled' | 'push' | 'inApp' | 'email',
    value: boolean
  ) => {
    updateTypePreference(type, { [key]: value });
    onPreferencesChange?.();
  }, [updateTypePreference, onPreferencesChange]);

  const handleEnableNotifications = useCallback(async () => {
    const permission = await requestPermission();
    if (permission === 'granted') {
      await subscribe();
      onPreferencesChange?.();
    }
  }, [requestPermission, subscribe, onPreferencesChange]);

  // Group type preferences by category
  const taskNotifications = preferences.typePreferences.filter(p => 
    ['task_assigned', 'task_due_soon', 'task_overdue'].includes(p.type)
  );
  const assetNotifications = preferences.typePreferences.filter(p => 
    ['asset_alert', 'maintenance_due', 'stock_low'].includes(p.type)
  );
  const complianceNotifications = preferences.typePreferences.filter(p => 
    ['compliance_alert', 'contract_expiring', 'loaner_overdue'].includes(p.type)
  );
  const systemNotifications = preferences.typePreferences.filter(p => 
    ['system_alert'].includes(p.type)
  );

  const renderTypePreference = (pref: NotificationTypePreference) => (
    <div key={pref.type} className={styles.typeItem}>
      <div className={styles.typeInfo}>
        <span className={styles.typeName}>{pref.displayName}</span>
        <span className={styles.typeDescription}>{pref.description}</span>
      </div>
      <div className={styles.typeToggles}>
        <ToggleSwitch
          id={`${pref.type}-enabled`}
          checked={pref.enabled}
          onChange={(checked) => handleTypeToggle(pref.type, 'enabled', checked)}
          label={`Enable ${pref.displayName}`}
        />
        {showChannelToggles && pref.enabled && (
          <div className={styles.channelToggles}>
            <label className={styles.channelLabel}>
              <input
                type="checkbox"
                checked={pref.push}
                onChange={(e) => handleTypeToggle(pref.type, 'push', e.target.checked)}
                disabled={!preferences.pushEnabled || !isPermissionGranted}
              />
              <span>Push</span>
            </label>
            <label className={styles.channelLabel}>
              <input
                type="checkbox"
                checked={pref.inApp}
                onChange={(e) => handleTypeToggle(pref.type, 'inApp', e.target.checked)}
                disabled={!preferences.inAppEnabled}
              />
              <span>In-App</span>
            </label>
            <label className={styles.channelLabel}>
              <input
                type="checkbox"
                checked={pref.email}
                onChange={(e) => handleTypeToggle(pref.type, 'email', e.target.checked)}
                disabled={!preferences.emailEnabled}
              />
              <span>Email</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );

  const renderCategory = (categoryTitle: string, items: NotificationTypePreference[]) => {
    if (items.length === 0) return null;
    return (
      <div className={styles.category}>
        <h4 className={styles.categoryTitle}>{categoryTitle}</h4>
        <div className={styles.typeList}>
          {items.map(renderTypePreference)}
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${className}`}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.description}>{description}</p>
      </div>

      {/* Permission prompt if not granted */}
      {isSupported && !isPermissionGranted && (
        <div className={styles.permissionPrompt}>
          <div className={styles.permissionIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </div>
          <div className={styles.permissionContent}>
            <span className={styles.permissionTitle}>Push notifications are disabled</span>
            <span className={styles.permissionDescription}>
              Enable push notifications to receive alerts on your device.
            </span>
          </div>
          <button
            type="button"
            className={styles.enableButton}
            onClick={handleEnableNotifications}
          >
            Enable
          </button>
        </div>
      )}

      {/* Global settings */}
      {showGlobalSettings && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Global Settings</h4>
          <div className={styles.settingsList}>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingName}>Push Notifications</span>
                <span className={styles.settingDescription}>
                  Receive notifications on your device
                </span>
              </div>
              <ToggleSwitch
                id="push-enabled"
                checked={preferences.pushEnabled}
                onChange={(checked) => handleGlobalToggle('pushEnabled', checked)}
                disabled={!isPermissionGranted}
                label="Enable push notifications"
              />
            </div>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingName}>In-App Notifications</span>
                <span className={styles.settingDescription}>
                  Show notifications within the application
                </span>
              </div>
              <ToggleSwitch
                id="inapp-enabled"
                checked={preferences.inAppEnabled}
                onChange={(checked) => handleGlobalToggle('inAppEnabled', checked)}
                label="Enable in-app notifications"
              />
            </div>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingName}>Email Notifications</span>
                <span className={styles.settingDescription}>
                  Receive notifications via email
                </span>
              </div>
              <ToggleSwitch
                id="email-enabled"
                checked={preferences.emailEnabled}
                onChange={(checked) => handleGlobalToggle('emailEnabled', checked)}
                label="Enable email notifications"
              />
            </div>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingName}>Notification Badges</span>
                <span className={styles.settingDescription}>
                  Show badge count on app icon
                </span>
              </div>
              <ToggleSwitch
                id="badges-enabled"
                checked={preferences.showBadges}
                onChange={(checked) => handleGlobalToggle('showBadges', checked)}
                label="Show notification badges"
              />
            </div>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <span className={styles.settingName}>Notification Sounds</span>
                <span className={styles.settingDescription}>
                  Play sound when notification arrives
                </span>
              </div>
              <ToggleSwitch
                id="sound-enabled"
                checked={preferences.playSound}
                onChange={(checked) => handleGlobalToggle('playSound', checked)}
                label="Enable notification sounds"
              />
            </div>
          </div>
        </div>
      )}

      {/* Quiet hours */}
      {showQuietHours && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Quiet Hours</h4>
          <p className={styles.sectionDescription}>
            Notifications will be silenced during these hours.
          </p>
          <div className={styles.quietHours}>
            <div className={styles.timeInput}>
              <label htmlFor="quiet-start">From</label>
              <input
                type="time"
                id="quiet-start"
                value={preferences.quietHoursStart || ''}
                onChange={(e) => handleQuietHoursChange('quietHoursStart', e.target.value)}
              />
            </div>
            <div className={styles.timeInput}>
              <label htmlFor="quiet-end">To</label>
              <input
                type="time"
                id="quiet-end"
                value={preferences.quietHoursEnd || ''}
                onChange={(e) => handleQuietHoursChange('quietHoursEnd', e.target.value)}
              />
            </div>
            {(preferences.quietHoursStart || preferences.quietHoursEnd) && (
              <button
                type="button"
                className={styles.clearButton}
                onClick={() => {
                  handleQuietHoursChange('quietHoursStart', '');
                  handleQuietHoursChange('quietHoursEnd', '');
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notification types */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Notification Types</h4>
        <p className={styles.sectionDescription}>
          Choose which types of notifications you want to receive.
        </p>
        
        {renderCategory('Tasks', taskNotifications)}
        {renderCategory('Assets & Maintenance', assetNotifications)}
        {renderCategory('Compliance & Contracts', complianceNotifications)}
        {renderCategory('System', systemNotifications)}
      </div>
    </div>
  );
}

export default NotificationPreferences;
