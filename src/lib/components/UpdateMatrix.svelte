<script>
  /**
   * Update matrix heatmap. Reads um_0_0 … um_7_7 from a session's metrics.
   * Colours match behav_utils/plotting/styles.UM_CMAP (orange→white→purple),
   * symmetric around 0.
   *
   * Props:
   *   stats: session metrics object (must contain um_Y_X keys)
   *   size:  side length in px (default 280)
   */
  export let stats;
  export let size = 280;

  const N = 8;
  const COLOUR_NEG  = [253, 120,   6];   // orange
  const COLOUR_ZERO = [255, 255, 255];   // white
  const COLOUR_POS  = [120,   0, 220];   // purple

  $: matrix = (() => {
    if (!stats) return null;
    const m = [];
    let allNull = true;
    for (let y = 0; y < N; y++) {
      const row = [];
      for (let x = 0; x < N; x++) {
        const v = stats[`um_${y}_${x}`];
        const num = (v === null || v === undefined || isNaN(v)) ? null : Number(v);
        if (num !== null) allNull = false;
        row.push(num);
      }
      m.push(row);
    }
    return allNull ? null : m;
  })();

  $: absMax = matrix
    ? Math.max(0.01, ...matrix.flat().filter(v => v !== null).map(Math.abs))
    : 0.01;

  const TICKS = Array.from({length: N}, (_, i) => (-1 + (i + 0.5) * (2 / N)));

  function lerp(a, b, t) { return a + (b - a) * t; }
  function colourFor(v) {
    if (v === null) return 'rgb(240,240,240)';
    const t = v / absMax;
    let r, g, b;
    if (t < 0) {
      const k = Math.min(1, -t);
      r = lerp(COLOUR_ZERO[0], COLOUR_NEG[0], k);
      g = lerp(COLOUR_ZERO[1], COLOUR_NEG[1], k);
      b = lerp(COLOUR_ZERO[2], COLOUR_NEG[2], k);
    } else {
      const k = Math.min(1, t);
      r = lerp(COLOUR_ZERO[0], COLOUR_POS[0], k);
      g = lerp(COLOUR_ZERO[1], COLOUR_POS[1], k);
      b = lerp(COLOUR_ZERO[2], COLOUR_POS[2], k);
    }
    return `rgb(${r|0},${g|0},${b|0})`;
  }

  const PAD_L = 50, PAD_R = 80, PAD_T = 24, PAD_B = 44;
  $: cellSize = (size - PAD_L - PAD_R) / N;
  $: heatSize = cellSize * N;

  const BAR_STEPS = 12;
  $: barStops = Array.from({length: BAR_STEPS}, (_, i) => {
    const t = -1 + (i / (BAR_STEPS - 1)) * 2;
    return colourFor(t * absMax);
  });
</script>

{#if matrix === null}
  <div class="empty">No update-matrix data for this session.</div>
{:else}
  <svg width={size} height={size} viewBox="0 0 {size} {size}"
       style="font-family: system-ui, -apple-system, sans-serif">
    {#each matrix as row, y}
      {#each row as v, x}
        <rect
          x={PAD_L + x * cellSize}
          y={PAD_T + (N - 1 - y) * cellSize}
          width={cellSize} height={cellSize}
          fill={colourFor(v)} stroke="#fff" stroke-width="0.5">
          <title>{`prev=${TICKS[x].toFixed(2)}, curr=${TICKS[y].toFixed(2)}: ${v === null ? 'NaN' : v.toFixed(3)}`}</title>
        </rect>
      {/each}
    {/each}

    {#each TICKS as t, i}
      <text x={PAD_L + (i + 0.5) * cellSize} y={PAD_T + heatSize + 14}
            text-anchor="middle" font-size="9" fill="#555"
            transform="rotate(45 {PAD_L + (i + 0.5) * cellSize} {PAD_T + heatSize + 14})">{t.toFixed(2)}</text>
    {/each}
    {#each TICKS as t, i}
      <text x={PAD_L - 6} y={PAD_T + (N - 1 - i) * cellSize + cellSize / 2 + 3}
            text-anchor="end" font-size="9" fill="#555">{t.toFixed(2)}</text>
    {/each}

    <text x={PAD_L + heatSize / 2} y={size - 8} text-anchor="middle" font-size="11" fill="#222">Previous stimulus</text>
    <text x={14} y={PAD_T + heatSize / 2} text-anchor="middle" font-size="11" fill="#222"
          transform="rotate(-90 14 {PAD_T + heatSize / 2})">Current stimulus</text>

    {#each barStops as col, i}
      <rect x={PAD_L + heatSize + 14}
            y={PAD_T + (BAR_STEPS - 1 - i) * (heatSize / BAR_STEPS)}
            width={14} height={heatSize / BAR_STEPS + 0.5} fill={col} />
    {/each}
    <text x={PAD_L + heatSize + 32} y={PAD_T + 6} font-size="9" fill="#555">{`+${absMax.toFixed(2)}`}</text>
    <text x={PAD_L + heatSize + 32} y={PAD_T + heatSize / 2 + 3} font-size="9" fill="#555">0</text>
    <text x={PAD_L + heatSize + 32} y={PAD_T + heatSize} font-size="9" fill="#555">{`-${absMax.toFixed(2)}`}</text>
  </svg>
{/if}

<style>
  .empty {
    padding: 18px; color: #888; font-size: 0.85rem; text-align: center;
    background: #fafafa; border: 1px dashed #ddd; border-radius: 6px;
  }
</style>
