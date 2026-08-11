import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Photos" metrics={4} lists={1} rows={4} />;
}
