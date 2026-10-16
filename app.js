/* Issue Tracker Dashboard — SPA: hash router, pages, modals, toasts */

/* ---- escape hatch for inline onclick handlers (script is strict-mode) ---- */
window.__app = {};

/* ============================ DATA ============================ */

const PROGRESS = {
  Ongoing:     { dot: 'dot-ongoing',     pill: 'prog-ongoing' },
  Completed:   { dot: 'dot-completed',   pill: 'prog-completed' },
  'In review': { dot: 'dot-review',      pill: 'prog-review' },
  Pending:     { dot: 'dot-pending',     pill: 'prog-pending' },
  'On hold':   { dot: 'dot-on-hold',     pill: 'prog-hold' },
};

const URGENCY = { Critical: 'pill-critical', Moderate: 'pill-moderate', Minor: 'pill-minor' };

/* ---- in-memory state, replaced by GET /api/bootstrap at boot ---- */
let PEOPLE = [];
let TASKS = [];
let PROJECTS = [];
let INBOX_ITEMS = [];
let DISCUSSIONS = {};          // taskId -> [{ who, initials, color, text, at }]

let ME = null;                 // current user id — set from GET /api/session (Phase 2 auth)
const mePerson = () => ME ? PEOPLE.find(p => p.id === ME) : null;
const meName  = () => (mePerson() || { name: 'Guest' }).name;
const meInitials = () => (mePerson() || { initials: '??' }).initials;
const meColor = () => (mePerson() || { color: '#888' }).color;
const personById = (id) => PEOPLE.find(p => p.id === id) || PEOPLE[0] || { name: 'Unknown', initials: '?', color: '#888' };

// Task list exactly as in the design (15 tasks) — ids unique server-side;
// the real data now comes from the backend via GET /api/bootstrap.

const CHANNELS = {
  engineering:    { topic: 'Builds, incidents and API chatter for the platform team.' },
  docs:           { topic: 'Everything documentation — PRDs, guides, changelogs.' },
  teams:          { topic: 'Cross-team coordination and people ops.' },
  initiatives:    { topic: 'Quarterly strategic initiatives and OKRs.' },
  'active-sprint':{ topic: 'Daily standups and blockers for the current sprint.' },
  design:         { topic: 'Design critiques, mockups and the design system.' },
  marketing:      { topic: 'Campaigns, launches and growth experiments.' },
};

/* Channel messages come from the backend (GET /api/channels/:id) */
let CHANNEL_MESSAGES = {};

/* Per-task metadata used by the Properties panel */
const TASK_META = {
  category:  ['API Documentation', 'Engineering', 'Design', 'Performance', 'Security'],
  department: ['💻 Engineering', '🎨 Design', '📈 Marketing', '🛡 Security', '📚 Docs'],
  tags: [['Features', 'Improvements'], ['Bugs'], ['Features', 'Bugs', 'Improvements'], ['Improvements']],
  dates: ['March 15, 2025', 'April 2, 2025', 'April 18, 2025', 'May 1, 2025'],
  deadlines: ['May 15, 2025', 'June 1, 2025', 'June 20, 2025', 'July 10, 2025'],
};

/* Discussions (Properties-panel comments) come from the backend:
   GET /api/bootstrap -> discussions map, POST /api/discussions/:taskId to add one. */
const meComment = () => ({ who: meName(), initials: meInitials(), color: meColor() });

const ATTACHMENTS = [
  { cls: 'xls', label: 'XLS', name: 'Client_Proposal.xls', sub: 'Today · 4 MB' },
  { cls: 'doc', label: 'DOC', name: 'PRD.docx', sub: 'Yesterday' },
  { cls: 'gdoc', label: 'G', name: 'Google Docs', sub: 'Linked document' },
];

/* ============================ BACKEND API CLIENT ============================ */

const API_BASE = '/api';

async function api(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    credentials: 'same-origin',   // send the session cookie (Phase 2 auth)
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { msg = (await res.json()).error || msg; } catch (_) {}
    const e = new Error(msg);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

/* Auth gate: mutations that come back 401 drop you on the login screen. */
let authExpired = false;
function handleAuthError(err) {
  if (err && err.status === 401 && !authExpired) {
    authExpired = true;
    ME = null;
    showLoginScreen('Your session expired — please sign in again.');
  }
}

/* Fire-and-forget mutation with optimistic UI + rollback on failure */
function mutate(path, method, body, onSuccess, label) {
  return api(method, path, body).catch(err => {
    if (err.status === 401) { handleAuthError(err); return; }
    console.error(`${method} ${path} failed:`, err);
    toast(`⚠ ${label || 'Server update failed'} — retrying locally only`);
    if (method === 'PATCH') {           // best-effort single retry for edits
      setTimeout(() => api(method, path, body).catch(() => {}), 1200);
    }
  });
}

const patchTask    = (task, body, label) => mutate(`/tasks/${encodeURIComponent(task.id)}`, 'PATCH', body, null, label || 'Save failed');
const deleteTaskApi = (task) => mutate(`/tasks/${encodeURIComponent(task.id)}`, 'DELETE', undefined, null, 'Delete failed');
const patchPrefs   = () => mutate('/prefs', 'PATCH', { savedIds, readFlags }, null, 'Preference sync failed');
const patchInboxRead = (id) => mutate(`/inbox/${encodeURIComponent(id)}`, 'PATCH', { unread: false }, null, 'Read sync failed');
const patchInboxReadAll = () => mutate('/inbox/read-all', 'PATCH', {}, null, 'Read sync failed');
const postComment = (taskId, text) => api('POST', `/discussions/${encodeURIComponent(taskId)}`, { text });
const postChannelMsg = (key, text) => api('POST', `/channels/${encodeURIComponent(key)}`, { text });
const saveProject = (name) => api('POST', '/projects', { name });
const saveBoardOrder = (order) => mutate('/board', 'PATCH', { order }, null, 'Board order not saved');
const updateProfile = (body) => api('PATCH', `/people/${encodeURIComponent(ME)}`, body);

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 172800) return 'Yesterday';
  return `${Math.floor(s / 86400)} days ago`;
}

/* ============================ HELPERS ============================ */

const $ = (sel, root = document) => root.querySelector(sel);
const pageEl = $('#page');
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let savedIds = [];     // task ids (strings) — canonical copy lives on the server (/api/prefs)
let readFlags = {};    // inbox item id -> true (server-persisted; localStorage is a fast cache)
let nextTaskNum = 100; // provisional TSK-### counter for optimistic rows; server assigns the real id
let sortState = { key: null, dir: 1 };
const undoStack = [];
const LS_KEY = 'issueTracker.v1';

/* localStorage is only a fast cache — and it must be scoped per user so two
   people sharing a browser never see each other's saved items / read flags. */
function lsKey() { return ME ? `${LS_KEY}.${ME}` : LS_KEY; }

try {
  const s = JSON.parse(localStorage.getItem(lsKey()) || '{}');
  savedIds = Array.isArray(s.saved) ? s.saved : [];
  readFlags = s.read || {};
} catch (_) {}

function persist() {
  try {
    localStorage.setItem(lsKey(), JSON.stringify({ saved: savedIds, read: readFlags }));
  } catch (_) { /* private mode / storage disabled — server copy still persists */ }
  if (ME) patchPrefs(); // sync to backend (fire-and-forget, retried on failure)
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2600);
}

function fallbackCopy(input, done) {
  try { input.select(); document.execCommand('copy'); } catch (_) {}
  done();
}

function metaFor(task) {
  const i = Math.max(0, TASKS.findIndex(x => x.idx === task.idx)); // position-based so metadata stays stable after deletes/inserts
  return {
    category: TASK_META.category[i % TASK_META.category.length],
    department: TASK_META.department[i % TASK_META.department.length],
    tags: TASK_META.tags[i % TASK_META.tags.length],
    added: TASK_META.dates[i % TASK_META.dates.length],
    deadline: TASK_META.deadlines[i % TASK_META.deadlines.length],
  };
}

/* ---------- undo history (persisted across page loads) ---------- */
let undoHistory = [];
try { undoHistory = JSON.parse(localStorage.getItem('undoHist') || '[]'); } catch (_) {}
function pushHistory(label) {
  undoHistory.unshift({ label, time: Date.now() });
  undoHistory = undoHistory.slice(0, 30);
  try { localStorage.setItem('undoHist', JSON.stringify(undoHistory)); } catch (_) {}
}

/* ============================ FILTERS / SORT / VISIBLE SET ============================ */

const STATUS_ORDER = ['Ongoing', 'In review', 'Completed', 'Pending', 'On hold'];
const URGENCY_ORDER = { Critical: 0, Moderate: 1, Minor: 2 };

let filterState = { progress: '', urgency: '', assignee: '' };

function visibleTasks() {
  let list = filteredTasks(); // search term applied
  if (currentRoute === 'mytasks' && myTaskFilter) list = list.filter(t => t.progress === myTaskFilter);
  const f = filterState;
  if (f.progress) list = list.filter(t => t.progress === f.progress);
  if (f.urgency)  list = list.filter(t => t.urgency === f.urgency);
  if (f.assignee !== '') list = list.filter(t => String(t.assignee) === String(f.assignee));
  if (sortState.key) {
    const k = sortState.key, dir = sortState.dir;
    list = [...list].sort((a, b) => {
      let r = 0;
      if (k === 'feature')  r = a.name.localeCompare(b.name);
      if (k === 'progress') r = STATUS_ORDER.indexOf(a.progress) - STATUS_ORDER.indexOf(b.progress);
      if (k === 'urgency')  r = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
      if (k === 'assignee') r = personById(a.assignee).name.localeCompare(personById(b.assignee).name);
      return r * dir || a.idx - b.idx;
    });
  }
  return list;
}

