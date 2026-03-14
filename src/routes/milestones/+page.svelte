<script>
  import { milestones, setKey, toast, uid } from '$lib/stores.js';
  import { checkIcon, statusLabel } from '$lib/utils.js';

  const CYCLE = ['todo','inprog','done','blocked'];
  const COLORS = ['#3b82f6','#f59e0b','#22c55e','#a855f7','#ef4444','#06b6d4','#ec4899','#84cc16'];
  let filter = 'all';
  let collapsed = {};

  // Phase modal
  let phaseModalOpen = false, editingPhaseIdx = null;
  let pf = { label:'', color:'#3b82f6', gantt_start:'', gantt_end:'', gantt_rows:[] };
  let newRowLabel = '', newRowS = '', newRowE = '';

  // Item modal
  let itemModalOpen = false, itemPhaseIdx = null;
  let itemText = '', itemDeadline = '', itemMilestone = false, itemDeadlineMonth = '';

  $: all = $milestones || [];
  $: { let t=0,d=0,ip=0,bl=0; all.forEach(p => p.items.forEach(i => { t++; if(i.status==='done')d++; if(i.status==='inprog')ip++; if(i.status==='blocked')bl++; })); stats={t,d,ip,bl}; }
  let stats = {t:0,d:0,ip:0,bl:0};

  function cycleStatus(pi, itemId) {
    const ms = JSON.parse(JSON.stringify(all));
    const item = ms[pi]?.items.find(i => i.id === itemId);
    if (!item) return;
    item.status = CYCLE[(CYCLE.indexOf(item.status)+1) % CYCLE.length];
    setKey('milestones', ms);
    toast(item.status === 'done' ? '✓ Done' : item.status);
  }

  function deleteItem(pi, itemId) {
    if (!confirm('Remove this item?')) return;
    const ms = JSON.parse(JSON.stringify(all));
    ms[pi].items = ms[pi].items.filter(i => i.id !== itemId);
    setKey('milestones', ms);
    toast('Removed', 'error');
  }

  function filterItems(items) { return filter === 'all' ? items : items.filter(i => i.status === filter); }

  // ── Phase CRUD ───────────────────────────────────────────────
  function openPhaseModal(idx) {
    editingPhaseIdx = idx ?? null;
    if (idx != null) {
      const p = all[idx];
      pf = { label: p.label, color: p.color, gantt_start: p.gantt_start||'', gantt_end: p.gantt_end||'', gantt_rows: JSON.parse(JSON.stringify(p.gantt_rows||[])) };
    } else {
      pf = { label:'', color: COLORS[all.length % COLORS.length], gantt_start:'', gantt_end:'', gantt_rows:[] };
    }
    newRowLabel = ''; newRowS = ''; newRowE = '';
    phaseModalOpen = true;
  }

  function addGanttRow() {
    if (!newRowLabel.trim()) return;
    pf.gantt_rows = [...pf.gantt_rows, { label: newRowLabel.trim(), s: parseInt(newRowS)||1, e: parseInt(newRowE)||1 }];
    newRowLabel = ''; newRowS = ''; newRowE = '';
  }

  function removeGanttRow(i) { pf.gantt_rows = pf.gantt_rows.filter((_, j) => j !== i); }

  function savePhase() {
    if (!pf.label.trim()) { toast('Phase name required', 'error'); return; }
    const ms = JSON.parse(JSON.stringify(all));
    const entry = {
      phase: editingPhaseIdx != null ? ms[editingPhaseIdx].phase : 'phase_' + uid(),
      label: pf.label.trim(), color: pf.color,
      gantt_start: parseInt(pf.gantt_start) || null,
      gantt_end: parseInt(pf.gantt_end) || null,
      gantt_rows: pf.gantt_rows,
      items: editingPhaseIdx != null ? ms[editingPhaseIdx].items : [],
    };
    if (editingPhaseIdx != null) ms[editingPhaseIdx] = entry; else ms.push(entry);
    setKey('milestones', ms);
    phaseModalOpen = false;
    toast(editingPhaseIdx != null ? 'Phase updated' : 'Phase added');
  }

  function deletePhase(idx) {
    const p = all[idx];
    if (!confirm(`Delete "${p.label}" and all its ${p.items.length} items?`)) return;
    const ms = JSON.parse(JSON.stringify(all));
    ms.splice(idx, 1);
    setKey('milestones', ms);
    toast('Phase deleted', 'error');
  }

  function movePhase(idx, dir) {
    const ms = JSON.parse(JSON.stringify(all));
    const ni = idx + dir;
    if (ni < 0 || ni >= ms.length) return;
    [ms[idx], ms[ni]] = [ms[ni], ms[idx]];
    setKey('milestones', ms);
  }

  // ── Item modal ───────────────────────────────────────────────
  function openItemModal(pi) {
    itemPhaseIdx = pi;
    itemText = ''; itemDeadline = ''; itemMilestone = false; itemDeadlineMonth = '';
    itemModalOpen = true;
  }

  function addItem() {
    if (!itemText.trim()) { toast('Enter text', 'error'); return; }
    const ms = JSON.parse(JSON.stringify(all));
    ms[itemPhaseIdx].items.push({
      id: uid(), text: itemText.trim(), status: 'todo',
      milestone: itemMilestone,
      deadline: itemDeadline || null,
      deadline_month: parseInt(itemDeadlineMonth) || null,
    });
    setKey('milestones', ms);
    itemModalOpen = false;
    toast('Item added');
  }
