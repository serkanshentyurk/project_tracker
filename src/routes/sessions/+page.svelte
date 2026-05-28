<script>
  import { todayStr } from '$lib/utils.js';
  import PsychometricPlot from '$lib/components/PsychometricPlot.svelte';
  import UpdateMatrix from '$lib/components/UpdateMatrix.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import PdfViewer from '$lib/components/PdfViewer.svelte';
  import { data, settings, animals, aims, currentProject, saveSession, removeSession, bulkAddSessions, toast, uid } from '$lib/stores.js';

  let animalFilter = '';
  let scanning = false;
  let scanResult = null;
  let expandedId = null;
  let modalOpen = false;
  let f = {};

  // PDF viewer state
  let pdfOpen = false, pdfUrl = '', pdfTitle = '';

  // Multi-metric selection
  let selectedMetricKeys = ['accuracy', 'abort_rate'];

  // Backward compat: PG stores scan paths in scan_roots, old code used processed_data_dir
  $: dataDir = $settings.processed_data_dir || $settings.scan_roots?.[0]?.path || '';
  $: sessionData = ((() => {
    const d = $data;
    if (!d) return [];
    const proj = d.projects?.find(p => p._id === d.currentProject);
    return proj?.session_data || [];
  })());

  $: animalIds = [...new Set(sessionData.map(s => s.animal_id))].sort();
  $: if (!animalFilter && animalIds.length > 0) animalFilter = animalIds[0];
  $: filtered = animalFilter === 'all' ? sessionData : sessionData.filter(s => s.animal_id === animalFilter);
  $: grouped = (() => {
    const map = {};
    filtered.forEach(s => {
      if (!map[s.animal_id]) map[s.animal_id] = [];
      map[s.animal_id].push(s);
    });
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.date || '').localeCompare(b.date || '')));
    return map;
  })();

  const ALL_METRICS = [
    { key: 'accuracy', label: 'Accuracy', color: '#3b82f6' },
    { key: 'abort_rate', label: 'Abort Rate', color: '#f59e0b' },
    { key: 'side_bias', label: 'Side Bias', color: '#ef4444' },
    { key: 'pse', label: 'PSE (μ)', color: '#22c55e' },
    { key: 'slope', label: 'Slope (σ)', color: '#a855f7' },
    { key: 'lapse_low', label: 'Lapse Low (γ)', color: '#ec4899' },
    { key: 'lapse_high', label: 'Lapse High (λ)', color: '#14b8a6' },
    { key: 'recency', label: 'Recency Index', color: '#8b5cf6' },
    { key: 'win_stay', label: 'Win-Stay', color: '#0ea5e9' },
    { key: 'lose_shift', label: 'Lose-Shift', color: '#f97316' },
    { key: 'stimulus_sensitivity', label: 'Stimulus Sensitivity', color: '#6366f1' },
    { key: 'choice_autocorr', label: 'Choice Autocorr', color: '#84cc16' },
    { key: 'hard_easy_ratio', label: 'Hard/Easy Ratio', color: '#d946ef' },
    { key: 'n_trials_valid', label: 'Valid Trials', color: '#64748b' },
    { key: 'w_stimulus', label: 'W: Stimulus', color: '#0d9488' },
    { key: 'w_prev_choice_1', label: 'W: Prev Choice₁', color: '#7c3aed' },
    { key: 'history_decay', label: 'History Decay', color: '#be123c' },
  ];

  function toggleMetric(key) {
    if (selectedMetricKeys.includes(key)) {
      if (selectedMetricKeys.length > 1) {
        selectedMetricKeys = selectedMetricKeys.filter(k => k !== key);
      }
    } else {
      selectedMetricKeys = [...selectedMetricKeys, key];
    }
  }

  $: selectedSeries = selectedMetricKeys.map(k => ALL_METRICS.find(m => m.key === k)).filter(Boolean);

  // Chart data for single-animal view
  $: chartDataSingle = filtered.map(s => ({
    date: s.date,
    stage: s.stage,
    nb_stim: s.metrics?.nb_stim || s.metrics?.Nb_Of_Stim,
    ...s.metrics,
  })).sort((a, b) => a.date.localeCompare(b.date));

  // For all-animals view: separate series per animal per metric
  $: isMultiAnimal = animalFilter === 'all';
  $: chartAnimals = [...new Set(filtered.map(s => s.animal_id))].sort();

  $: multiSeries = isMultiAnimal
    ? chartAnimals.flatMap((aid, ai) => {
        const colors = ['#3b82f6','#f59e0b','#22c55e','#a855f7','#ef4444','#0ea5e9','#ec4899','#84cc16'];
        return selectedMetricKeys.map((mk, mi) => ({
          key: `${mk}_${aid}`,
          color: colors[ai % colors.length],
          label: `${aid} · ${ALL_METRICS.find(m=>m.key===mk)?.label || mk}`,
        }));
      })
    : selectedSeries;

  $: multiData = isMultiAnimal
    ? (() => {
        const dateMap = {};
        filtered.forEach(s => {
          if (!dateMap[s.date]) dateMap[s.date] = { date: s.date, stage: s.stage };
          selectedMetricKeys.forEach(mk => {
            dateMap[s.date][`${mk}_${s.animal_id}`] = s.metrics?.[mk];
          });
        });
        return Object.values(dateMap).sort((a,b) => a.date.localeCompare(b.date));
      })()
    : chartDataSingle;

  // Reference lines
  $: refLines = (() => {
    const lines = [];
    if (selectedMetricKeys.includes('accuracy')) lines.push({ value: 0.5, color: '#888', label: 'chance' });
    if (selectedMetricKeys.includes('recency')) {
      lines.push({ value: 0.3, color: '#ef4444', label: 'high η' });
      lines.push({ value: 0.1, color: '#22c55e', label: 'low η' });
    }
    if (selectedMetricKeys.includes('side_bias')) lines.push({ value: 0, color: '#888', label: 'no bias' });
    return lines;
  })();

  // Scan — now uses bulkAddSessions
  async function scanFolder() {
    if (!dataDir) { toast('Set Processed data directory in Settings first', 'error'); return; }
    scanning = true;
    scanResult = null;
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataDir: dataDir, projectId: $currentProject?._id }),
      });
      const result = await res.json();
      if (!result.ok) { toast(result.error || 'Scan failed', 'error'); scanning = false; return; }
      const added = await bulkAddSessions(result.sessions);   // ← per-entity bulk
      scanResult = { found: result.sessions.length, added, errors: result.errors };
      toast(`Scan complete: ${added} new sessions added`);
    } catch (e) {
      toast('Scan failed: ' + e.message, 'error');
    }
    scanning = false;
  }

  function openPdf(session, pdfName, type) {
    pdfUrl = `/api/pdf?dataDir=${encodeURIComponent(dataDir)}&folder=${encodeURIComponent(session.folder)}&file=${encodeURIComponent(pdfName)}`;
    pdfTitle = `${type} — ${session.animal_id} ${session.date}`;
    pdfOpen = true;
  }

  // Manual add — now uses saveSession
  function openModal() {
    f = { _id: '', animal_id: '', date: todayStr(), stage: '', distribution: '', metrics: {},
      n_trials: '', accuracy: '', notes: '' };
    modalOpen = true;
  }

  function saveManual() {
    if (!f.animal_id || !f.date) { toast('Animal and date required', 'error'); return; }
    const entry = {
      _id: f._id || uid(),
      animal_id: f.animal_id, date: f.date, stage: f.stage, distribution: f.distribution,
      folder: null, pdfs: [],
      metrics: {
        n_trials_total: parseFloat(f.n_trials) || null,
        accuracy: parseFloat(f.accuracy) || null,
        stage: f.stage, animal_id: f.animal_id, date: f.date,
      },
      source: 'manual', notes: f.notes,
    };
    saveSession(entry);                                        // ← per-entity
    modalOpen = false;
    toast('Session added');
  }

  function deleteSession(id) {
    if (!confirm('Delete this session entry?')) return;
    removeSession(id);                                         // ← per-entity
    toast('Deleted', 'error');
  }

  function metricDisplay(val) {
    if (val == null || val === '' || isNaN(val)) return '—';
    return typeof val === 'number' ? val.toFixed(3) : val;
  }

  const PDF_LABELS = {
    performance: '📈 Performance',
    psychometric: '🔔 Psychometric',
    shift_profile: '📐 Shift Profile',
    other: '📄 PDF',
  };
