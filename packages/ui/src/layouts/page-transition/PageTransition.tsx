import { type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './PageTransition.module.css';

export interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  return (
    <div key={location.key} className={styles.transition}>
      {children}
    </div>
  );
}
