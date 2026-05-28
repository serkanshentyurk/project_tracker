<script>
  /**
   * Per-session psychometric curve. Needs the empirical-data fields added
   * to behav_utils (psych_bin_centres / _means / _counts, psych_curve_x/_y).
   * Until a re-scan populates those, shows a graceful "no data" message.
   *
   * Props:
   *   stats: session metrics object
   *   width / height in px
   */
  export let stats;
  export let width = 360;
  export let height = 280;

  $: centres = stats?.psych_bin_centres || null;
  $: means   = stats?.psych_bin_means   || null;
  $: counts  = stats?.psych_bin_counts  || null;
  $: curveX  = stats?.psych_curve_x     || null;
  $: curveY  = stats?.psych_curve_y     || null;
  $: hasData = !!(centres && means);

  // A fit is "unreliable" when a curve was drawn but the parameters came back
  // null (near-chance / strongly biased / too few trials). Flag it so the line
  // isn't read as a trustworthy fit.
  $: muVal = stats?.mu;
  $: unreliable = !!(curveY) && (muVal === null || muVal === undefined || isNaN(muVal));

  const PAD = { left: 48, right: 14, top: 16, bottom: 42 };
  $: plotW = width  - PAD.left - PAD.right;
  $: plotH = height - PAD.top  - PAD.bottom;

  function xScale(x) { return PAD.left + ((x + 1) / 2) * plotW; }
  function yScale(y) { return PAD.top  + (1 - y) * plotH; }

  $: maxCount = counts ? Math.max(...counts, 1) : 1;
  function radius(n) {
    if (!n || n <= 0) return 0;
    return 3 + 6 * Math.sqrt(n / maxCount);
  }

  function wilson(p, n) {
    if (!n || n <= 0) return [null, null];
    const z = 1.96, z2 = 1.96 * 1.96;
    const denom = 1 + z2 / n;
    const centre = (p + z2 / (2 * n)) / denom;
    const half = (z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / denom;
    return [Math.max(0, centre - half), Math.min(1, centre + half)];
  }

  $: curvePath = (() => {
    if (!curveX || !curveY) return null;
    let d = '';
    for (let i = 0; i < curveX.length; i++) {
      const y = curveY[i];
      if (y === null || isNaN(y)) continue;
      d += `${d ? 'L' : 'M'}${xScale(curveX[i]).toFixed(2)},${yScale(y).toFixed(2)}`;
    }
    return d || null;
  })();

  const X_TICKS = [-1, -0.5, 0, 0.5, 1];
  const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];
</script>

{#if !hasData}
  <div class="empty">No psychometric data. Re-scan to populate.</div>
{:else}
  <svg {width} {height} viewBox="0 0 {width} {height}"
       style="font-family: system-ui, -apple-system, sans-serif">
    <line x1={PAD.left} x2={width - PAD.right} y1={yScale(0.5)} y2={yScale(0.5)} stroke="#ddd" stroke-dasharray="3,3" />
    <line x1={xScale(0)} x2={xScale(0)} y1={PAD.top} y2={height - PAD.bottom} stroke="#ddd" stroke-dasharray="3,3" />

    <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={height - PAD.bottom} stroke="#333" stroke-width="1" />
    <line x1={PAD.left} x2={width - PAD.right} y1={height - PAD.bottom} y2={height - PAD.bottom} stroke="#333" stroke-width="1" />

    {#each X_TICKS as t}
      <line x1={xScale(t)} x2={xScale(t)} y1={height - PAD.bottom} y2={height - PAD.bottom + 4} stroke="#333" />
      <text x={xScale(t)} y={height - PAD.bottom + 16} text-anchor="middle" font-size="10" fill="#555">{t}</text>
    {/each}
    {#each Y_TICKS as t}
      <line x1={PAD.left - 4} x2={PAD.left} y1={yScale(t)} y2={yScale(t)} stroke="#333" />
      <text x={PAD.left - 6} y={yScale(t) + 3} text-anchor="end" font-size="10" fill="#555">{t}</text>
    {/each}

    <text x={PAD.left + plotW / 2} y={height - 6} text-anchor="middle" font-size="11" fill="#222">Stimulus</text>
    <text x={12} y={PAD.top + plotH / 2} text-anchor="middle" font-size="11" fill="#222"
          transform="rotate(-90 12 {PAD.top + plotH / 2})">P(choose right)</text>

    {#if curvePath}
      <path d={curvePath} stroke={unreliable ? '#9ca3af' : '#1e40af'}
            stroke-width="2" fill="none"
            stroke-dasharray={unreliable ? '4,3' : '0'} />
    {/if}

    {#if unreliable}
      <text x={PAD.left + plotW / 2} y={PAD.top + 12} text-anchor="middle"
            font-size="10" fill="#b45309" font-weight="600">⚠ unreliable fit</text>
    {/if}

    {#each centres as c, i}
      {#if means[i] !== null && means[i] !== undefined}
        {@const m = means[i]}
        {@const n = counts ? counts[i] : 0}
        {@const ci = wilson(m, n)}
        {#if ci[0] !== null}
          <line x1={xScale(c)} x2={xScale(c)} y1={yScale(ci[1])} y2={yScale(ci[0])} stroke="#1e40af" stroke-width="1.5" />
        {/if}
        <circle cx={xScale(c)} cy={yScale(m)} r={radius(n)} fill="#1e40af" fill-opacity="0.7" stroke="#fff" stroke-width="1">
          <title>{`stim=${c.toFixed(2)}, P(R)=${m.toFixed(3)}, n=${n}`}</title>
        </circle>
      {/if}
    {/each}

    {#if stats?.mu !== undefined && stats?.sigma !== undefined}
      <text x={width - PAD.right - 8} y={PAD.top + 14} text-anchor="end" font-size="10" fill="#444">
        μ = {Number(stats.mu).toFixed(3)}, σ = {Number(stats.sigma).toFixed(3)}
      </text>
    {/if}
  </svg>
{/if}

<style>
  .empty {
    padding: 18px; color: #888; font-size: 0.85rem; text-align: center;
    background: #fafafa; border: 1px dashed #ddd; border-radius: 6px;
  }
</style>
