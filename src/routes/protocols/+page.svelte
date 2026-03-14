<script>
  import { protocols, aims, setKey, toast, uid } from '$lib/stores.js';
  import { renderMd, checkIcon, statusLabel } from '$lib/utils.js';
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';

  const CYCLE = ['todo','inprog','done','blocked'];
  let aimFilter = 'all', modalOpen = false, editingId = null;
  let openCards = {};
  let f = { title:'', aim:'', steps:'', items:[] };
  let newItemText = '';

  $: all = $protocols || [];
  $: filtered = aimFilter === 'all' ? all : all.filter(p => p.aim === aimFilter);
  $: { let t=0,d=0; all.forEach(p => p.items.forEach(i => { t++; if(i.status==='done')d++; })); itemStats={t,d}; }
  let itemStats = {t:0,d:0};

  function cycleItemStatus(protoId, itemId) {
    const ps = JSON.parse(JSON.stringify(all));
    const p = ps.find(x => x._id === protoId);
    const item = p?.items.find(i => i.id === itemId); if (!item) return;
    item.status = CYCLE[(CYCLE.indexOf(item.status)+1) % CYCLE.length];
    setKey('protocols', ps);
    toast(item.status === 'done' ? '✓ Done' : item.status);
  }

  function deleteItem(protoId, itemId) {
    if (!confirm('Remove item?')) return;
    const ps = JSON.parse(JSON.stringify(all));
    const p = ps.find(x => x._id === protoId); if (!p) return;
    p.items = p.items.filter(i => i.id !== itemId);
    setKey('protocols', ps); toast('Removed', 'error');
  }

  function addItemToExisting(protoId) {
    const text = prompt('Checklist item text:');
    if (!text?.trim()) return;
    const ps = JSON.parse(JSON.stringify(all));
    const p = ps.find(x => x._id === protoId); if (!p) return;
    p.items.push({ id: uid(), text: text.trim(), status: 'todo' });
    setKey('protocols', ps); toast('Item added');
  }

  function openProtoModal(id) {
    editingId = id || null;
    const p = id ? all.find(x => x._id === id) : null;
    f = p ? { ...p, items: [...p.items] } : { _id:'', title:'', aim:'', steps:'', items:[] };
    newItemText = '';
    modalOpen = true;
  }

  function addModalItem() {
    if (!newItemText.trim()) return;
    f.items = [...f.items, { id: uid(), text: newItemText.trim(), status: 'todo' }];
    newItemText = '';
  }

  function removeModalItem(id) {
    f.items = f.items.filter(i => i.id !== id);
  }

  function save() {
    if (!f.title?.trim()) { toast('Title required', 'error'); return; }
    const ps = JSON.parse(JSON.stringify(all));
    const entry = { ...f, _id: f._id || uid() };
    const idx = ps.findIndex(p => p._id === entry._id);
    if (idx >= 0) ps[idx] = entry; else ps.push(entry);
    setKey('protocols', ps); modalOpen = false;
    toast(editingId ? 'Updated' : 'Protocol added');
  }

  function del() {
    if (!editingId || !confirm('Delete this protocol?')) return;
    setKey('protocols', all.filter(p => p._id !== editingId));
    modalOpen = false; toast('Deleted', 'error');
  }
</script>

<div class="page-header">
  <div><h1>Protocols</h1><div class="sub">Each protocol bundles a checklist + step-by-step procedure. Click to expand.</div></div>
  <div class="header-actions"><button class="btn btn-primary" on:click={() => openProtoModal()}>+ Add Protocol</button></div>
</div>

