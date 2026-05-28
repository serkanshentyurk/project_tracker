<script>
  export let open = false;
  export let url = '';
  export let title = '';

  function close() { open = false; }
</script>

{#if open}
  <div class="pdf-backdrop" on:click|self={close}>
    <div class="pdf-modal">
      <div class="pdf-header">
        <span class="pdf-title">{title}</span>
        <div style="display:flex;gap:8px;align-items:center">
          <a href={url} target="_blank" class="btn btn-secondary btn-sm" style="text-decoration:none">↗ Open in new tab</a>
          <button class="modal-close" on:click={close}>×</button>
        </div>
      </div>
      <div class="pdf-body">
        <iframe src={url} title={title}></iframe>
      </div>
    </div>
  </div>
{/if}

<style>
  .pdf-backdrop {
    display: flex; position: fixed; inset: 0; background: rgba(0,0,0,.5);
    z-index: 300; align-items: center; justify-content: center; padding: 30px;
  }
  .pdf-modal {
    background: var(--surface); border-radius: 10px; width: 100%; max-width: 900px;
    height: 85vh; display: flex; flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,.3); overflow: hidden;
  }
  .pdf-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 12px 16px; border-bottom: 1px solid var(--border);
  }
  .pdf-title { font-weight: 700; font-size: .9rem; }
  .pdf-body { flex: 1; }
  .pdf-body iframe {
    width: 100%; height: 100%; border: none;
  }
</style>
