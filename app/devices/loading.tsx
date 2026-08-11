import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Devices" sub="Integration status per device, across every property." metrics={4} lists={4} rows={2} />;
}
