import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Team" metrics={4} lists={3} rows={4} />;
}
