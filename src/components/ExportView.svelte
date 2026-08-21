<script lang="ts">
  import { copyText } from '../lib/clipboard';
  import { formatShort } from '../lib/date';
  import { store } from '../lib/store.svelte';
  import { summarizeMonth } from '../lib/summary';
  import { buildMonthExport } from '../lib/tsv';

  interface Props {
    year: number;
    month: number;
    onnotify: (message: string) => void;
  }

  let { year, month, onnotify }: Props = $props();

  const data = $derived(buildMonthExport(store.days, store.fiscalYear, year, month));
  const summary = $derived(
    summarizeMonth(store.days, store.fiscalYear, year, month, store.settings.carryOver)
  );

  let manual = $state<string | null>(null);
  /** 結合セルに拒否された場合の1行ずつコピーモード */
  let rowMode = $state<Record<string, number>>({});

  async function copy(label: string, text: string) {
    const ok = await copyText(text);
    if (ok) {
      manual = null;
      onnotify(`${label} をコピーしました`);
    } else {
      manual = text;
      onnotify('コピーできませんでした。下のテキストを手動で選択してください');
    }
  }

  function startRowMode(id: string) {
    rowMode[id] = 0;
  }

  async function copyRow(id: string, lines: string[], cell: string, index: number) {
    await copy(`${cell.replace(/\d+$/, '')}${Number(cell.match(/\d+$/)![0]) + index}`, lines[index]);
    rowMode[id] = Math.min(index + 1, lines.length - 1);
  }
</script>

<div class="card">
  <h2>貼り付け先</h2>
  <p class="muted" style="margin:0">
    <strong>年間入力シート</strong> の {month}月度は
    <strong>{data.startRow}行目 〜 {data.endRow}行目</strong>（{data.rowCount}行）です。
    以下の3ブロックを順にコピーして、指定セルに貼り付けてください。
  </p>
</div>

{#if summary.errors.length || summary.missing.length || summary.warnings.length}
  <div class="card">
    <h2>貼り付け前の確認</h2>
    {#if summary.errors.length}
      <div class="issue error">
        エラーが {summary.errors.length} 件あります：
        {summary.errors
          .slice(0, 3)
          .map((e) => `${formatShort(e.key)} ${e.issue.message}`)
          .join(' / ')}
      </div>
    {/if}
    {#if summary.missing.length}
      <div class="issue warn" style="margin-top:6px">
        未入力の平日 {summary.missing.length} 日：{summary.missing.map(formatShort).join(' / ')}
      </div>
    {/if}
    {#if summary.warnings.length}
      <div class="issue warn" style="margin-top:6px">
        警告 {summary.warnings.length} 件：
        {summary.warnings
          .slice(0, 3)
          .map((w) => `${formatShort(w.key)} ${w.issue.message}`)
          .join(' / ')}
      </div>
    {/if}
  </div>
{/if}

{#each data.blocks as block (block.block.id)}
  <div class="card">
    <div class="row">
      <h2 style="margin:0;color:var(--text);font-size:0.95rem">{block.block.label}</h2>
      <div class="spacer"></div>
      <code class="cell">{block.cell}</code>
    </div>
    <p class="muted" style="margin:6px 0">{block.block.hint}</p>
    <div class="row">
      <button class="btn primary" style="flex:1" onclick={() => copy(block.cell, block.tsv)}>
        コピー
      </button>
      {#if block.block.id !== 'work-time'}
        <button class="btn small ghost" onclick={() => startRowMode(block.block.id)}>1行ずつ</button>
      {/if}
    </div>

    {#if rowMode[block.block.id] !== undefined}
      {@const index = rowMode[block.block.id]}
      <div class="rowmode">
        <div class="row">
          <span class="muted">
            {index + 1} / {block.lines.length} 行目（{block.block.column}{data.startRow + index}）
          </span>
          <div class="spacer"></div>
          <button class="btn small ghost" onclick={() => (rowMode[block.block.id] = Math.max(0, index - 1))}>前</button>
          <button
            class="btn small"
            onclick={() => copyRow(block.block.id, block.lines, block.cell, index)}
          >
            この行をコピー
          </button>
        </div>
        <div class="preview">{block.lines[index] || '（空）'}</div>
      </div>
    {/if}
  </div>
{/each}

{#if manual !== null}
  <div class="card">
    <h2>手動コピー用</h2>
    <textarea readonly rows="8" value={manual}></textarea>
    <p class="muted">長押しで全選択してコピーしてください。</p>
  </div>
{/if}

<style>
  .cell {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 2px 8px;
    font-size: 0.85rem;
  }

  .rowmode {
    margin-top: 10px;
    border-top: 1px solid var(--border);
    padding-top: 10px;
  }

  .preview {
    margin-top: 6px;
    background: var(--surface-2);
    border-radius: 8px;
    padding: 8px;
    font-size: 0.8rem;
    white-space: pre-wrap;
    word-break: break-all;
  }
</style>
