<script>
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { animals, aims, trajectories, sessions as transitions, data } from '$lib/stores.js';
  import LineChart from '$lib/components/LineChart.svelte';
  import PsychometricPlot from '$lib/components/PsychometricPlot.svelte';
  import UpdateMatrix from '$lib/components/UpdateMatrix.svelte';
  import CurriculumStrip from '$lib/components/CurriculumStrip.svelte';
  import { flagSession, worstLevel, levelColour } from '$lib/flags.js';

  // Route param: /animals/[id] where id is the animal _id
  $: animalIdParam = $page.params.id;
  $: animal = $animals.find(a => a._id === animalIdParam) || null;

  // session_data lives on the current project; pull it directly.
  $: sessionData = (() => {
    const d = $data;
    if (!d) return [];
    const proj = d.projects?.find(p => p._id === d.currentProject);
    return proj?.session_data || [];
  })();

  // Sessions for this animal. session_data[].animal_id holds the TRACK id,
  // so match against animal.track_id (falling back to _id for safety).
  $: mySessions = animal
    ? sessionData
        .filter(s => s.animal_id === animal.track_id || s.animal_id === animal._id)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    : [];

  $: myTransitions = animal
    ? [...$transitions]
        .filter(t => t.animal_id === animal._id)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    : [];

  $: aim = animal ? ($aims[animal.aim] || null) : null;
  $: stages = animal ? (($trajectories || {})[animal.aim] || []) : [];

  function trajClass(currentStage, i) {
    const ci = stages.findIndex(s => s.id === currentStage);
    if (ci === -1) return 'upcoming';
    return i < ci ? 'done' : i === ci ? 'current' : 'upcoming';
  }

  // ── Chart ───────────────────────────────────────────────────
  let selectedMetricKeys = ['accuracy', 'abort_rate'];
  const ALL_METRICS = [
    { key: 'accuracy', label: 'Accuracy', color: '#3b82f6' },
    { key: 'abort_rate', label: 'Abort Rate', color: '#f59e0b' },
    { key: 'side_bias', label: 'Side Bias', color: '#ef4444' },
    { key: 'pse', label: 'PSE (μ)', color: '#22c55e' },
    { key: 'slope', label: 'Slope (σ)', color: '#a855f7' },
    { key: 'lapse_low', label: 'Lapse Low', color: '#ec4899' },
    { key: 'lapse_high', label: 'Lapse High', color: '#14b8a6' },
    { key: 'recency', label: 'Recency', color: '#8b5cf6' },
    { key: 'win_stay', label: 'Win-Stay', color: '#0ea5e9' },
    { key: 'lose_shift', label: 'Lose-Shift', color: '#f97316' },
    { key: 'stimulus_sensitivity', label: 'Stim. Sensitivity', color: '#6366f1' },
    { key: 'n_trials_valid', label: 'Valid Trials', color: '#64748b' },
  ];
  function toggleMetric(key) {
    if (selectedMetricKeys.includes(key)) {
      if (selectedMetricKeys.length > 1)
        selectedMetricKeys = selectedMetricKeys.filter(k => k !== key);
    } else {
      selectedMetricKeys = [...selectedMetricKeys, key];
    }
  }
  $: selectedSeries = selectedMetricKeys.map(k => ALL_METRICS.find(m => m.key === k)).filter(Boolean);
  $: chartData = mySessions.map(s => ({ date: s.date, stage: s.stage, ...s.metrics }));
  $: refLines = (() => {
    const lines = [];
    if (selectedMetricKeys.includes('accuracy')) lines.push({ value: 0.5, color: '#888', label: 'chance' });
    if (selectedMetricKeys.includes('side_bias')) lines.push({ value: 0, color: '#888', label: 'no bias' });
    return lines;
  })();

  // ── Selected session for plots ──────────────────────────────
  let selectedSessionId = null;
  let hoveredDate = null;
  $: selectedSession = mySessions.find(s => s._id === selectedSessionId)
      || (mySessions.length ? mySessions[mySessions.length - 1] : null);
  $: if (mySessions.length && !selectedSessionId)
       selectedSessionId = mySessions[mySessions.length - 1]._id;

  // Index of the current session within mySessions (date-ascending).
  $: sessIdx = selectedSession ? mySessions.findIndex(s => s._id === selectedSession._id) : -1;
  function prevSession() {
    if (sessIdx > 0) selectedSessionId = mySessions[sessIdx - 1]._id;
  }
  function nextSession() {
    if (sessIdx >= 0 && sessIdx < mySessions.length - 1) selectedSessionId = mySessions[sessIdx + 1]._id;
  }

  // ── Animal stepper (walks ALL animals by track_id, ignoring list filters) ──
  $: animalOrder = [...$animals].sort((a, b) =>
    (a.track_id || a._id).localeCompare(b.track_id || b._id));
  $: animalIdx = animal ? animalOrder.findIndex(a => a._id === animal._id) : -1;
  function prevAnimal() {
    if (animalIdx > 0) goto(`/animals/${animalOrder[animalIdx - 1]._id}`);
  }
  function nextAnimal() {
    if (animalIdx >= 0 && animalIdx < animalOrder.length - 1)
      goto(`/animals/${animalOrder[animalIdx + 1]._id}`);
  }

  function metricDisplay(val) {
    if (val == null || val === '' || isNaN(val)) return '—';
    return typeof val === 'number' ? val.toFixed(3) : val;
  }