function toolbarHtml() {
  const active = filterState.progress || filterState.urgency || filterState.assignee !== '';
  return `
  <div class="table-toolbar">
    <select id="flt-progress" class="tool-select" aria-label="Filter by progress">
      <option value="">All progress</option>${Object.keys(PROGRESS).map(k => `<option ${filterState.progress === k ? 'selected' : ''}>${k}</option>`).join('')}
    </select>
    <select id="flt-urgency" class="tool-select" aria-label="Filter by urgency">
      <option value="">All urgency</option>${Object.keys(URGENCY).map(k => `<option ${filterState.urgency === k ? 'selected' : ''}>${k}</option>`).join('')}
    </select>
    <select id="flt-assignee" class="tool-select" aria-label="Filter by owner">
      <option value="">All owners</option>${PEOPLE.map(p => `<option value="${p.id}" ${String(filterState.assignee) === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}
    </select>
    ${active ? '<button id="clear-filters" class="btn btn-ghost btn-sm">Clear filters ✕</button>' : ''}
    <span class="toolbar-spacer"></span>
    <button data-export class="btn btn-ghost btn-sm" title="Download tasks as CSV">⬇ Export CSV</button>
  </div>`;
}

function applyFiltersAndSort() {
  const host = $('#board-body');
  if (!host) return;
  const rows = visibleTasks();
  host.innerHTML = rows.length ? taskTableHtml(rows)
    : `<div class="empty-state">No tasks match your filters.<br><button id="clear-filters" class="btn btn-ghost btn-sm" style="margin-top:8px">Clear filters</button></div>`;
  const bulk = $('.bulkbar');
  if (bulk) bulk.remove();
}

function exportCsv(tasks) {
  const head = ['ID', 'Name', 'Progress', 'Urgency', 'Assignee', 'Comments'];
  const lines = [head.join(',')].concat(tasks.map(t =>
    [t.id, `"${t.name.replace(/"/g, '""')}"`, t.progress, t.urgency, personById(t.assignee).name, t.comments].join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tasks.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

/* ============================ MUTATIONS (edit / status / delete / undo) ============================
   All mutations are optimistic: update in-memory state + UI immediately, then sync to the
   backend via PATCH/DELETE /api/tasks/:id. On failure mutate() surfaces a warning toast and
   retries; Undo reverses both the local change and the server copy.                       */

const byIdx = (idx) => TASKS.find(x => x.idx === idx);

function updateTaskRow(idx) {
  const tr = document.querySelector(`.task-table tbody tr[data-idx="${idx}"]`);
  const t = byIdx(idx);
  if (!tr || !t) return;
  const fresh = document.createElement('tr');
  fresh.innerHTML = taskRowHtml(t);
  fresh.dataset.idx = idx; fresh.tabIndex = 0;
  fresh.className = tr.className;
  tr.replaceWith(fresh);
}

function startRename(idx) {
  const cell = document.querySelector(`.task-table tbody tr[data-idx="${idx}"] .feature-name`);
  const t = byIdx(idx);
  if (!cell || !t || cell.querySelector('input')) return;
  cell.innerHTML = `<input class="rename-input" type="text" value="${esc(t.name)}" aria-label="Rename task" />`;
  const inp = cell.querySelector('input');
  inp.focus(); inp.select();
  let done = false;
  function commit() {
    if (done) return; done = true;
    const v = inp.value.trim();
    if (v && v !== t.name) {
      const old = t.name; t.name = v;
      patchTask(t, { name: v }, 'Rename not saved');
      pushHistory(`Renamed “${old}” → “${v}”`);
      undoStack.push({ label: `Rename of “${v}”`, run: () => { t.name = old; patchTask(t, { name: old }); render(); } });
      render();
      showUndoToast(`✏ Renamed “${v}”`);
    } else render();
  }
  inp.addEventListener('blur', () => commit());
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { done = true; render(); }
  });
}

function cycleStatus(idx) {
  const t = byIdx(idx); if (!t) return;
  const old = t.progress;
  t.progress = STATUS_ORDER[(STATUS_ORDER.indexOf(old) + 1) % STATUS_ORDER.length];
  patchTask(t, { progress: t.progress }, 'Status not saved');
  pushHistory(`“${t.name}”: ${old} → ${t.progress}`);
  undoStack.push({ label: `Status change of “${t.name}”`, run: () => { t.progress = old; patchTask(t, { progress: old }); render(); } });
  if ($('#board-body')) renderBoardBody(); else render(); // board pages vs mytasks/home/saved tables
  showUndoToast(`“${t.name}”: ${old} → ${t.progress}`);
}

function deleteTask(idx) {
  const pos = TASKS.findIndex(x => x.idx === idx); if (pos < 0) return;
  const removed = TASKS[pos];
  deleteTaskApi(removed);
  savedIds = savedIds.filter(id => id !== removed.id); persist();
  pushHistory(`Deleted “${removed.name}”`);
  undoStack.push({
    label: `Deleted “${removed.name}”`,
    run: async () => {
      TASKS.splice(pos, 0, removed);
      try {                                  // re-create on the server; keep the client row in sync
        const created = await api('POST', '/tasks', {
          name: removed.name, progress: removed.progress, urgency: removed.urgency,
          assignee: removed.assignee, project: removed.project, comments: removed.comments,
        });
        Object.assign(removed, { id: created.id, idx: created.idx });
      } catch (_) { /* stays local-only until next full reload */ }
    },
  });
  TASKS.splice(pos, 1);
  render();
  showUndoToast(`🗑 Deleted “${removed.name}”`);
}
function bulkDelete() {
  const boxes = [...document.querySelectorAll('.row-check:checked')];
  if (!boxes.length) return;
  const idxs = new Set(boxes.map(b => +b.dataset.idx));
  const removed = TASKS.filter(t => idxs.has(t.idx));
  removed.forEach(deleteTaskApi);
  savedIds = savedIds.filter(id => !removed.some(t => t.id === id)); persist();
  TASKS = TASKS.filter(t => !idxs.has(t.idx));
  pushHistory(`Deleted ${removed.length} tasks`);
  undoStack.push({
    label: `Deleted ${removed.length} tasks`,
    run: async () => {
      for (const t of removed) {
        TASKS.push(t);
        try {
          const created = await api('POST', '/tasks', {
            name: t.name, progress: t.progress, urgency: t.urgency,
            assignee: t.assignee, project: t.project, comments: t.comments,
          });
          Object.assign(t, { id: created.id, idx: created.idx });
        } catch (_) {}
      }
    },
  });
  render();
  showUndoToast(`🗑 Deleted ${removed.length} tasks`);
}

async function undoLast() {
  const op = undoStack.pop();
  if (!op) return toast('Nothing to undo');
  await op.run(); render(); toast(`↩ Undone: ${op.label}`);
}

function showUndoToast(msg) {
  const t = $('#toast');
  t.innerHTML = `${esc(msg)} <button id="undo-btn" class="undo-btn">Undo</button>`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 6000);
}

window.__app.undoLast = undoLast;

window.__app.startRename = startRename;
window.__app.cycleStatus = cycleStatus;

const URGENCY_CYCLE = ['Critical', 'Moderate', 'Minor'];
window.__app.cycleUrgency = function (idx) {
  const t = TASKS.find(x => x.idx === idx); if (!t) return;
  const old = t.urgency;
  t.urgency = URGENCY_CYCLE[(URGENCY_CYCLE.indexOf(old) + 1) % URGENCY_CYCLE.length];
  patchTask(t, { urgency: t.urgency }, 'Urgency not saved');
  pushHistory(`“${t.name}”: urgency ${old} → ${t.urgency}`);
  undoStack.push({ label: `Urgency change of “${t.name}”`, run: () => { t.urgency = old; patchTask(t, { urgency: old }); render(); } });
  if ($('#board-body')) renderBoardBody(); else render();
  showUndoToast(`“${t.name}”: ${old} → ${t.urgency}`);
};

/* ============================ MODAL (with focus trap) ============================ */

let lastFocused = null;

function openModal(title, html) {
  lastFocused = document.activeElement;
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = html;
  $('#modal-overlay').classList.remove('hidden');
  const first = $('#modal-body button, #modal-body input, #modal-body select, #modal-body textarea');
  (first || $('#modal-close')).focus();
}
function closeModal() {
  $('#modal-overlay').classList.add('hidden');
  if (lastFocused && lastFocused.focus) lastFocused.focus();
  lastFocused = null;
}
document.addEventListener('keydown', (e) => {
  const overlay = $('#modal-overlay');
  if (overlay.classList.contains('hidden')) return;
  if (e.key !== 'Tab') return;
  const focusables = [...overlay.querySelectorAll('button, input, select, textarea, a[href]')]
    .filter(el => !el.disabled && el.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
});

$('#modal-close').addEventListener('click', closeModal);
$('#modal-overlay').addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeColMenus(); closeModal(); } });

/* close column menus on scroll/resize so they don't float detached */
window.addEventListener('scroll', () => { if (document.querySelector('.col-menu')) closeColMenus(); }, true);
window.addEventListener('resize', () => { if (document.querySelector('.col-menu')) closeColMenus(); });

/* Keyboard shortcuts: N = new feature, / = focus search (when not typing) */
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
    e.preventDefault(); toggleDarkMode(); return;
  }
  if (e.key === 'Escape') { closeModal(); return; }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if ((e.metaKey || e.ctrlKey) && !typing && e.key.toLowerCase() === 'z') { e.preventDefault(); undoLast(); return; }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); $('#global-search').focus(); }
  if (e.key.toLowerCase() === 'n') { e.preventDefault(); showNewFeatureModal(); }
});

/* ============================ SHARED COMPONENTS ============================ */

function taskRowHtml(t) {
  const p = personById(t.assignee);
  return `
    <tr data-idx="${t.idx}" tabindex="0">
      <td class="check-cell"><input type="checkbox" class="row-check" data-idx="${t.idx}" aria-label="Select ${esc(t.name)}" /></td>
      <td><div class="feature-cell"><span class="tsk-id">${t.id}</span><span class="feature-name" title="Double-click to rename">${esc(t.name)}</span></div></td>
      <td><button class="progress-cell progress-btn ${PROGRESS[t.progress]?.pill || 'prog-hold'}" onclick="__app.cycleStatus(${t.idx})" title="Click to change status"><span class="status-dot ${PROGRESS[t.progress]?.dot || 'dot-on-hold'}"></span>${t.progress}</button></td>
      <td><button class="urgency-cell pill ${URGENCY[t.urgency]}" onclick="__app.cycleUrgency(${t.idx})" title="Click to change urgency">${t.urgency}</button></td>
      <td>
        <div class="assignee">
          <button class="avatar link-avatar" style="--a:${p.color}" data-person="${t.assignee}" title="${p.name}">${p.initials}</button>
          <span class="assignee-name">${p.name}</span>
          ${t.comments ? `<span class="comment-count" title="${t.comments} comments">💬 ${t.comments}</span>` : ''}
        </div>
      </td>
      <td class="row-actions">
        <button class="icon-btn edit-btn" onclick="__app.startRename(${t.idx})" title="Rename" aria-label="Rename task">✎</button>
        <button class="icon-btn del-btn" data-del="${t.idx}" title="Delete" aria-label="Delete task">🗑</button>
      </td>
    </tr>`;
}

