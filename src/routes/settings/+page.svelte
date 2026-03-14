<script>
  import { settings, aims, trajectories, setKey, toast, data, loaded, currentProject, allProjects, deleteProject, uid } from '$lib/stores.js';
  import { buildDefaultProject, buildExampleProject } from '$lib/config.js';
  import { renderMd } from '$lib/utils.js';
  import MarkdownEditor from '$lib/components/MarkdownEditor.svelte';

  let s = {};
  let projName = '';
  let previewHyp = false;

  // Aim editor state
  let aimModalOpen = false, editingAimId = null;
  let af = { label:'', title:'', description:'', color:'#3b82f6', tools:'' };
  // Trajectory editor (within aim modal)
  let trajStages = [];
  let newStage = { id:'', label:'', short:'', type:'behaviour' };

  $: if ($loaded && $currentProject && !s._init) {
    s = { ...$currentProject.settings, _init: true };
    projName = $currentProject.name || '';
  }

  let lastProjId = null;
  $: if ($currentProject?._id && $currentProject._id !== lastProjId) {
    lastProjId = $currentProject._id;
    s = { ...$currentProject.settings, _init: true };
    projName = $currentProject.name || '';
  }

  $: aimEntries = Object.entries($aims || {});

  function save() {
    const { _init, ...rest } = s;
    setKey('settings', rest);
    if (projName.trim() !== $currentProject.name) {
      data.update(d => {
        const p = d.projects.find(x => x._id === d.currentProject);
        if (p) p.name = projName.trim();
        return d;
      });
    }
    toast('Settings saved');
  }

  // ── Aim CRUD ─────────────────────────────────────────────
  function openAimModal(aimId) {
    editingAimId = aimId || null;
    if (aimId && $aims[aimId]) {
      const a = $aims[aimId];
      af = { label: a.label, title: a.title, description: a.description, color: a.color, tools: (a.tools||[]).join(', ') };
      trajStages = JSON.parse(JSON.stringify(($trajectories||{})[aimId] || []));
    } else {
      const nextNum = aimEntries.length + 1;
      af = { label: `Aim ${nextNum}`, title: '', description: '', color: '#3b82f6', tools: '' };
      trajStages = [];
      editingAimId = null;
    }
    newStage = { id:'', label:'', short:'', type:'behaviour' };
    aimModalOpen = true;
  }

  function addTrajStage() {
    if (!newStage.id.trim()) return;
    trajStages = [...trajStages, { ...newStage, id: newStage.id.trim(), label: newStage.label.trim(), short: newStage.short.trim() || newStage.id.trim() }];
    newStage = { id:'', label:'', short:'', type:'behaviour' };
  }

  function removeTrajStage(i) { trajStages = trajStages.filter((_, j) => j !== i); }

  function saveAim() {
    if (!af.label.trim()) { toast('Label required', 'error'); return; }
    const aimId = editingAimId || ('A' + (aimEntries.length + 1));
    const newAims = JSON.parse(JSON.stringify($aims || {}));
    newAims[aimId] = {
      label: af.label.trim(),
      title: af.title.trim(),
      description: af.description.trim(),
      color: af.color,
      tools: af.tools.split(',').map(t => t.trim()).filter(Boolean),
    };
    setKey('aims', newAims);
    const newTraj = JSON.parse(JSON.stringify($trajectories || {}));
    newTraj[aimId] = trajStages;
    setKey('trajectories', newTraj);
    aimModalOpen = false;
    toast(editingAimId ? 'Aim updated' : 'Aim added');
  }

  function deleteAim(aimId) {
    const animalCount = ($currentProject?.animals||[]).filter(a => a.aim === aimId).length;
    if (animalCount > 0) {
      if (!confirm(`${animalCount} animals are assigned to this aim. Delete anyway? Animals will keep their aim ID but it won't resolve.`)) return;
    } else {
      if (!confirm(`Delete aim "${$aims[aimId]?.label}"?`)) return;
    }
    const newAims = JSON.parse(JSON.stringify($aims || {}));
    delete newAims[aimId];
    setKey('aims', newAims);
    const newTraj = JSON.parse(JSON.stringify($trajectories || {}));
    delete newTraj[aimId];
    setKey('trajectories', newTraj);
    toast('Aim deleted', 'error');
  }

  // ── Data management ──────────────────────────────────────
  function delProject() {
    if ($allProjects.length <= 1) { toast('Cannot delete the only project', 'error'); return; }
    if (!confirm(`Delete project "${projName}"?`)) return;
    deleteProject($currentProject._id);
    s = {}; lastProjId = null;
    toast('Project deleted', 'error');
  }

  function resetProject() {
    if (!confirm('Reset this project to example defaults? All current data will be lost.')) return;
    const fresh = buildExampleProject();
    fresh._id = $currentProject._id;
    fresh.name = projName || 'Example Study';
    data.update(d => { const idx = d.projects.findIndex(p => p._id === d.currentProject); if (idx >= 0) d.projects[idx] = fresh; return d; });
    s = { ...fresh.settings, _init: true };
    fetch('/api/data', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify($data) });
    toast('Reset to defaults');
  }

  async function exportJSON() {
    const res = await fetch('/api/data');
    const d = await res.json();
    const blob = new Blob([JSON.stringify(d, null, 2)], { type:'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `tracker_backup_${new Date().toISOString().slice(0,10)}.json`; a.click();
  }

  async function importJSON(e) {
    const file = e.target.files[0]; if (!file) return;
    try {
      const text = await file.text();
      const d = JSON.parse(text);
      data.set(d);
      await fetch('/api/data', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(d) });
      s = {}; lastProjId = null;
      toast('Data imported');
    } catch { toast('Import failed', 'error'); }
  }
</script>

<div class="page-header">
  <div><h1>Settings</h1><div class="sub">Project settings, aims, texts, and data management.</div></div>
</div>

<div class="content" style="max-width:800px">
  <div class="settings-section">
    <h3>Project</h3>
    <div class="form-grid" style="margin-bottom:14px">
      <div class="form-group"><label>Project name</label><input bind:value={projName}></div>
      <div class="form-group"><label>Full title</label><input bind:value={s.project_full}></div>
      <div class="form-group"><label>Supervisor</label><input bind:value={s.supervisor}></div>
    </div>
    <div class="form-group" style="margin-bottom:14px">
      <label>Committee (comma-separated)</label>
      <input value={s.committee?.join?.(', ') || ''} on:input={(e) => s.committee = e.target.value.split(',').map(x=>x.trim()).filter(Boolean)}>
    </div>
  </div>

  <!-- Aims -->
  <div class="settings-section">
    <h3>Aims</h3>
    <p class="text-xs text-muted mb-3">Each aim has a label, description, colour, and optional stage trajectory. Animals are assigned to aims.</p>
    {#each aimEntries as [id, aim]}
      <div class="card" style="border-left:3px solid {aim.color};padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <strong>{aim.label}</strong>{aim.title ? `: ${aim.title}` : ''}
          {#if aim.description}<div class="text-xs text-muted">{aim.description}</div>{/if}
          {#if ($trajectories||{})[id]?.length}<div class="text-xs text-muted" style="margin-top:2px">{($trajectories||{})[id].length} stages defined</div>{/if}
        </div>
        <button class="btn btn-secondary btn-sm" on:click={() => openAimModal(id)}>Edit</button>
        <button class="btn btn-danger btn-sm" on:click={() => deleteAim(id)}>✕</button>
      </div>
    {/each}
    {#if aimEntries.length === 0}
      <div class="text-muted text-sm" style="margin-bottom:8px">No aims defined yet.</div>
    {/if}
    <button class="btn btn-secondary" on:click={() => openAimModal()}>+ Add Aim</button>
  </div>

  <!-- Gantt -->
  <div class="settings-section">
    <h3>Gantt Timeline</h3>
    <p class="text-xs text-muted mb-3">Phases and sub-rows are managed on <a href="/milestones">Milestones</a>.</p>
    <div class="form-grid cols-3" style="margin-bottom:14px">
      <div class="form-group"><label>Current month (red line)</label><input type="number" min="1" bind:value={s.today_month}></div>
      <div class="form-group"><label>Total months</label><input type="number" min="1" bind:value={s.gantt_total_months}></div>
      <div class="form-group"><label>Start year</label><input type="number" bind:value={s.gantt_start_year}></div>
    </div>
  </div>

  <!-- Hypothesis -->
  <div class="settings-section">
    <h3>Core Hypothesis (Overview page)</h3>
    <p class="text-xs text-muted mb-3">Supports **bold**, *italic*, `code`, ## headings, - lists, and ==colour==highlights==/colour==.</p>
    <MarkdownEditor bind:value={s.hypothesis} rows={10} placeholder="Write your hypothesis here…" />
  </div>

  <button class="btn btn-primary" on:click={save} style="margin-bottom:24px">Save settings</button>

  <div class="settings-section">
    <h3>Data Management</h3>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-secondary" on:click={exportJSON}>⬇ Export</button>
      <label class="btn btn-secondary" style="cursor:pointer">⬆ Import<input type="file" accept=".json" style="display:none" on:change={importJSON}></label>
      <button class="btn btn-danger" on:click={resetProject}>↻ Reset project</button>
      {#if $allProjects.length > 1}<button class="btn btn-danger" on:click={delProject}>🗑 Delete project</button>{/if}
    </div>
  </div>
</div>

<!-- Aim modal -->
{#if aimModalOpen}
<div class="modal-backdrop open" on:click|self={() => aimModalOpen=false}>
  <div class="modal" style="max-width:640px">
    <div class="modal-header"><h2>{editingAimId ? `Edit ${af.label}` : 'Add Aim'}</h2><button class="modal-close" on:click={() => aimModalOpen=false}>×</button></div>
    <div class="modal-body">
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group"><label>Label *</label><input bind:value={af.label} placeholder="e.g. Aim 1"></div>
        <div class="form-group"><label>Colour</label><input type="color" bind:value={af.color} style="height:36px;padding:2px"></div>
        <div class="form-group full"><label>Title</label><input bind:value={af.title} placeholder="Short title"></div>
        <div class="form-group full"><label>Description</label><textarea bind:value={af.description} rows="2"></textarea></div>
        <div class="form-group full"><label>Tools (comma-separated)</label><input bind:value={af.tools} placeholder="e.g. Imaging, Electrophysiology, Behavioural analysis"></div>
      </div>

      <div style="background:#f8f9fb;border:1px solid var(--border);border-radius:var(--r);padding:12px">
        <div style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Stage Trajectory (optional)</div>
        <p class="text-xs text-muted mb-3">Stages define the progression an animal goes through. Used in the Animals page trajectory display.</p>
        {#each trajStages as st, i}
          <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;font-size:.82rem">
            <code style="min-width:50px">{st.id}</code>
            <span style="flex:1">{st.label}</span>
            <span class="text-xs text-muted">{st.short} · {st.type}</span>
            <button class="btn btn-sm" style="padding:1px 5px;font-size:.68rem;border-color:transparent;color:var(--muted)" on:click={() => removeTrajStage(i)}>✕</button>
          </div>
        {/each}
        <div style="display:flex;gap:6px;align-items:end;margin-top:8px;flex-wrap:wrap">
          <div class="form-group" style="flex:1;min-width:60px"><label>ID</label><input bind:value={newStage.id} placeholder="HP"
            on:keydown={(e) => { if(e.key==='Enter'){e.preventDefault();addTrajStage()} }}></div>
          <div class="form-group" style="flex:2;min-width:100px"><label>Label</label><input bind:value={newStage.label} placeholder="Headplate surgery"
            on:keydown={(e) => { if(e.key==='Enter'){e.preventDefault();addTrajStage()} }}></div>
          <div class="form-group" style="flex:1;min-width:50px"><label>Short</label><input bind:value={newStage.short} placeholder="HP"></div>
          <div class="form-group" style="flex:1;min-width:80px"><label>Type</label>
            <select bind:value={newStage.type}>
              <option value="surgery">surgery</option><option value="husbandry">husbandry</option>
              <option value="behaviour">behaviour</option><option value="opto">opto</option>
              <option value="imaging">imaging</option><option value="done">done</option>
            </select>
          </div>
          <button class="btn btn-secondary btn-sm" on:click={addTrajStage} style="margin-bottom:4px">Add</button>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={() => aimModalOpen=false}>Cancel</button>
      <button class="btn btn-primary" on:click={saveAim}>Save</button>
    </div>
  </div>
</div>
{/if}
