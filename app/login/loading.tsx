import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Sign in" narrow lists={1} rows={2} />;
}