function sortIcon(key) {
  if (sortState.key !== key) return '<span class="sort-ind">↕</span>';
  return `<span class="sort-ind on">${sortState.dir === 1 ? '↑' : '↓'}</span>`;
}

/* ---- column header: sort + filter dropdown menu ---- */

function colHead(key, label) {
  const canFilter = key !== 'feature';
  const fVal = canFilter ? (key === 'assignee' ? filterState.assignee : filterState[key]) : '';
  const filtered = canFilter && fVal !== '' && fVal !== undefined;
  const sorted = sortState.key === key;
  const arrow = sorted ? (sortState.dir === 1 ? '↑' : '↓') : '';
  return `<button class="th-btn${filtered ? ' is-filtered' : ''}" data-menu="col:${key}"
      aria-haspopup="true" aria-expanded="false" title="${canFilter ? 'Sort & filter' : 'Sort'} by ${label}">
    <span>${label}</span>${arrow ? `<span class="th-arrow">${arrow}</span>` : ''}
    ${filtered ? '<span class="th-filter-dot" aria-hidden="true"></span>' : ''}
    <svg class="th-caret" width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4.5 6 7.5 9 4.5"/></svg>
  </button>`;
}

function colMenuHtml(key) {
  const labels = { feature: 'Feature', progress: 'Progress', urgency: 'Urgency', assignee: 'Assigned to' };
  const dirOpts = [
    { act: `sort:${key}:asc`, icon: '↑', label: 'A → Z', active: sortState.key === key && sortState.dir === 1 },
    { act: `sort:${key}:desc`, icon: '↓', label: 'Z → A', active: sortState.key === key && sortState.dir === -1 },
  ];
  let filterOpts = [];
  if (key === 'progress') filterOpts = Object.keys(PROGRESS).map(k => ({ val: k, label: k, dot: PROGRESS[k].dot }));
  if (key === 'urgency')  filterOpts = Object.keys(URGENCY).map(k => ({ val: k, label: k, pill: URGENCY[k] }));
  if (key === 'assignee') filterOpts = PEOPLE.map(p => ({ val: p.id, label: p.name, avatar: p }));
  const cur = key === 'assignee' ? filterState.assignee : filterState[key];
  const isFiltered = cur !== '' && cur !== undefined;
  return `
    <div class="menu-sec">Sort ${labels[key]}</div>
    ${dirOpts.map(o => `<button class="menu-item${o.active ? ' active' : ''}" data-menuact="${o.act}">
      <span class="mi-icon mi-arrow">${o.icon}</span><span class="mi-label">${o.label}</span>${o.active ? '<span class="mi-check">✓</span>' : ''}</button>`).join('')}
    ${filterOpts.length ? `
      <div class="menu-sep"></div>
      <div class="menu-sec">Filter ${labels[key]}</div>
      <button class="menu-item${!isFiltered ? ' active' : ''}" data-menuact="clearf:${key}">
        <span class="mi-icon">◎</span><span class="mi-label">All</span>${!isFiltered ? '<span class="mi-check">✓</span>' : ''}</button>
      ${filterOpts.map(o => `<button class="menu-item${String(cur) === o.val ? ' active' : ''}" data-menuact="setf:${key}:${encodeURIComponent(o.val)}">
        <span class="mi-icon">${o.dot ? `<span class="status-dot ${o.dot}"></span>` : o.pill ? `<span class="pill ${o.pill} pill-xs">${esc(o.label)}</span>` : o.avatar ? `<span class="avatar avatar-xs" style="--a:${o.avatar.color}">${o.avatar.initials[0]}</span>` : ''}</span>
        <span class="mi-label">${esc(o.label)}</span>${String(cur) === o.val ? '<span class="mi-check">✓</span>' : ''}</button>`).join('')}
    ` : ''}`;
}

function closeColMenus() {
  document.querySelectorAll('.col-menu').forEach(m => m.remove());
  document.querySelectorAll('.th-btn[aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
}

function openColMenu(btn) {
  const wasOpen = btn.getAttribute('aria-expanded') === 'true';
  closeColMenus();
  if (wasOpen) return;
  btn.setAttribute('aria-expanded', 'true');
  const key = btn.dataset.menu.split(':')[1];
  const menu = document.createElement('div');
  menu.className = 'col-menu';
  menu.innerHTML = colMenuHtml(key);
  document.body.appendChild(menu);
  const r = btn.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left = Math.min(Math.max(8, r.left), window.innerWidth - mw - 8);
  let top = r.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 6);
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';
}

function refreshViews() {
  // re-render whatever table views are on screen so sort/filter changes apply everywhere
  if (currentRoute === 'mytasks') { render(); return; }
  if ($('#board-body')) { kanbanMode ? renderKanban() : renderBoardBody(); return; }
  render();
}

function taskTableHtml(tasks) {
  return `
    <table class="task-table">
      <thead><tr>
        <th class="check-cell"></th>
        <th>${colHead('feature', 'Feature')}</th>
        <th>${colHead('progress', 'Progress')}</th>
        <th>${colHead('urgency', 'Urgency')}</th>
        <th>${colHead('assignee', 'Assigned to')}</th>
        <th class="row-actions"></th>
      </tr></thead>
      <tbody id="task-rows">${tasks.map(taskRowHtml).join('')}</tbody>
    </table>`;
}

function propertiesPanelHtml(task) {
  const m = metaFor(task);
  const owner = personById(task.assignee);
  const comments = DISCUSSIONS[task.id] || [];
  const isSaved = savedIds.includes(task.id);
  return `
  <aside class="properties">
    <div class="props-head"><h2>Properties</h2>
      <div class="props-actions">
        <button id="save-toggle" class="icon-btn" data-idx="${task.idx}" title="${isSaved ? 'Remove from saved' : 'Save item'}">${isSaved ? '★' : '☆'}</button>
        <button class="icon-btn" id="edit-task-btn" data-idx="${task.idx}" title="Rename task">✎</button>
        <button class="icon-btn danger-icon" id="delete-task-btn" data-del="${task.idx}" title="Delete task">🗑</button>
      </div>
    </div>
    <dl class="props-list">
      <div class="prop-row"><dt>Task ID</dt><dd>${task.id}</dd></div>
      <div class="prop-row"><dt>Progress</dt><dd>
        <select id="prop-status" data-idx="${task.idx}" class="prop-select" aria-label="Change progress">
          ${Object.keys(PROGRESS).map(k => `<option ${k === task.progress ? 'selected' : ''}>${k}</option>`).join('')}
        </select></dd></div>
      <div class="prop-row"><dt>Category</dt><dd>${m.category}</dd></div>
      <div class="prop-row"><dt>Task owner</dt><dd><button class="avatar avatar-xs link-avatar" style="--a:${owner.color}" data-person="${task.assignee}">${owner.initials[0]}</button>${owner.name.split(' ')[0]}</dd></div>
      <div class="prop-row"><dt>Urgency</dt><dd><span class="pill ${URGENCY[task.urgency]}">${task.urgency}</span></dd></div>
      <div class="prop-row"><dt>Department</dt><dd>${m.department}</dd></div>
      <div class="prop-row"><dt>Date added</dt><dd>${m.added}</dd></div>
      <div class="prop-row"><dt>Deadline</dt><dd>${m.deadline}</dd></div>
      <div class="prop-row tags-row"><dt>Tags</dt><dd class="tags">${m.tags.map(t => `<span class="tag">${t}</span>`).join('')}</dd></div>
    </dl>
    <div class="props-section">
      <h3>Attachments</h3>
      ${ATTACHMENTS.map(a => `
        <a href="#" class="attachment" data-attachment="${a.name}">
          <span class="file-icon ${a.cls}">${a.label}</span>
          <span class="att-meta"><span class="att-name">${a.name}</span><span class="att-sub">${a.sub}</span></span>
        </a>`).join('')}
    </div>
    <div class="props-section discussion">
      <h3>Discussion</h3>
      <ul class="comments" id="comment-list">
        ${comments.map(c => `
        <li>
          <span class="avatar avatar-sm" style="--a:${c.color}">${c.initials}</span>
          <div class="comment-body"><div class="comment-author">${c.who}</div><p>${esc(c.text)}</p></div>
        </li>`).join('')}
      </ul>
      <form id="comment-form" class="comment-input">
        <input id="comment-box" data-idx="${task.idx}" type="text" placeholder="Write a comment (Enter to send)" aria-label="Write a comment" />
        <button id="comment-send" class="btn btn-primary btn-sm" type="submit">Send</button>
      </form>
    </div>
  </aside>`;
}

function boardSectionHtml(title, tabs, activeTab, tasks) {
  return `
    <section class="board">
      <div class="board-head">
        <h1 class="project-title">${esc(title)}</h1>
        <div class="tabs">
          ${tabs.map((tb, i) => `<button class="tab ${i === activeTab ? 'active' : ''}" data-tab="${i}">${tb}</button>`).join('')}
        </div>
        <button id="share-btn" class="btn btn-ghost share-btn">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 3.5 16.5 8 11 12.5"/><path d="M16 8H7.5A4 4 0 0 0 3.5 12v1.5"/><path d="M16 8V16"/></svg>
          Share
        </button>
      </div>
      ${tasks.length ? `<div class="view-toggle" role="group" aria-label="Board view">
        <button class="vt-btn ${kanbanMode ? '' : 'active'}" data-view="table" title="Table view">☰ Table</button>
        <button class="vt-btn ${kanbanMode ? 'active' : ''}" data-view="kanban" title="Kanban board view">▦ Kanban</button>
      </div>` : ''}
      <div id="board-body">
        ${tasks.length ? `${toolbarHtml()}${taskTableHtml(tasks)}`
          : `<div class="empty-state">No tasks in “${esc(title)}” yet.<br><button class="btn btn-primary btn-sm" id="new-feature-btn" style="margin-top:10px">＋ Create the first task</button></div>`}
      </div>
    </section>`;
}

/* ---------- Kanban view ---------- */
let kanbanDragIdx = null;

function setKanban(on) {
  kanbanMode = on;
  document.querySelectorAll('.view-toggle .vt-btn').forEach(b => b.classList.toggle('active', (b.dataset.view === 'kanban') === on));
  if (on) renderKanban(); else renderBoardBody();
}

