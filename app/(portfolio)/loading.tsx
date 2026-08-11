import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Portfolio" sub="Where every property stands, and what is holding it up." metrics={6} tables={3} cols={7} lists={0} rows={4} />;
}
