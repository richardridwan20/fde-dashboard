import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Weekly report" lists={2} rows={6} />;
}
