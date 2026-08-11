import { PageSkeleton } from '@/components/skeleton';

// No title: the real heading is the property name, so literal text here would
// flash the wrong thing before swapping.
export default function Loading() {
  return <PageSkeleton metrics={4} lists={4} rows={5} />;
}
