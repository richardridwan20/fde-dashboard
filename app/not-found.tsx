import Link from 'next/link';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="py-16 text-center">
      <h1 className="text-lg font-medium">Not found</h1>
      <p className="mt-1 text-[13px] text-sub">
        That property or page does not exist — it may have been renamed.
      </p>
      <Button className="mt-4" asChild>
        <Link href="/">Back to portfolio</Link>
      </Button>
    </main>
  );
}
