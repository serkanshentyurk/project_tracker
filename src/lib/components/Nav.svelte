<script>
  import { page } from '$app/stores';
  import { settings, allProjects, currentProjectId, switchProject, addProject, deleteProject, uid, toast } from '$lib/stores.js';
  import { buildDefaultProject } from '$lib/config.js';

  const pages = [
    { id:'/',             icon:'🏠', label:'Overview' },
    { id:'/animals',      icon:'🐭', label:'Animals' },
    { id:'/transitions',  icon:'🔀', label:'Transitions' },
    { id:'/sessions',     icon:'📊', label:'Sessions' },
    { id:'/milestones',   icon:'✅', label:'Milestones' },
    { id:'/log',          icon:'📋', label:'Log' },
    { id:'/protocols',    icon:'📝', label:'Protocols' },
    { id:'/calendar',     icon:'📅', label:'Calendar' },
    { id:'/settings',     icon:'⚙️', label:'Settings' },
  ];

  function onProjectChange(e) {
    const val = e.target.value;
    if (val === '__new__') {
      const name = prompt('New project name:');
      if (!name?.trim()) { e.target.value = $currentProjectId; return; }
      const proj = buildDefaultProject(uid(), name.trim());
      addProject(proj);                         // ← already async in new stores
      toast('Project created');
    } else {
      switchProject(val);                       // ← already async in new stores
    }
  }

  function promptTodayMonth() {
    const cur = $settings.today_month || 3;
    const val = prompt(`Current Gantt month (1 = first month):\n\nCurrent: ${cur}`);
    if (val === null) return;
    const n = parseInt(val);
    if (isNaN(n) || n < 1) { toast('Must be ≥ 1', 'error'); return; }
    // Note: this still uses the legacy path via Settings page save.
    // The Gantt month is saved when the user clicks Save in Settings.
    // For a quick inline update, we use setKey as fallback:
    import('$lib/stores.js').then(m => {
      m.setKey('settings', { ...$settings, today_month: n });
      toast('Gantt month updated');
    });
  }
  import { goto } from '$app/navigation';
</script>


<div id="nav" style="
  width:var(--nav-w); background:var(--nav-bg); color:#9aabC0;
  position:fixed; top:0; left:0; bottom:0; display:flex;
  flex-direction:column; z-index:100; overflow-y:auto;">

  <div style="padding:14px 14px 10px;border-bottom:1px solid #222d42">
    <div style="font-size:.62rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#4a5a78;margin-bottom:6px">Project</div>
    <select value={$currentProjectId} on:change={onProjectChange}
      style="width:100%;padding:5px 8px;border-radius:5px;border:1px solid #2e3f5e;background:#1f2a3e;color:#dde4f0;font-size:.82rem;font-weight:600;cursor:pointer">
      {#each $allProjects as p}
        <option value={p._id}>{p.name}</option>
      {/each}
      <option value="__new__">+ New project…</option>
    </select>
  </div>

  <nav style="flex:1;padding:8px 0">
    {#each pages as p}
      <a href={p.id}
        class:active={$page.url.pathname === p.id}
        style="display:flex;align-items:center;gap:9px;padding:8px 14px;color:#8898b2;font-size:.83rem;
        border-left:3px solid transparent;transition:color .12s,background .12s;text-decoration:none;
        {$page.url.pathname === p.id ? 'color:#dde4f0;border-left-color:var(--accent);background:#1f2a3e;font-weight:600' : ''}">
        <span style="font-size:.9rem;width:18px;text-align:center;flex-shrink:0">{p.icon}</span>{p.label}
      </a>
    {/each}
  </nav>

  <div style="padding:12px 14px;border-top:1px solid #222d42;display:flex;flex-direction:column;gap:6px">
    <div style="font-size:.72rem;color:#4a5a78">
      Gantt month: <strong style="color:#8898b2">{$settings.today_month || 3}</strong>
      <button on:click={promptTodayMonth} style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:.72rem;padding:0 3px;text-decoration:underline">edit</button>
    </div>
    <div style="color:#4a5a78;font-size:.68rem">💾 Auto-saves to server</div>
    <button on:click={logout}
      style="display:block;width:100%;padding:5px 10px;background:#222d42;border:1px solid #2e3f5e;
      border-radius:5px;color:#8898b2;font-size:.74rem;cursor:pointer;text-align:center;margin-top:4px;transition:background .12s"
      >Log out</button>
  </div>
</div>
