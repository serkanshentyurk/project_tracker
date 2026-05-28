import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';

export const data = writable(null);
export const loaded = writable(false);

export const currentProjectId = derived(data, $d => $d?.currentProject ?? null);
export const allProjects = derived(data, $d => $d?.projects ?? []);
export const currentProject = derived(data, $d => {
  const id = $d?.currentProject;
  return $d?.projects?.find(p => p._id === id) || $d?.projects?.[0] || null;
});

export const animals      = derived(currentProject, $p => $p?.animals ?? []);
export const sessions     = derived(currentProject, $p => $p?.sessions ?? []);
export const milestones   = derived(currentProject, $p => $p?.milestones ?? []);
export const log          = derived(currentProject, $p => $p?.log ?? []);
export const protocols    = derived(currentProject, $p => $p?.protocols ?? []);
export const events       = derived(currentProject, $p => $p?.events ?? []);
export const settings     = derived(currentProject, $p => $p?.settings ?? {});
export const aims         = derived(currentProject, $p => $p?.aims ?? {});
export const trajectories = derived(currentProject, $p => $p?.trajectories ?? {});


// =============================================================================
// DATA LOADING — unchanged
// =============================================================================

export async function loadData() {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    data.set(d);
    loaded.set(true);
  } catch (e) {
    console.error('Failed to load data:', e);
  }
}


// =============================================================================
// HELPERS
// =============================================================================

export const toasts = writable([]);
let toastId = 0;
export function toast(msg, type = 'success') {
  const id = ++toastId;
  toasts.update(t => [...t, { id, msg, type }]);
  setTimeout(() => toasts.update(t => t.filter(x => x.id !== id)), 2800);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Current project ID from the store. */
function _pid() {
  const d = get(data);
  return d?.currentProject;
}

/** Update a key on the current project in the local store.
 *  Creates new object references throughout so derived stores propagate. */
function _updateKey(key, value) {
  data.update(d => {
    const idx = d.projects.findIndex(p => p._id === d.currentProject);
    if (idx >= 0) {
      d.projects[idx] = { ...d.projects[idx], [key]: value };
      d.projects = [...d.projects];
    }
    return { ...d };
  });
}

/** Fire-and-forget API call. Logs + toasts on error but doesn't throw. */
async function _api(path, method, body) {
  try {
    const res = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    const result = await res.json();
    if (!result.ok) throw new Error(result.error || 'Server error');
    return result;
  } catch (e) {
    console.error(`${method} ${path} failed:`, e);
    toast('Save failed — check console', 'error');
  }
}


// =============================================================================
// LEGACY — kept as deprecated fallback
// =============================================================================

/**
 * @deprecated Use per-entity functions instead (saveAnimal, saveTransition, etc.)
 *
 * Still works: updates locally + POSTs entire blob to /api/data.
 * Kept so pages can be migrated incrementally. Remove once all pages use
 * the per-entity functions below.
 */
let _saveTimer = null;

export function setKey(key, value) {
  _updateKey(key, value);
  _scheduleLegacySave();
}

function _scheduleLegacySave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_legacyFlush, 300);
}

async function _legacyFlush() {
  const d = get(data);
  if (!d) return;
  try {
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.error('[legacy] Failed to save data:', e);
  }
}

if (browser) {
  window.addEventListener('beforeunload', () => {
    // Legacy: flush pending debounced save on page close
    if (_saveTimer) {
      clearTimeout(_saveTimer);
      const d = get(data);
      if (d) {
        navigator.sendBeacon('/api/data',
          new Blob([JSON.stringify(d)], { type: 'application/json' }));
      }
    }
  });
}


// =============================================================================
// PER-ENTITY: ANIMALS
// =============================================================================

export async function saveAnimal(animal) {
  const entry = { ...animal, _id: animal._id || uid() };
  const list = [...get(animals)];
  const idx = list.findIndex(a => a._id === entry._id);
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  _updateKey('animals', list);
  await _api('/api/animals', 'PUT', { projectId: _pid(), animal: entry });
  return entry;
}

export async function removeAnimal(animalId) {
  _updateKey('animals', get(animals).filter(a => a._id !== animalId));
  await _api('/api/animals', 'DELETE', { projectId: _pid(), id: animalId });
}


