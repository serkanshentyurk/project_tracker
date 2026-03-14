<script>
  import { log, setKey, toast, uid } from '$lib/stores.js';
  import { statusLabel, todayStr, renderMd } from '$lib/utils.js';
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';

  let kindFilter = 'all', statusFilter = 'all', prioFilter = 'all';
  let modalOpen = false, editingId = null;
  let f = {};
  let openCards = {};

  const STATUS_CYCLES = {
    decision: ['settled','provisional','revisit'],
    issue: ['open','resolved','wontfix'],
  };
  const PRIO_LABEL = { high:'🔴 High', medium:'🟡 Medium', low:'⚪ Low' };

  $: all = $log || [];
  $: filtered = all.filter(e => {
    if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (prioFilter !== 'all' && e.priority !== prioFilter) return false;
    return true;
  }).sort((a,b) => {
    if (a.kind === 'issue' && b.kind === 'issue') {
      const p = {high:0,medium:1,low:2};
      return (p[a.priority]??3) - (p[b.priority]??3);
    }
    return b.date?.localeCompare(a.date);
  });
  $: openIssues = all.filter(i => i.kind==='issue' && i.status==='open').length;
  $: highPrio = all.filter(i => i.kind==='issue' && i.priority==='high' && i.status==='open').length;
  $: decisions = all.filter(i => i.kind==='decision').length;

  function cycleStatus(id) {
    const items = JSON.parse(JSON.stringify(all));
    const item = items.find(x => x.id === id); if (!item) return;
    const cycle = STATUS_CYCLES[item.kind] || ['open','resolved'];
    item.status = cycle[(cycle.indexOf(item.status)+1) % cycle.length];
    setKey('log', items);
    toast(`Status: ${item.status}`);
  }

  function openModal(id) {
    editingId = id || null;
    const e = id ? all.find(x => x.id === id) : null;
    f = e ? { ...e } : { id:'', date: todayStr(), kind:'issue', status:'open',
      title:'', body:'', risks:'', priority:'high', deadline:'', resolved_date:'', resolution:'' };
    modalOpen = true;
  }

  function save() {
    if (!f.title?.trim()) { toast('Title required', 'error'); return; }
    const items = JSON.parse(JSON.stringify(all));
    const entry = { ...f, id: f.id || uid() };
    if (entry.kind === 'decision') { entry.priority = null; }
    const idx = items.findIndex(x => x.id === entry.id);
    if (idx >= 0) items[idx] = entry; else items.push(entry);
    setKey('log', items); modalOpen = false;
    toast(editingId ? 'Updated' : 'Added');
  }

  function del() {
    if (!editingId || !confirm('Delete this entry?')) return;
    setKey('log', all.filter(x => x.id !== editingId));
    modalOpen = false; toast('Deleted', 'error');
  }
</script>

<div class="page-header">
  <div><h1>Log</h1><div class="sub">Decisions and issues in one place. Click status badge to cycle.</div></div>
  <div class="header-actions"><button class="btn btn-primary" on:click={() => openModal()}>+ Add Entry</button></div>
</div>