function kanbanColsHtml(tasks) {
  return `
    <div class="kanban">
      ${STATUS_ORDER.map(st => {
        const col = tasks.filter(t => t.progress === st);
        return `
        <div class="kb-col" data-status="${st}">
          <div class="kb-head"><span class="status-dot ${PROGRESS[st].dot}"></span><strong>${st}</strong><span class="kb-count">${col.length}</span></div>
          <div class="kb-drop">
            ${col.map(t => {
              const p = personById(t.assignee);
              return `<div class="kb-card" draggable="true" data-idx="${t.idx}" tabindex="0">
                <div class="kb-name">${esc(t.name)}</div>
                <div class="kb-meta"><span class="tsk-id">${t.id}</span><span class="pill ${URGENCY[t.urgency]}">${t.urgency}</span>
                  <span class="avatar avatar-xs" style="--a:${p.color}" title="${p.name}">${p.initials[0]}</span></div>
              </div>`;
            }).join('') || '<div class="kb-empty">Drop tasks here</div>'}
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function wireKanban(host) {
  host.querySelectorAll('.kb-card').forEach(card => {
    card.addEventListener('dragstart', () => { kanbanDragIdx = +card.dataset.idx; card.classList.add('dragging'); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); kanbanDragIdx = null; });
    card.addEventListener('click', () => { location.hash = `#/task/${card.dataset.idx}`; });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = `#/task/${card.dataset.idx}`; });
  });
  host.querySelectorAll('.kb-col').forEach(col => {
    col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', (e) => {
      e.preventDefault(); col.classList.remove('over');
      if (kanbanDragIdx == null) return;
      const t = TASKS.find(x => x.idx === kanbanDragIdx);
      const st = col.dataset.status;
      if (t && t.progress !== st) {
        const old = t.progress; t.progress = st;
        patchTask(t, { progress: st }, 'Move not saved');
        saveBoardOrder(TASKS.map(x => x.id)); // persist column order server-side
        pushHistory(`Moved “${t.name}” → ${st}`);
        undoStack.push({ label: `Move of “${t.name}”`, run: () => { t.progress = old; patchTask(t, { progress: old }); render(); } });
        refreshViews();
        showUndoToast(`Moved “${t.name}” → ${st}`);
      }
    });
  });
}

function renderKanban() {
  const host = $('#board-body'); if (!host) return;
  const tasks = visibleTasks();
  if (!tasks.length) { host.innerHTML = '<div class="empty-state">No tasks match your filters.</div>'; return; }
  host.innerHTML = kanbanColsHtml(tasks);
  wireKanban(host);
}

function renderBoardBody() {
  const host = $('#board-body'); if (!host) return;
  const activeTab = document.querySelector('.tab.active');
  const isOverview = ['project', 'task'].includes(currentRoute) && activeTab && activeTab.dataset.tab === '0';
  if (isOverview) { host.innerHTML = overviewHtml(); return; }
  const rows = visibleTasks();
  host.innerHTML = toolbarHtml() + (rows.length ? taskTableHtml(rows)
    : `<div class="empty-state">No tasks match your search or filters.<br><button id="clear-filters" class="btn btn-ghost btn-sm" style="margin-top:8px">Clear filters</button></div>`);
  updateBulkBar();
}

/* ============================ ROUTER ============================ */

const routes = {}; // filled below
let currentRoute = '';

function parseHash() {
  const h = location.hash.replace(/^#\/?/, '') || 'home';
  const parts = h.split('/');
  return { name: parts[0], param: parts[1] || null };
}

/* ============================ LOGIN SCREEN (Phase 2) ============================ */
/* Full-page overlay rendered outside the router; shown when no session exists. */

let loginNotice = '';

function showLoginScreen(notice) {
  if (notice !== undefined) loginNotice = notice;
  document.body.classList.add('show-login');
}

function hideLoginScreen() {
  loginNotice = '';
  document.body.classList.remove('show-login');
}

function renderLoginScreen() {
  const screen = $('#login-screen');
  if (!screen) return;
  screen.innerHTML = `
    <div class="login-card">
      <div class="login-brand">
        <div class="org-avatar" aria-hidden="true">
          <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 8.5h16M4.5 14h19M6 19.5h16" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
            <path d="M8 4h12l3 4.5H5L8 4Zm-3.5 5.5h19L26 14H2l2.5-4.5ZM5 19.5h18l-2.5 4.5H7.5L5 19.5Z" fill="#fff" opacity=".28"/>
          </svg>
        </div>
        <h1>TaskHive</h1>
        <p>Sign in to your workspace</p>
      </div>
      ${loginNotice ? `<div class="login-notice">${esc(loginNotice)}</div>` : ''}
      <form id="login-form" autocomplete="on">
        <label>Email<input id="login-email" type="email" required placeholder="you@catlas.inc" value="parth@catlas.inc" /></label>
        <label>Password<input id="login-password" type="password" required placeholder="••••••••" value="password" /></label>
        <button type="submit" class="btn btn-primary btn-block" id="login-submit">Sign in</button>
      </form>
      <div class="login-alt">New here? <button id="show-signup" class="link-btn" type="button">Create an account</button></div>
      <form id="signup-form" class="hidden">
        <label>Name<input id="signup-name" type="text" required placeholder="Ada Lovelace" /></label>
        <label>Email<input id="signup-email" type="email" required placeholder="ada@catlas.inc" /></label>
        <label>Password<input id="signup-password" type="password" required minlength="4" placeholder="min 4 characters" /></label>
        <button type="submit" class="btn btn-primary btn-block">Create account</button>
        <div class="login-alt">Already registered? <button id="show-login" class="link-btn" type="button">Sign in</button></div>
      </form>
      <div class="login-hint">Demo accounts — any seeded teammate with password <code>password</code>:<br>
        parth@ · david@ · maya@ · alex@ · sara@ <em>catlas.inc</em></div>
    </div>`;
}

function doLogin(email, password) {
  return api('POST', '/login', { email, password }).then(d => {
    authExpired = false;
    ME = d.user.id;
    hideLoginScreen();
    return loadBootstrap();
  });
}

function doLogout() {
  return api('POST', '/logout', {}).catch(() => {}).then(() => {
    ME = null; savedIds = []; readFlags = {};
    showLoginScreen('Signed out.');
  });
}

function render() {
  if (!ME) { showLoginScreen('Please sign in to continue.'); }   // session lost mid-use
  const { name, param } = parseHash();
  const fn = routes[name] || routes.home;
  currentRoute = name;
  pageEl.innerHTML = fn(param);
  setActiveNav(name, param);
  if (name === 'mytasks' && mtView === 'board') {
    const c = $('.mt-content');
    if (c) wireKanban(c);
  }
  window.scrollTo(0, 0);
}

function setActiveNav(name, param) {
  document.querySelectorAll('.nav-item').forEach(a => {
    const r = a.dataset.route;
    a.classList.toggle('active', r === name && (!a.dataset.param || a.dataset.param === param));
  });
}

function setCrumbs(items) { // items: [{label, hash}] last is current
  $('#crumbs').innerHTML = items.map((it, i) => {
    const last = i === items.length - 1;
    return `${i ? '<span class="sep">/</span>' : ''}<a href="${it.hash || '#'}" class="${last ? 'current' : ''}">${esc(it.label)}</a>`;
  }).join('');
}

window.addEventListener('hashchange', render);

/* ============================ PAGES ============================ */

routes.home = () => {
  setCrumbs([{ label: 'Overview' }, { label: 'Home' }]);
  const counts = { Ongoing: 0, Completed: 0, 'In review': 0, Pending: 0 };
  TASKS.forEach(t => counts[t.progress]++);
  const mine = TASKS.filter(t => t.assignee === ME);
  return `
    <section class="page-pad">
      <div class="page-head">
        <h1>Welcome back, ${esc(meName().split(' ')[0])} 👋</h1>
        <p>Here's what's happening across your workspace today.</p>
      </div>
      <div class="stat-grid">
        <button class="stat-card" data-goto="#/mytasks"><span class="stat-num">${TASKS.length}</span><span class="stat-label">Total tasks</span></button>
        <button class="stat-card" data-goto="#/projects"><span class="stat-num">${PROJECTS.length}</span><span class="stat-label">Active projects</span></button>
        <button class="stat-card" data-goto="#/inbox"><span class="stat-num">${INBOX_ITEMS.filter(i => !readFlags[i.id]).length}</span><span class="stat-label">Unread inbox</span></button>
        <button class="stat-card" data-goto="#/saved"><span class="stat-num">${savedIds.length}</span><span class="stat-label">Saved items</span></button>
      </div>
      <h2 class="section-title">Progress overview</h2>
      <div class="bar-chart">
        ${Object.entries(counts).map(([k, v]) => `
          <div class="bar-row">
            <span class="bar-label"><span class="status-dot ${PROGRESS[k].dot}"></span>${k}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v / Math.max(TASKS.length, 1) * 100)}%"></div></div>
            <span class="bar-count">${v}</span>
          </div>`).join('')}
      </div>
      <h2 class="section-title">Recent activity</h2>
      <ul class="activity-list">
        ${INBOX_ITEMS.slice(0, 5).map((it) => `
          <li data-inbox="${it.id}" style="cursor:pointer"><span class="avatar avatar-sm" style="--a:${it.color}">${it.initials}</span>
              <span><strong>${esc(it.who)}</strong> ${esc(it.text)} <em>${timeAgo(it.at)}</em></span></li>`).join('')}
      </ul>
      <h2 class="section-title">Your tasks</h2>
      ${taskTableHtml(mine)}
    </section>`;
};

routes.inbox = () => {
  setCrumbs([{ label: 'Overview' }, { label: 'Inbox' }]);
  return `
    <section class="page-pad">
      <div class="page-head">
        <h1>Inbox</h1>
        <p>Notifications and mentions across your projects.
          <button id="mark-all-read" class="btn btn-ghost btn-sm">Mark all as read</button></p>
      </div>
      <ul class="inbox-list">
        ${INBOX_ITEMS.map((it) => {
          const unread = !readFlags[it.id];
          return `
          <li class="inbox-item ${unread ? 'unread' : ''}" data-inbox="${it.id}">
            <span class="avatar avatar-sm" style="--a:${it.color}">${it.initials}</span>
            <div class="inbox-body">
              <div class="inbox-top"><strong>${esc(it.who)}</strong><span class="inbox-time">${timeAgo(it.at)}</span></div>
              <p>${esc(it.text)}</p>
            </div>
            ${unread ? '<span class="unread-dot"></span>' : ''}
          </li>`;
        }).join('')}
      </ul>
    </section>`;
};