</script>

<div class="page-header">
  <div><h1>Milestones</h1><div class="sub">Click items to cycle status. Phases drive the Gantt on Overview.</div></div>
  <div class="header-actions">
    <button class="btn btn-secondary" on:click={() => openPhaseModal()}>+ Add Phase</button>
  </div>
</div>

<div class="content">
  <div class="stats-row">
    <div class="stat-box"><div class="val">{stats.d}/{stats.t}</div><div class="lbl">Done</div></div>
    <div class="stat-box"><div class="val">{stats.ip}</div><div class="lbl">In progress</div></div>
    <div class="stat-box"><div class="val">{stats.bl}</div><div class="lbl">Blocked</div></div>
    <div class="stat-box"><div class="val">{stats.t-stats.d-stats.ip-stats.bl}</div><div class="lbl">To do</div></div>
  </div>

  <div class="filter-bar">
    <span class="text-muted text-sm">Show:</span>
    {#each ['all','todo','inprog','done','blocked'] as f}
      <button class="filter-btn" class:active={filter===f} on:click={() => filter=f}>{f==='all'?'All':statusLabel(f)}</button>
    {/each}
  </div>

  {#if all.length === 0}
    <div class="empty-state"><div class="icon">✅</div>No phases yet. Click <strong>+ Add Phase</strong> to create one.</div>
  {/if}

  {#each all as phase, pi}
    {@const items = filterItems(phase.items)}
    {@const pDone = phase.items.filter(i=>i.status==='done').length}
    {@const pct = phase.items.length ? Math.round(pDone/phase.items.length*100) : 0}
    {@const isOpen = collapsed[pi] !== true}
    <div class="phase-block">
      <div class="phase-header" style="background:{phase.color}" on:click={() => collapsed[pi] = !collapsed[pi]}>
        <span>{phase.label}</span>
        <div style="display:flex;align-items:center;gap:10px">
          {#if phase.gantt_start}<span style="font-size:.66rem;opacity:.7">months {phase.gantt_start}–{phase.gantt_end}</span>{/if}
          <div style="width:70px"><div class="progress-wrap" style="background:rgba(255,255,255,.3)"><div class="progress-bar" style="width:{pct}%;background:#fff"></div></div></div>
          <span style="font-size:.76rem;opacity:.85">{pDone}/{phase.items.length}</span>
          <span style="font-size:.8rem">{isOpen?'▲':'▼'}</span>
        </div>
      </div>
      {#if isOpen}
        <div class="phase-body">
          {#each items as item}
            <div class="checklist-item" class:is-milestone={item.milestone} style="cursor:pointer"
              on:click={() => cycleStatus(pi, item.id)}>
              <span class="check-icon {item.status}">{checkIcon(item.status)}</span>
              <span style="flex:1">
                {#if item.milestone}🏁 {/if}{item.text}
                {#if item.deadline}<span class="text-xs" style="color:var(--warn);margin-left:6px">📅 {item.deadline}</span>{/if}
                {#if item.deadline_month}<span class="text-xs text-muted" style="margin-left:4px">(m{item.deadline_month})</span>{/if}
              </span>
              <span class="status-chip {item.status}">{statusLabel(item.status)}</span>
              <button class="btn btn-sm" style="padding:2px 6px;font-size:.68rem;border-color:transparent;color:var(--muted)"
                on:click|stopPropagation={() => deleteItem(pi, item.id)} title="Remove">✕</button>
            </div>
          {/each}
          {#if items.length === 0}
            <div style="padding:16px;color:var(--muted);font-size:.84rem;text-align:center">No items match filter.</div>
          {/if}
          <div style="padding:6px 15px;display:flex;gap:6px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" on:click|stopPropagation={() => openItemModal(pi)}>+ Add item</button>
            <button class="btn btn-secondary btn-sm" on:click|stopPropagation={() => openPhaseModal(pi)}>Edit phase</button>
            <button class="btn btn-secondary btn-sm" on:click|stopPropagation={() => movePhase(pi, -1)} disabled={pi===0}>↑</button>
            <button class="btn btn-secondary btn-sm" on:click|stopPropagation={() => movePhase(pi, 1)} disabled={pi===all.length-1}>↓</button>
            <button class="btn btn-danger btn-sm" on:click|stopPropagation={() => deletePhase(pi)}>Delete phase</button>
          </div>
        </div>
      {/if}
    </div>
  {/each}
</div>

<!-- Phase modal -->
{#if phaseModalOpen}
<div class="modal-backdrop open" on:click|self={() => phaseModalOpen=false}>
  <div class="modal" style="max-width:600px">
    <div class="modal-header"><h2>{editingPhaseIdx!=null?'Edit Phase':'Add Phase'}</h2><button class="modal-close" on:click={() => phaseModalOpen=false}>×</button></div>
    <div class="modal-body">
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group full"><label>Phase name *</label><input bind:value={pf.label} placeholder="e.g. Phase 2 — Pilots"></div>
        <div class="form-group"><label>Colour</label><input type="color" bind:value={pf.color} style="height:36px;padding:2px"></div>
      </div>
      <div style="background:#f8f9fb;border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-bottom:14px">
        <div style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Gantt Timeline (optional)</div>
        <div class="form-grid cols-3" style="margin-bottom:10px">
          <div class="form-group"><label>Start month</label><input type="number" min="1" bind:value={pf.gantt_start} placeholder="e.g. 4"></div>
          <div class="form-group"><label>End month</label><input type="number" min="1" bind:value={pf.gantt_end} placeholder="e.g. 10"></div>
        </div>
        <div style="font-size:.72rem;font-weight:600;color:var(--muted);margin-bottom:6px">Sub-rows</div>
        {#each pf.gantt_rows as row, i}
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;font-size:.82rem">
            <span style="flex:1">{row.label}</span>
            <span class="text-xs text-muted">m{row.s}–{row.e}</span>
            <button class="btn btn-sm" style="padding:1px 5px;font-size:.68rem;border-color:transparent;color:var(--muted)" on:click={() => removeGanttRow(i)}>✕</button>
          </div>
        {/each}
        <div style="display:flex;gap:6px;align-items:end">
          <div class="form-group" style="flex:2"><label>Row label</label><input bind:value={newRowLabel} placeholder="Task name"
            on:keydown={(e) => { if(e.key==='Enter'){e.preventDefault();addGanttRow()} }}></div>
          <div class="form-group" style="flex:1"><label>Start</label><input type="number" bind:value={newRowS} min="1"></div>
          <div class="form-group" style="flex:1"><label>End</label><input type="number" bind:value={newRowE} min="1"></div>
          <button class="btn btn-secondary btn-sm" on:click={addGanttRow} style="margin-bottom:4px">Add</button>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={() => phaseModalOpen=false}>Cancel</button>
      <button class="btn btn-primary" on:click={savePhase}>Save</button>
    </div>
  </div>
</div>
{/if}

<!-- Item modal -->
{#if itemModalOpen}
<div class="modal-backdrop open" on:click|self={() => itemModalOpen=false}>
  <div class="modal" style="max-width:480px">
    <div class="modal-header"><h2>Add Item</h2><button class="modal-close" on:click={() => itemModalOpen=false}>×</button></div>
    <div class="modal-body">
      <div class="form-group" style="margin-bottom:12px"><label>Item text *</label><textarea bind:value={itemText} rows="2"></textarea></div>
      <div class="form-grid cols-3">
        <div class="form-group"><label>Calendar deadline</label><input type="date" bind:value={itemDeadline}></div>
        <div class="form-group"><label>Gantt month</label><input type="number" min="1" bind:value={itemDeadlineMonth} placeholder="e.g. 9"></div>
        <div class="form-group"><label>Milestone?</label>
          <select bind:value={itemMilestone}><option value={false}>No</option><option value={true}>Yes 🏁</option></select>
        </div>
      </div>
      <p class="text-xs text-muted mt-3">Milestone items with a Gantt month appear as diamonds on the Overview Gantt chart.</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={() => itemModalOpen=false}>Cancel</button>
      <button class="btn btn-primary" on:click={addItem}>Add</button>
    </div>
  </div>
</div>
{/if}
