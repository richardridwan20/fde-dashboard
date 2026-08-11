import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Meetings" sub="Schedule, then write the notes in markdown with the photos embedded." metrics={4} lists={2} rows={4} />;
}
