import { PageSkeleton } from '@/components/skeleton';

// The form page is a centred max-w-2xl column, not the full-width shell.
export default function Loading() {
  return <PageSkeleton title="New client" narrow lists={1} rows={6} />;
}
