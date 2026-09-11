import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'NJUST 校园导航',
  description: '南京理工大学江阴校区校园步行导航',
};

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
