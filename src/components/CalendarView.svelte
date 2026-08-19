<script lang="ts">
  import { daysInMonth, formatShort, fromKey, makeKey } from '../lib/date';
  import { holidayName } from '../lib/holidays';
  import { store } from '../lib/store.svelte';
  import { summarizeMonth } from '../lib/summary';
  import { formatTime, humanDuration } from '../lib/time';

  interface Props {
    year: number;
    month: number;
    selected: string;
    onselect: (key: string) => void;
  }

  let { year, month, selected, onselect }: Props = $props();

  const summary = $derived(
    summarizeMonth(store.days, store.fiscalYear, year, month, store.settings.carryOver)
  );

  // 月初の曜日ぶんだけ先頭を空ける
  const leading = $derived(new Date(year, month - 1, 1).getDay());
  const cells = $derived(
    Array.from({ length: leading }, () => null).concat(
      Array.from({ length: daysInMonth(year, month) }, (_, i) =>
        makeKey(year, month, i + 1)
      ) as never[]
    ) as (string | null)[]
  );

  function statusOf(key: string): 'saved' | 'missing' | 'rest' {
    const day = summary.days[fromKey(key).getDate() - 1];
    if (day.entry) return 'saved';
    return day.restDay ? 'rest' : 'missing';
  }
</script>

<div class="card">
  <div class="weekdays">
    {#each ['日', '月', '火', '水', '木', '金', '土'] as w (w)}
      <span>{w}</span>
    {/each}
  </div>
  <div class="grid">
    {#each cells as key, i (key ?? `blank-${i}`)}
      {#if key === null}
        <span></span>
      {:else}
        <button
          class="day {statusOf(key)}"
          class:selected={key === selected}
          class:holiday={holidayName(key) !== undefined}
          onclick={() => onselect(key)}
        >
          <span class="num">{fromKey(key).getDate()}</span>
          <span class="dot"></span>
        </button>
      {/if}
    {/each}
  </div>
  <div class="legend muted">
    <span><i class="sw saved"></i>入力済</span>
    <span><i class="sw missing"></i>未入力(平日)</span>
    <span><i class="sw rest"></i>土日祝</span>
  </div>
</div>

<div class="card">
  <h2>{month}月度の集計</h2>
  <div class="stats">
    <div><span class="muted">合計実働</span><strong>{humanDuration(summary.totalWorked)}</strong></div>
    <div><span class="muted">勤務日数</span><strong>{summary.workedDays}日</strong></div>
    <div><span class="muted">月初 振休残</span><strong>{formatTime(summary.openingBalance)}</strong></div>
    <div><span class="muted">月末 振休残</span><strong>{formatTime(summary.closingBalance)}</strong></div>
  </div>
  {#if summary.byType.length}
    <div class="row wrap" style="margin-top:8px">
      {#each summary.byType as t (t.type)}
        <span class="chip">{t.type} {t.count}日</span>
      {/each}
    </div>
  {/if}
  {#if summary.missing.length}
    <div class="issue warn" style="margin-top:10px">
      未入力の平日が {summary.missing.length} 日あります（{summary.missing
        .slice(0, 5)
        .map(formatShort)
        .join(' / ')}{summary.missing.length > 5 ? ' …' : ''}）
    </div>
  {/if}
</div>

<div class="card">
  <h2>一覧</h2>
  <div class="list">
    {#each summary.days as day (day.key)}
      <button class="item" class:selected={day.key === selected} onclick={() => onselect(day.key)}>
        <span class="date" class:rest={day.restDay}>{formatShort(day.key)}</span>
        {#if day.entry}
          <span class="type">{day.entry.type}</span>
          <span class="time muted">
            {day.entry.start && day.entry.end ? `${day.entry.start}〜${day.entry.end}` : ''}
          </span>
          <span class="worked">{day.worked === null ? '' : formatTime(day.worked)}</span>
        {:else}
          <span class="type muted">{day.restDay ? '—' : '未入力'}</span>
        {/if}
      </button>
    {/each}
  </div>
</div>

<style>
  .weekdays,
  .grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .weekdays {
    font-size: 0.72rem;
    color: var(--muted);
    text-align: center;
    margin-bottom: 4px;
  }

  .day {
    position: relative;
    aspect-ratio: 1;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface-2);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 0;
  }

  .day.holiday .num {
    color: var(--danger);
  }

  .day.selected {
    outline: 2px solid var(--accent);
  }

  .num {
    font-size: 0.85rem;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: transparent;
  }

  .day.saved .dot {
    background: var(--ok);
  }

  .day.missing .dot {
    background: var(--warn);
  }

  .legend {
    display: flex;
    gap: 10px;
    margin-top: 8px;
    font-size: 0.72rem;
  }

  .sw {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-right: 4px;
  }

  .sw.saved {
    background: var(--ok);
  }

  .sw.missing {
    background: var(--warn);
  }

  .sw.rest {
    background: var(--border);
  }

  .stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .stats div {
    display: flex;
    flex-direction: column;
    background: var(--surface-2);
    border-radius: 8px;
    padding: 8px;
    font-size: 0.8rem;
  }

  .stats strong {
    font-size: 1rem;
  }

  .chip {
    font-size: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 3px 10px;
  }

  .list {
    display: flex;
    flex-direction: column;
    max-height: 60vh;
    overflow-y: auto;
  }

  .item {
    display: grid;
    grid-template-columns: 5.2em 5em 1fr auto;
    align-items: center;
    gap: 6px;
    text-align: left;
    background: none;
    border: 0;
    border-bottom: 1px solid var(--border);
    padding: 10px 2px;
    font-size: 0.82rem;
  }

  .item.selected {
    background: var(--surface-2);
  }

  .item .date.rest {
    color: var(--danger);
  }

  .item .time {
    font-size: 0.76rem;
  }
</style>