routes.saved = () => {
  setCrumbs([{ label: 'Overview' }, { label: 'Saved items' }]);
  const items = TASKS.filter(t => savedIds.includes(t.id));
  return `
    <section class="page-pad">
      <div class="page-head"><h1>Saved items</h1><p>Tasks you bookmarked with ☆ in the Properties panel.</p></div>
      ${items.length ? taskTableHtml(items) : '<div class="empty-state">Nothing saved yet. Open a task and hit ☆ to save it.</div>'}
    </section>`;
};

/* ---- My Tasks page: view mode (grouped / table / board) ---- */
let mtView = (() => { try { return localStorage.getItem('mtView') || 'grouped'; } catch (_) { return 'grouped'; } })();
function setMtView(v) {
  mtView = v;
  try { localStorage.setItem('mtView', v); } catch (_) {}
  render();
}

function mtToolbarHtml() {
  const f = filterState;
  const chips = [];
  if (myTaskFilter) chips.push({ key: 'status', label: `Status: ${myTaskFilter}` });
  if (f.progress)   chips.push({ key: 'progress', label: `Progress: ${f.progress}` });
  if (f.urgency)    chips.push({ key: 'urgency', label: `Urgency: ${f.urgency}` });
  if (f.assignee !== '') { const ap = PEOPLE.find(p => p.id === f.assignee); chips.push({ key: 'assignee', label: `Owner: ${ap ? ap.name : f.assignee}` }); }
  const chipHtml = chips.map(c => `<button class="mt-chip" data-mtchip="${c.key}" title="Remove filter">${esc(c.label)}<span class="mt-chip-x">✕</span></button>`).join('');
  const seg = (v, icon, label) => `<button class="mt-seg-btn${mtView === v ? ' active' : ''}" data-mtview="${v}" aria-pressed="${mtView === v}" title="${label} view">${icon}<span>${label}</span></button>`;
  return `
  <div class="mt-toolbar">
    <div class="mt-search-wrap">
      <svg class="mt-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>
      <input id="mt-search" class="mt-search" type="search" placeholder="Search your tasks…" value="${esc(searchTerm)}" aria-label="Search my tasks">
    </div>
    ${chipHtml}
    ${chips.length ? '<button id="clear-mytasks-filter" class="btn btn-ghost btn-sm">Clear all ✕</button>' : ''}
    <span class="toolbar-spacer"></span>
    <div class="mt-seg" role="group" aria-label="View mode">${seg('grouped', '▤', 'Grouped')}${seg('table', '☰', 'Table')}${seg('board', '▦', 'Board')}</div>
    <button data-export class="btn btn-ghost btn-sm" title="Download tasks as CSV">⬇ CSV</button>
  </div>`;
}

