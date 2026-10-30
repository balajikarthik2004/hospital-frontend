import { Link } from 'react-router-dom';
import { Button, EmptyState } from '@/components/common';

export function NotFoundPage() {
  return (
    <EmptyState
      title="That page does not exist"
      detail="The link may be out of date, or the record may have been removed."
      action={
        <Link to="/">
          <Button variant="outline">Back to the dashboard</Button>
        </Link>
      }
    />
  );
}
