<script>
  import '../app.css';
  import { page } from '$app/stores';
  import Nav from '$lib/components/Nav.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import { loadData, loaded } from '$lib/stores.js';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  $: isLogin = $page.url.pathname === '/login';

  onMount(() => {
    if (!isLogin) loadData();
  });

  // When navigating away from login (client-side only)
  $: if (browser && !isLogin && !$loaded) loadData();
</script>

{#if isLogin}
  <slot />
{:else if $loaded}
  <div class="app-layout">
    <Nav />
    <div id="main">
      <slot />
    </div>
  </div>
{:else}
  <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:.9rem;color:var(--muted)">
    Loading…
  </div>
{/if}

<Toast />
