// 表データのURL用エンコード/デコード
//
// ブラウザでも Node.js / Edge Runtime でも動くよう、TextEncoder/Decoder と
// Base64URL を組み合わせるシンプルな実装にしている。

export type TableData = {
  theme: string;
  cells: Record<string, string>;
};

// バイト列をBase64URL文字列に
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  // btoa が無い環境（Node 18未満）は基本想定しない（Next.js は Node 18+）
  const b64 = typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const binary = typeof atob === 'function'
    ? atob(b64)
    : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function encodeTableData(data: TableData): string {
  // 空のセルは含めない
  const cells: Record<string, string> = {};
  for (const [k, v] of Object.entries(data.cells || {})) {
    if (v && v.trim()) cells[k] = v;
  }
  const minimized = { t: data.theme || '', c: cells };
  const json = JSON.stringify(minimized);
  const bytes = new TextEncoder().encode(json);
  return bytesToBase64Url(bytes);
}

export function decodeTableData(s: string): TableData | null {
  if (!s) return null;
  try {
    const bytes = base64UrlToBytes(s);
    const json = new TextDecoder().decode(bytes);
    const obj = JSON.parse(json);
    return {
      theme: typeof obj.t === 'string' ? obj.t : '',
      cells: (obj.c && typeof obj.c === 'object') ? obj.c : {},
    };
  } catch (e) {
    return null;
  }
}
