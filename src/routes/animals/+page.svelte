<script>
  import { animals, aims, trajectories, setKey, toast, uid } from '$lib/stores.js';

  let aimFilter = 'all';
  let modalOpen = false;
  let editingId = null;
  let f = {};

  $: aimEntries = Object.entries($aims || {});
  $: aimIds = aimEntries.map(([id]) => id);
  $: filtered = aimFilter === 'all' ? $animals : $animals.filter(a => a.aim === aimFilter);
  $: grouped = aimFilter === 'all'
    ? aimIds.map(id => ({ id, animals: $animals.filter(a => a.aim === id) }))
    : [{ id: aimFilter, animals: filtered }];

  function stages(aim) { return ($trajectories || {})[aim] || []; }

  function openModal(id) {
    editingId = id || null;
    const a = id ? $animals.find(x => x._id === id) : null;
    f = a ? { ...a } : { _id: '', track_id: '', lab_id: '', cage: '', sex: '',
      aim: aimIds[0] || '', strain: '', mutation1: '', dob: '', hp_date: '', wr_start: '',
      train_start: '', current_stage: '', notes: '', opto_batch: '', surgery_date: '',
      aav_date: '', window_grade: '', gcamp: '', stage_dates: {} };
    modalOpen = true;
  }

  function save() {
    if (!f.track_id?.trim()) { toast('ID required', 'error'); return; }
    const entry = { ...f, _id: f._id || uid() };
    const list = [...$animals];
    const idx = list.findIndex(a => a._id === entry._id);
    if (idx >= 0) list[idx] = entry; else list.push(entry);
    setKey('animals', list);
    modalOpen = false;
    toast(editingId ? 'Animal updated' : 'Animal added');
  }

  function del() {
    if (!editingId || !confirm('Delete this animal and all its sessions?')) return;
    setKey('animals', $animals.filter(a => a._id !== editingId));
    modalOpen = false;
    toast('Deleted', 'error');
  }

  function trajClass(stgs, currentStage, i) {
    const ci = stgs.findIndex(s => s.id === currentStage);
    if (ci === -1) return 'upcoming';
    return i < ci ? 'done' : i === ci ? 'current' : 'upcoming';
  }
</script>

<div class="page-header">
  <div><h1>Animals</h1><div class="sub">Click a row to edit. Grouped by aim.</div></div>
  <div class="header-actions"><button class="btn btn-primary" on:click={() => openModal()}>+ Add Animal</button></div>
</div>

<div class="content">
  <div class="stats-row">
    <div class="stat-box"><div class="val">{$animals.length}</div><div class="lbl">Total</div></div>
    <div class="stat-box"><div class="val">{$animals.filter(a=>a.current_stage).length}</div><div class="lbl">Active</div></div>
    {#each aimEntries as [id, aim]}
      <div class="stat-box"><div class="val">{$animals.filter(a=>a.aim===id).length}</div><div class="lbl">{aim.label}</div></div>
    {/each}
  </div>

  <div class="filter-bar">
    <span class="text-muted text-sm">Show:</span>
    <button class="filter-btn" class:active={aimFilter==='all'} on:click={() => aimFilter='all'}>All</button>
    {#each aimEntries as [id, aim]}
      <button class="filter-btn" class:active={aimFilter===id} on:click={() => aimFilter=id}
        style="{aimFilter===id ? `background:${aim.color};border-color:${aim.color};color:#fff` : ''}">{aim.label}</button>
    {/each}
  </div>

  {#each grouped as g}
    {@const aim = ($aims || {})[g.id]}
    {#if aim}
    <div class="card" style="padding:0;overflow:hidden;border-top:3px solid {aim.color};margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)">
        <span class="bold">{aim.label}: {aim.title}</span>
        <span class="text-xs text-muted">{g.animals.length} registered</span>
      </div>
      {#if g.animals.length === 0}
        <div class="empty-state" style="padding:30px">No animals yet</div>
      {:else}
        <div class="table-wrap" style="border:none;border-radius:0">
          <table>
            <thead><tr><th>ID</th><th>Lab ID</th><th>Sex</th><th>Stage</th><th>Trajectory</th><th>Notes</th></tr></thead>
            <tbody>
              {#each g.animals as a}
                <tr class="clickable" on:click={() => openModal(a._id)}>
                  <td><strong>{a.track_id || a._id}</strong></td>
                  <td>{a.lab_id || '—'}</td>
                  <td>{a.sex || '—'}</td>
                  <td>{#if a.current_stage}<code>{a.current_stage}</code>{:else}<span class="text-muted">—</span>{/if}</td>
                  <td>
                    <div class="traj-row">
                      {#each stages(a.aim) as s, i}
                        <span class="traj-stage {trajClass(stages(a.aim), a.current_stage, i)} type-{s.type}" title="{s.label}">{s.short}</span>
                        {#if i < stages(a.aim).length - 1}<span class="traj-arrow">›</span>{/if}
                      {/each}
                    </div>
                  </td>
                  <td class="text-xs text-muted">{a.notes || ''}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
    {/if}
  {/each}
</div>

{#if modalOpen}
<div class="modal-backdrop open" on:click|self={() => modalOpen = false}>
  <div class="modal">
    <div class="modal-header">
      <h2>{editingId ? `Edit: ${f.track_id}` : 'Add Animal'}</h2>
      <button class="modal-close" on:click={() => modalOpen = false}>×</button>
    </div>
    <div class="modal-body">
      <div class="form-grid cols-3" style="margin-bottom:14px">
        <div class="form-group"><label>ID *</label><input bind:value={f.track_id} placeholder="A1_01"></div>
        <div class="form-group"><label>Lab ID</label><input bind:value={f.lab_id}></div>
        <div class="form-group"><label>Cage</label><input bind:value={f.cage}></div>
        <div class="form-group"><label>Sex</label>
          <select bind:value={f.sex}><option value="">—</option><option value="M">Male</option><option value="F">Female</option></select>
        </div>
        <div class="form-group"><label>Aim *</label>
          <select bind:value={f.aim}>
            {#each aimEntries as [id, aim]}<option value={id}>{aim.label}</option>{/each}
          </select>
        </div>
      </div>
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group"><label>Line / Strain</label><input bind:value={f.strain}></div>
        <div class="form-group"><label>Mutation 1</label><input bind:value={f.mutation1}></div>
      </div>
      <div class="form-grid cols-3" style="margin-bottom:14px">
        <div class="form-group"><label>DOB</label><input type="date" bind:value={f.dob}></div>
        <div class="form-group"><label>HP date</label><input type="date" bind:value={f.hp_date}></div>
        <div class="form-group"><label>WR start</label><input type="date" bind:value={f.wr_start}></div>
        <div class="form-group"><label>Train start</label><input type="date" bind:value={f.train_start}></div>
      </div>
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group"><label>Current stage</label>
          <select bind:value={f.current_stage}>
            <option value="">— not started —</option>
            {#each stages(f.aim) as s}<option value={s.id}>{s.id} — {s.label}</option>{/each}
          </select>
        </div>
      </div>
      <div class="form-group"><label>Notes</label><textarea bind:value={f.notes} rows="2"></textarea></div>
    </div>
    <div class="modal-footer">
      {#if editingId}<button class="btn btn-danger btn-sm" style="margin-right:auto" on:click={del}>Delete</button>{/if}
      <button class="btn btn-secondary" on:click={() => modalOpen = false}>Cancel</button>
      <button class="btn btn-primary" on:click={save}>Save</button>
    </div>
  </div>
</div>
{/if}
