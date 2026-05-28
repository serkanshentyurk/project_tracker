<script>
  import { animals, sessions, milestones, log, settings, currentProject, aims } from '$lib/stores.js';
  import { renderMd } from '$lib/utils.js';
  import { goto } from '$app/navigation';
  import { data } from '$lib/stores.js';
  import { flagsForLatestSession, worstLevel, levelColour } from '$lib/flags.js';
  import { todayStr } from '$lib/utils.js';

  $: animalList = $animals;
  $: aimEntries = Object.entries($aims || {});
  $: active = animalList.filter(a => a.current_stage).length;
  $: sessionCount = $sessions.length;
  $: mDone = 0; $: mTotal = 0;
  $: { mDone = 0; mTotal = 0; ($milestones||[]).forEach(p => p.items.forEach(i => { mTotal++; if (i.status==='done') mDone++; })); }
  $: openIssues = ($log||[]).filter(i => i.kind==='issue' && i.status==='open').length;
  $: todayM = $settings.today_month || 1;
  $: ganttTotal = $settings.gantt_total_months || 36;
  $: startYear = $settings.gantt_start_year || 2026;
  $: yearCount = Math.ceil(ganttTotal / 12);
  $: years = Array.from({length: yearCount}, (_, i) => startYear + i);
  $: ganttPhases = ($milestones || []).filter(p => p.gantt_start && p.gantt_end);
  $: sessionData = (() => {
    const d = $data;
    if (!d) return [];
    const proj = d.projects?.find(p => p._id === d.currentProject);
    return proj?.session_data || [];
  })();

  $: ranToday = (() => {
    const today = todayStr();
    return new Set(sessionData.filter(s => s.date === today).map(s => s.animal_id)).size;
  })();

  $: flaggedAnimals = $animals
    .map(a => {
      const mine = sessionData.filter(s => s.animal_id === a.track_id || s.animal_id === a._id);
      const flags = flagsForLatestSession(mine);
      return { animal: a, flags, level: worstLevel(flags) };
    })
    .filter(x => x.level)
    .sort((a, b) => (a.level === 'danger' ? -1 : 1) - (b.level === 'danger' ? -1 : 1));
    function pct(m) { return ((m-1)/ganttTotal*100).toFixed(2)+'%'; }
    function w(s,e) { return ((e-s+1)/ganttTotal*100).toFixed(2)+'%'; }
</script>

<div class="page-header">
  <div>
    <h1>🏠 Overview</h1>
    <div class="sub">{$settings.project_full || $currentProject?.name || ''}{$settings.supervisor ? ` · Supervisor: ${$settings.supervisor}` : ''}</div>
  </div>
</div>

