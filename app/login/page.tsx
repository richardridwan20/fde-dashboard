import { LoginForm } from '@/components/login-form';

export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: Promise<any> }) {
  const sp = await searchParams;

  return (
    <main className="mx-auto max-w-sm space-y-4 py-12">
      <div className="text-center">
        <h1 className="text-lg font-medium">Wasimil FDE</h1>
        <p className="text-[12px] text-faint">Sign in to the dashboard.</p>
      </div>
      {sp?.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-[12px] text-red-800">
          {String(sp.error).replace(/_/g, ' ')}
        </p>
      )}
      <LoginForm />
    </main>
  );
}
