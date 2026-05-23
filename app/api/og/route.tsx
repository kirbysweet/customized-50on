import { ImageResponse } from 'next/og';
import { COLUMNS } from '@/lib/kana';
import { decodeTableData } from '@/lib/encode';

export const runtime = 'edge';

// OGP画像のサイズ（Xカード推奨サイズ）
const WIDTH = 1200;
const HEIGHT = 630;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const d = searchParams.get('d');
  const data = d ? decodeTableData(d) : null;

  const theme = data?.theme || '';
  const cells = data?.cells || {};

  // 日本語フォントを Google Fonts から取得
  // ※ ImageResponse は外部フォントの埋め込みに対応している
  // フォントサブセット最適化のため、表示する文字列だけを抽出してフォントを読み込む
  // ただしsatori/@vercel/ogはサブセット指定がないため、フォント全部をfetchすると重い
  // Noto Serif JPのregularは数MBあるため、CDN経由でフォントを読み込む（初回は遅いがキャッシュされる）
  let fontData: ArrayBuffer | null = null;
  try {
    // 使う可能性のある文字を集めて、Google Fonts CSS APIで最適化されたフォントを取得
    const allText = [
      theme,
      'カスタム五十音表メーカー',
      'CUSTOM GOJŪON TABLE',
      '五十音',
      ...Object.values(cells),
      // 全ての頭文字
      'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわ',
    ].join('');
    const uniqueChars = Array.from(new Set(allText)).join('');
    const fontCssUrl = `https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@500;700&text=${encodeURIComponent(uniqueChars)}`;
    const cssRes = await fetch(fontCssUrl, {
      headers: {
        // Google Fonts は User-Agent によって返すフォーマットを変える
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    const cssText = await cssRes.text();
    const fontUrlMatch = cssText.match(/src:\s*url\((https:[^)]+)\)\s*format\(['"]?woff2['"]?\)/);
    if (fontUrlMatch) {
      const fontRes = await fetch(fontUrlMatch[1]);
      fontData = await fontRes.arrayBuffer();
    }
  } catch (e) {
    console.warn('Font load failed', e);
  }

  // 表示用に列を反転（右からあ行）
  const reversed = [...COLUMNS].reverse();

  // 色
  const PAPER = '#f4ede0';
  const PAPER_DEEP = '#ebe0cd';
  const INK = '#1a1714';
  const INK_SOFT = '#4a3f35';
  const VERMILION = '#b33a3a';
  const LINE = 'rgba(26,23,20,0.2)';

  // セル幅・高さ計算
  const PADDING = 32;
  const TABLE_W = WIDTH - PADDING * 2;
  const TITLE_AREA = theme ? 80 : 50;
  const FOOTER_AREA = 40;
  const TABLE_H = HEIGHT - PADDING * 2 - TITLE_AREA - FOOTER_AREA;
  const COL_W = TABLE_W / 10;
  const ROW_H = TABLE_H / 5;

  // セル内のテキスト用に、長文は最大3行までに丸める表示用関数
  // OGPでは固定フォントサイズで描画する（@vercel/ogはflex+gridに対応）
  const cellsArray: { kana: string; value: string; row: number; col: number }[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 10; c++) {
      const kana = reversed[c].rows[r];
      if (kana === null) {
        cellsArray.push({ kana: '', value: '__EMPTY__', row: r, col: c });
      } else {
        cellsArray.push({ kana, value: cells[kana] || '', row: r, col: c });
      }
    }
  }

  // テキストサイズを内容に応じて雑に決める
  const getFontSize = (text: string): number => {
    if (!text) return 36;
    const lines = text.split('\n');
    const longest = lines.reduce((m, s) => Math.max(m, s.length), 0);
    const linesCount = lines.length;
    // セル幅から横方向の最大サイズ
    const innerW = COL_W - 12;
    const innerH = ROW_H - 12;
    let maxByWidth: number;
    if (longest <= 4 && linesCount === 1) {
      maxByWidth = Math.floor(innerW / (longest * 1.05));
    } else {
      maxByWidth = Math.floor(innerW / (5 * 1.05));
    }
    const maxByHeight = Math.floor(innerH / (linesCount * 1.25));
    return Math.max(11, Math.min(maxByWidth, maxByHeight, 44));
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: PAPER,
          padding: PADDING,
          fontFamily: '"Shippori Mincho", "Yu Mincho", "Hiragino Mincho ProN", serif',
        }}
      >
        {/* タイトル領域 */}
        <div
          style={{
            height: TITLE_AREA,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: INK_SOFT,
              letterSpacing: '0.3em',
              opacity: 0.7,
            }}
          >
            CUSTOM GOJŪON TABLE
          </div>
          {theme && (
            <div
              style={{
                fontSize: 36,
                color: INK,
                fontWeight: 700,
                letterSpacing: '0.05em',
                marginTop: 6,
              }}
            >
              {theme}
            </div>
          )}
        </div>

        {/* 五十音表 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            border: `2px solid ${INK}`,
            backgroundColor: PAPER,
          }}
        >
          {Array.from({ length: 5 }).map((_, r) => (
            <div key={r} style={{ display: 'flex', flexDirection: 'row' }}>
              {Array.from({ length: 10 }).map((_, c) => {
                const cell = cellsArray.find(x => x.row === r && x.col === c)!;
                const isEmpty = cell.value === '__EMPTY__';
                const isLastCol = c === 9;
                const isLastRow = r === 4;
                const cellStyle: React.CSSProperties = {
                  width: COL_W,
                  height: ROW_H,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: isLastCol ? 'none' : `1px solid ${LINE}`,
                  borderBottom: isLastRow ? 'none' : `1px solid ${LINE}`,
                  padding: 6,
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                };
                if (isEmpty) {
                  return (
                    <div
                      key={c}
                      style={{
                        ...cellStyle,
                        backgroundColor: PAPER_DEEP,
                        backgroundImage: `repeating-linear-gradient(45deg, ${PAPER} 0, ${PAPER} 8px, ${PAPER_DEEP} 8px, ${PAPER_DEEP} 9px)`,
                      }}
                    />
                  );
                }
                if (!cell.value) {
                  // 未入力: 大きな頭文字を薄く
                  return (
                    <div key={c} style={cellStyle}>
                      <div style={{ fontSize: 56, color: INK, opacity: 0.18, fontWeight: 800, display: 'flex' }}>
                        {cell.kana}
                      </div>
                    </div>
                  );
                }
                // 入力済み: その内容を表示
                const fs = getFontSize(cell.value);
                return (
                  <div key={c} style={cellStyle}>
                    <div
                      style={{
                        fontSize: fs,
                        color: INK,
                        fontWeight: 500,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        lineHeight: 1.25,
                        display: 'flex',
                        textAlign: 'center',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        overflow: 'hidden',
                      }}
                    >
                      {cell.value}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* フッタ */}
        <div
          style={{
            height: FOOTER_AREA,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: INK_SOFT,
            fontSize: 14,
            letterSpacing: '0.1em',
            paddingTop: 12,
          }}
        >
          <div style={{ display: 'flex', color: INK_SOFT, opacity: 0.7 }}>カスタム五十音表メーカー</div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `2px solid ${VERMILION}`,
              color: VERMILION,
              fontWeight: 700,
              fontSize: 12,
              width: 56,
              height: 28,
              borderRadius: 4,
              letterSpacing: '0.1em',
            }}
          >
            五十音
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: fontData ? [{
        name: 'Shippori Mincho',
        data: fontData,
        style: 'normal',
        weight: 700,
      }] : undefined,
    }
  );
}
