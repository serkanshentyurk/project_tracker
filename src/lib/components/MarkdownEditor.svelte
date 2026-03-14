<script>
  import { renderMd } from '$lib/utils.js';

  export let value = '';
  export let rows = 8;
  export let placeholder = '';

  let textarea;
  let showPreview = false;

  function wrap(before, after) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end);
    const replacement = before + (selected || 'text') + (after || before);
    value = value.slice(0, start) + replacement + value.slice(end);

    // Restore cursor position after Svelte updates the DOM
    const newPos = selected ? start + before.length + selected.length + (after || before).length : start + before.length;
    setTimeout(() => {
      textarea.focus();
      if (selected) {
        textarea.setSelectionRange(start, start + replacement.length);
      } else {
        textarea.setSelectionRange(start + before.length, start + before.length + 4);
      }
    }, 0);
  }

  function insertLine(prefix) {
    if (!textarea) return;
    const start = textarea.selectionStart;
    // Find start of current line
    const before = value.slice(0, start);
    const lineStart = before.lastIndexOf('\n') + 1;
    const lineEnd = value.indexOf('\n', start);
    const end = lineEnd === -1 ? value.length : lineEnd;
    const line = value.slice(lineStart, end);
    value = value.slice(0, lineStart) + prefix + line + value.slice(end);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length + line.length);
    }, 0);
  }

  const COLORS = [
    { label: 'Yellow', code: 'yellow' },
    { label: 'Green', code: 'green' },
    { label: 'Blue', code: 'blue' },
    { label: 'Red', code: 'red' },
    { label: 'Purple', code: 'purple' },
  ];

  let colorMenuOpen = false;

  function insertHighlight(color) {
    wrap(`==${color}==`, `==/${color}==`);
    colorMenuOpen = false;
  }
</script>

<div class="md-editor">
  <div class="md-toolbar">
    <button type="button" class="md-btn" title="Bold (Ctrl+B)" on:click={() => wrap('**')}>
      <strong>B</strong>
    </button>
    <button type="button" class="md-btn" title="Italic" on:click={() => wrap('*')}>
      <em>I</em>
    </button>
    <button type="button" class="md-btn" title="Code" on:click={() => wrap('`')}>
      <code style="font-size:.7rem">&lt;/&gt;</code>
    </button>
    <span class="md-sep"></span>
    <button type="button" class="md-btn" title="Heading" on:click={() => insertLine('## ')}>
      H
    </button>
    <button type="button" class="md-btn" title="Sub-heading" on:click={() => insertLine('### ')}>
      h
    </button>
    <button type="button" class="md-btn" title="Bullet list" on:click={() => insertLine('- ')}>
      •
    </button>
    <span class="md-sep"></span>
    <div class="md-color-wrap">
      <button type="button" class="md-btn" title="Highlight" on:click={() => colorMenuOpen = !colorMenuOpen}>
        <span style="background:#fef08a;padding:0 3px;border-radius:2px;font-size:.72rem">A</span>
      </button>
      {#if colorMenuOpen}
        <div class="md-color-menu">
          {#each COLORS as c}
            <button type="button" class="md-color-swatch md-hl-{c.code}" on:click={() => insertHighlight(c.code)} title={c.label}></button>
          {/each}
        </div>
      {/if}
    </div>
    <div style="flex:1"></div>
    <button type="button" class="md-btn" class:md-btn-active={showPreview} on:click={() => showPreview = !showPreview}>
      {showPreview ? '✏ Edit' : '👁 Preview'}
    </button>
  </div>

  {#if showPreview}
    <div class="md-preview">
      {#if value.trim()}
        {@html renderMd(value)}
      {:else}
        <span class="text-muted" style="font-style:italic">Nothing to preview</span>
      {/if}
    </div>
  {:else}
    <textarea
      bind:this={textarea}
      bind:value
      {rows}
      {placeholder}
      class="md-textarea"
      on:keydown={(e) => {
        if (e.ctrlKey || e.metaKey) {
          if (e.key === 'b') { e.preventDefault(); wrap('**'); }
          if (e.key === 'i') { e.preventDefault(); wrap('*'); }
        }
      }}
    ></textarea>
  {/if}
</div>

<style>
  .md-editor { border: 1.5px solid var(--border); border-radius: var(--r); overflow: hidden; }
  .md-editor:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-lt); }

  .md-toolbar {
    display: flex; align-items: center; gap: 2px; padding: 4px 6px;
    background: #f6f7f9; border-bottom: 1px solid var(--border);
  }

  .md-btn {
    display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 26px; border: none; border-radius: 4px;
    background: transparent; cursor: pointer; font-size: .8rem;
    color: var(--text); transition: background .1s;
  }
  .md-btn:hover { background: #e5e7eb; }
  .md-btn-active { background: #dbeafe; color: var(--accent); }

  .md-sep { width: 1px; height: 18px; background: #d1d5db; margin: 0 3px; }

  .md-color-wrap { position: relative; }
  .md-color-menu {
    position: absolute; top: 100%; left: 0; z-index: 10;
    display: flex; gap: 4px; padding: 6px 8px;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--r); box-shadow: 0 4px 12px rgba(0,0,0,.12);
    margin-top: 4px;
  }
  .md-color-swatch {
    width: 22px; height: 22px; border: 1.5px solid #d1d5db; border-radius: 4px;
    cursor: pointer; transition: transform .1s;
  }
  .md-color-swatch:hover { transform: scale(1.15); border-color: #888; }
  .md-hl-yellow { background: #fef08a; }
  .md-hl-green  { background: #bbf7d0; }
  .md-hl-blue   { background: #bfdbfe; }
  .md-hl-red    { background: #fecaca; }
  .md-hl-purple { background: #e9d5ff; }

  .md-textarea {
    width: 100%; border: none; padding: 10px 12px; resize: vertical;
    font-family: 'SF Mono', 'Fira Code', monospace; font-size: .82rem; line-height: 1.6;
    min-height: 120px; background: var(--surface); color: var(--text);
  }
  .md-textarea:focus { outline: none; }

  .md-preview {
    padding: 12px 14px; font-size: .86rem; line-height: 1.7;
    min-height: 120px; background: var(--surface);
  }
</style>
