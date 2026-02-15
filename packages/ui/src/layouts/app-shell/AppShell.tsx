import { type ReactNode } from 'react';
import { Sidebar, type NavGroup } from '../sidebar/Sidebar';
import { Header } from '../header/Header';
import { TourProvider } from '../../tour/TourProvider';
import styles from './AppShell.module.css';

export interface AppShellUser {
  name: string;
  role: string;
  avatar?: string;
}

export interface AppShellProps {
  appName: string;
  navGroups: NavGroup[];
  user?: AppShellUser;
  logo?: ReactNode;
  /** Show the sidebar. @default true */
  sidebar?: boolean;
  /** Show the header. @default true */
  header?: boolean;
  /** Wrap the shell in TourProvider. @default true */
  tours?: boolean;
  headerActions?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  appName,
  navGroups,
  user,
  logo,
  sidebar = true,
  header = true,
  tours = true,
  headerActions,
  children,
}: AppShellProps) {
  const shell = (
    <div className={styles.shell}>
      {sidebar && (
        <Sidebar appName={appName} navGroups={navGroups} user={user} logo={logo} />
      )}
      <div className={`${styles.main} ${!sidebar ? styles.noSidebar : ''}`}>
        {header && (
          <Header title={appName} actions={headerActions} />
        )}
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );

  if (tours) {
    return <TourProvider>{shell}</TourProvider>;
  }
  return shell;
}
