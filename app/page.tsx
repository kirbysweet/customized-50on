import type { Metadata } from 'next';
import { decodeTableData } from '@/lib/encode';
import Editor from './Editor';

type SearchParams = { d?: string };

export async function generateMetadata(
  { searchParams }: { searchParams: SearchParams }
): Promise<Metadata> {
  const d = typeof searchParams.d === 'string' ? searchParams.d : '';
  const data = d ? decodeTableData(d) : null;

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || ''; // Vercelデプロイ後に自動で正しいURLになる
  const ogImageUrl = d ? `/api/og?d=${encodeURIComponent(d)}` : `/api/og`;

  const title = data?.theme
    ? `「${data.theme}」のカスタム五十音表`
    : 'カスタム五十音表メーカー';
  const description = data?.theme
    ? `「${data.theme}」で五十音表をつくりました。あなたも作ってみませんか？`
    : 'それぞれの文字から始まる言葉で、自分だけの五十音表をつくる無料ツール';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
    metadataBase: baseUrl ? new URL(baseUrl) : undefined,
  };
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  const d = typeof searchParams.d === 'string' ? searchParams.d : '';
  const initialData = d ? decodeTableData(d) : null;
  return <Editor initialData={initialData} />;
}