<div class="content">
  <div class="stats-row">
    <div class="stat-box"><div class="val">{openIssues}</div><div class="lbl">Open issues</div></div>
    <div class="stat-box"><div class="val">{highPrio}</div><div class="lbl">High priority</div></div>
    <div class="stat-box"><div class="val">{decisions}</div><div class="lbl">Decisions</div></div>
    <div class="stat-box"><div class="val">{all.length}</div><div class="lbl">Total</div></div>
  </div>

  <div class="filter-bar">
    <span class="text-muted text-sm">Kind:</span>
    {#each ['all','issue','decision'] as k}
      <button class="filter-btn" class:active={kindFilter===k} on:click={() => kindFilter=k}>{k==='all'?'All':k==='issue'?'Issues':'Decisions'}</button>
    {/each}
    <span class="text-muted text-sm" style="margin-left:6px">Status:</span>
    {#each ['all','open','settled','resolved'] as s}
      <button class="filter-btn" class:active={statusFilter===s} on:click={() => statusFilter=s}>{s==='all'?'All':statusLabel(s)}</button>
    {/each}
    <span class="text-muted text-sm" style="margin-left:6px">Priority:</span>
    {#each ['all','high','medium','low'] as p}
      <button class="filter-btn" class:active={prioFilter===p} on:click={() => prioFilter=p}>{p==='all'?'All':PRIO_LABEL[p]||p}</button>
    {/each}
  </div>

  {#if filtered.length === 0}
    <div class="empty-state"><div class="icon">📋</div>No entries match filters.</div>
  {:else}
    {#each filtered as e}
      <div class="expand-card {e.kind==='issue'?`priority-${e.priority||'low'}`:''}">
        <div class="expand-card-header" on:click={() => openCards[e.id] = !openCards[e.id]}>
          <span class="text-xs text-muted" style="min-width:30px">{e.id}</span>
          <span class="kind-chip {e.kind}">{e.kind}</span>
          <span style="flex:1;font-weight:600;font-size:.9rem">{e.title}</span>
          {#if e.kind==='issue' && e.priority}<span class="text-xs">{PRIO_LABEL[e.priority]}</span>{/if}
          <span class="text-xs text-muted">{e.date}</span>
          {#if e.deadline}<span class="text-xs" style="color:var(--warn);font-weight:600">📅 {e.deadline}</span>{/if}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <span on:click|stopPropagation={() => cycleStatus(e.id)} style="cursor:pointer">
            <span class="status-chip {e.status}">{statusLabel(e.status)}</span>
          </span>
          <span class="text-muted text-xs">{openCards[e.id]?'▲':'▼'}</span>
        </div>
        <div class="expand-card-body" class:open={openCards[e.id]}>
          <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
            <button class="btn btn-secondary btn-sm" on:click={() => openModal(e.id)}>Edit</button>
          </div>
          {#if e.body}<div class="detail-label">{e.kind==='decision'?'Rationale':'Description'}</div><div style="font-size:.86rem;line-height:1.6">{@html renderMd(e.body)}</div>{/if}
          {#if e.risks}<div class="detail-label" style="margin-top:10px">Risks / caveats</div><div class="risk-box">⚠ {e.risks}</div>{/if}
          {#if e.status==='resolved' && e.resolution}
            <div style="margin-top:10px;background:#f0fdf4;border:1px solid #86efac;border-radius:5px;padding:8px 10px;font-size:.84rem">
              ✓ Resolved {e.resolved_date||''}: {e.resolution}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  {/if}
</div>

{#if modalOpen}
<div class="modal-backdrop open" on:click|self={() => modalOpen=false}>
  <div class="modal">
    <div class="modal-header"><h2>{editingId ? 'Edit Entry' : 'Add Entry'}</h2><button class="modal-close" on:click={() => modalOpen=false}>×</button></div>
    <div class="modal-body">
      <div class="form-grid cols-3" style="margin-bottom:12px">
        <div class="form-group"><label>ID</label><input bind:value={f.id} placeholder="e.g. D13 or I07"></div>
        <div class="form-group"><label>Date</label><input type="date" bind:value={f.date}></div>
        <div class="form-group"><label>Kind</label>
          <select bind:value={f.kind}><option value="issue">Issue</option><option value="decision">Decision</option></select>
        </div>
        <div class="form-group"><label>Status</label>
          <select bind:value={f.status}>
            {#if f.kind==='decision'}
              <option value="settled">Settled</option><option value="provisional">Provisional</option><option value="revisit">Revisit</option>
            {:else}
              <option value="open">Open</option><option value="resolved">Resolved</option><option value="wontfix">Won't fix</option>
            {/if}
          </select>
        </div>
        {#if f.kind==='issue'}
          <div class="form-group"><label>Priority</label>
            <select bind:value={f.priority}><option value="high">🔴 High</option><option value="medium">🟡 Medium</option><option value="low">Low</option></select>
          </div>
        {/if}
        <div class="form-group"><label>Deadline</label><input type="date" bind:value={f.deadline}></div>
      </div>
      <div class="form-group" style="margin-bottom:12px"><label>Title *</label><input bind:value={f.title}></div>
      <div class="form-group" style="margin-bottom:12px">
        <label>{f.kind==='decision'?'Rationale':'Description'}</label>
        <MarkdownEditor bind:value={f.body} rows={4} />
      </div>
      <div class="form-group" style="margin-bottom:12px"><label>Risks / caveats</label><textarea bind:value={f.risks} rows="2"></textarea></div>
      {#if f.kind==='issue'}
        <div class="form-grid">
          <div class="form-group"><label>Resolved date</label><input type="date" bind:value={f.resolved_date}></div>
          <div class="form-group full"><label>Resolution</label><textarea bind:value={f.resolution} rows="2"></textarea></div>
        </div>
      {/if}
    </div>
    <div class="modal-footer">
      {#if editingId}<button class="btn btn-danger btn-sm" style="margin-right:auto" on:click={del}>Delete</button>{/if}
      <button class="btn btn-secondary" on:click={() => modalOpen=false}>Cancel</button>
      <button class="btn btn-primary" on:click={save}>Save</button>
    </div>
  </div>
</div>
{/if}
