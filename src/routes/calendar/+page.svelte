<script>
  import { milestones, log, events, sessions, animals, saveEvent, removeEvent, toast, uid } from '$lib/stores.js';
  import { statusLabel, daysFromToday, todayStr } from '$lib/utils.js';

  const TODAY = new Date(); TODAY.setHours(0,0,0,0);
  let viewYear = TODAY.getFullYear(), viewMonth = TODAY.getMonth();
  let addModalOpen = false, editingEventId = null;
  let af = { title:'', date: todayStr(), type:'meeting', notes:'' };

  function collectEvents() {
    const evs = [];
    ($milestones||[]).forEach(phase => (phase.items||[]).forEach(item => {
      if (item.deadline) evs.push({ date:item.deadline, type:'milestone', title:item.text, status:item.status, _src:'milestone' });
    }));
    ($log||[]).forEach(i => {
      if (i.deadline) evs.push({ date:i.deadline, type:i.kind, title:i.title, status:i.status, priority:i.priority, _src:i.kind, _id:i.id });
    });
    ($events||[]).forEach(e => evs.push({ date:e.date, type:'event', title:e.title, notes:e.notes, _src:'event', _id:e._id }));
    ($sessions||[]).forEach(s => {
      if (!s.date || !s.stage_to) return;
      const anim = ($animals||[]).find(a => a._id === s.animal_id);
      evs.push({ date:s.date, type:'transition', title:`${anim?.track_id||s.animal_id}: →${s.stage_to}`, _src:'transition' });
    });
    return evs;
  }

  function evClass(type) {
    return { milestone:'ev-milestone', issue:'ev-issue', decision:'ev-decision', event:'ev-event', transition:'ev-transition' }[type] || 'ev-event';
  }

  $: allEvents = collectEvents();
  $: byDate = (() => { const m={}; allEvents.forEach(e => { if(!m[e.date]) m[e.date]=[]; m[e.date].push(e); }); return m; })();
  $: calTitle = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-GB', { month:'long', year:'numeric' });

  $: cells = (() => {
    const first = new Date(viewYear, viewMonth, 1);
    let startDow = (first.getDay() + 6) % 7;
    const cellDate = new Date(first); cellDate.setDate(cellDate.getDate() - startDow);
    const out = [];
    for (let i = 0; i < 42; i++) {
      const y=cellDate.getFullYear(), m=cellDate.getMonth(), d=cellDate.getDate();
      const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      out.push({ ds, d, isThisMonth: m===viewMonth && y===viewYear, isToday: ds===todayStr(), events: byDate[ds]||[] });
      cellDate.setDate(cellDate.getDate()+1);
    }
    return out;
  })();

  $: upcoming = allEvents
    .filter(e => { const d=daysFromToday(e.date); return d >= -3 && d <= 60; })
    .filter(e => e.type !== 'transition')
    .sort((a,b) => a.date.localeCompare(b.date));

  function prevMonth() { viewMonth--; if(viewMonth<0){viewMonth=11;viewYear--;} }
  function nextMonth() { viewMonth++; if(viewMonth>11){viewMonth=0;viewYear++;} }
  function goToday() { viewYear=TODAY.getFullYear(); viewMonth=TODAY.getMonth(); }

  function openAdd(id) {
    editingEventId = id || null;
    if (id) {
      const ev = ($events||[]).find(e => e._id === id);
      af = ev ? { ...ev } : { title:'', date:todayStr(), type:'meeting', notes:'' };
    } else {
      af = { _id:'', title:'', date:todayStr(), type:'meeting', notes:'' };
    }
    addModalOpen = true;
  }

  function saveEventFn() {
    if (!af.title?.trim() || !af.date) { toast('Title and date required', 'error'); return; }
    const entry = { ...af, _id: af._id || uid() };
    saveEvent(entry);                           // ← per-entity
    addModalOpen = false;
    toast(editingEventId ? 'Updated' : 'Event added');
  }

  function deleteEventFn() {
    if (!editingEventId || !confirm('Delete?')) return;
    removeEvent(editingEventId);                // ← per-entity
    addModalOpen = false; toast('Deleted', 'error');
  }

  function daysBadge(d) {
    if (d < 0) return { cls:'overdue', text:`${Math.abs(d)}d overdue` };
    if (d === 0) return { cls:'soon', text:'Today' };
    if (d <= 7) return { cls:'soon', text:`${d}d` };
    return { cls:'future', text:`${d}d` };
  }
