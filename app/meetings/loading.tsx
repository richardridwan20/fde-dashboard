import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Activities" sub="Meetings, migrations, installs and site visits. Write the notes in markdown with the photos embedded." metrics={4} lists={2} rows={4} />;
}
