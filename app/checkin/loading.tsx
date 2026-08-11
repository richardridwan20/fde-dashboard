import { PageSkeleton } from '@/components/skeleton';

// No metrics: the page renders its stat row only when events exist, and there
// are none. Drawing four cards that then vanish tells exactly the lie this page
// was written to avoid.
export default function Loading() {
  return <PageSkeleton title="Check-in" sub="Where guest check-in stalls or fails, by property and by step. Last 14 days." lists={1} rows={5} />;
}
