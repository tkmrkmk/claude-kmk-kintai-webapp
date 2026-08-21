<script lang="ts">
  import { quarterOptions } from '../lib/time';

  interface Props {
    value: string;
    from?: number;
    to?: number;
    id?: string;
  }

  let { value = $bindable(), from = 0, to = 24 * 60, id }: Props = $props();

  const options = $derived(quarterOptions(from, to));
  // 15分単位から外れた既存値も選択肢として残す（消えると編集できなくなるため）
  const all = $derived(value && !options.includes(value) ? [value, ...options] : options);
</script>

<select {id} bind:value>
  <option value="">—</option>
  {#each all as option (option)}
    <option value={option}>{option}</option>
  {/each}
</select>
