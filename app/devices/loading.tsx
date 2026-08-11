import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Devices" metrics={4} lists={2} rows={6} />;
}
