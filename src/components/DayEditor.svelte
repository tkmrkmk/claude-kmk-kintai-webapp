<script lang="ts">
  import { untrack } from 'svelte';
  import { formatDisplay, fromKey, isWeekend } from '../lib/date';
  import { holidayName } from '../lib/holidays';
  import { store } from '../lib/store.svelte';
  import { humanDuration, workedMinutes } from '../lib/time';
  import { sanitize } from '../lib/tsv';
  import { DAY_TYPES, emptyEntry, isEmptyEntry, type DayEntry, type DayType } from '../lib/types';
  import { hasError, validateEntry } from '../lib/validation';
  import TimeSelect from './TimeSelect.svelte';

  interface Props {
    dateKey: string;
    onsaved?: (message: string) => void;
  }

  let { dateKey, onsaved }: Props = $props();

  const pattern = $derived(store.settings.defaultPattern);
  const saved = $derived(store.getDay(dateKey));

  let draft = $state<DayEntry>(emptyEntry());

  // 対象日が変わったときだけ、保存済みの値（なければ既定パターン）を読み込む
  $effect(() => {
    const key = dateKey;
    untrack(() => {
      const current = store.getDay(key);
      draft = current ? { ...current } : withPattern(emptyEntry());
    });
  });

  function withPattern(entry: DayEntry): DayEntry {
    return { ...entry, start: pattern.start, end: pattern.end, break: pattern.break };
  }

  const date = $derived(fromKey(dateKey));
  const holiday = $derived(holidayName(dateKey));
  const restDay = $derived(isWeekend(date) || holiday !== undefined);
  const worked = $derived(workedMinutes(draft));
  const issues = $derived(validateEntry(dateKey, draft));
  const blocked = $derived(hasError(issues));

  function selectType(type: DayType) {
    draft.type = type;
    if (type === '休暇' || type === 'その他休') {
      draft.start = '';
      draft.end = '';
      draft.break = '';
    } else if (!draft.start && !draft.end) {
      draft = withPattern(draft);
    }
  }

  function applyPattern() {
    draft = withPattern(draft);
  }

  function saveDay() {
    if (blocked) return;
    store.setDay(dateKey, {
      ...draft,
      work: sanitize(draft.work),
      note: sanitize(draft.note)
    });
    onsaved?.(`${formatDisplay(dateKey)} を保存しました`);
  }

  function quickNormal() {
    const entry = withPattern({ ...draft, type: '通常勤務' });
    draft = entry;
    store.setDay(dateKey, { ...entry, work: sanitize(entry.work), note: sanitize(entry.note) });
    onsaved?.('通常勤務で登録しました');
  }

  function removeDay() {
    store.deleteDay(dateKey);
    draft = withPattern(emptyEntry());
    onsaved?.('削除しました');
  }
</script>

<div class="card">
  <div class="row">
    <h2 style="font-size:1rem;color:var(--text)">{formatDisplay(dateKey)}</h2>
    <div class="spacer"></div>
    {#if holiday}
      <span class="tag holiday">{holiday}</span>
    {:else if restDay}
      <span class="tag holiday">休日</span>
    {/if}
    {#if saved}
      <span class="tag saved">入力済</span>
    {/if}
  </div>

  <div class="types">
    {#each DAY_TYPES as type (type)}
      <button
        class="btn small type"
        class:selected={draft.type === type}
        onclick={() => selectType(type)}
      >
        {type}
      </button>
    {/each}
  </div>

  <div class="times">
    <div class="field">
      <label for="start">開始</label>
      <TimeSelect id="start" bind:value={draft.start} />
    </div>
    <div class="field">
      <label for="end">終了</label>
      <TimeSelect id="end" bind:value={draft.end} />
    </div>
    <div class="field">
      <label for="break">休憩</label>
      <TimeSelect id="break" bind:value={draft.break} to={480} />
    </div>
  </div>

  <div class="row">
    <button class="btn small ghost" onclick={applyPattern}>既定パターン</button>
    <div class="spacer"></div>
    <span class="worked">
      実働 {worked === null ? '—' : humanDuration(worked)}
    </span>
  </div>

  <div class="field" style="margin-top:10px">
    <label for="work">作業内容(作業場所)</label>
    <input id="work" type="text" bind:value={draft.work} placeholder="例: AIプロダクト（自宅）" />
    {#if store.settings.presets.work.length}
      <div class="row wrap presets">
        {#each store.settings.presets.work as preset (preset)}
          <button class="btn small ghost" onclick={() => (draft.work = preset)}>{preset}</button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="field">
    <label for="note">備考</label>
    <input id="note" type="text" bind:value={draft.note} placeholder="例: ★草加↔築地" />
    {#if store.settings.presets.note.length}
      <div class="row wrap presets">
        {#each store.settings.presets.note as preset (preset)}
          <button class="btn small ghost" onclick={() => (draft.note = preset)}>{preset}</button>
        {/each}
      </div>
    {/if}
  </div>

  {#if issues.length}
    <div class="issues">
      {#each issues as issue (issue.message)}
        <div class="issue {issue.severity}">{issue.message}</div>
      {/each}
    </div>
  {/if}

  <div class="row" style="margin-top:12px">
    <button class="btn primary" style="flex:1" onclick={saveDay} disabled={blocked}>登録</button>
    {#if saved}
      <button class="btn danger" onclick={removeDay}>削除</button>
    {/if}
  </div>

  {#if !saved || isEmptyEntry(saved)}
    <button class="btn ghost" style="width:100%;margin-top:8px" onclick={quickNormal}>
      通常勤務でワンタップ登録（{pattern.start}〜{pattern.end} 休憩{pattern.break}）
    </button>
  {/if}
</div>

<style>
  .tag {
    font-size: 0.72rem;
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--muted);
  }

  .tag.holiday {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 50%, transparent);
  }

  .tag.saved {
    color: var(--ok);
    border-color: color-mix(in srgb, var(--ok) 50%, transparent);
  }

  .types {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin: 10px 0;
  }

  .type {
    padding: 8px 2px;
    font-size: 0.78rem;
  }

  .type.selected {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-ink);
    font-weight: 700;
  }

  .times {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .times .field {
    margin-bottom: 0;
  }

  .worked {
    font-weight: 700;
  }

  .presets {
    margin-top: 4px;
  }
</style>