</script>


<div class="page-header">
  <div><h1>📅 Calendar</h1><div class="sub">Deadlines from milestones, log entries, and custom events.</div></div>
  <div class="header-actions"><button class="btn btn-primary" on:click={() => openAdd()}>+ Add Event</button></div>
</div>

<div class="content">
  <div style="display:grid;grid-template-columns:1fr 260px;gap:18px;align-items:start;width:100%">
    <div>
      <div class="cal-nav">
        <button class="btn btn-secondary btn-sm" on:click={prevMonth}>‹ Prev</button>
        <h2>{calTitle}</h2>
        <button class="btn btn-secondary btn-sm" on:click={nextMonth}>Next ›</button>
        <button class="btn btn-secondary btn-sm" on:click={goToday}>Today</button>
      </div>
      <div class="cal-grid">
        {#each ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] as dow}
          <div class="cal-dow">{dow}</div>
        {/each}
        {#each cells as c}
          <div class="cal-cell" class:other-month={!c.isThisMonth} class:today={c.isToday}>
            <span class="cal-day-num">{c.d}</span>
            {#each c.events.slice(0,3) as ev}
              <span class="cal-event {evClass(ev.type)}" title={ev.title}>{ev.title}</span>
            {/each}
            {#if c.events.length > 3}<span class="text-xs text-muted">+{c.events.length-3} more</span>{/if}
          </div>
        {/each}
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;font-size:.72rem">
        <span><span class="cal-event ev-milestone" style="display:inline-block;padding:1px 6px">■</span> Milestone</span>
        <span><span class="cal-event ev-issue" style="display:inline-block;padding:1px 6px">■</span> Issue</span>
        <span><span class="cal-event ev-decision" style="display:inline-block;padding:1px 6px">■</span> Decision</span>
        <span><span class="cal-event ev-event" style="display:inline-block;padding:1px 6px">■</span> Event</span>
        <span><span class="cal-event ev-transition" style="display:inline-block;padding:1px 6px">■</span> Transition</span>
      </div>
    </div>

    <div>
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:12px 14px;border-bottom:1px solid var(--border);font-weight:700;font-size:.88rem">⏰ Upcoming (60 days)</div>
        {#if upcoming.length === 0}
          <div style="padding:20px;text-align:center;color:var(--muted);font-size:.84rem">No deadlines in the next 60 days.</div>
        {:else}
          {#each upcoming as ev}
            {@const d = daysFromToday(ev.date)}
            {@const badge = daysBadge(d)}
            <div class="upcoming-item">
              <div>
                <div class="upcoming-date" class:overdue={d<0} class:soon={d>=0&&d<=7}>{ev.date}</div>
                <span class="days-badge {badge.cls}">{badge.text}</span>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-size:.83rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title={ev.title}>{ev.title}</div>
                {#if ev.status}<div class="text-xs text-muted">{ev.status}</div>{/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>

{#if addModalOpen}
<div class="modal-backdrop open" on:click|self={() => addModalOpen=false}>
  <div class="modal" style="max-width:440px">
    <div class="modal-header"><h2>{editingEventId ? 'Edit Event' : 'Add Event'}</h2><button class="modal-close" on:click={() => addModalOpen=false}>×</button></div>
    <div class="modal-body">
      <div class="form-grid" style="margin-bottom:12px">
        <div class="form-group"><label>Title *</label><input bind:value={af.title} placeholder="e.g. Committee meeting"></div>
        <div class="form-group"><label>Date *</label><input type="date" bind:value={af.date}></div>
        <div class="form-group"><label>Type</label>
          <select bind:value={af.type}>
            <option value="meeting">📆 Meeting</option><option value="booking">🔬 Equipment booking</option>
            <option value="deadline">⚠ External deadline</option><option value="surgery">🩺 Surgery</option><option value="other">Other</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>Notes</label><textarea bind:value={af.notes} rows="2"></textarea></div>
    </div>
    <div class="modal-footer">
      {#if editingEventId}<button class="btn btn-danger btn-sm" style="margin-right:auto" on:click={deleteEventFn}>Delete</button>{/if}
      <button class="btn btn-secondary" on:click={() => addModalOpen=false}>Cancel</button>
      <button class="btn btn-primary" on:click={saveEventFn}>Save</button>
    </div>
  </div>
</div>
{/if}
