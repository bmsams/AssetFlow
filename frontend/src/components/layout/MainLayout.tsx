import { useState, useCallback, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PageTransition } from '@ams/ui/layouts';
import { Sidebar, type NavGroup } from './Sidebar';
import { Header } from './Header';
import { MobileNav, type MobileNavItem } from './MobileNav';
import { MobileDrawer } from './MobileDrawer';
import styles from './MainLayout.module.css';

export interface MainLayoutProps {
  children: ReactNode;
  title?: string;
  navGroups: NavGroup[];
  mobileNavItems?: MobileNavItem[];
}

export function MainLayout({ 
  children, 
  title = 'Asset Management System', 
  navGroups,
  mobileNavItems,
}: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);

  const handleMenuClick = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  const handleMoreClick = useCallback(() => {
    setMoreDrawerOpen(true);
  }, []);

  const handleMoreDrawerClose = useCallback(() => {
    setMoreDrawerOpen(false);
  }, []);

  // Generate default mobile nav items from nav groups if not provided
  const defaultMobileNavItems: MobileNavItem[] = mobileNavItems || navGroups
    .flatMap((group) => group.items)
    .slice(0, 4)
    .map((item) => ({
      path: item.path,
      label: item.label,
      icon: item.icon || (
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
        </svg>
      ),
    }));

  return (
    <div className={styles.layout}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar isOpen={sidebarOpen} onClose={handleSidebarClose} navGroups={navGroups} />

      <div className={styles.content}>
        <Header title={title} onMenuClick={handleMenuClick} />

        <main id="main-content" className={styles.main}>
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav
        items={defaultMobileNavItems}
        maxItems={4}
        onMoreClick={handleMoreClick}
      />

      {/* Mobile "More" drawer */}
      <MobileDrawer
        isOpen={moreDrawerOpen}
        onClose={handleMoreDrawerClose}
        title="More Options"
        position="bottom"
      >
        <nav aria-label="Additional navigation">
          {(() => {
            const pinnedPaths = new Set(defaultMobileNavItems.map((item) => item.path));
            return navGroups.map((group) => {
              const drawerItems = group.items.filter((item) => !pinnedPaths.has(item.path));
              if (drawerItems.length === 0) {
                return null;
              }
              return (
                <div key={group.title} className={styles.moreNavGroup}>
                  <h3 className={styles.moreNavGroupTitle}>{group.title}</h3>
                  <ul className={styles.moreNavList}>
                    {drawerItems.map((item) => (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          className={styles.moreNavLink}
                          onClick={handleMoreDrawerClose}
                        >
                          {item.icon && (
                            <span className={styles.moreNavIcon}>{item.icon}</span>
                          )}
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            });
          })()}
        </nav>
      </MobileDrawer>
    </div>
  );
}
