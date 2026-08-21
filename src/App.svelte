<script lang="ts">
  import CalendarView from './components/CalendarView.svelte';
  import DayEditor from './components/DayEditor.svelte';
  import ExportView from './components/ExportView.svelte';
  import ImportView from './components/ImportView.svelte';
  import SettingsView from './components/SettingsView.svelte';
  import { fiscalMonths, fromKey, inFiscalYear, makeKey, todayKey } from './lib/date';
  import { store } from './lib/store.svelte';

  type View = 'day' | 'calendar' | 'export' | 'import' | 'settings';

  const TABS: { id: View; label: string; icon: string }[] = [
    { id: 'day', label: '入力', icon: '✏️' },
    { id: 'calendar', label: 'カレンダー', icon: '📅' },
    { id: 'export', label: '出力', icon: '📤' },
    { id: 'import', label: '取込', icon: '📥' },
    { id: 'settings', label: '設定', icon: '⚙️' }
  ];

  let view = $state<View>('day');
  let selected = $state(todayKey());

  const months = $derived(fiscalMonths(store.fiscalYear));
  // 表示中の月度。選択日が年度外なら年度の先頭月にそろえる
  let monthIndex = $state(0);

  $effect(() => {
    const key = selected;
    if (!inFiscalYear(key, store.fiscalYear)) return;
    const d = fromKey(key);
    const index = months.findIndex((m) => m.year === d.getFullYear() && m.month === d.getMonth() + 1);
    if (index >= 0) monthIndex = index;
  });

  const month = $derived(months[monthIndex] ?? months[0]);

  let toast = $state<string | null>(null);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;

  function notify(message: string) {
    toast = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast = null), 2200);
  }

  function shiftMonth(delta: number) {
    const next = monthIndex + delta;
    if (next < 0 || next >= months.length) return;
    monthIndex = next;
    const m = months[next];
    // 選択日は同じ日付を保ちつつ月内に収める
    const day = Math.min(fromKey(selected).getDate(), new Date(m.year, m.month, 0).getDate());
    selected = makeKey(m.year, m.month, day);
  }

  function selectDay(key: string) {
    selected = key;
    view = 'day';
  }

  function goToday() {
    selected = todayKey();
    view = 'day';
  }
</script>

<div class="app">
  <header class="topbar">
    <h1>勤怠入力</h1>
    <div class="spacer"></div>
    {#if view !== 'settings'}
      <div class="monthnav">
        <button class="btn small ghost" onclick={() => shiftMonth(-1)} disabled={monthIndex === 0}>
          ‹
        </button>
        <span class="label">{store.fiscalYear}年度 {month.label}</span>
        <button
          class="btn small ghost"
          onclick={() => shiftMonth(1)}
          disabled={monthIndex === months.length - 1}
        >
          ›
        </button>
      </div>
    {/if}
    <button class="btn small ghost" onclick={goToday}>今日</button>
  </header>

  {#if store.saveError}
    <div class="issue error" style="margin-top:10px">{store.saveError}</div>
  {/if}

  {#if view === 'day'}
    <DayEditor dateKey={selected} onsaved={notify} />
    <CalendarView year={month.year} month={month.month} {selected} onselect={selectDay} />
  {:else if view === 'calendar'}
    <CalendarView year={month.year} month={month.month} {selected} onselect={selectDay} />
  {:else if view === 'export'}
    <ExportView year={month.year} month={month.month} onnotify={notify} />
  {:else if view === 'import'}
    <ImportView year={month.year} month={month.month} onnotify={notify} />
  {:else}
    <SettingsView onnotify={notify} />
  {/if}
</div>

<nav class="nav">
  {#each TABS as tab (tab.id)}
    <button
      onclick={() => (view = tab.id)}
      aria-current={view === tab.id ? 'page' : undefined}
    >
      <span class="icon">{tab.icon}</span>
      {tab.label}
    </button>
  {/each}
</nav>

{#if toast}
  <div class="toast" role="status">{toast}</div>
{/if}

<style>
  .monthnav {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .monthnav .label {
    font-size: 0.8rem;
    min-width: 8.5em;
    text-align: center;
  }
</style>
