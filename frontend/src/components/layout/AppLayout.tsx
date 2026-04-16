import type { ReactNode } from 'react';
import { Navbar } from './Navbar';
import { Toaster } from '@/components/ui/Toaster';

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      <Toaster />
    </div>
  );
}
