<script>
  import { animals, sessions, aims, trajectories, saveTransition, removeTransition, saveAnimal, toast, uid } from '$lib/stores.js';
  import { todayStr } from '$lib/utils.js';

  let aimFilter = 'all', modalOpen = false, editingId = null;
  let f = {};

  $: entries = [...$sessions].sort((a,b) => b.date?.localeCompare(a.date));
  $: filtered = aimFilter === 'all' ? entries : entries.filter(e => getAim(e.animal_id) === aimFilter);

  function getAim(id) { return $animals.find(a => a._id === id)?.aim || '?'; }
  function getLabel(id) { return $animals.find(a => a._id === id)?.track_id || id; }

  function openModal(id) {
    editingId = id || null;
    if (id) {
      const e = $sessions.find(x => x._id === id);
      f = e ? { ...e } : {};
    } else {
      f = { _id: '', animal_id: '', date: todayStr(), stage_from: '', stage_to: '', notes: '' };
    }
    modalOpen = true;
  }

  function onAnimalChange() {
    const a = $animals.find(x => x._id === f.animal_id);
    f.stage_from = a?.current_stage || '';
  }

  $: availableStages = (() => {
    if (!f.animal_id) return [];
    const a = $animals.find(x => x._id === f.animal_id);
    if (!a) return [];
    const stgs = $trajectories[a.aim] || [];
    const ci = stgs.findIndex(s => s.id === a.current_stage);
    return ci === -1 ? stgs : stgs.slice(ci + 1);
  })();

  function save() {
    if (!f.animal_id || !f.stage_to) { toast('Select animal and stage', 'error'); return; }
    const animal = $animals.find(a => a._id === f.animal_id);
    const entry = {
      _id: f._id || uid(), animal_id: f.animal_id, date: f.date,
      stage_from: editingId ? f.stage_from : (animal?.current_stage || null),
      stage_to: f.stage_to, notes: f.notes?.trim() || '',
    };
    saveTransition(entry);                      // ← per-entity

    // Also update animal's current_stage
    if (!editingId && animal) {
      const updated = { ...animal, current_stage: f.stage_to,
        stage_dates: { ...(animal.stage_dates||{}), [f.stage_to]: f.date }};
      saveAnimal(updated);                      // ← per-entity
    }
    modalOpen = false;
    toast(editingId ? 'Updated' : `${getLabel(f.animal_id)} → ${f.stage_to}`);
  }

  function del() {
    if (!editingId || !confirm('Delete this entry?')) return;
    removeTransition(editingId);                // ← per-entity
    modalOpen = false; toast('Deleted', 'error');
  }
</script>

<div class="page-header">
  <div><h1>🔀 Transitions</h1><div class="sub">Log key stage transitions. Auto-updates animal's current stage.</div></div>
  <div class="header-actions"><button class="btn btn-primary" on:click={() => openModal()}>+ Log Transition</button></div>
</div>

<div class="content">
  <div class="stats-row">
    <div class="stat-box"><div class="val">{entries.length}</div><div class="lbl">Logged</div></div>
    <div class="stat-box"><div class="val">{new Set(entries.map(e=>e.animal_id)).size}</div><div class="lbl">Animals</div></div>
    <div class="stat-box"><div class="val">{entries[0]?.date||'—'}</div><div class="lbl">Most recent</div></div>
  </div>

  <div class="filter-bar">
    <span class="text-muted text-sm">Aim:</span>
    <button class="filter-btn" class:active={aimFilter==='all'} on:click={() => aimFilter='all'}>All</button>
    <button class="filter-btn aim1" class:active={aimFilter==='A1'} on:click={() => aimFilter='A1'}>Aim 1</button>
    <button class="filter-btn aim2" class:active={aimFilter==='A2'} on:click={() => aimFilter='A2'}>Aim 2</button>
    <button class="filter-btn aim3" class:active={aimFilter==='A3'} on:click={() => aimFilter='A3'}>Aim 3</button>
  </div>

  {#if filtered.length === 0}
    <div class="empty-state"><div class="icon">🔀</div>No transitions logged yet.</div>
  {:else}
    <div class="card" style="padding:0;overflow:hidden">
      <div class="table-wrap" style="border:none;border-radius:0">
        <table>
          <thead><tr><th>Date</th><th>Animal</th><th>Aim</th><th>Transition</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            {#each filtered as e}
              <tr class="clickable" on:click={() => openModal(e._id)}>
                <td><code style="font-size:.76rem">{e.date||'—'}</code></td>
                <td><strong>{getLabel(e.animal_id)}</strong></td>
                <td><span class="aim-badge {getAim(e.animal_id)}">{$aims[getAim(e.animal_id)]?.label || '?'}</span></td>
                <td><code>{e.stage_from||'—'}</code> → <code>{e.stage_to||'—'}</code></td>
                <td class="text-xs text-muted" style="max-width:280px">{e.notes||''}</td>
                <td class="text-xs text-muted">edit ›</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

{#if modalOpen}
<div class="modal-backdrop open" on:click|self={() => modalOpen=false}>
  <div class="modal" style="max-width:560px">
    <div class="modal-header">
      <h2>{editingId ? 'Edit Transition' : 'Log Transition'}</h2>
      <button class="modal-close" on:click={() => modalOpen=false}>×</button>
    </div>
    <div class="modal-body">
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group"><label>Animal *</label>
          <select bind:value={f.animal_id} on:change={onAnimalChange}>
            <option value="">— select —</option>
            {#each [...$animals].sort((a,b) => (a.track_id||'').localeCompare(b.track_id||'')) as a}
              <option value={a._id}>{a.track_id || a._id} ({a.aim})</option>
            {/each}
          </select>
        </div>
        <div class="form-group"><label>Date *</label><input type="date" bind:value={f.date}></div>
      </div>
      {#if f.animal_id}
        <div style="background:#f8f9fb;border:1px solid var(--border);border-radius:var(--r);padding:12px;margin-bottom:14px">
          <div class="text-xs text-muted" style="margin-bottom:6px">From: <strong>{f.stage_from || '(not started)'}</strong></div>
          <div class="form-group"><label>To (new stage) *</label>
            <select bind:value={f.stage_to}>
              <option value="">— select —</option>
              {#each availableStages as s}<option value={s.id}>{s.id} — {s.label}</option>{/each}
            </select>
          </div>
        </div>
      {/if}
      <div class="form-group"><label>Notes</label><textarea bind:value={f.notes} rows="3"></textarea></div>
    </div>
    <div class="modal-footer">
      {#if editingId}<button class="btn btn-danger btn-sm" style="margin-right:auto" on:click={del}>Delete</button>{/if}
      <button class="btn btn-secondary" on:click={() => modalOpen=false}>Cancel</button>
      <button class="btn btn-primary" on:click={save}>Save</button>
    </div>
  </div>
</div>
{/if}