routes.mytasks = () => {
  setCrumbs([{ label: 'Overview', hash: '#/home' }, { label: 'My tasks' }]);
  const me = personById(ME);
  const allMine = TASKS.filter(t => t.assignee === ME);
  const mine = visibleTasks().filter(t => t.assignee === ME); // search + status pills + column filters/sorts
  const done = allMine.filter(t => t.progress === 'Completed').length;
  const pct = allMine.length ? Math.round(done / allMine.length * 100) : 0;
  const dueSoon = allMine.filter(t => {
    if (t.progress === 'Completed') return false;
    const d = metaFor(t).deadline.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d+)/i);
    if (!d) return false;
    const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    const dt = new Date(2026, months.indexOf(d[1].toLowerCase()), +d[2]);
    return dt >= new Date() && dt - Date.now() < 14 * 864e5;
  }).length;
  const critOpen = allMine.filter(t => t.urgency === 'Critical' && t.progress !== 'Completed').length;

  /* hero band */
  const initials = me.initials;
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; })();
  const hero = `
    <header class="mt-hero">
      <div class="avatar avatar-lg" style="--a:${me.color}">${initials}</div>
      <div class="mt-hero-txt">
        <h1>${greeting}, ${esc(me.name.split(' ')[0])} 👋</h1>
        <p>${allMine.length ? `${critOpen ? `<strong>${critOpen} critical task${critOpen > 1 ? 's' : ''}</strong> need attention · ` : ''}${dueSoon ? `${dueSoon} due this week · ` : ''}you're <strong>${pct}% complete</strong>` : 'Nothing on your plate right now.'}</p>
      </div>
      <div class="mt-ring" style="--p:${pct}" role="img" aria-label="${pct}% of your tasks completed">
        <span class="mt-ring-num">${pct}%</span>
      </div>
    </header>`;

  /* status filter pills */
  const pills = `
    <div class="mt-pills" role="group" aria-label="Filter by status">
      <button class="mt-pill${!myTaskFilter ? ' active' : ''}" data-status="">All<span class="mt-pill-n">${allMine.length}</span></button>
      ${STATUS_ORDER.map(st => {
        const n = allMine.filter(t => t.progress === st).length;
        return `<button class="mt-pill${st === myTaskFilter ? ' active' : ''}" data-status="${st}">
          <span class="status-dot ${PROGRESS[st].dot}"></span>${st}<span class="mt-pill-n">${n}</span></button>`;
      }).join('')}
    </div>`;

  let body;
  if (!allMine.length) {
    body = `<div class="empty-state">No tasks assigned to you yet.<br><button class="btn btn-primary btn-sm" style="margin-top:10px" data-goto="#/project/q3-plan">Browse the Q3 Plan board</button></div>`;
  } else {
    const q = searchTerm.trim().toLowerCase();
    const noneShown = !mine.length;
    let content;
    if (noneShown) {
      content = `<div class="empty-state">No matching tasks${q ? ` for “${esc(searchTerm)}”` : ''}.<br>
        <button id="clear-mytasks-filter" class="btn btn-ghost btn-sm" style="margin-top:8px">Clear search &amp; filters</button></div>`;
    } else if (mtView === 'table') {
      content = taskTableHtml(mine);
    } else if (mtView === 'board') {
      content = kanbanColsHtml(mine);
    } else { /* grouped */
      content = STATUS_ORDER.map(st => {
        const list = mine.filter(t => t.progress === st);
        if (!list.length) return '';
        return `
        <section class="mtask-group">
          <h2 class="mtask-group-title"><span class="status-dot ${PROGRESS[st].dot}"></span>${st}<span class="group-count">${list.length}</span></h2>
          ${taskTableHtml(list)}
        </section>`;
      }).join('');
    }
    body = `${pills}${mtToolbarHtml()}<div class="mt-content">${content}</div>`;
  }

  return `<section class="page-pad mtask-page">${hero}${body}</section>`;
};

let myTaskFilter = '';

routes.projects = () => {
  setCrumbs([{ label: 'Workspace' }, { label: 'Projects' }]);
  return `
    <section class="page-pad">
      <div class="page-head"><h1>Projects</h1>
        <p><button id="new-project-btn" class="btn btn-primary btn-sm">＋ New project</button></p></div>
      <div class="project-grid">
        ${PROJECTS.map(pr => `
          <button class="project-card" data-project="${pr.id}">
            <div class="pc-avatar" style="--a:${(personById(pr.members && pr.members[0]) || PEOPLE[0] || { color: '#43b3ff' }).color}">${pr.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
            <h3>${esc(pr.name)}</h3><p>${esc(pr.desc)}</p>
            <div class="pc-meta"><span>${(pr.members || []).length} members</span><span>${typeof pr.open === 'number' ? pr.open : TASKS.filter(t => t.project === pr.id && t.progress !== 'Completed').length} open tasks</span></div>
          </button>`).join('')}
      </div>
    </section>`;
};

routes.project = (param) => {
  const pr = PROJECTS.find(p => p.id === param || slugify(p.name) === param);
  if (!pr) { location.hash = '#/projects'; return ''; }
  currentProject = pr.id;                       // scope board/filters/search to this project
  const tasks = scopedTasks();
  setCrumbs([{ label: 'Overview', hash: '#/home' }, { label: 'Projects', hash: '#/projects' }, { label: pr.name }]);
  const selected = tasks[0] || TASKS[0];
  return `
    <div class="content-split">
      ${boardSectionHtml(pr.name, ['Overview', `Tasks ${tasks.length}`, 'Board'], tasks.length ? (kanbanMode ? 2 : 1) : 1, tasks)}
      ${propertiesPanelHtml(selected)}
    </div>`;
};

/* Board view mode toggle (table ↔ kanban) */
let kanbanMode = false;

/* Active project scope — boards, filters and search only show this project's tasks */
let currentProject = 'q3-plan';
function scopedTasks() { return TASKS.filter(t => t.project === currentProject); }

routes.calendar = () => {
  setCrumbs([{ label: 'Workspace' }, { label: 'Calendar' }]);
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const monthName = now.toLocaleString('en', { month: 'long' });
  const firstDow = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const events = {};
  TASKS.forEach(t => {
    const d = metaFor(t).deadline.match(/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d+)/i);
    if (d) {
      const dayNum = +d[2];
      (events[dayNum] = events[dayNum] || []).push(`<span class="cal-ev ev-purple" title="${esc(t.name)}">${esc(t.name)}</span>`);
    }
  });
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push('<div class="cal-day empty"></div>');
  for (let d = 1; d <= daysInMonth; d++) {
    let ev = (events[d] || []).slice(0, 3).join('');
    if (d % 7 === 2 && !ev) ev = '<span class="cal-ev ev-blue">Standup</span>';
    cells.push(`<button class="cal-day${d === now.getDate() ? ' today' : ''}" data-calday="${d}">${d}${ev}</button>`);
  }
  return `
    <section class="page-pad">
      <div class="page-head"><h1>Calendar — ${monthName} ${year}</h1><p>Deadlines and events from your projects. Click a day to filter tasks.</p></div>
      <div class="calendar">
        <div class="cal-dow">Sun Mon Tue Wed Thu Fri Sat</div>
        <div class="cal-grid">${cells.join('')}</div>
      </div>
    </section>`;
};

routes.roadmaps = () => {
  setCrumbs([{ label: 'Workspace' }, { label: 'Roadmaps' }]);
  const phases = [
    { q: 'Q1', label: 'Foundation', pct: 100 }, { q: 'Q2', label: 'Growth', pct: 100 },
    { q: 'Q3', label: 'Q3 Plan', pct: 55 }, { q: 'Q4', label: 'Scale', pct: 10 },
  ];
  return `
    <section class="page-pad">
      <div class="page-head"><h1>Roadmaps</h1><p>Strategic timeline across quarters.</p></div>
      <div class="roadmap">
        ${phases.map(p => `
          <button class="rm-phase" data-goto="#/projects">
            <div class="rm-top"><strong>${p.q}</strong> ${p.label}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${p.pct}%"></div></div>
            <span class="rm-pct">${p.pct}% complete</span>
          </button>`).join('')}
      </div>
    </section>`;
};

routes.channel = (param) => {
  const key = param || 'engineering';
  const ch = CHANNELS[key] || { topic: 'Team conversation.' };
  const name = key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  setCrumbs([{ label: 'Channels' }, { label: '#' + name }]);
  const msgs = CHANNEL_MESSAGES[key] || [];
  return `
    <section class="page-pad">
      <div class="page-head"><h1># ${name}</h1><p>${ch.topic}</p></div>
      <ul class="chat-list">
        ${msgs.map(m => `
          <li><span class="avatar avatar-sm" style="--a:${m.color}">${m.initials}</span>
            <div class="chat-body"><div class="chat-top"><strong>${m.who}</strong><em>${m.time}</em></div>
            <p>${esc(m.text)}</p></div></li>`).join('') || '<div class="empty-state">No messages yet — say hi!</div>'}
      </ul>
      <form id="chat-form" class="comment-input chat-input">
        <input id="chat-box" type="text" placeholder="Message # ${name} (Enter to send)" aria-label="Send a message" />
        <button id="chat-send" class="btn btn-primary btn-sm" type="submit">Send</button>
      </form>
    </section>`;
};

routes.settings = () => {
  setCrumbs([{ label: 'TaskHive' }, { label: 'Settings' }]);
  const me = mePerson() || { name: '', email: '' };
  return `
    <section class="page-pad narrow">
      <div class="page-head"><h1>Settings</h1></div>
      <div class="settings-group">
        <h3>Profile</h3>
        <p class="muted">You are signed in as <strong>${esc(me.name || '—')}</strong>.</p>
        <label>Display name<input id="set-name" type="text" value="${esc(me.name)}" /></label>
        <label>Email<input id="set-email" type="email" value="${esc(me.email || '')}" /></label>
        <label>New password<input id="set-password" type="password" placeholder="leave blank to keep current password" autocomplete="new-password" /></label>
      </div>
      <div class="settings-group">
        <h3>Preferences</h3>
        <label class="switch-row">Email notifications<input type="checkbox" checked /></label>
        <label class="switch-row">Weekly digest<input type="checkbox" /></label>
        <label class="switch-row">Dark mode (preview)<input type="checkbox" id="set-dark" ${document.documentElement.classList.contains('dark') ? 'checked' : ''} /></label>
      </div>
      <div class="settings-actions">
        <button id="save-settings" class="btn btn-primary">Save changes</button>
        <button id="logout-btn" class="btn btn-ghost">Sign out</button>
        <button id="reset-data" class="btn btn-ghost danger">Reset demo data</button>
      </div>
    </section>`;
};

routes.help = () => {
  setCrumbs([{ label: 'Support' }, { label: 'Help & support' }]);
  const faqs = [
    ['How do I create a task?', 'Use the “New feature” button in the top bar of any project board.'],
    ['Where are my saved items?', 'Click ☆ in a task’s Properties panel — they appear under Saved items.'],
    ['How does Inbox work?', 'Mentions, assignments and reviews land there; click a notification to jump to its task.'],
    ['Can I share a project?', 'Yes — the Share button copies a workspace link to your clipboard.'],
  ];
  return `
    <section class="page-pad narrow">
      <div class="page-head"><h1>Help &amp; support</h1><p>Frequently asked questions about this workspace.</p></div>
      <div class="faq">
        ${faqs.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('')}
      </div>
      <div class="settings-actions">
        <button id="contact-support" class="btn btn-primary">Contact support</button>
        <button id="keyboard-shortcuts" class="btn btn-ghost">Keyboard shortcuts</button>
      </div>
    </section>`;
};

function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

/* ============================ GLOBAL ACTIONS ============================ */

function showUpgradeModal() {
  openModal('Upgrade plan', `
    <p class="modal-lead">Unlock unlimited projects, guests and history.</p>
    <div class="plan-grid">
      <div class="plan"><h3>Starter</h3><div class="plan-price">$0</div><ul><li>3 projects</li><li>15 tasks/project</li></ul><button class="btn btn-ghost btn-sm plan-btn">Current</button></div>
      <div class="plan featured"><h3>Pro</h3><div class="plan-price">$12<span>/mo</span></div><ul><li>Unlimited projects</li><li>Guest access</li><li>Priority support</li></ul><button class="btn btn-primary btn-sm plan-btn" data-plan="Pro">Choose Pro</button></div>
      <div class="plan"><h3>Business</h3><div class="plan-price">$29<span>/mo</span></div><ul><li>SSO & audit logs</li><li>Advanced roadmaps</li></ul><button class="btn btn-primary btn-sm plan-btn" data-plan="Business">Choose Business</button></div>
    </div>`);
}

function showShareModal(projectName) {
  openModal(`Share “${projectName}”`, `
    <label>Invite by email<input id="share-email" type="email" placeholder="teammate@company.com" /></label>
    <label class="switch-row">Can edit<input type="checkbox" checked /></label>
    <div class="share-link-row">
      <input id="share-link" type="text" readonly value="https://app.catlas.inc/p/${slugify(projectName)}" />
      <button id="copy-link" class="btn btn-primary btn-sm">Copy link</button>
    </div>
    <button id="send-invite" class="btn btn-ghost btn-sm">Send invite</button>`);
}

function showNewFeatureModal() {
  openModal('New feature', `
    <form id="new-feature-form">
      <label>Name<input id="nf-name" type="text" required placeholder="e.g. Add keyboard shortcuts" /></label>
      <label>Progress<select id="nf-progress">${Object.keys(PROGRESS).map(k => `<option>${k}</option>`).join('')}</select></label>
      <label>Urgency<select id="nf-urgency">${Object.keys(URGENCY).map(k => `<option>${k}</option>`).join('')}</select></label>
      <label>Assignee<select id="nf-assignee">${PEOPLE.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></label>
      <label>Project<select id="nf-project">${PROJECTS.map(p => `<option value="${slugify(p.name)}" ${slugify(p.name) === currentProject ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <button type="submit" class="btn btn-primary">Create task</button>
    </form>`);
}

/* ============================ EVENT DELEGATION ============================ */

document.body.addEventListener('click', (e) => {
  /* ---- column header menu: handle first, before generic closest() ---- */
  const menuBtn = e.target.closest('.col-menu [data-menuact]');
  if (menuBtn) {
    const [kind, a, b] = menuBtn.dataset.menuact.split(':');
    closeColMenus();
    if (kind === 'sort') sortState = { key: a, dir: b === 'asc' ? 1 : -1 };
    else if (kind === 'setf') filterState[a] = decodeURIComponent(b);
    else if (kind === 'clearf') filterState[a] = '';
    refreshViews();
    return;
  }
  const thBtn = e.target.closest('.th-btn');
  if (thBtn) { openColMenu(thBtn); return; }
  if (document.querySelector('.col-menu')) closeColMenus(); // click outside → dismiss

  const el = e.target.closest('[id],[data-goto],[data-calday],[data-project],[data-inbox],[data-attachment],[data-person],[data-plan],[data-view],[data-export],[data-status],[data-mtview],[data-mtchip],[data-del]');
  if (!el) return;

  // My Tasks status pills (must run before the generic closest() id lookup)
  const pill = e.target.closest('.mt-pill');
  if (pill) {
    const st = pill.dataset.status;
    myTaskFilter = (!st || st === myTaskFilter) ? '' : st; // "All" resets; clicking active pill toggles off
    render();
    return;
  }

  // board table/kanban view toggle
  if (el.dataset.view !== undefined && el.classList.contains('vt-btn')) { setKanban(el.dataset.view === 'kanban'); return; }

  // simple navigation shortcuts
  const goto = el.getAttribute('data-goto');
  if (goto) { location.hash = goto; return; }

  if (el.id === 'upgrade-btn') return showUpgradeModal();
  if (el.id === 'new-feature-btn') return showNewFeatureModal();
  if (el.dataset.plan) { closeModal(); return toast(`🎉 ${el.dataset.plan} plan selected (demo)`); }
  if (el.id === 'copy-link') {
    const inp = $('#share-link');
    const done = () => toast('Link copied to clipboard');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(inp.value).then(done, () => fallbackCopy(inp, done));
    } else fallbackCopy(inp, done);
    return;
  }
  if (el.id === 'send-invite') {
    const v = $('#share-email').value.trim();
    if (!v) return toast('Enter an email first');
    $('#share-email').value = ''; return toast(`Invite sent to ${v}`);
  }
  if (el.id === 'share-btn') {
    const title = el.closest('.board')?.querySelector('.project-title')?.textContent || 'Q3 Plan';
    return showShareModal(title);
  }

  if (el.id === 'mark-all-read') {
    INBOX_ITEMS.forEach(it => { readFlags[it.id] = true; });
    patchInboxReadAll();
    persist(); render(); return toast('Inbox cleared');
  }
  if (el.dataset.inbox !== undefined) {
    const it = INBOX_ITEMS.find(x => x.id === el.dataset.inbox);
    if (!it) return;
    readFlags[it.id] = true; patchInboxRead(it.id); persist();
    if (it.task != null) {
      const t = TASKS.find(x => x.id === it.task);
      if (t) { location.hash = `#/task/${t.idx}`; return; }
    }
    render();
    return;
  }
  if (el.dataset.calday !== undefined) {
    const day = el.dataset.calday;
    const matches = TASKS.filter(t => metaFor(t).deadline.includes(` ${day},`));
    if (!matches.length) return toast(`No deadlines on day ${day}`);
    openModal(`Deadlines on the ${day}th`, `
      <ul class="mini-tasks">${matches.map(t =>
        `<li><span class="status-dot ${PROGRESS[t.progress].dot}"></span><a href="#/task/${t.idx}">${esc(t.name)}</a></li>`).join('')}</ul>`);
    return;
  }
  if (el.dataset.project !== undefined) {
    location.hash = `#/project/${el.dataset.project}`;
    return;
  }
  if (el.id === 'new-project-btn') {
    return openModal('New project', `<form id="new-project-form"><label>Project name<input id="np-name" type="text" required placeholder="e.g. Mobile App v3" /></label><label>Owner<select id="np-owner">${PEOPLE.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></label><button class="btn btn-primary">Create project</button></form>`);
  }
  if (el.dataset.person !== undefined) {
    const p = personById(el.dataset.person);
    return openModal(p.name, `
      <div class="profile-head"><span class="avatar" style="--a:${p.color};width:48px;height:48px;font-size:16px">${p.initials}</span>
      <div><h3>${esc(p.name)}</h3><p>Engineering · TaskHive</p></div></div>
      <p class="modal-lead">Assigned tasks:</p>
      <ul class="mini-tasks">${TASKS.filter(t => t.assignee === el.dataset.person).map(t =>
        `<li><span class="status-dot ${PROGRESS[t.progress].dot}"></span><a href="#/task/${t.idx}">${esc(t.name)}</a></li>`).join('')}</ul>`);
  }
  if (el.dataset.attachment) { e.preventDefault(); return toast(`⬇ Downloading ${el.dataset.attachment}… (demo)`); }

  if (el.id === 'save-toggle') {
    const t = byIdx(+(el.dataset.idx ?? 0));
    if (!t) return;
    if (savedIds.includes(t.id)) { savedIds = savedIds.filter(i => i !== t.id); toast('Removed from saved items'); }
    else { savedIds.push(t.id); toast('★ Saved item'); }
    persist(); render(); return;
  }
  if (el.id === 'save-settings') {
    const nameEl = $('#set-name'), emailEl = $('#set-email'), passEl = $('#set-password');
    const body = {};
    if (nameEl && nameEl.value.trim()) body.name = nameEl.value.trim();
    if (emailEl && emailEl.value.trim()) body.email = emailEl.value.trim();
    if (passEl && passEl.value) body.password = passEl.value;
    if (!ME) return toast('Sign in first');
    updateProfile(body).then(updated => {
      const i = PEOPLE.findIndex(p => p.id === updated.id);
      if (i > -1) PEOPLE[i] = updated; else PEOPLE.push(updated);
      try { localStorage.removeItem(LS_KEY + '.' + ME); } catch (_) {}
      location.hash = '#/home';
      render();
      toast('✔ Settings saved');
    }).catch(err => {
      if (err.status === 401) handleAuthError(err);
      else toast(`⚠ ${err.message}`);
    });
    return;
  }
  if (el.id === 'logout-btn') return doLogout().then(() => renderLoginScreen());
  if (el.id === 'reset-data') {
    try { localStorage.clear(); } catch (_) {}
    savedIds = []; readFlags = {};
    patchPrefs();
    location.hash = '#/home';
    loadBootstrap().then(render); return toast('Workspace reloaded from server');
  }
  if (el.id === 'contact-support') return openModal('Contact support', `<form id="support-form"><label>Subject<input type="text" required /></label><label>Message<textarea rows="4" required></textarea></label><button class="btn btn-primary">Send message</button></form>`);
  if (el.id === 'keyboard-shortcuts') return openModal('Keyboard shortcuts', `<ul class="shortcuts"><li><kbd>N</kbd> New feature</li><li><kbd>/</kbd> Focus search</li><li><kbd>Esc</kbd> Close dialogs</li><li><kbd>Ctrl/Cmd</kbd>+<kbd>Z</kbd> Undo last change</li><li><kbd>Ctrl/Cmd</kbd>+<kbd>Shift</kbd>+<kbd>L</kbd> Toggle dark mode</li><li><kbd>Enter</kbd> on a focused row opens the task</li></ul>`);

  // task row selection inside boards
  const tr = e.target.closest('.task-table tbody tr');
  if (tr && !e.target.closest('.link-avatar') && !e.target.closest('button') && !e.target.closest('input')) {
    document.querySelectorAll('.task-table tbody tr.selected').forEach(r => r.classList.remove('selected'));
    tr.classList.add('selected');
    const propsHost = document.querySelector('.content-split .properties') || document.querySelector('.page-pad .properties');
    if (propsHost) {
      const fresh = document.createElement('div');
      fresh.innerHTML = propertiesPanelHtml(byIdx(+tr.dataset.idx));
      propsHost.replaceWith(fresh.firstElementChild);
    } else {
      const t = TASKS.find(x => x.idx === +tr.dataset.idx);
      if (t) location.hash = `#/task/${t.idx}`;
    }
  }

  /* ---- delete with confirm dialog ---- */
  if (el.dataset.del !== undefined) {
    const t = TASKS.find(x => x.idx === +el.dataset.del);
    if (!t) return;
    return openModal('Delete task?', `
      <p class="modal-lead">“${esc(t.name)}” will be removed from the board. You can undo right after.</p>
      <div class="settings-actions">
        <button id="confirm-delete" data-idx="${t.idx}" class="btn btn-primary danger">Delete</button>
        <button id="cancel-delete" class="btn btn-ghost">Cancel</button>
      </div>`);
  }
  if (el.id === 'confirm-delete') { deleteTask(+el.dataset.idx); closeModal(); return; }
  if (el.id === 'cancel-delete') { closeModal(); return; }

  /* ---- rename from Properties panel ---- */
  if (el.id === 'edit-task-btn') { startRename(+el.dataset.idx); return; }

  /* ---- clear filters / export csv / bulk actions / undo ---- */
  if (el.id === 'clear-filters') { filterState = { progress: '', urgency: '', assignee: '' }; renderBoardBody(); return; }
  if (el.id === 'clear-mytasks-filter') { myTaskFilter = ''; searchTerm = ''; sortState = { key: null, dir: 1 }; filterState = { progress: '', urgency: '', assignee: '' }; const gs = $('#global-search'); if (gs) gs.value = ''; render(); return; }
  if (el.classList.contains('mt-pill')) {
    const st = el.dataset.status;
    myTaskFilter = (!st || st === myTaskFilter) ? '' : st; // "All" resets; clicking active pill toggles off
    render();
    return;
  }
  if (el.dataset.mtview) { setMtView(el.dataset.mtview); return; }
  if (el.dataset.mtchip) {
    const k = el.dataset.mtchip;
    if (k === 'status') myTaskFilter = '';
    else filterState[k] = '';
    render();
    return;
  }
  if (el.hasAttribute('data-export')) { exportCsv(visibleTasks()); return toast('⬇ tasks.csv downloaded'); }
  if (el.id === 'bulk-delete') { bulkDelete(); return; }
  if (el.id === 'undo-btn') { undoLast(); return; }

  // tabs on boards
  const tab = e.target.closest('.tab');
  if (tab) {
    const tabsWrap = tab.closest('.tabs');
    tabsWrap.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const i = +tab.dataset.tab;
    const host = $('#board-body');
    if (!host) return;
    if (i === 2) { kanbanMode = true; renderKanban(); return; }
    kanbanMode = false;
    if (currentRoute === 'mytasks') { render(); return; } else {
      host.innerHTML = i === 0 ? overviewHtml() : (toolbarHtml() + (() => { const rows = visibleTasks(); return rows.length ? taskTableHtml(rows) : '<div class="empty-state">No tasks match your search or filters.</div>'; })());
    }
  }
});

