import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'カスタム五十音表メーカー',
  description: 'それぞれの文字から始まる言葉で、自分だけの五十音表をつくる無料ツール',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;700;800&family=Klee+One:wght@400;600&family=Zen+Kurenaido&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
