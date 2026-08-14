import { PageSkeleton } from '@/components/skeleton';

export default function Loading() {
  return <PageSkeleton title="Weekly report" sub="SHIPPED and IN PROGRESS are derived live from blockers and ClickUp. The four narrative sections are yours." lists={1} rows={8} />;
}
