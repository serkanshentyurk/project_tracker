<script>
  /**
   * Curriculum strip: stage + distribution + session-type over time,
   * on a date x-axis. Designed to sit directly above a performance chart
   * sharing the same x-domain, with linked hover.
   *
   * Props:
   *   sessions: date-sorted array of session objects
   *             (each: { date, stage, metrics: { distribution, is_opto, is_masking } })
   *   width:    px
   *   hoveredDate (bindable): the date string currently hovered, shared
   *             with a sibling chart for linked highlighting.
   *
   * Emits hover via bind:hoveredDate. The parent passes the same variable
   * to the performance chart so both highlight the same session.
   */
  export let sessions = [];
  export let width = 720;
  export let hoveredDate = null;

  const ROW_H = 22;
  const GAP = 4;
  const PAD = { left: 90, right: 14, top: 6, bottom: 22 };

  // Colour maps. Anything not listed → grey (unknown/error/contamination).
  const STAGE_COLOURS = {
    'Habituation':     '#94a3b8',
    'Lick_To_Release': '#60a5fa',
    'Three_And_Three': '#a78bfa',
    'Full_Task_Disc':  '#34d399',
    'Full_Task_Cont':  '#10b981',
  };
  const DIST_COLOURS = {
    'Uniform': '#3b82f6',
    'Hard-A':  '#f59e0b',
    'Hard-B':  '#ef4444',
  };
  const GREY = '#d1d5db';

  function stageColour(s) { return STAGE_COLOURS[s] || GREY; }
  function distColour(d)  { return DIST_COLOURS[d]  || GREY; }

  // Date domain
  $: dates = sessions.map(s => s.date).filter(Boolean);
  $: t0 = dates.length ? +new Date(dates[0]) : 0;
  $: t1 = dates.length ? +new Date(dates[dates.length - 1]) : 1;
  $: span = Math.max(1, t1 - t0);

  $: plotW = width - PAD.left - PAD.right;

  // xOf: used directly in the template's {#each} blocks (markers, hover,
  // ticks). Those re-render with `sessions`, reading current t0/span here.
  function xOf(dateStr) {
    return PAD.left + ((+new Date(dateStr) - t0) / span) * plotW;
  }

  // xScale: the SAME mapping, but built in a reactive statement so the
  // segment computations (which can't expose their xOf-closure dependency
  // to Svelte) re-run when the domain changes. See segments() below.
  $: xScale = makeXScale(t0, span, plotW);
  function makeXScale(t0, span, plotW) {
    return (dateStr) => PAD.left + ((+new Date(dateStr) - t0) / span) * plotW;
  }

  // Build contiguous segments for a row: merge consecutive sessions sharing
  // the same value. Returns [{ value, startDate, endDate, x, w }].
  // `sess` and `xfn` are passed explicitly so Svelte tracks them as
  // dependencies — it cannot see values read inside the function body.
  function segments(sess, xfn, valueFn) {
    const segs = [];
    for (let i = 0; i < sess.length; i++) {
      const v = valueFn(sess[i]);
      const d = sess[i].date;
      const prev = segs[segs.length - 1];
      if (prev && prev.value === v) {
        prev.endDate = d;
      } else {
        segs.push({ value: v, startDate: d, endDate: d });
      }
    }
    return segs.map((s, i) => {
      const x = xfn(s.startDate);
      const next = segs[i + 1];
      const xEnd = next ? xfn(next.startDate) : xfn(s.endDate) + Math.max(4, plotW / Math.max(sess.length, 1));
      return { ...s, x, w: Math.max(3, xEnd - x) };
    });
  }

  $: stageSegs = segments(sessions, xScale, s => s.stage || '');
  // Distribution only meaningful in Full_Task_Cont — grey elsewhere.
  $: distSegs = segments(sessions, xScale, s =>
    (s.stage === 'Full_Task_Cont') ? (s.metrics?.distribution || '') : '__na__'
  );

  // Session-type markers (one per session): opto / masking / normal
  function sessType(s) {
    if (s.metrics?.is_masking) return 'masking';
    if (s.metrics?.is_opto)    return 'opto';
    return 'normal';
  }

  // Rows: y positions
  const Y_STAGE = PAD.top;
  const Y_DIST  = PAD.top + ROW_H + GAP;
  const Y_MARK  = PAD.top + 2 * (ROW_H + GAP);
  $: totalH = Y_MARK + 16 + PAD.bottom;

  // X-axis date ticks: first, last, and a few in between
  $: dateTicks = (() => {
    if (dates.length <= 1) return dates;
    const n = Math.min(6, dates.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.round(i * (dates.length - 1) / (n - 1));
      out.push(dates[idx]);
    }
    return [...new Set(out)];
  })();

  function fmtDate(d) {
    const dt = new Date(d);
    return `${dt.getMonth() + 1}/${dt.getDate()}`;
  }
</script>

