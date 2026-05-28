<script>
  export let data = [];       // [{ date, stage?, ...metrics }]
  export let series = [];     // [{ key, color, label }]
  export let xKey = 'date';
  export let title = '';
  export let yMin = null;
  export let yMax = null;
  export let height = 300;
  export let refLines = [];   // [{ value, color, label }]
  export let stageBands = false;  // if true, shade background by 'stage' field
  export let stageKey = 'stage';
  export let distLines = false;    // if true, draw vertical lines where 'distribution' changes
  export let distKey = 'distribution';

  const W = 800, pad = { t: 30, r: 20, b: 60, l: 55 };
  const plotW = W - pad.l - pad.r;
  $: plotH = height - pad.t - pad.b;

  let tooltip = null;

  $: xLabels = [...new Set(data.map(d => d[xKey]))].sort();
  $: xScale = (i) => pad.l + (i / Math.max(xLabels.length - 1, 1)) * plotW;
  $: halfStep = xLabels.length > 1 ? (plotW / (xLabels.length - 1)) / 2 : plotW / 2;

  $: allValues = data.flatMap(d => series.map(s => d[s.key])).filter(v => v != null && !isNaN(v));
  $: computedMin = yMin != null ? yMin : allValues.length ? Math.min(...allValues) * 0.95 : 0;
  $: computedMax = yMax != null ? yMax : allValues.length ? Math.max(...allValues) * 1.05 : 1;
  $: yRange = computedMax - computedMin || 1;
  $: yScale = (v) => pad.t + plotH - ((v - computedMin) / yRange) * plotH;

  $: yTicks = (() => {
    const n = 5;
    const step = yRange / n;
    return Array.from({ length: n + 1 }, (_, i) => computedMin + i * step);
  })();

  $: xTickInterval = Math.max(1, Math.ceil(xLabels.length / 14));

  // Stage bands: group consecutive dates with same stage
  const STAGE_COLORS = {
    'Full_Task_Disc':  { 2: '#dbeafe', 4: '#dcfce7', 6: '#fef9c3', 8: '#fecaca' },
    'Full_Task_Cont':  '#f5f5f5',
    'Habituation':     '#e5e7eb',
    'Lick_To_Release': '#e5e7eb',
  };

  function getStageColor(stage, nbStim) {
    if (!stage) return null;
    if (stage === 'Full_Task_Disc' && nbStim) {
      return STAGE_COLORS['Full_Task_Disc']?.[nbStim] || '#dbeafe';
    }
    return STAGE_COLORS[stage] || '#f5f5f5';
  }

  $: bands = (() => {
    if (!stageBands || xLabels.length === 0) return [];
    const result = [];
    let startIdx = 0;
    for (let i = 1; i <= xLabels.length; i++) {
      const prevRow = data.find(d => d[xKey] === xLabels[i - 1]);
      const currRow = i < xLabels.length ? data.find(d => d[xKey] === xLabels[i]) : null;
      const prevStage = prevRow?.[stageKey];
      const currStage = currRow?.[stageKey];
      if (i === xLabels.length || currStage !== prevStage) {
        const color = getStageColor(prevStage, prevRow?.nb_stim || prevRow?.Nb_Of_Stim);
        if (color) {
          result.push({
            x: xScale(startIdx) - halfStep,
            width: xScale(i - 1) - xScale(startIdx) + halfStep * 2,
            color,
            stage: prevStage || '?',
          });
        }
        startIdx = i;
      }
    }
    return result;
  })();

  // Distribution-change markers: vertical line where 'distribution' changes
  // between consecutive sessions. Only meaningful within Full_Task_Cont, so
  // we ignore rows whose distribution is empty/unknown.
  const DIST_COLORS = { 'Uniform': '#3b82f6', 'Hard-A': '#f59e0b', 'Hard-B': '#ef4444' };
  $: distMarkers = (() => {
    if (!distLines || xLabels.length === 0) return [];
    const out = [];
    let prevDist = null;
    for (let i = 0; i < xLabels.length; i++) {
      const row = data.find(d => d[xKey] === xLabels[i]);
      const stage = row?.[stageKey];
      // Only consider distribution within Full_Task_Cont; treat others as null.
      const dist = (stage === 'Full_Task_Cont') ? (row?.[distKey] || null) : null;
      if (dist && dist !== prevDist) {
        out.push({ x: xScale(i), dist, color: DIST_COLORS[dist] || '#6b7280' });
      }
      prevDist = dist;
    }
    return out;
  })();

  $: paths = series.map(s => {
    const points = xLabels.map((label, i) => {
      const row = data.find(d => d[xKey] === label && d[s.key] != null && !isNaN(d[s.key]));
      if (!row) return null;
      return { x: xScale(i), y: yScale(row[s.key]), val: row[s.key], label };
    }).filter(Boolean);
    return { ...s, points };
  });

  function showTooltip(point, seriesLabel) {
    tooltip = { x: point.x, y: point.y, text: `${seriesLabel}: ${point.val.toFixed(3)}`, date: point.label };
  }