// =============================================================================
// PER-ENTITY: TRANSITIONS (stage changes — "sessions" in the frontend store)
// =============================================================================

export async function saveTransition(transition) {
  const entry = { ...transition, _id: transition._id || uid() };
  const list = [...get(sessions)];
  const idx = list.findIndex(s => s._id === entry._id);
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  _updateKey('sessions', list);
  await _api('/api/transitions', 'PUT', { projectId: _pid(), transition: entry });
  return entry;
}

export async function removeTransition(transId) {
  _updateKey('sessions', get(sessions).filter(s => s._id !== transId));
  await _api('/api/transitions', 'DELETE', { projectId: _pid(), id: transId });
}


// =============================================================================
// PER-ENTITY: SESSIONS (behavioural session_data)
// =============================================================================

/** Get session_data from the current project (not exposed as a derived store). */
function _getSessionData() {
  const d = get(data);
  if (!d) return [];
  const proj = d.projects?.find(p => p._id === d.currentProject);
  return proj?.session_data || [];
}

export async function saveSession(session) {
  const entry = { ...session, _id: session._id || uid() };
  const list = [..._getSessionData()];
  const idx = list.findIndex(s => s._id === entry._id);
  if (idx >= 0) list[idx] = entry; else list.push(entry);
  _updateKey('session_data', list);
  await _api('/api/sessions', 'PUT', { projectId: _pid(), session: entry });
  return entry;
}

export async function removeSession(sessionId) {
  _updateKey('session_data', _getSessionData().filter(s => s._id !== sessionId));
  await _api('/api/sessions', 'DELETE', { projectId: _pid(), id: sessionId });
}

/** Bulk add sessions (from scan). Returns count added. */
export async function bulkAddSessions(newSessions) {
  if (!newSessions?.length) return 0;
  const projectId = _pid();
  let added = 0;
  const local = _getSessionData();
  const byKey = new Map(local.map(s => [`${s.animal_id}_${s.date}`, s]));

  for (const incoming of newSessions) {
    const key = `${incoming.animal_id}_${incoming.date}`;
    const existing = byKey.get(key);
    const entry = {
      ...incoming,
      _id: existing?._id || incoming._id || uid(),
    };
    byKey.set(key, entry);
    await _api('/api/sessions', 'PUT', { projectId, session: entry });
    if (!existing) added++;
  }

  // Single store update at the end → single re-render
  _updateKey('session_data', [...byKey.values()]);
  return added;
}


// =============================================================================
// PER-ENTITY: MILESTONES
// =============================================================================

export async function saveMilestones(milestoneArray) {
  _updateKey('milestones', milestoneArray);
  await _api('/api/milestones', 'PUT', { projectId: _pid(), milestones: milestoneArray });
}


// =============================================================================
// PER-ENTITY: LOG
// =============================================================================

export async function saveLogEntry(entry) {
  const item = { ...entry, id: entry.id || uid() };
  const list = [...get(log)];
  const idx = list.findIndex(x => x.id === item.id);
  if (idx >= 0) list[idx] = item; else list.push(item);
  _updateKey('log', list);
  await _api('/api/log', 'PUT', { projectId: _pid(), entry: item });
  return item;
}

export async function removeLogEntry(entryId) {
  _updateKey('log', get(log).filter(x => x.id !== entryId));
  await _api('/api/log', 'DELETE', { projectId: _pid(), id: entryId });
}

/**
 * Update just the log array locally + remotely.
 * Used for status cycling where the caller modifies in place then saves all.
 */
export async function saveLogArray(logArray) {
  _updateKey('log', logArray);
  // Find the changed entry — for status cycling we don't know which one,
  // so re-save the whole set via individual upserts.
  // This is slightly wasteful but status cycling is infrequent.
  const pid = _pid();
  for (const entry of logArray) {
    await _api('/api/log', 'PUT', { projectId: pid, entry });
  }
}


// =============================================================================
// PER-ENTITY: PROTOCOLS
// =============================================================================

