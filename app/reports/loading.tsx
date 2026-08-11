import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Weekly report" sub="Generated from this week’s blockers, ClickUp tasks and meetings." lists={1} rows={8} />;
}
