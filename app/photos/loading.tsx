import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Photos" lists={3} rows={3} />;
}