</script>

<div class="page-header">
  <div>
    <h1>🐭 {animal ? (animal.track_id || animal._id) : 'Animal not found'}</h1>
    {#if animal}
      <div class="sub">
        {aim ? `${aim.label}: ${aim.title}` : ''}
        {animal.current_stage ? ` · Stage: ${animal.current_stage}` : ''}
      </div>
    {/if}
  </div>
  <div class="header-actions">
    {#if animal && animalOrder.length > 1}
      <div style="display:flex;align-items:center;gap:4px;margin-right:8px">
        <button class="btn btn-secondary btn-sm" on:click={prevAnimal} disabled={animalIdx <= 0} title="Previous animal">←</button>
        <span class="text-xs text-muted" style="min-width:54px;text-align:center">{animalIdx + 1} / {animalOrder.length}</span>
        <button class="btn btn-secondary btn-sm" on:click={nextAnimal} disabled={animalIdx >= animalOrder.length - 1} title="Next animal">→</button>
      </div>
    {/if}
    <button class="btn btn-secondary" on:click={() => goto('/animals')}>← All animals</button>
  </div>
</div>

<div class="content">
  {#if !animal}
    <div class="empty-state"><div class="icon">❓</div>No animal with id <code>{animalIdParam}</code> in this project.</div>
  {:else}
    <!-- Summary + trajectory -->
    <div class="card" style="margin-bottom:16px;border-top:3px solid {aim?.color || 'var(--border)'}">
      <div style="display:flex;flex-wrap:wrap;gap:24px">
        <div>
          <div class="text-xs text-muted">Lab ID</div>
          <div class="bold">{animal.lab_id || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted">Sex</div>
          <div class="bold">{animal.sex || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted">Cage</div>
          <div class="bold">{animal.cage || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted">Strain</div>
          <div class="bold">{animal.strain || '—'}</div>
        </div>
        <div>
          <div class="text-xs text-muted">Sessions</div>
          <div class="bold">{mySessions.length}</div>
        </div>
      </div>

      {#if stages.length}
        <div class="traj-row" style="margin-top:14px">
          {#each stages as s, i}
            <span class="traj-stage {trajClass(animal.current_stage, i)} type-{s.type}" title={s.label}>{s.short}</span>
            {#if i < stages.length - 1}<span class="traj-arrow">›</span>{/if}
          {/each}
        </div>
      {/if}

      {#if animal.notes}
        <div class="text-sm text-muted" style="margin-top:12px">{animal.notes}</div>
      {/if}
    </div>

    {#if mySessions.length === 0}
      <div class="empty-state"><div class="icon">📊</div>No behavioural sessions recorded for this animal yet.</div>
    {:else}
      <!-- Curriculum strip -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-title" style="margin-bottom:8px">🗓 Curriculum</div>
        <CurriculumStrip sessions={mySessions} width={720} bind:hoveredDate />
      </div>

      <!-- Metric trajectory -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-title" style="margin-bottom:8px">📈 Performance over time</div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">
          {#each ALL_METRICS as m}
            <button class="metric-chip" class:active={selectedMetricKeys.includes(m.key)}
              style="{selectedMetricKeys.includes(m.key) ? `background:${m.color};border-color:${m.color};color:#fff` : ''}"
              on:click={() => toggleMetric(m.key)}>{m.label}</button>
          {/each}
        </div>
        <LineChart data={chartData} series={selectedSeries}
          title="{animal.track_id || animal._id}" {refLines} stageBands={true} distLines={true} />
      </div>

      <!-- Per-session plots -->
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title">🔔 Session plots</div>
          <div style="display:flex;align-items:center;gap:6px">
            <button class="btn btn-secondary btn-sm" on:click={prevSession}
              disabled={sessIdx <= 0} title="Previous session">←</button>
            <select bind:value={selectedSessionId}
              style="padding:6px 10px;border-radius:var(--r);border:1.5px solid var(--border);font-size:.82rem">
              {#each [...mySessions].reverse() as s}
                <option value={s._id}>{s.date} · {s.stage || '—'}</option>
              {/each}
            </select>
            <button class="btn btn-secondary btn-sm" on:click={nextSession}
              disabled={sessIdx < 0 || sessIdx >= mySessions.length - 1} title="Next session">→</button>
          </div>
        </div>
        {#if selectedSession}
          {@const m = selectedSession.metrics || {}}
          {@const isCont = selectedSession.stage === 'Full_Task_Cont'}
          <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:6px">
            <span style="font-weight:700;font-size:.95rem">{animal.track_id || animal._id}</span>
            <span class="text-muted">·</span>
            <span style="font-weight:600">{selectedSession.date}</span>
            <span class="sess-tag" style="background:#eef2ff;color:#3730a3">#{sessIdx + 1}</span>
            {#if selectedSession.stage}
              <span class="sess-tag" style="background:#f1f5f9;color:#334155">{selectedSession.stage.replace(/_/g,' ')}</span>
            {/if}
            {#if isCont && m.distribution}
              <span class="sess-tag" style="background:#fef3c7;color:#92400e">{m.distribution}</span>
            {/if}
            {#if m.is_masking}
              <span class="sess-tag" style="background:#dbeafe;color:#1e40af">◆ masking</span>
            {:else if m.is_opto}
              <span class="sess-tag" style="background:#fee2e2;color:#b91c1c">● opto{m.opto_frac ? ` ${(m.opto_frac*100).toFixed(0)}%` : ''}</span>
            {/if}
          </div>
          <div class="text-xs text-muted" style="margin-bottom:10px">
            {sessIdx + 1} of {mySessions.length} ·
            n trials = {m.n_trials_valid ?? m.n_trials_total ?? '—'}
            · single session (noisy for low trial counts)
          </div>
          <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start">
            <PsychometricPlot stats={selectedSession.metrics} width={360} height={280} />
            <UpdateMatrix stats={selectedSession.metrics} size={300} />
          </div>
        {/if}
      </div>

      <!-- Session history table with flags -->
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border)" class="bold">Session history</div>
        <div class="table-wrap" style="border:none;border-radius:0">
          <table>
            <thead>
              <tr><th></th><th>Date</th><th>Stage</th><th>Trials</th><th>Accuracy</th><th>Side bias</th><th>Abort</th><th>Flags</th></tr>
            </thead>
            <tbody>
              {#each [...mySessions].reverse() as s}
                {@const flags = flagSession(s.metrics)}
                {@const lvl = worstLevel(flags)}
                <tr class="clickable" on:click={() => selectedSessionId = s._id}
                    style="{selectedSessionId === s._id ? 'background:#eef4ff' : ''}">
                  <td style="width:8px;padding-left:10px">
                    {#if lvl}<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:{levelColour(lvl)}"></span>{/if}
                  </td>
                  <td><code style="font-size:.76rem">{s.date}</code></td>
                  <td class="text-xs">{s.stage || '—'}</td>
                  <td>{s.metrics?.n_trials_valid ?? s.metrics?.n_trials_total ?? '—'}</td>
                  <td style="font-weight:600;color:{(s.metrics?.accuracy||0) >= 0.7 ? 'var(--success)' : (s.metrics?.accuracy||0) >= 0.5 ? 'var(--warn)' : 'var(--danger)'}">{metricDisplay(s.metrics?.accuracy)}</td>
                  <td>{metricDisplay(s.metrics?.side_bias)}</td>
                  <td>{metricDisplay(s.metrics?.abort_rate)}</td>
                  <td class="text-xs">
                    {#each flags as fl}
                      <span style="display:inline-block;padding:1px 6px;border-radius:8px;margin:1px;background:{levelColour(fl.level)}22;color:{levelColour(fl.level)};font-weight:600">{fl.msg}</span>
                    {/each}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      {#if myTransitions.length}
        <div class="card" style="margin-top:16px">
          <div class="card-title" style="margin-bottom:8px">🔀 Stage transitions</div>
          {#each myTransitions as t}
            <div class="text-sm" style="padding:4px 0;border-bottom:1px solid var(--border)">
              <code class="text-xs">{t.date}</code>
              &nbsp;{t.stage_from || '—'} → <strong>{t.stage_to}</strong>
              {#if t.notes}<span class="text-xs text-muted"> · {t.notes}</span>{/if}
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  .metric-chip {
    display: inline-flex; padding: 3px 10px; border-radius: 12px;
    border: 1.5px solid var(--border); background: var(--surface);
    font-size: .74rem; font-weight: 600; cursor: pointer; transition: all .12s;
    color: var(--text);
  }
  .metric-chip:hover { border-color: var(--accent); }
  .metric-chip.active { color: #fff; }
  .sess-tag {
    display: inline-flex; align-items: center; padding: 2px 9px;
    border-radius: 11px; font-size: .74rem; font-weight: 600;
  }
</style>
