import { PageSkeleton } from '@/components/skeleton';

// Sub omitted: the real one ends "Last sync 3h ago", which is data.
export default function Loading() {
  return <PageSkeleton title="ClickUp" metrics={4} lists={2} rows={6} />;
}
