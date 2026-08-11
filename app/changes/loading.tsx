import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Changes" sub="Everything recorded across every property, newest first." lists={3} rows={6} />;
}
