'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { COLUMNS } from '@/lib/kana';
import { encodeTableData, TableData } from '@/lib/encode';

declare global {
  interface Window {
    html2canvas: any;
    __refitTimer?: ReturnType<typeof setTimeout>;
  }
}

const STORAGE_KEY = 'gojuon-table-v1';

// ---- 保存・復元 (cookie) ----
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const exp = new Date(Date.now() + days * 86400000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${exp}; path=/; SameSite=Lax`;
}

// ---- contentEditable のヘルパ ----
function getEditorValue(editor: HTMLDivElement): string {
  let v = (editor.innerText || '').replace(/\r/g, '');
  v = v.replace(/\n+$/, '');
  return v;
}
function setEditorValue(editor: HTMLDivElement, value: string) {
  editor.textContent = value || '';
}
function normalizeEditor(editor: HTMLDivElement) {
  const v = getEditorValue(editor);
  if (!v) {
    if (editor.innerHTML !== '') editor.innerHTML = '';
  }
}
function focusEditor(ed: HTMLDivElement) {
  ed.focus();
  const range = document.createRange();
  range.selectNodeContents(ed);
  range.collapse(false);
  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

// ---- fitText: 文字サイズの自動調整 ----
function fitText(ed: HTMLDivElement) {
  const cell = ed.closest('.cell') as HTMLElement | null;
  if (!cell) return;
  const PAD = 6;
  const LH = 1.25;
  const cellW = cell.clientWidth;
  const cellH = cell.clientHeight;
  const innerW = cellW - PAD * 2;
  const innerH = cellH - PAD * 2;

  const maxByFive = Math.floor(innerW / (5 * 1.02));
  const maxByOneLine = Math.floor(innerH / LH);
  const HARD_MAX = 36;
  const minFs = 9;

  const value = getEditorValue(ed);
  if (!value) {
    ed.style.setProperty('--cell-fs', Math.min(maxByFive, maxByOneLine, HARD_MAX) + 'px');
    return;
  }

  const lines = value.split('\n');
  const longest = lines.reduce((m, s) => Math.max(m, s.length), 0);
  const hasNewline = lines.length > 1;

  let maxFs: number;
  if (!hasNewline && longest <= 4 && longest > 0) {
    const fitByChars = Math.floor(innerW / (longest * 1.02));
    maxFs = Math.min(fitByChars, maxByOneLine, HARD_MAX);
  } else {
    maxFs = Math.min(maxByFive, HARD_MAX);
    maxFs = Math.min(maxFs, Math.floor(innerH / (lines.length * LH)));
  }
  maxFs = Math.max(minFs, maxFs);

  let fs = maxFs;
  for (; fs >= minFs; fs--) {
    ed.style.setProperty('--cell-fs', fs + 'px');
    const overW = ed.scrollWidth > ed.clientWidth + 1;
    const overH = ed.scrollHeight > ed.clientHeight + 1;
    if (!overW && !overH) break;
  }
  if (fs < minFs) {
    ed.style.setProperty('--cell-fs', minFs + 'px');
  }
}

function updateFilled(ed: HTMLDivElement) {
  const cell = ed.closest('.cell') as HTMLElement | null;
  if (!cell) return;
  const v = getEditorValue(ed);
  if (v.trim()) cell.classList.add('filled');
  else cell.classList.remove('filled');
  fitText(ed);
}

// html2canvasを必要時に動的読み込み
function loadHtml2Canvas(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => resolve(window.html2canvas);
    s.onerror = () => reject(new Error('html2canvas load failed'));
    document.head.appendChild(s);
  });
}

export default function Editor({ initialData }: { initialData: TableData | null }) {
  const reversedColumns = [...COLUMNS].reverse();
  const gridRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLInputElement>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<{ msg: string; show: boolean }>({ msg: '', show: false });
  const [savedShown, setSavedShown] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // すべての .editor 要素を取得
  const getAllEditors = useCallback((): HTMLDivElement[] => {
    if (!gridRef.current) return [];
    return Array.from(gridRef.current.querySelectorAll<HTMLDivElement>('.editor[data-kana]'));
  }, []);

  // 保存処理
  const saveState = useCallback(() => {
    const cells: Record<string, string> = {};
    getAllEditors().forEach(ed => {
      const v = getEditorValue(ed);
      if (v.trim()) cells[ed.dataset.kana!] = v;
    });
    const theme = themeRef.current?.value || '';
    const data = { theme, cells };
    const json = JSON.stringify(data);
    try { localStorage.setItem(STORAGE_KEY, json); } catch (e) {}
    if (json.length < 3500) setCookie(STORAGE_KEY, json, 180);

    setSavedShown(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSavedShown(false), 1200);
  }, [getAllEditors]);

  // トースト表示
  const showToast = useCallback((msg: string, ms = 3000) => {
    setToast({ msg, show: true });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(t => ({ ...t, show: false })), ms);
  }, []);

  // 初期化（マウント時）
  useEffect(() => {
    // 復元の優先順位:
    // 1) URLパラメータ（initialData）が最優先 — 共有URLから開いた場合
    // 2) なければ localStorage / cookie
    let loaded: TableData | null = initialData;
    if (!loaded) {
      let raw: string | null = null;
      try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) {}
      if (!raw) raw = getCookie(STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          const cells = parsed.cells || parsed;
          loaded = {
            theme: typeof parsed.theme === 'string' ? parsed.theme : '',
            cells: cells || {},
          };
        } catch (e) {}
      }
    }

    if (loaded) {
      getAllEditors().forEach(ed => {
        const kana = ed.dataset.kana!;
        if (loaded!.cells[kana]) setEditorValue(ed, loaded!.cells[kana]);
      });
      if (loaded.theme && themeRef.current) themeRef.current.value = loaded.theme;
    }

    // filled状態と文字サイズを反映
    getAllEditors().forEach(updateFilled);

    // フォント読み込み後に再フィット
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        getAllEditors().forEach(fitText);
      });
    }

    // ウィンドウリサイズで再フィット
    const onResize = () => {
      if (window.__refitTimer) clearTimeout(window.__refitTimer);
      window.__refitTimer = setTimeout(() => getAllEditors().forEach(fitText), 150);
    };
    window.addEventListener('resize', onResize);
    // ページ離脱前に保存
    window.addEventListener('beforeunload', saveState);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('beforeunload', saveState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- 方向移動 ----
  const moveToNextEditor = (currentEd: HTMLDivElement) => {
    const all = getAllEditors();
    const i = all.indexOf(currentEd);
    if (i >= 0 && i < all.length - 1) focusEditor(all[i + 1]);
  };
  const getEditorAt = (r: number, c: number): HTMLDivElement | null => {
    if (!gridRef.current) return null;
    return gridRef.current.querySelector<HTMLDivElement>(`.editor[data-row="${r}"][data-col="${c}"]`);
  };
  const moveDirection = (currentEd: HTMLDivElement, dr: number, dc: number) => {
    const r0 = parseInt(currentEd.dataset.row!, 10);
    const c0 = parseInt(currentEd.dataset.col!, 10);
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < 5 && c >= 0 && c < 10) {
      const ed = getEditorAt(r, c);
      if (ed) { focusEditor(ed); return; }
      r += dr; c += dc;
    }
  };

  // ---- イベントハンドラ ----
  const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
    const ed = e.currentTarget;
    normalizeEditor(ed);
    updateFilled(ed);
    saveState();
  };
  const handleEditorBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    const ed = e.currentTarget;
    normalizeEditor(ed);
    updateFilled(ed);
  };
  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (!e.shiftKey) return;
    const ed = e.currentTarget;
    if (e.key === 'Enter') { e.preventDefault(); moveToNextEditor(ed); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); moveDirection(ed, 0, +1); }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); moveDirection(ed, 0, -1); }
    else if (e.key === 'ArrowDown')  { e.preventDefault(); moveDirection(ed, +1, 0); }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); moveDirection(ed, -1, 0); }
  };
  const handleEditorPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text');
    document.execCommand('insertText', false, text);
  };

  // ---- すべて消す ----
  const handleClear = () => {
    if (!confirm('すべての入力を消去します。よろしいですか？')) return;
    getAllEditors().forEach(ed => {
      setEditorValue(ed, '');
      updateFilled(ed);
    });
    if (themeRef.current) themeRef.current.value = '';
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    setCookie(STORAGE_KEY, '', -1);
  };

  // ---- PNG生成（保存・共有共通） ----
  const renderPaperToPng = async (): Promise<{ blob: Blob; dataUrl: string; filename: string }> => {
    const html2canvas = await loadHtml2Canvas();
    const paper = paperRef.current!;
    const toolbar = paper.querySelector('.toolbar') as HTMLElement;
    const savedDisplay = toolbar.style.display;

      getAllEditors().forEach(ed => {
        (ed as any).dataset.prevCE = ed.contentEditable;
        ed.contentEditable = 'false';
      });

    const themeInp = themeRef.current!;
    const themeProxy = document.createElement('div');
    themeProxy.className = 'theme-proxy';
    themeProxy.textContent = themeInp.value;
    themeInp.parentNode!.insertBefore(themeProxy, themeInp);
    themeInp.style.display = 'none';

    const credit = document.createElement('div');
    credit.className = 'export-credit';
    credit.textContent = 'Created by カスタム五十音表メーカー';
    paper.appendChild(credit);

    paper.classList.add('for-export');
    toolbar.style.display = 'none';

    try {
      const canvas = await html2canvas(paper, {
        backgroundColor: '#f4ede0',
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
      const theme = (themeInp.value || '').trim().replace(/[\\/:*?"<>|]/g, '');
      const filename = theme ? `カスタム五十音表_${theme}_${ts}.png` : `カスタム五十音表_${ts}.png`;
      const blob: Blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const dataUrl = canvas.toDataURL('image/png');
      return { blob, dataUrl, filename };
    } finally {
      paper.classList.remove('for-export');
      toolbar.style.display = savedDisplay;
      getAllEditors().forEach(ed => {
        ed.contentEditable = (ed as any).dataset.prevCE || 'plaintext-only';
        delete (ed as any).dataset.prevCE;
      });
      themeProxy.remove();
      themeInp.style.display = '';
      credit.remove();
    }
  };

  // ---- PNG保存 ----
  const handleExport = async () => {
    try {
      const { dataUrl, filename } = await renderPaperToPng();
      const a = document.createElement('a');
      a.download = filename;
      a.href = dataUrl;
      a.click();
    } catch (e: any) {
      alert('PNG出力に失敗しました: ' + e.message);
    }
  };

  // ---- X で共有 ----
  const buildShareUrl = (): string => {
    const cells: Record<string, string> = {};
    getAllEditors().forEach(ed => {
      const v = getEditorValue(ed);
      if (v.trim()) cells[ed.dataset.kana!] = v;
    });
    const theme = themeRef.current?.value || '';
    const encoded = encodeTableData({ theme, cells });
    const base = window.location.origin + window.location.pathname;
    return `${base}?d=${encoded}`;
  };
  const buildTweetText = (shareUrl: string): string => {
    const theme = (themeRef.current?.value || '').trim();
    const head = theme ? `「${theme}」` : '自分だけのお題';
    return `${head}で五十音表をつくりました！\n#カスタム五十音表メーカー\n${shareUrl}`;
  };
  const openTweetCompose = (text: string) => {
    const url = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShareX = async () => {
    const shareUrl = buildShareUrl();
    const tweetText = buildTweetText(shareUrl);
    // OGP方式：画像はサーバー側で生成されるので、ツイート文＋URLだけを渡す
    // (URL末尾にog:image付きのページが入るので、Xカードで画像つきプレビューが出る)
    openTweetCompose(tweetText);
    showToast('投稿画面を開きました。\n投稿すると五十音表がカード表示されます。', 5000);
  };

  return (
    <>
      <div className="container">
        <header>
          <div className="title-wrap">
            <span className="kicker">Custom Gojūon Table Maker</span>
            <h1>カスタム<span className="accent">五十音表</span>メーカー</h1>
            <p className="subtitle">それぞれの文字から始まる言葉で、自分だけの表をつくる</p>
          </div>
        </header>

        <div className="paper" id="paper" ref={paperRef}>
          <div className="toolbar">
            <div className="toolbar-label">
              <span className="dot"></span>自動保存中
              <span className={'save-indicator' + (savedShown ? ' show' : '')}>
                <span className="check">✓</span> 保存しました
              </span>
            </div>
            <button className="btn btn-ghost" onClick={handleClear}>すべて消す</button>
            <button className="btn" onClick={handleExport}>PNGとして保存</button>
            <button className="btn btn-primary btn-x" onClick={handleShareX}>
              <svg className="x-logo" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>Xのポストで共有</span>
            </button>
          </div>

          <div className="theme-strip">
            <input
              type="text"
              ref={themeRef}
              className="theme-input"
              placeholder="この表のテーマを入力（例：好きな食べもの）"
              maxLength={40}
              onInput={saveState}
            />
          </div>

          <div className="table-wrap">
            <div className="gojuon" ref={gridRef}>
              {Array.from({ length: 5 }).map((_, r) => (
                reversedColumns.map((col, c) => {
                  const kana = col.rows[r];
                  if (kana === null) {
                    return <div key={`${r}-${c}`} className="cell empty" data-row={r} data-col={c}></div>;
                  }
                  return (
                    <div key={`${r}-${c}`} className="cell" data-kana={kana} data-row={r} data-col={c}>
                      <div className="big-kana">{kana}</div>
                      <div
                        className="editor"
                        ref={(el) => {
                          if (el && el.contentEditable !== 'plaintext-only') {
                            try { el.contentEditable = 'plaintext-only'; }
                            catch (e) { el.contentEditable = 'true'; }
                          }
                        }}
                        data-kana={kana}
                        data-row={r}
                        data-col={c}
                        role="textbox"
                        aria-label={`${kana}から始まる言葉`}
                        aria-multiline="true"
                        onInput={handleEditorInput}
                        onBlur={handleEditorBlur}
                        onKeyDown={handleEditorKeyDown}
                        onPaste={handleEditorPaste}
                        suppressContentEditableWarning
                      />
                    </div>
                  );
                })
              ))}
            </div>
          </div>

          <div className="meta">
            <span>※ 入力内容はこのブラウザに自動で保存されます</span>
            <div className="stamp">五十<br />音表</div>
          </div>
        </div>

        <p className="footnote">CRAFTED · WITH · CARE</p>
      </div>

      <div className={'toast' + (toast.show ? ' show' : '')} role="status" aria-live="polite">
        {toast.msg}
      </div>
    </>
  );
}
