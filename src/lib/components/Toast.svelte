<script>
  import { toasts } from '$lib/stores.js';
</script>

{#each $toasts as t (t.id)}
  <div class="toast toast-{t.type} show">{t.msg}</div>
{/each}