</script>

<div class="page-header">
  <div><h1>📊 Sessions</h1><div class="sub">Daily session data from processed folder. Scan or add manually.</div></div>
  <div class="header-actions">
    <button class="btn btn-primary" on:click={scanFolder} disabled={scanning}>
      {scanning ? 'Scanning…' : '🔍 Scan folder'}
    </button>
    <button class="btn btn-secondary" on:click={openModal}>+ Manual entry</button>
  </div>
</div>

<div class="content">
  <div class="stats-row">
    <div class="stat-box"><div class="val">{sessionData.length}</div><div class="lbl">Sessions</div></div>
    <div class="stat-box"><div class="val">{animalIds.length}</div><div class="lbl">Animals</div></div>
    <div class="stat-box"><div class="val">{sessionData.length ? [...sessionData].sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]?.date : '—'}</div><div class="lbl">Latest</div></div>
  </div>

  {#if scanResult}
    <div class="card" style="margin-bottom:14px;padding:10px 14px;background:#f0f9ff;border-color:#bae6fd">
      <span class="text-sm"><strong>{scanResult.found}</strong> sessions found, <strong>{scanResult.added}</strong> new added.</span>
      {#if scanResult.errors.length > 0}
        <div class="text-xs text-muted mt-3">{scanResult.errors.length} errors: {scanResult.errors.slice(0,3).join('; ')}</div>
      {/if}
    </div>
  {/if}

  {#if !dataDir}
    <div class="card" style="margin-bottom:14px;background:#fffbeb;border-color:#fde68a">
      <p class="text-sm">⚠ Set <strong>Processed data directory</strong> in <a href="/settings">Settings</a> to enable scanning.</p>
    </div>
  {/if}

  <!-- Animal selector -->
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">
    <span class="text-muted text-sm">Animal:</span>
    <select bind:value={animalFilter} style="padding:6px 10px;border-radius:var(--r);border:1.5px solid var(--border);font-size:.85rem;min-width:140px">
      <option value="all">All animals</option>
      {#each animalIds as aid}
        <option value={aid}>{aid}</option>
      {/each}
    </select>
    <span class="text-xs text-muted">{filtered.length} sessions</span>
  </div>

  <!-- Charts -->
  {#if filtered.length > 0}
    <div class="card" style="margin-bottom:16px">
      <div class="card-title" style="margin-bottom:8px">📈 Metric Trajectory</div>

      <!-- Metric selector chips -->
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">
        {#each ALL_METRICS as m}
          <button
            class="metric-chip"
            class:active={selectedMetricKeys.includes(m.key)}
            style="{selectedMetricKeys.includes(m.key) ? `background:${m.color};border-color:${m.color};color:#fff` : ''}"
            on:click={() => toggleMetric(m.key)}>
            {m.label}
          </button>
        {/each}
      </div>

      <LineChart
        data={multiData}
        series={isMultiAnimal ? multiSeries : selectedSeries}
        title="{animalFilter === 'all' ? 'All animals' : animalFilter} — {selectedMetricKeys.map(k => ALL_METRICS.find(m=>m.key===k)?.label).join(', ')}"
        {refLines}
        stageBands={!isMultiAnimal}
      />
    </div>
  {/if}

  <!-- Per-animal tables -->
  {#if Object.keys(grouped).length === 0}
    <div class="empty-state"><div class="icon">📊</div>No sessions yet. Click <strong>Scan folder</strong> or <strong>Manual entry</strong>.</div>
  {:else}
    {#each Object.entries(grouped) as [animalId, sessions]}
      {@const aim = $animals.find(a => a.track_id === animalId || a._id === animalId)}
      {@const aimColor = aim ? ($aims[aim.aim]?.color || 'var(--border)') : 'var(--border)'}
      <div class="card" style="padding:0;overflow:hidden;border-top:3px solid {aimColor};margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)">
          <span class="bold">{animalId}</span>
          <span class="text-xs text-muted">{sessions.length} sessions</span>
        </div>
        <div class="table-wrap" style="border:none;border-radius:0">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Stage</th><th>Dist.</th><th>Trials</th>
                <th>Accuracy</th><th>PSE</th><th>Slope</th><th>Recency</th>
                <th>Abort</th><th></th>
              </tr>
            </thead>
            <tbody>
              {#each sessions as s}
                <tr class="clickable" on:click={() => expandedId = expandedId === s._id ? null : s._id}>
                  <td><code style="font-size:.76rem">{s.date}</code></td>
                  <td class="text-xs">{s.stage || '—'}</td>
                  <td class="text-xs">{s.distribution || '—'}</td>
                  <td>{s.metrics?.n_trials_valid ?? s.metrics?.n_trials_total ?? '—'}</td>
                  <td style="font-weight:600;color:{(s.metrics?.accuracy||0) >= 0.7 ? 'var(--success)' : (s.metrics?.accuracy||0) >= 0.5 ? 'var(--warn)' : 'var(--danger)'}">{metricDisplay(s.metrics?.accuracy)}</td>
                  <td>{metricDisplay(s.metrics?.pse)}</td>
                  <td>{metricDisplay(s.metrics?.slope)}</td>
                  <td>{metricDisplay(s.metrics?.recency)}</td>
                  <td>{metricDisplay(s.metrics?.abort_rate)}</td>
                  <td class="text-xs text-muted">{expandedId === s._id ? '▲' : '▼'}</td>
                </tr>
                {#if expandedId === s._id}
                  <tr>
                    <td colspan="10" style="padding:0;background:#f8f9fb">
                      <div style="padding:14px 16px">
                        <!-- All numeric metrics -->
                         <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start;margin-bottom:14px">
                          <PsychometricPlot stats={s.metrics} width={340} height={260} />
                          <UpdateMatrix stats={s.metrics} size={280} />
                        </div>
                        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px;margin-bottom:12px">
                          {#each Object.entries(s.metrics || {}).filter(([k,v]) => typeof v === 'number') as [key, val]}
                            <div style="font-size:.78rem">
                              <span class="text-muted">{key}:</span> <strong>{val.toFixed(4)}</strong>
                            </div>
                          {/each}
                        </div>

                        <!-- PDF buttons → modal viewer -->
                        {#if s.pdfs?.length && s.folder}
                          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
                            {#each s.pdfs as pdf}
                              <button class="btn btn-secondary btn-sm"
                                on:click|stopPropagation={() => openPdf(s, pdf.name, pdf.type)}>
                                {PDF_LABELS[pdf.type] || pdf.name}
                              </button>
                            {/each}
                          </div>
                        {/if}

                        {#if s.notes}<div class="text-xs text-muted" style="margin-bottom:8px">{s.notes}</div>{/if}
                        <button class="btn btn-danger btn-sm" on:click|stopPropagation={() => deleteSession(s._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                {/if}
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/each}
  {/if}
</div>

<!-- PDF modal viewer -->
<PdfViewer bind:open={pdfOpen} url={pdfUrl} title={pdfTitle} />

<!-- Manual entry modal -->
{#if modalOpen}
<div class="modal-backdrop open" on:click|self={() => modalOpen=false}>
  <div class="modal" style="max-width:520px">
    <div class="modal-header"><h2>Manual Session Entry</h2><button class="modal-close" on:click={() => modalOpen=false}>×</button></div>
    <div class="modal-body">
      <div class="form-grid" style="margin-bottom:14px">
        <div class="form-group"><label>Animal ID *</label>
          <select bind:value={f.animal_id}>
            <option value="">— select —</option>
            {#each $animals as a}<option value={a.track_id || a._id}>{a.track_id || a._id}</option>{/each}
          </select>
        </div>
        <div class="form-group"><label>Date *</label><input type="date" bind:value={f.date}></div>
        <div class="form-group"><label>Stage</label><input bind:value={f.stage} placeholder="e.g. Full_Task_Cont"></div>
        <div class="form-group"><label>Distribution</label><input bind:value={f.distribution} placeholder="e.g. Uniform"></div>
        <div class="form-group"><label>Total trials</label><input type="number" bind:value={f.n_trials}></div>
        <div class="form-group"><label>Accuracy (0–1)</label><input type="number" step="0.01" bind:value={f.accuracy}></div>
      </div>
      <div class="form-group"><label>Notes</label><textarea bind:value={f.notes} rows="2"></textarea></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" on:click={() => modalOpen=false}>Cancel</button>
      <button class="btn btn-primary" on:click={saveManual}>Save</button>
    </div>
  </div>
</div>
{/if}

<style>
  .metric-chip {
    display: inline-flex; padding: 3px 10px; border-radius: 12px;
    border: 1.5px solid var(--border); background: var(--surface);
    font-size: .74rem; font-weight: 600; cursor: pointer; transition: all .12s;
    color: var(--text);
  }
  .metric-chip:hover { border-color: var(--accent); }
  .metric-chip.active { color: #fff; }
</style>
