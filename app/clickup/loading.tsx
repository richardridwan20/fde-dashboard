import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="ClickUp" metrics={4} lists={2} rows={6} />;
}