</script>

<div style="overflow-x:auto;margin-bottom:16px">
  <svg viewBox="0 0 {W} {height}" style="width:100%;max-width:{W}px;height:auto;font-family:-apple-system,sans-serif"
    on:mouseleave={() => tooltip = null}>

    {#if title}
      <text x={W/2} y={16} text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">{title}</text>
    {/if}

    <!-- Stage bands -->
    {#each bands as band}
      <rect x={Math.max(pad.l, band.x)} y={pad.t}
        width={Math.min(band.x + band.width, W - pad.r) - Math.max(pad.l, band.x)}
        height={plotH} fill={band.color} opacity="0.5" />
    {/each}

    <!-- Distribution-change markers -->
    {#each distMarkers as dm}
      <line x1={dm.x} x2={dm.x} y1={pad.t} y2={pad.t + plotH}
        stroke={dm.color} stroke-width="1.5" stroke-dasharray="2,2" opacity="0.8" />
      <text x={dm.x + 3} y={pad.t + 10} font-size="8.5" font-weight="600" fill={dm.color}>{dm.dist}</text>
    {/each}

    <!-- Grid -->
    {#each yTicks as tick}
      <line x1={pad.l} x2={W - pad.r} y1={yScale(tick)} y2={yScale(tick)} stroke="#d1d5db" stroke-width="0.5" />
      <text x={pad.l - 8} y={yScale(tick) + 4} text-anchor="end" font-size="10" fill="var(--muted)">{tick.toFixed(2)}</text>
    {/each}

    <!-- Reference lines -->
    {#each refLines as ref}
      <line x1={pad.l} x2={W - pad.r} y1={yScale(ref.value)} y2={yScale(ref.value)}
        stroke={ref.color || '#888'} stroke-width="1" stroke-dasharray="4,3" />
      {#if ref.label}
        <text x={W - pad.r + 4} y={yScale(ref.value) + 3} font-size="9" fill={ref.color || '#888'}>{ref.label}</text>
      {/if}
    {/each}

    <!-- X labels -->
    {#each xLabels as label, i}
      {#if i % xTickInterval === 0}
        <text x={xScale(i)} y={height - pad.b + 16} text-anchor="middle" font-size="9" fill="var(--muted)"
          transform="rotate(-45, {xScale(i)}, {height - pad.b + 16})">{label}</text>
      {/if}
    {/each}

    <!-- Lines + dots -->
    {#each paths as s}
      {#if s.points.length > 1}
        <polyline points={s.points.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none" stroke={s.color} stroke-width="2" stroke-linejoin="round" />
      {/if}
      {#each s.points as p}
        <circle cx={p.x} cy={p.y} r="4" fill={s.color} stroke="#fff" stroke-width="1.5"
          style="cursor:pointer"
          on:mouseenter={() => showTooltip(p, s.label)} />
      {/each}
    {/each}

    <!-- Axes -->
    <line x1={pad.l} x2={pad.l} y1={pad.t} y2={pad.t + plotH} stroke="var(--border)" stroke-width="1" />
    <line x1={pad.l} x2={W - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="var(--border)" stroke-width="1" />

    <!-- Tooltip -->
    {#if tooltip}
      <g>
        <rect x={tooltip.x - 75} y={tooltip.y - 38} width="150" height="32" rx="4"
          fill="var(--nav-bg)" opacity="0.92" />
        <text x={tooltip.x} y={tooltip.y - 23} text-anchor="middle" font-size="10" fill="#dde4f0">{tooltip.date}</text>
        <text x={tooltip.x} y={tooltip.y - 10} text-anchor="middle" font-size="10" font-weight="600" fill="#fff">{tooltip.text}</text>
      </g>
    {/if}
  </svg>

  <!-- Legend -->
  <div style="display:flex;gap:14px;flex-wrap:wrap;padding:4px 0;font-size:.74rem;align-items:center">
    {#each series as s}
      <span style="display:flex;align-items:center;gap:4px">
        <span style="width:12px;height:3px;background:{s.color};border-radius:2px;display:inline-block"></span>
        {s.label}
      </span>
    {/each}
    {#if stageBands && bands.length > 0}
      <span style="color:var(--muted);margin-left:8px">|</span>
      <span style="color:var(--muted)">Shading = training stage</span>
    {/if}
    {#if distLines && distMarkers.length > 0}
      <span style="color:var(--muted);margin-left:8px">|</span>
      <span style="color:var(--muted)">Dashed line = distribution change</span>
    {/if}
  </div>
</div>