<div class="content">
  <div class="stats-row">
    <div class="stat-box"><div class="val">{all.length}</div><div class="lbl">Protocols</div></div>
    <div class="stat-box"><div class="val">{itemStats.d}/{itemStats.t}</div><div class="lbl">Items done</div></div>
  </div>

  <div class="filter-bar">
    <span class="text-muted text-sm">Aim:</span>
    <button class="filter-btn" class:active={aimFilter==='all'} on:click={() => aimFilter='all'}>All</button>
    {#each Object.entries($aims || {}) as [id, aim]}
      <button class="filter-btn" class:active={aimFilter===id} on:click={() => aimFilter=id}
        style="{aimFilter===id ? `background:${aim.color};border-color:${aim.color};color:#fff` : ''}">{aim.label}</button>
    {/each}
    <button class="filter-btn" class:active={aimFilter===''} on:click={() => aimFilter=''}>General</button>
  </div>

  {#if filtered.length === 0}
    <div class="empty-state"><div class="icon">📝</div>No protocols match filter.</div>
  {:else}
    {#each filtered as proto}
      {@const done = proto.items.filter(i=>i.status==='done').length}
      {@const total = proto.items.length}
      {@const pct = total ? Math.round(done/total*100) : 0}
      <div class="proto-card" style="{proto.aim ? `border-left:3px solid ${$aims[proto.aim]?.color||'var(--border)'}` : ''}">
        <div class="proto-header" on:click={() => openCards[proto._id] = !openCards[proto._id]}>
          <span class="proto-title">{proto.title}</span>
          {#if proto.aim}<span class="aim-badge {proto.aim}">{$aims[proto.aim]?.label}</span>{:else}<span class="aim-badge" style="background:#f3f4f6;color:#6b7280">General</span>{/if}
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:60px"><div class="progress-wrap"><div class="progress-bar" style="width:{pct}%;background:var(--accent)"></div></div></div>
            <span class="text-xs text-muted">{done}/{total}</span>
          </div>
          <span class="text-muted text-xs">{openCards[proto._id]?'▲':'▼'}</span>
        </div>
        {#if openCards[proto._id]}
          <div class="proto-body">
            {#if proto.steps}
              <div class="proto-steps">{@html renderMd(proto.steps)}</div>
            {:else}
              <div style="padding:16px 18px;color:var(--muted);font-style:italic;font-size:.84rem;background:#f8f9fb;border-bottom:1px solid var(--border)">
                No steps written yet — click Edit to add.
              </div>
            {/if}
            <div style="padding:4px 0">
              {#each proto.items as item}
                <div class="checklist-item" style="cursor:pointer" on:click={() => cycleItemStatus(proto._id, item.id)}>
                  <span class="check-icon {item.status}">{checkIcon(item.status)}</span>
                  <span style="flex:1">{item.text}</span>
                  <span class="status-chip {item.status}">{statusLabel(item.status)}</span>
                  <button class="btn btn-sm" style="padding:2px 6px;font-size:.68rem;border-color:transparent;color:var(--muted)"
                    on:click|stopPropagation={() => deleteItem(proto._id, item.id)} title="Remove">✕</button>
                </div>
              {/each}
              {#if proto.items.length === 0}
                <div style="padding:14px 16px;color:var(--muted);font-size:.84rem">No checklist items.</div>
              {/if}
            </div>
            <div class="proto-actions">
              <button class="btn btn-secondary btn-sm" on:click={() => addItemToExisting(proto._id)}>+ Add item</button>
              <button class="btn btn-secondary btn-sm" on:click={() => openProtoModal(proto._id)}>Edit protocol</button>
            </div>
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

{#if modalOpen}
<div class="modal-backdrop open" on:click|self={() => modalOpen=false}>
  <div class="modal" style="max-width:700px">
    <div class="modal-header"><h2>{editingId ? 'Edit Protocol' : 'Add Protocol'}</h2><button class="modal-close" on:click={() => modalOpen=false}>×</button></div>
    <div class="modal-body">
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group full"><label>Title *</label><input bind:value={f.title} placeholder="e.g. Cranial Window Surgery"></div>
        <div class="form-group"><label>Aim</label>
          <select bind:value={f.aim}><option value="">General</option>
            {#each Object.entries($aims || {}) as [id, aim]}<option value={id}>{aim.label}</option>{/each}
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-bottom:14px">
        <label>Steps</label>
        <MarkdownEditor bind:value={f.steps} rows={10} placeholder="## Preparation&#10;- Step one&#10;- Step two" />
      </div>
      <div style="margin-bottom:8px">
        <label>Checklist items</label>
        <div class="item-list">
          {#each f.items as item}
            <div class="item-row">
              <span style="flex:1">{item.text}</span>
              <button class="item-remove" on:click={() => removeModalItem(item.id)}>✕</button>
            </div>
          {/each}
        </div>
        <div class="inline-item-row">
          <input bind:value={newItemText} placeholder="New checklist item…"
            on:keydown={(e) => { if (e.key==='Enter') { e.preventDefault(); addModalItem(); } }}>
          <button class="btn btn-secondary btn-sm" on:click={addModalItem}>Add</button>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      {#if editingId}<button class="btn btn-danger btn-sm" style="margin-right:auto" on:click={del}>Delete</button>{/if}
      <button class="btn btn-secondary" on:click={() => modalOpen=false}>Cancel</button>
      <button class="btn btn-primary" on:click={save}>Save</button>
    </div>
  </div>
</div>
{/if}
