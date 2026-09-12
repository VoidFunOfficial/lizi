import type { Metadata } from 'next';
import LandingPage from './landing/landing-page';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'NJustMap · 把校园，装进口袋。',
  description:
    '为南京理工大学江阴校区打造。校园地图、步行导航、课表与日程，让校园里的每一天，多一点从容。下载 Android 或直接使用 Web 版。',
  openGraph: {
    title: 'NJustMap · 把校园，装进口袋。',
    description: '校园地图、路线、课表与日程。为江阴校区的每一天。',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
};

export default LandingPage;
