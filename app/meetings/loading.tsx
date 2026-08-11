import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Meetings" metrics={4} lists={2} rows={4} />;
}