export async function saveProtocol(protocol) {
  const item = { ...protocol, _id: protocol._id || uid() };
  const list = [...get(protocols)];
  const idx = list.findIndex(x => x._id === item._id);
  if (idx >= 0) list[idx] = item; else list.push(item);
  _updateKey('protocols', list);
  await _api('/api/protocols', 'PUT', { projectId: _pid(), protocol: item });
  return item;
}

export async function removeProtocol(protoId) {
  _updateKey('protocols', get(protocols).filter(x => x._id !== protoId));
  await _api('/api/protocols', 'DELETE', { projectId: _pid(), id: protoId });
}

/**
 * Save the full protocols array (for in-place mutations like status cycling).
 * Upserts only the specific protocol that changed.
 */
export async function saveProtocolById(protoId) {
  const list = get(protocols);
  const proto = list.find(x => x._id === protoId);
  if (proto) {
    _updateKey('protocols', [...list]); // trigger reactivity
    await _api('/api/protocols', 'PUT', { projectId: _pid(), protocol: proto });
  }
}


// =============================================================================
// PER-ENTITY: EVENTS
// =============================================================================

export async function saveEvent(event) {
  const item = { ...event, _id: event._id || uid() };
  const list = [...get(events)];
  const idx = list.findIndex(x => x._id === item._id);
  if (idx >= 0) list[idx] = item; else list.push(item);
  _updateKey('events', list);
  await _api('/api/events', 'PUT', { projectId: _pid(), event: item });
  return item;
}

export async function removeEvent(eventId) {
  _updateKey('events', get(events).filter(x => x._id !== eventId));
  await _api('/api/events', 'DELETE', { projectId: _pid(), id: eventId });
}


// =============================================================================
// PER-ENTITY: AIMS + TRAJECTORIES
// =============================================================================

export async function saveAim(aimId, aim, stages) {
  const newAims = { ...get(aims), [aimId]: aim };
  _updateKey('aims', newAims);
  const newTraj = { ...get(trajectories), [aimId]: stages };
  _updateKey('trajectories', newTraj);
  await _api('/api/aims', 'PUT', { projectId: _pid(), aimId, aim, stages });
}

export async function removeAim(aimId) {
  const newAims = { ...get(aims) };
  delete newAims[aimId];
  _updateKey('aims', newAims);
  const newTraj = { ...get(trajectories) };
  delete newTraj[aimId];
  _updateKey('trajectories', newTraj);
  await _api('/api/aims', 'DELETE', { projectId: _pid(), aimId });
}


// =============================================================================
// PER-ENTITY: SETTINGS + PROJECT NAME
// =============================================================================

export async function saveSettings(settingsObj, name) {
  _updateKey('settings', settingsObj);
  if (name !== undefined) {
    data.update(d => {
      const p = d.projects.find(x => x._id === d.currentProject);
      if (p) p.name = name;
      return { ...d };
    });
  }
  await _api('/api/settings', 'PUT', {
    projectId: _pid(),
    settings: settingsObj,
    name,
  });
}


// =============================================================================
// PROJECT-LEVEL OPERATIONS
// =============================================================================

export async function switchProject(projectId) {
  data.update(d => {
    d.currentProject = projectId;
    return { ...d };
  });
  await _api('/api/project', 'PUT', { action: 'switch', id: projectId });
}

export async function addProject(project) {
  data.update(d => {
    d.projects.push(project);
    d.currentProject = project._id;
    return { ...d };
  });
  await _api('/api/project', 'POST', { project });
}

export async function deleteProject(projectId) {
  data.update(d => {
    d.projects = d.projects.filter(p => p._id !== projectId);
    if (d.currentProject === projectId) d.currentProject = d.projects[0]?._id || null;
    return { ...d };
  });
  await _api('/api/project', 'DELETE', { projectId });
  // Update server's current project pointer if we just deleted the active one
  const d = get(data);
  if (d?.currentProject) {
    await _api('/api/project', 'PUT', { action: 'switch', id: d.currentProject });
  }
}

export async function resetProject(project) {
  // Replace local
  data.update(d => {
    const idx = d.projects.findIndex(p => p._id === project._id);
    if (idx >= 0) d.projects[idx] = project;
    return { ...d };
  });
  // Server: delete + re-import
  await _api('/api/project', 'PUT', { action: 'import', project });
}