/* ---- bulk action bar (appears when rows are checked) ---- */
document.body.addEventListener('change', (e) => {
  if (e.target.classList.contains('row-check')) updateBulkBar();
  if (e.target.id === 'flt-progress') { filterState.progress = e.target.value; refreshViews(); }
  if (e.target.id === 'flt-urgency')  { filterState.urgency = e.target.value; refreshViews(); }
  if (e.target.id === 'flt-assignee') { filterState.assignee = e.target.value; refreshViews(); }
  if (e.target.id === 'prop-status') {
    const idx = +e.target.dataset.idx;
    const t = TASKS.find(x => x.idx === idx);
    if (t) {
      const old = t.progress; t.progress = e.target.value;
      patchTask(t, { progress: t.progress }, 'Status not saved');
      updateTaskRow(idx);
      showUndoToast(`Status → ${t.progress}`);
      undoStack.push({ label: `Status change`, run: () => { t.progress = old; patchTask(t, { progress: old }); render(); } });
    }
  }
});

function updateBulkBar() {
  const n = document.querySelectorAll('.row-check:checked').length;
  let bar = $('.bulkbar');
  if (!n) { if (bar) bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'bulkbar';
    bar.innerHTML = `<span id="bulk-count"></span><button id="bulk-delete" class="btn btn-primary btn-sm danger">🗑 Delete selected</button>`;
    ($('.board') || document.body).appendChild(bar);
  }
  bar.querySelector('#bulk-count').textContent = `${n} selected`;
}

/* double-click a task name to rename inline */
document.body.addEventListener('dblclick', (e) => {
  const name = e.target.closest('.feature-name');
  if (name) {
    const tr = name.closest('tr[data-idx]');
    if (tr) startRename(+tr.dataset.idx);
  }
});

/* keyboard: Enter on a focused row opens the task; ↑/↓ move between rows */
document.body.addEventListener('keydown', (e) => {
  const tr = e.target.closest('.task-table tbody tr[data-idx]');
  if (!tr || e.target.tagName === 'INPUT') return;
  if (e.key === 'Enter') {
    e.preventDefault();
    const t = TASKS.find(x => x.idx === +tr.dataset.idx);
    if (t) location.hash = `#/task/${t.idx}`;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const rows = [...document.querySelectorAll('.task-table tbody tr[data-idx]')];
    const i = rows.indexOf(tr);
    const next = rows[i + (e.key === 'ArrowDown' ? 1 : -1)];
    if (next) next.focus();
  }
});

/* Overview tab content for the project board */
function overviewHtml() {
  const scope = (currentRoute === 'project' || currentRoute === 'task') ? scopedTasks() : TASKS;
  const counts = {};
  scope.forEach(t => counts[t.progress] = (counts[t.progress] || 0) + 1);
  return `
    <div class="overview">
      <h3>Status breakdown</h3>
      <div class="bar-chart">
        ${Object.entries(counts).map(([k, v]) => `
          <div class="bar-row"><span class="bar-label"><span class="status-dot ${PROGRESS[k].dot}"></span>${k}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v / Math.max(scope.length,1) * 100)}%"></div></div>
          <span class="bar-count">${v}</span></div>`).join('')}
      </div>
      <h3>Team</h3>
      <div class="team-row">
        ${PEOPLE.map(p => `<button class="avatar link-avatar" data-person="${p.id}" style="--a:${p.color}" title="${p.name}">${p.initials}</button>`).join('')}
      </div>
      <p class="modal-lead">Switch to the <strong>Tasks</strong> tab to see all ${scope.length} features.</p>
    </div>`;
}

