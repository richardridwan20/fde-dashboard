import Link from 'next/link';
import { getAllPhotos, getOverview } from '@/lib/data';
import { Card, CardHeader, Empty } from '@/components/ui';
import { PhotoGrid } from '@/components/photo-grid';

export const dynamic = 'force-dynamic';

export default async function Photos({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;
  const category = sp?.category;
  const [all, clients] = await Promise.all([getAllPhotos(), getOverview()]);

  const photos = category ? all.filter((p: any) => p.category === category) : all;
  const categories = Array.from(new Set(all.map((p: any) => p.category))).sort();
  const byProperty = clients
    .map((c: any) => ({ client: c, items: photos.filter((p: any) => p.property_id === c.id) }))
    .filter((g: any) => g.items.length);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-medium">Photos</h1>
          <p className="text-[12px] text-faint">
            {all.length} uploaded. Click a caption to edit it; tick to select and delete.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <Link href="/photos" className={category ? 'underline' : 'font-medium'}>
            all
          </Link>
          {categories.map((c: any) => (
            <Link
              key={c}
              href={`/photos?category=${c}`}
              className={category === c ? 'font-medium' : 'underline'}
            >
              {c}
            </Link>
          ))}
        </div>
      </div>

      {byProperty.map(({ client, items }: any) => (
        <Card key={client.id}>
          <CardHeader
            title={
              <Link href={`/property/${client.slug}`} className="hover:underline">
                {client.name}
              </Link>
            }
          />
          <PhotoGrid photos={items} />
        </Card>
      ))}

      {!photos.length && (
        <Card>
          <Empty>No photos{category ? ` in ${category}` : ''} yet.</Empty>
        </Card>
      )}
    </main>
  );
}
