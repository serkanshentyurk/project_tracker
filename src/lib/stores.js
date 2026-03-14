import { writable, derived } from 'svelte/store';

export const data = writable(null);
export const loaded = writable(false);

export const currentProjectId = derived(data, $d => $d?.currentProject ?? null);
export const allProjects = derived(data, $d => $d?.projects ?? []);
export const currentProject = derived(data, $d => {
  const id = $d?.currentProject;
  return $d?.projects?.find(p => p._id === id) || $d?.projects?.[0] || null;
});

// Per-project derived stores
export const animals      = derived(currentProject, $p => $p?.animals ?? []);
export const sessions     = derived(currentProject, $p => $p?.sessions ?? []);
export const milestones   = derived(currentProject, $p => $p?.milestones ?? []);
export const log          = derived(currentProject, $p => $p?.log ?? []);
export const protocols    = derived(currentProject, $p => $p?.protocols ?? []);
export const events       = derived(currentProject, $p => $p?.events ?? []);
export const settings     = derived(currentProject, $p => $p?.settings ?? {});
export const aims         = derived(currentProject, $p => $p?.aims ?? {});
export const trajectories = derived(currentProject, $p => $p?.trajectories ?? {});

let _saveTimer = null;

export async function loadData() {
  const res = await fetch('/api/data');
  const d = await res.json();
  data.set(d);
  loaded.set(true);
}

async function _flush(d) {
  await fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(d),
  });
}

export function setKey(key, value) {
  data.update(d => {
    const idx = d.projects.findIndex(p => p._id === d.currentProject);
    if (idx >= 0) d.projects[idx][key] = value;
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => _flush(d), 300);
    return d;
  });
}

export function switchProject(projectId) {
  data.update(d => { d.currentProject = projectId; clearTimeout(_saveTimer); _saveTimer = setTimeout(() => _flush(d), 300); return d; });
}

export function addProject(project) {
  data.update(d => { d.projects.push(project); d.currentProject = project._id; clearTimeout(_saveTimer); _saveTimer = setTimeout(() => _flush(d), 300); return d; });
}

export function deleteProject(projectId) {
  data.update(d => {
    d.projects = d.projects.filter(p => p._id !== projectId);
    if (d.currentProject === projectId) d.currentProject = d.projects[0]?._id || null;
    clearTimeout(_saveTimer); _saveTimer = setTimeout(() => _flush(d), 300); return d;
  });
}

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