/* Task detail route */
routes.task = (param) => {
  const t = TASKS.find(x => x.idx === +param);
  if (!t) { location.hash = '#/project/q3-plan'; return ''; }
  currentProject = t.project || 'q3-plan';   // scope the board to this task's project
  const prName = (PROJECTS.find(p => slugify(p.name) === currentProject) || { name: 'Q3 Plan' }).name;
  setCrumbs([{ label: 'Overview', hash: '#/home' }, { label: 'Projects', hash: '#/projects' }, { label: prName, hash: `#/project/${currentProject}` }, { label: t.name }]);
  return `
    <div class="content-split">
      ${boardSectionHtml(prName, ['Overview', `Tasks ${scopedTasks().length}`, 'Board'], kanbanMode ? 2 : 1, filteredTasks())}
      ${propertiesPanelHtml(t)}
    </div>`;
};

/* ============================ SEARCH ============================ */

let searchTerm = '';
function filteredTasks() {
  const q = searchTerm.trim().toLowerCase();
  const base = (currentRoute === 'project' || currentRoute === 'task') ? scopedTasks() : TASKS;
  return base.filter(t => !q || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
}

document.body.addEventListener('input', (e) => {
  if (e.target.id === 'mt-search') {
    searchTerm = e.target.value;
    render(); // full re-render keeps pills, chips, counts and all grouped sections in sync
  }
});

$('#global-search').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  const onBoard = ['project', 'task'].includes(currentRoute);
  if (onBoard && $('#board-body')) {
    renderBoardBody(); // keeps toolbar, filters and sort intact
  } else if (!onBoard && searchTerm.trim()) {
    // searching from a non-board page: jump to the Q3 board with the filter applied
    location.hash = '#/project/q3-plan';
  } else if (!onBoard) {
    // live search results for Home / My tasks / Saved tables
    const tbody = $('#task-rows');
    if (tbody) {
      const scope = currentRoute === 'mytasks' ? TASKS.filter(t => t.assignee === ME)
                  : currentRoute === 'saved'   ? TASKS.filter(t => savedIds.includes(t.id))
                  : TASKS;
      const q = searchTerm.trim().toLowerCase();
      const rows = scope.filter(t => !q || t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
      tbody.innerHTML = rows.length ? rows.map(taskRowHtml).join('')
        : `<tr><td colspan="6" class="no-results">No tasks match “${esc(searchTerm)}”.</td></tr>`;
    }
  }
});
$('#global-search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !$('#task-rows')) location.hash = '#/project/q3-plan';
});

/* ============================ FORM SUBMITS (delegated) ============================ */

document.body.addEventListener('submit', (e) => {
  if (e.target.id === 'new-feature-form') {
    e.preventDefault();
    const name = $('#nf-name').value.trim();
    if (!name) return;
    const body = {
      name,
      progress: $('#nf-progress').value, urgency: $('#nf-urgency').value,
      assignee: $('#nf-assignee').value,
      project: $('#nf-project') ? $('#nf-project').value : 'q3-plan',
      comments: 0,
    };
    api('POST', '/tasks', body).then(created => {   // server assigns id + stable idx
      TASKS.unshift(created);
      closeModal(); toast(`✔ Created “${name}”`);
      if (!location.hash.startsWith('#/project') && !location.hash.startsWith('#/task')) location.hash = '#/project/q3-plan';
      else render();
    }).catch(err => toast(`⚠ Create failed: ${err.message}`));
  }
  if (e.target.id === 'new-project-form') {
    e.preventDefault();
    const name = $('#np-name').value.trim();
    if (!name) return;
    saveProject(name).then(pr => {
      PROJECTS.push(pr);
      closeModal(); toast(`✔ Project “${pr.name}” created`); render();
    }).catch(err => toast(`⚠ Could not create project: ${err.message}`));
  }
  if (e.target.id === 'support-form') {
    e.preventDefault(); closeModal(); toast('✉ Message sent to support');
  }
  if (e.target.id === 'comment-form') {
    e.preventDefault();
    const box = $('#comment-box'); const v = box.value.trim();
    if (!v) return;
    const idx = +box.dataset.idx;
    const t = TASKS.find(x => x.idx === idx);
    if (!t) return;
    postComment(t.id, v).then(({ comment, comments }) => {
      (DISCUSSIONS[t.id] = DISCUSSIONS[t.id] || []).push(comment);
      t.comments = comments;
      const li = document.createElement('li');
      li.innerHTML = `<span class="avatar avatar-sm" style="--a:${comment.color}">${comment.initials}</span><div class="comment-body"><div class="comment-author">${esc(comment.who)}</div><p>${esc(comment.text)}</p></div>`;
      $('#comment-list').appendChild(li);
      box.value = '';
      updateTaskRow(idx);
      toast('💬 Comment posted');
    }).catch(err => toast(`⚠ Comment not saved: ${err.message}`));
  }
  if (e.target.id === 'chat-form') {
    e.preventDefault();
    const box = $('#chat-box'); const v = box.value.trim();
    if (!v) return;
    const key = parseHash().param || 'engineering';
    postChannelMsg(key, v).then(msg => {
      (CHANNEL_MESSAGES[key] = CHANNEL_MESSAGES[key] || []).push(msg);
      const list = $('.chat-list');
      if (list.querySelector('.empty-state')) render();
      else {
        const li = document.createElement('li');
        li.innerHTML = `<span class="avatar avatar-sm" style="--a:${msg.color}">${msg.initials}</span><div class="chat-body"><div class="chat-top"><strong>${esc(msg.who)}</strong><em>${msg.time}</em></div><p>${esc(msg.text)}</p></div>`;
        list.appendChild(li);
      }
      box.value = '';
    }).catch(err => toast(`⚠ Message not saved: ${err.message}`));
  }
});

/* Dark-mode preview toggle (persisted) */
document.body.addEventListener('change', (e) => {
  if (e.target.id === 'set-dark') {
    toggleDarkMode(e.target.checked);
  }
});

function toggleDarkMode(force) {
  const html = document.documentElement;
  const on = typeof force === 'boolean' ? force : !html.classList.contains('dark');
  html.classList.toggle('dark', on);
  try { localStorage.setItem('darkMode', on ? '1' : '0'); } catch (_) {}
  const cb = document.getElementById('set-dark');
  if (cb) cb.checked = on;
  toast(on ? '🌙 Dark mode on' : '☀️ Light mode on');
}

/* ============================ INIT ============================ */

(function applySavedDarkMode() {
  let on = false;
  try { on = localStorage.getItem('darkMode') === '1'; } catch (_) {}
  document.documentElement.classList.toggle('dark', on);
})();

/* Boot: hydrate in-memory state from GET /api/bootstrap, then render.
   Phase 2: bootstrap also returns the current session user; unauthenticated
   visitors get the login screen instead of workspace data. */
async function loadBootstrap() {
  try {
    const d = await api('GET', '/bootstrap');
    PEOPLE        = d.people || [];
    TASKS         = d.tasks || [];
    PROJECTS      = d.projects || [];
    INBOX_ITEMS   = d.inbox || [];
    DISCUSSIONS   = d.discussions || {};
    CHANNEL_MESSAGES = d.messages || {};
    if (d.user) { ME = d.user.id; hideLoginScreen(); }   // session cookie present — enter workspace
    else if (!document.body.classList.contains('show-login')) { showLoginScreen(); return; }
    // server prefs win over the stale localStorage cache
    savedIds = Array.isArray(d.savedIds) ? d.savedIds.filter(x => typeof x === 'string') : [];
    readFlags = (d.readFlags && typeof d.readFlags === 'object') ? d.readFlags : {};
    INBOX_ITEMS.forEach(it => { if (it.unread === false) readFlags[it.id] = true; });
    persist(); // push merged prefs back into the per-user cache/server copy
    nextTaskNum = Math.max(100, ...TASKS.map(t => parseInt(String(t.id).replace(/\D/g, ''), 10) || 0)) + 1;
  } catch (err) {
    console.error('bootstrap failed:', err);
    if (err.status === 401) { ME = null; showLoginScreen('Please sign in to continue.'); renderLoginScreen(); return; }
    hideLoginScreen();
    pageEl.innerHTML = `<section class="page-pad"><div class="empty-state">⚠ Could not reach the server.<br>
      Start it with <code>npm start</code>, then refresh this page.</div></section>`;
    return;
  }
  const loading = $('#boot-loading');
  if (loading) loading.remove();
  if (!location.hash) location.hash = '#/home';
  render();
}

/* Login-screen wiring (delegated so it survives re-renders) */
document.body.addEventListener('submit', (e) => {
  if (e.target.id === 'login-form') {
    e.preventDefault();
    const btn = $('#login-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
    doLogin($('#login-email').value, $('#login-password').value)
      .catch(err => {
        if (btn) { btn.disabled = false; btn.textContent = 'Sign in'; }
        loginNotice = err.message || 'Sign-in failed';
        renderLoginScreen();
      });
  }
  if (e.target.id === 'signup-form') {
    e.preventDefault();
    api('POST', '/signup', {
      name: $('#signup-name').value.trim(),
      email: $('#signup-email').value.trim(),
      password: $('#signup-password').value,
    }).then(d => {
      authExpired = false;
      ME = d.user.id;
      hideLoginScreen();
      return loadBootstrap();
    }).catch(err => {
      loginNotice = err.message || 'Sign-up failed';
      renderLoginScreen();
      const sf = $('#signup-form');   // reopen the signup panel with the error visible
      if (sf) { sf.classList.remove('hidden'); $('#show-signup')?.closest('.login-card').querySelector('.login-alt')?.classList.add('hidden'); }
    });
  }
});

document.body.addEventListener('click', (e) => {
  const el = e.target.closest('#show-signup, #show-login');
  if (!el) return;
  const sf = $('#signup-form'), lf = $('#login-form'), alt = $('#show-signup')?.parentElement;
  if (el.id === 'show-signup') { if (sf) sf.classList.remove('hidden'); if (lf) lf.classList.add('hidden'); if (alt) alt.classList.add('hidden'); }
  else { if (sf) sf.classList.add('hidden'); if (lf) lf.classList.remove('hidden'); if (alt) alt.classList.remove('hidden'); }
});

/* Boot: always start on the login screen; if a session cookie exists the
   workspace hydrates immediately behind it (loadBootstrap hides the overlay). */
function boot() {
  renderLoginScreen();
  showLoginScreen();
  loadBootstrap();
}

boot();
