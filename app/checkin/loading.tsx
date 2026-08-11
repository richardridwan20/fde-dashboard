import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Check-in" sub="Where guest check-in stalls or fails, by property and by step." metrics={4} lists={2} rows={5} />;
}
