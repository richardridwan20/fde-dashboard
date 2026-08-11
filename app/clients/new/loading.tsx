import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="New client" lists={1} rows={6} />;
}
