<script lang="ts">
  import { copyText } from '../lib/clipboard';
  import { fiscalYearOf } from '../lib/date';
  import { normalizeData, savedFiscalYears } from '../lib/storage';
  import { store } from '../lib/store.svelte';
  import { THEMES, THEME_LABELS } from '../lib/theme';
  import TimeSelect from './TimeSelect.svelte';

  interface Props {
    onnotify: (message: string) => void;
  }

  let { onnotify }: Props = $props();

  const currentFy = fiscalYearOf(new Date());
  const yearOptions = $derived(
    Array.from(new Set([...savedFiscalYears(), currentFy, store.fiscalYear, currentFy + 1])).sort(
      (a, b) => a - b
    )
  );

  let newWork = $state('');
  let newNote = $state('');
  let importJson = $state('');
  let importFileName = $state('');
  let fileInput = $state<HTMLInputElement | null>(null);

  function addPreset(kind: 'work' | 'note') {
    const value = (kind === 'work' ? newWork : newNote).trim();
    if (!value) return;
    store.updateSettings((s) => {
      if (!s.presets[kind].includes(value)) s.presets[kind].push(value);
    });
    if (kind === 'work') newWork = '';
    else newNote = '';
  }

  function removePreset(kind: 'work' | 'note', value: string) {
    store.updateSettings((s) => {
      s.presets[kind] = s.presets[kind].filter((v) => v !== value);
    });
  }

  async function copyJson() {
    const ok = await copyText(store.exportJson());
    onnotify(ok ? 'JSONをコピーしました' : 'コピーできませんでした');
  }

  function downloadJson() {
    const blob = new Blob([store.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kintai-${store.fiscalYear}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function readFile(file: File): Promise<string> {
    if (typeof file.text === 'function') return file.text();
    // File.text() 非対応環境（古い iOS Safari 等）向けフォールバック
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async function onFilePicked(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    // 同じファイルを選び直しても change が発火するようにクリアする
    input.value = '';
    if (!file) return;
    try {
      const text = await readFile(file);
      JSON.parse(text);
      importJson = text;
      importFileName = file.name;
      onnotify(`${file.name} を読み込みました`);
    } catch {
      importJson = '';
      importFileName = '';
      onnotify('ファイルを読み込めませんでした（JSON形式ではありません）');
    }
  }

  function restoreJson() {
    try {
      const data = normalizeData(JSON.parse(importJson), store.fiscalYear);
      store.replaceAll(data);
      importJson = '';
      importFileName = '';
      onnotify(`${data.fiscalYear}年度のデータを復元しました`);
    } catch {
      onnotify('JSONの読み込みに失敗しました');
    }
  }

  function clearYear() {
    if (!confirm(`${store.fiscalYear}年度の入力データをすべて削除します。よろしいですか？`)) return;
    store.clearYear();
    onnotify('削除しました');
  }
</script>

<div class="card">
  <h2>テーマ</h2>
  <div class="themes" role="group" aria-label="テーマ">
    {#each THEMES as theme (theme)}
      <button
        class="btn small"
        class:primary={store.theme === theme}
        aria-pressed={store.theme === theme}
        onclick={() => store.setTheme(theme)}
      >
        {THEME_LABELS[theme]}
      </button>
    {/each}
  </div>
  <p class="muted" style="margin-bottom:0">
    「端末の設定」はOS/ブラウザのライト・ダーク設定に追従します。
  </p>
</div>

<div class="card">
  <h2>年度</h2>
  <select
    value={store.fiscalYear}
    onchange={(e) => store.setFiscalYear(Number(e.currentTarget.value))}
  >
    {#each yearOptions as year (year)}
      <option value={year}>{year}年度（{year}/4/1〜{year + 1}/3/31）</option>
    {/each}
  </select>
  <p class="muted" style="margin-bottom:0">データは年度ごとに分けて保存されます。</p>
</div>

<div class="card">
  <h2>既定の勤務パターン</h2>
  <div class="times">
    <div class="field">
      <label for="p-start">開始</label>
      <TimeSelect
        id="p-start"
        bind:value={
          () => store.settings.defaultPattern.start,
          (v) => store.updateSettings((s) => (s.defaultPattern.start = v))
        }
      />
    </div>
    <div class="field">
      <label for="p-end">終了</label>
      <TimeSelect
        id="p-end"
        bind:value={
          () => store.settings.defaultPattern.end,
          (v) => store.updateSettings((s) => (s.defaultPattern.end = v))
        }
      />
    </div>
    <div class="field">
      <label for="p-break">休憩</label>
      <TimeSelect
        id="p-break"
        to={480}
        bind:value={
          () => store.settings.defaultPattern.break,
          (v) => store.updateSettings((s) => (s.defaultPattern.break = v))
        }
      />
    </div>
  </div>
</div>

<div class="card">
  <h2>作業内容のプリセット</h2>
  <div class="row wrap">
    {#each store.settings.presets.work as preset (preset)}
      <button class="btn small ghost" onclick={() => removePreset('work', preset)}>
        {preset} ✕
      </button>
    {/each}
  </div>
  <div class="row" style="margin-top:8px">
    <input type="text" bind:value={newWork} placeholder="追加する作業内容" />
    <button class="btn small" onclick={() => addPreset('work')}>追加</button>
  </div>
</div>

<div class="card">
  <h2>備考のプリセット</h2>
  <div class="row wrap">
    {#each store.settings.presets.note as preset (preset)}
      <button class="btn small ghost" onclick={() => removePreset('note', preset)}>
        {preset} ✕
      </button>
    {/each}
  </div>
  <div class="row" style="margin-top:8px">
    <input type="text" bind:value={newNote} placeholder="追加する備考" />
    <button class="btn small" onclick={() => addPreset('note')}>追加</button>
  </div>
</div>

<div class="card">
  <h2>バックアップ</h2>
  <div class="row">
    <button class="btn small" onclick={copyJson}>JSONをコピー</button>
    <button class="btn small" onclick={downloadJson}>ファイルに保存</button>
  </div>
</div>

<div class="card">
  <h2>データの復元</h2>
  <div class="row">
    <button class="btn small" onclick={() => fileInput?.click()}>ファイルから読み込み</button>
    {#if importFileName}
      <span class="muted" style="align-self:center">{importFileName}</span>
    {/if}
  </div>
  <input
    bind:this={fileInput}
    type="file"
    accept="application/json,.json"
    class="hidden-file"
    onchange={onFilePicked}
  />
  <div class="field" style="margin-top:10px">
    <label for="restore">JSONを貼り付けて復元</label>
    <textarea
      id="restore"
      bind:value={importJson}
      oninput={() => (importFileName = '')}
      rows="4"
      placeholder="ここに貼り付け"
    ></textarea>
  </div>
  <button class="btn" style="width:100%" onclick={restoreJson} disabled={!importJson.trim()}>
    復元（現在の年度データを置き換え）
  </button>
</div>

<div class="card">
  <h2>データの取り扱い</h2>
  <p class="muted" style="margin:0">
    データはこの端末のブラウザ（LocalStorage）にのみ保存され、外部には送信されません。
    <strong>ブラウザのデータ削除（履歴削除・サイトデータ消去）を行うと消えます。</strong>
    定期的にJSONバックアップを取ってください。
  </p>
  {#if !store.storageAvailable}
    <div class="issue error" style="margin-top:8px">
      このブラウザでは LocalStorage が使えないため、入力内容は保存されません。
    </div>
  {/if}
  <button class="btn danger" style="width:100%;margin-top:10px" onclick={clearYear}>
    {store.fiscalYear}年度のデータを全削除
  </button>
</div>

<style>
  .themes {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-bottom: 8px;
  }

  .times {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .times .field {
    margin-bottom: 0;
  }

  .hidden-file {
    display: none;
  }
</style>
