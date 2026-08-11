import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Team" sub="Who is carrying what, and how the new joiners are ramping." metrics={4} lists={3} rows={4} />;
}
