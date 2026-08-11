import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Weekly report" lists={1} rows={8} />;
}
