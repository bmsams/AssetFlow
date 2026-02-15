import { Link } from 'react-router-dom';
import { Button } from '../components/ui';
import styles from './Page.module.css';

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <div className={styles.centeredContent}>
        <h1 className={styles.errorCode}>404</h1>
        <p className={styles.errorTitle}>Page Not Found</p>
        <p className={styles.errorDescription}>
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link to="/">
          <Button variant="primary">Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
