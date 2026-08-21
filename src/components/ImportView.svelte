<script lang="ts">
  import { formatShort } from '../lib/date';
  import { store } from '../lib/store.svelte';
  import { mergeEntry, parseImport, type ImportResult } from '../lib/tsv';
  import type { DayEntry } from '../lib/types';

  interface Props {
    year: number;
    month: number;
    onnotify: (message: string) => void;
  }

  let { year, month, onnotify }: Props = $props();

  let text = $state('');
  let singleColumnAs = $state<'work-content' | 'note'>('work-content');
  let result = $state<ImportResult | null>(null);

  const SHAPE_LABEL = {
    full: 'C〜L列（全項目）',
    'work-time': 'C〜F列（勤怠区分・開始・終了・休憩）',
    'work-content': 'H列（作業内容）',
    note: 'K列（備考）'
  } as const;

  interface Change {
    key: string;
    before?: DayEntry;
    after: DayEntry;
    overwrite: boolean;
  }

  const changes = $derived.by<Change[]>(() => {
    if (!result) return [];
    const list: Change[] = [];
    for (const row of result.rows) {
      if (!row.entry) continue;
      const before = store.getDay(row.key);
      const after = mergeEntry(before, row.entry, result.shape);
      if (before && JSON.stringify(before) === JSON.stringify(after)) continue;
      list.push({ key: row.key, before, after, overwrite: before !== undefined });
    }
    return list;
  });

  const overwriteCount = $derived(changes.filter((c) => c.overwrite).length);

  function preview() {
    result = parseImport(text, year, month, singleColumnAs);
  }

  function summarize(entry: DayEntry): string {
    const time = entry.start && entry.end ? ` ${entry.start}〜${entry.end}` : '';
    return `${entry.type}${time}${entry.work ? ` / ${entry.work}` : ''}${entry.note ? ` / ${entry.note}` : ''}`;
  }

  function commit() {
    const patch: Record<string, DayEntry> = {};
    for (const change of changes) patch[change.key] = change.after;
    store.applyDays(patch);
    onnotify(`${changes.length} 日分を取り込みました`);
    text = '';
    result = null;
  }
</script>

<div class="card">
  <h2>TSVの取り込み</h2>
  <p class="muted" style="margin:0 0 8px">
    Excel `年間入力シート` の {month}月度の範囲（{month}/1 の行から）をコピーして貼り付けてください。
    列数から取り込む項目を自動判定します。
  </p>
  <textarea bind:value={text} rows="6" placeholder="ここに貼り付け"></textarea>
  <div class="field" style="margin-top:8px">
    <label for="single">1列だけ貼り付けた場合の扱い</label>
    <select id="single" bind:value={singleColumnAs}>
      <option value="work-content">H列（作業内容）</option>
      <option value="note">K列（備考）</option>
    </select>
  </div>
  <button class="btn primary" style="width:100%" onclick={preview} disabled={!text.trim()}>
    差分をプレビュー
  </button>
</div>

{#if result}
  <div class="card">
    <h2>プレビュー</h2>
    <p class="muted" style="margin:0 0 8px">判定: {SHAPE_LABEL[result.shape]}</p>
    {#each result.warnings as warning (warning)}
      <div class="issue warn" style="margin-bottom:6px">{warning}</div>
    {/each}

    {#if changes.length === 0}
      <p class="muted">取り込む変更はありません。</p>
    {:else}
      <p class="muted">
        {changes.length} 日分を反映します（うち上書き {overwriteCount} 日）。
      </p>
      <div class="diff">
        {#each changes as change (change.key)}
          <div class="diff-row">
            <span class="date">{formatShort(change.key)}</span>
            <span class="body">
              {#if change.before}
                <s class="muted">{summarize(change.before)}</s><br />
              {/if}
              {summarize(change.after)}
            </span>
          </div>
        {/each}
      </div>
      <button class="btn primary" style="width:100%;margin-top:10px" onclick={commit}>
        取り込みを確定（{overwriteCount} 日を上書き）
      </button>
    {/if}
  </div>
{/if}

<style>
  .diff {
    display: flex;
    flex-direction: column;
    max-height: 50vh;
    overflow-y: auto;
  }

  .diff-row {
    display: grid;
    grid-template-columns: 5.2em 1fr;
    gap: 6px;
    border-bottom: 1px solid var(--border);
    padding: 8px 0;
    font-size: 0.8rem;
  }

  .diff-row .body {
    word-break: break-all;
  }
</style>