<div class="content">
  <div class="stats-row">
    <div class="stat-box"><div class="val">{animalList.length}</div><div class="lbl">Animals</div></div>
    <div class="stat-box"><div class="val">{active}</div><div class="lbl">Active</div></div>
    <div class="stat-box"><div class="val">{sessionCount}</div><div class="lbl">Sessions</div></div>
    <div class="stat-box"><div class="val">{mDone}/{mTotal}</div><div class="lbl">Milestones</div></div>
    <div class="stat-box"><div class="val">{openIssues}</div><div class="lbl">Open issues</div></div>
  </div>

  <div class="card" style="margin-bottom:16px">
    <div class="card-title">📌 Needs attention</div>
    <div class="text-sm text-muted" style="margin-bottom:10px">
      {ranToday} animal{ranToday === 1 ? '' : 's'} ran today ·
      {flaggedAnimals.length} flagged on latest session
    </div>
    {#if flaggedAnimals.length === 0}
      <div class="text-sm" style="color:var(--success)">✓ No animals flagged.</div>
    {:else}
      <div style="display:flex;flex-direction:column;gap:6px">
        {#each flaggedAnimals as fa}
          <div class="clickable" on:click={() => goto(`/animals/${fa.animal._id}`)}
            style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:6px;border:1px solid var(--border)">
            <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:{levelColour(fa.level)}"></span>
            <strong style="min-width:70px">{fa.animal.track_id || fa.animal._id}</strong>
            <span class="text-xs">
              {#each fa.flags as fl}
                <span style="display:inline-block;padding:1px 6px;border-radius:8px;margin:1px;background:{levelColour(fl.level)}22;color:{levelColour(fl.level)};font-weight:600">{fl.msg}</span>
              {/each}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Hypothesis -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">🧠 Core Hypothesis</div>
    <div style="font-size:.88rem;line-height:1.7">
      {#if $settings.hypothesis}
        {@html renderMd($settings.hypothesis)}
      {:else}
        <p class="text-muted" style="font-style:italic">No hypothesis text set. Go to <a href="/settings">Settings</a> to write one.</p>
      {/if}
    </div>
  </div>

  <!-- Aims -->
  {#if aimEntries.length > 0}
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-bottom:20px">
    {#each aimEntries as [id, aim]}
      {@const cohort = animalList.filter(a => a.aim === id)}
      <div class="card" style="border-top:3px solid {aim.color}">
        <div class="card-title" style="color:{aim.color}">{aim.label}: {aim.title}</div>
        <p class="text-sm" style="margin-bottom:8px">{aim.description}</p>
        <div class="text-xs text-muted" style="margin-bottom:6px">{cohort.length} animals registered</div>
        {#if aim.tools?.length}
        <div style="display:flex;flex-wrap:wrap;gap:3px">{#each aim.tools as t}<span class="tag">{t}</span>{/each}</div>
        {/if}
      </div>
    {/each}
  </div>
  {:else}
    <div class="card" style="margin-bottom:16px">
      <p class="text-muted text-sm">No aims defined. Add them in <a href="/settings">Settings</a>.</p>
    </div>
  {/if}

  <!-- Dynamic Gantt -->
  {#if ganttPhases.length > 0}
  <div class="card">
    <div class="card-title">📅 Phase Timeline ({startYear} – {startYear + yearCount - 1})</div>
    <div class="gantt-wrap"><div class="gantt">
      <div class="gantt-year-row">
        {#each years as yr}<div class="gantt-yr" style="flex:{12/ganttTotal}">&nbsp;{yr}</div>{/each}
      </div>
      <div class="gantt-q-row">
        {#each Array(yearCount * 4) as _, i}<div class="gantt-q" style="flex:{3/ganttTotal}">Q{(i%4)+1}</div>{/each}
      </div>
      {#each ganttPhases as phase}
        <div class="gantt-row">
          <div class="gantt-label group">{phase.label}</div>
          <div class="gantt-track group" style="position:relative">
            <div class="gantt-today" style="left:{pct(todayM)}"></div>
            <div class="gantt-bar" style="left:{pct(phase.gantt_start)};width:{w(phase.gantt_start,phase.gantt_end)};background:{phase.color};opacity:.4;height:100%;border-radius:3px"></div>
          </div>
        </div>
        {#each (phase.gantt_rows||[]) as row}
          <div class="gantt-row">
            <div class="gantt-label text-muted text-xs">{row.label}</div>
            <div class="gantt-track" style="position:relative">
              <div class="gantt-today" style="left:{pct(todayM)}"></div>
              <div class="gantt-bar" style="left:{pct(row.s)};width:{w(row.s,row.e)};background:{phase.color}"></div>
            </div>
          </div>
        {/each}
        {@const mstones = (phase.items||[]).filter(i => i.milestone && i.deadline_month)}
        {#if mstones.length > 0}
          <div class="gantt-row">
            <div class="gantt-label text-xs text-muted">milestones</div>
            <div class="gantt-track" style="position:relative;height:18px">
              <div class="gantt-today" style="left:{pct(todayM)}"></div>
              {#each mstones as ml}
                <div style="position:absolute;left:{pct(ml.deadline_month)};transform:translateX(-50%)">
                  <div class="gantt-milestone" style="{ml.status==='done'?'background:#22c55e':''}"></div>
                  <div class="gantt-milestone-label" style="{ml.status==='done'?'color:#22c55e':''}">{ml.text}</div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
        <div style="height:6px"></div>
      {/each}
    </div></div>
    <p class="text-xs text-muted" style="margin-top:8px">Red line = month {todayM}. Phases managed on <a href="/milestones">Milestones</a>. Gantt settings in <a href="/settings">Settings</a>.</p>
  </div>
  {:else}
    <div class="card"><div class="card-title">📅 Phase Timeline</div>
      <p class="text-muted text-sm">No phases with Gantt dates yet. Add them on <a href="/milestones">Milestones</a>.</p>
    </div>
  {/if}
</div>
