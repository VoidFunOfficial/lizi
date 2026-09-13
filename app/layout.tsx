import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '南梨有梨',
  icons: {
    icon: [{ url: '/icon.png', type: 'image/png' }],
    apple: '/apple-touch-icon.png',
  },
  description:
    '标注曲线路径、自由通行面、楼内通道与开放规则，并按距离、晴天建筑阴影、避雨和无障碍偏好导航。',
  openGraph: {
    title: '南梨有梨',
    description: '曲线路径 · 晴天建筑阴影 · 楼内避暑 · 无障碍导航',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '南梨有梨',
    description: '曲线路径 · 晴天建筑阴影 · 楼内避暑 · 无障碍导航',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