{#if sessions.length === 0}
  <div class="empty">No sessions to chart.</div>
{:else}
  <svg {width} height={totalH} viewBox="0 0 {width} {totalH}"
       style="font-family: system-ui, -apple-system, sans-serif"
       on:mouseleave={() => hoveredDate = null}>

    <!-- Row labels -->
    <text x={PAD.left - 8} y={Y_STAGE + ROW_H / 2 + 3} text-anchor="end" font-size="10" fill="#444">Stage</text>
    <text x={PAD.left - 8} y={Y_DIST + ROW_H / 2 + 3} text-anchor="end" font-size="10" fill="#444">Distribution</text>
    <text x={PAD.left - 8} y={Y_MARK + 8} text-anchor="end" font-size="10" fill="#444">Session</text>

    <!-- Stage segments -->
    {#each stageSegs as seg}
      <rect x={seg.x} y={Y_STAGE} width={seg.w} height={ROW_H}
            fill={stageColour(seg.value)} stroke="#fff" stroke-width="0.5">
        <title>{`${seg.value || 'unlabelled'}: ${seg.startDate} → ${seg.endDate}`}</title>
      </rect>
      {#if seg.w > 46}
        <text x={seg.x + 4} y={Y_STAGE + ROW_H / 2 + 3} font-size="8.5" fill="#fff" style="pointer-events:none">
          {seg.value.replace(/_/g, ' ').slice(0, Math.floor(seg.w / 6))}
        </text>
      {/if}
    {/each}

    <!-- Distribution segments -->
    {#each distSegs as seg}
      <rect x={seg.x} y={Y_DIST} width={seg.w} height={ROW_H}
            fill={seg.value === '__na__' ? '#f1f5f9' : distColour(seg.value)}
            stroke="#fff" stroke-width="0.5">
        <title>{seg.value === '__na__' ? 'n/a (not Full_Task_Cont)' : `${seg.value || 'unknown'}: ${seg.startDate} → ${seg.endDate}`}</title>
      </rect>
      {#if seg.value !== '__na__' && seg.w > 36}
        <text x={seg.x + 4} y={Y_DIST + ROW_H / 2 + 3} font-size="8.5" fill="#fff" style="pointer-events:none">{seg.value}</text>
      {/if}
    {/each}

    <!-- Session-type markers -->
    {#each sessions as s}
      {@const t = sessType(s)}
      {@const cx = xOf(s.date)}
      {#if t === 'opto'}
        <circle cx={cx} cy={Y_MARK + 5} r="4" fill="#dc2626" stroke="#fff" stroke-width="1">
          <title>{`opto · ${s.date}`}</title>
        </circle>
      {:else if t === 'masking'}
        <rect x={cx - 4} y={Y_MARK + 1} width="8" height="8" fill="#2563eb" stroke="#fff" stroke-width="1" transform="rotate(45 {cx} {Y_MARK + 5})">
          <title>{`masking · ${s.date}`}</title>
        </rect>
      {:else}
        <circle cx={cx} cy={Y_MARK + 5} r="2" fill="#cbd5e1">
          <title>{`normal · ${s.date}`}</title>
        </circle>
      {/if}
    {/each}

    <!-- Hover highlight line shared with chart -->
    {#if hoveredDate}
      <line x1={xOf(hoveredDate)} x2={xOf(hoveredDate)} y1={PAD.top} y2={Y_MARK + 12}
            stroke="#111" stroke-width="1" stroke-dasharray="2,2" style="pointer-events:none" />
    {/if}

    <!-- Invisible hover catchers (one per session column) -->
    {#each sessions as s, i}
      {@const cx = xOf(s.date)}
      {@const next = sessions[i + 1]}
      {@const xEnd = next ? xOf(next.date) : cx + plotW / Math.max(sessions.length, 1)}
      <rect x={cx} y={PAD.top} width={Math.max(2, xEnd - cx)} height={Y_MARK + 12 - PAD.top}
            fill="transparent" on:mouseenter={() => hoveredDate = s.date} />
    {/each}

    <!-- X axis date ticks -->
    {#each dateTicks as d}
      <text x={xOf(d)} y={totalH - 6} text-anchor="middle" font-size="9" fill="#777">{fmtDate(d)}</text>
    {/each}
  </svg>

  <!-- Legend -->
  <div class="legend">
    {#each Object.entries(STAGE_COLOURS) as [name, col]}
      <span class="leg"><span class="sw" style="background:{col}"></span>{name.replace(/_/g,' ')}</span>
    {/each}
    <span class="sep">·</span>
    {#each Object.entries(DIST_COLOURS) as [name, col]}
      <span class="leg"><span class="sw" style="background:{col}"></span>{name}</span>
    {/each}
    <span class="sep">·</span>
    <span class="leg"><span class="dot" style="background:#dc2626"></span>opto</span>
    <span class="leg"><span class="diamond" style="background:#2563eb"></span>masking</span>
  </div>
{/if}

<style>
  .empty { padding: 14px; color: #888; font-size: 0.85rem; }
  .legend { display:flex; flex-wrap:wrap; gap:10px; margin-top:6px; font-size:.72rem; color:#555; align-items:center; }
  .leg { display:inline-flex; align-items:center; gap:4px; }
  .sw { width:11px; height:11px; border-radius:2px; display:inline-block; }
  .dot { width:9px; height:9px; border-radius:50%; display:inline-block; }
  .diamond { width:8px; height:8px; display:inline-block; transform:rotate(45deg); }
  .sep { color:#ccc; }
</style>
