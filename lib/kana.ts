export type ColumnDef = {
  head: string;
  romaji: string;
  rows: (string | null)[];
};

// 配列の順序: あ行→わ行（表示は逆順に並び替える）
export const COLUMNS: ColumnDef[] = [
  { head: 'あ', romaji: 'A',  rows: ['あ','い','う','え','お'] },
  { head: 'か', romaji: 'KA', rows: ['か','き','く','け','こ'] },
  { head: 'さ', romaji: 'SA', rows: ['さ','し','す','せ','そ'] },
  { head: 'た', romaji: 'TA', rows: ['た','ち','つ','て','と'] },
  { head: 'な', romaji: 'NA', rows: ['な','に','ぬ','ね','の'] },
  { head: 'は', romaji: 'HA', rows: ['は','ひ','ふ','へ','ほ'] },
  { head: 'ま', romaji: 'MA', rows: ['ま','み','む','め','も'] },
  { head: 'や', romaji: 'YA', rows: ['や', null, 'ゆ', null, 'よ'] },
  { head: 'ら', romaji: 'RA', rows: ['ら','り','る','れ','ろ'] },
  { head: 'わ', romaji: 'WA', rows: ['わ', null, null, null, null] },
];

// 全てのかな（順序固定）。エンコード/デコードはこの順序に依存する。
export const ALL_KANA: string[] = (() => {
  const out: string[] = [];
  for (const col of COLUMNS) {
    for (const k of col.rows) {
      if (k !== null) out.push(k);
    }
  }
  return out;
})();
