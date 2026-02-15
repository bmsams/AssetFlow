import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import { useAuth, type UserRole } from '../hooks/useAuth';
import { getLandingPage } from '../utils/landing-page';
import styles from './Page.module.css';

interface AccessDeniedPageProps {
  requiredRoles?: UserRole[];
}

export function AccessDeniedPage({ requiredRoles }: AccessDeniedPageProps) {
  const { user } = useAuth();
  const landingPage = getLandingPage(user?.roles ?? []);

  return (
    <div className={styles.page}>
      <div className={styles.centeredContent}>
        <h1 className={styles.errorCode}>403</h1>
        <p className={styles.errorTitle}>Access Denied</p>
        <p className={styles.errorDescription}>
          You do not have the required role to access this page.
        </p>
        {requiredRoles && requiredRoles.length > 0 && (
          <p className={styles.errorDescription}>
            Required roles: {requiredRoles.join(', ')}
          </p>
        )}
        <Link to={landingPage}>
          <Button variant="primary">Go to Home</Button>
        </Link>
      </div>
    </div>
  );
}
