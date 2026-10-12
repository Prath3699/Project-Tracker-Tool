/* Issue Tracker Dashboard — SPA: hash router, pages, modals, toasts */

/* ---- escape hatch for inline onclick handlers (script is strict-mode) ---- */
window.__app = {};

/* ============================ DATA ============================ */

const PROGRESS = {
  Ongoing:     { dot: 'dot-ongoing' },
  Completed:   { dot: 'dot-completed' },
  'In review': { dot: 'dot-review' },
  Pending:     { dot: 'dot-pending' },
};

const URGENCY = { Critical: 'pill-critical', Moderate: 'pill-moderate', Minor: 'pill-minor' };

const PEOPLE = [
  { name: 'Priya Sharma', initials: 'PS', color: '#43b3ff' },
  { name: 'David Lee',    initials: 'DL', color: '#ffa575' },
  { name: 'Maya Chen',    initials: 'MC', color: '#7b60ff' },
  { name: 'Alex Kim',     initials: 'AK', color: '#3eb957' },
  { name: 'Sara Noor',    initials: 'SN', color: '#db672d' },
];

// Task list exactly as in the design (15 tasks)
let TASKS = [
  { id: 'TSK-8',  name: 'Improve Navigation & Menu Organization', progress: 'Ongoing',   urgency: 'Moderate', assignee: 2, comments: 0 },
  { id: 'TSK-20', name: 'Enhance Search Functionality',           progress: 'Completed', urgency: 'Critical', assignee: 1, comments: 6 },
  { id: 'TSK-22', name: 'Dark Mode Implementation',               progress: 'In review', urgency: 'Minor',    assignee: 0, comments: 0 },
  { id: 'TSK-6',  name: 'Optimize Mobile Responsiveness',         progress: 'Ongoing',   urgency: 'Moderate', assignee: 3, comments: 0 },
  { id: 'TSK-6',  name: 'Redesign Checkout Flow',                 progress: 'Ongoing',   urgency: 'Critical', assignee: 4, comments: 0 },
  { id: 'TSK-10', name: 'Speed Optimization for Home Page',       progress: 'Ongoing',   urgency: 'Critical', assignee: 1, comments: 0 },
  { id: 'TSK-40', name: 'Reduce Load Time for Large Data Sets',   progress: 'Pending',   urgency: 'Minor',    assignee: 2, comments: 0 },
  { id: 'TSK-12', name: 'Optimize Image Compression for Faster Loading', progress: 'In review', urgency: 'Moderate', assignee: 0, comments: 0 },
  { id: 'TSK-18', name: 'Introduce AI-powered Task Prioritization', progress: 'Completed', urgency: 'Moderate', assignee: 3, comments: 4 },
  { id: 'TSK-12', name: 'Multi-language Support Implementation',  progress: 'Completed', urgency: 'Critical', assignee: 4, comments: 1 },
  { id: 'TSK-12', name: 'Missing Tooltip on Product Images',      progress: 'Completed', urgency: 'Moderate', assignee: 1, comments: 0 },
  { id: 'TSK-22', name: 'Integrate Third-party Calendar Sync',    progress: 'Completed', urgency: 'Critical', assignee: 2, comments: 4 },
  { id: 'TSK-14', name: 'Enhance User Authentication with 2FA',   progress: 'Pending',   urgency: 'Minor',    assignee: 0, comments: 0 },
  { id: 'TSK-27', name: 'GDPR Compliance Updates',                progress: 'Pending',   urgency: 'Minor',    assignee: 3, comments: 0 },
  { id: 'TSK-18', name: 'Data Encryption for Sensitive Information', progress: 'In review', urgency: 'Minor', assignee: 4, comments: 3 },
].map((t, i) => ({ ...t, idx: i, project: 'q3-plan' }));

/* NOTE: some task IDs repeat in the original design mockup; give every task a
   unique internal id so deep links, saved items and new tasks never collide. */
let nextTaskNum = 100;

const PROJECTS = [
  { name: 'Q3 Plan',            desc: 'Product roadmap & delivery plan for Q3', members: 5, open: 15 },
  { name: 'Website Redesign',   desc: 'New marketing site and design system',   members: 4, open: 12 },
  { name: 'Mobile App v2.0',    desc: 'Feature parity with web + offline mode', members: 6, open: 23 },
  { name: 'API Documentation',  desc: 'Public developer docs refresh',          members: 3, open: 8 },
  { name: 'Customer Portal',    desc: 'Self-service dashboard for clients',     members: 5, open: 17 },
  { name: 'Internal Tools',     desc: 'Admin utilities and ops automation',     members: 2, open: 6 },
];

/* Seed a few tasks into other projects so non-Q3 boards aren't dead ends */
PROJECTS.filter(p => p.name !== 'Q3 Plan').forEach((p, pi) => {
  const owners = [pi % PEOPLE.length, (pi + 2) % PEOPLE.length];
  const names = [
    `Kick-off & scope “${p.name}”`,
    `Define success metrics for ${p.name}`,
  ];
  names.forEach((n, ni) => TASKS.push({
    id: 'TSK-' + (50 + pi * 2 + ni), name: n,
    progress: ni === 0 ? 'Ongoing' : 'Pending',
    urgency: ['Moderate', 'Minor', 'Critical'][pi % 3],
    assignee: owners[ni], comments: 0,
    idx: 500 + pi * 2 + ni, project: slugifyStatic(p.name),
  }));
});

function slugifyStatic(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

const INBOX_ITEMS = [
  { who: 'David Lee',  initials: 'DL', color: '#ffa575', text: 'mentioned you in “Enhance Search Functionality”', time: '10 min ago', task: 1, unread: true },
  { who: 'Priya Sharma', initials: 'PS', color: '#43b3ff', text: 'assigned you “Dark Mode Implementation”',       time: '32 min ago', task: 2, unread: true },
  { who: 'Maya Chen',  initials: 'MC', color: '#7b60ff', text: 'completed “Introduce AI-powered Task Prioritization”', time: '1 h ago', task: 8, unread: true },
  { who: 'Alex Kim',   initials: 'AK', color: '#3eb957', text: 'commented on “Optimize Mobile Responsiveness”',   time: '3 h ago', task: 3, unread: false },
  { who: 'Sara Noor',  initials: 'SN', color: '#db672d', text: 'requested review of “Data Encryption for Sensitive Information”', time: 'Yesterday', task: 14, unread: false },
  { who: 'David Lee',  initials: 'DL', color: '#ffa575', text: 'changed urgency of “Redesign Checkout Flow” to Critical', time: 'Yesterday', task: 4, unread: false },
  { who: 'Priya Sharma', initials: 'PS', color: '#43b3ff', text: 'shared the project “Q3 Plan” with you',          time: '2 days ago', task: null, unread: false },
];

const CHANNELS = {
  engineering:    { topic: 'Builds, incidents and API chatter for the platform team.' },
  docs:           { topic: 'Everything documentation — PRDs, guides, changelogs.' },
  teams:          { topic: 'Cross-team coordination and people ops.' },
  initiatives:    { topic: 'Quarterly strategic initiatives and OKRs.' },
  'active-sprint':{ topic: 'Daily standups and blockers for the current sprint.' },
  design:         { topic: 'Design critiques, mockups and the design system.' },
  marketing:      { topic: 'Campaigns, launches and growth experiments.' },
};

const CHANNEL_MESSAGES = {
  engineering: [
    { who: 'Alex Kim', initials: 'AK', color: '#3eb957', text: 'Deployed build #482 to staging — search latency down 30%.', time: '09:12' },
    { who: 'Maya Chen', initials: 'MC', color: '#7b60ff', text: 'Nice! Any regressions on the nav menu task (TSK-8)?', time: '09:15' },
    { who: 'Alex Kim', initials: 'AK', color: '#3eb957', text: 'None so far. QA signed off on mobile responsiveness too.', time: '09:18' },
  ],
  docs: [
    { who: 'Priya Sharma', initials: 'PS', color: '#43b3ff', text: 'PRD.docx updated with the new accessibility section.', time: '11:02' },
    { who: 'David Lee', initials: 'DL', color: '#ffa575', text: 'I’ll add the API examples before Friday.', time: '11:20' },
  ],
  teams: [
    { who: 'Sara Noor', initials: 'SN', color: '#db672d', text: 'Reminder: retro at 4 pm in the big room.', time: '10:00' },
  ],
  initiatives: [
    { who: 'David Lee', initials: 'DL', color: '#ffa575', text: 'Q3 initiative tracker is live — see the Q3 Plan project.', time: '08:45' },
  ],
  'active-sprint': [
    { who: 'Maya Chen', initials: 'MC', color: '#7b60ff', text: 'Standup notes: TSK-20 done, TSK-22 in review.', time: '09:30' },
    { who: 'Alex Kim', initials: 'AK', color: '#3eb957', text: 'Blocker: need designs for the checkout flow revamp.', time: '09:32' },
  ],
  design: [
    { who: 'Priya Sharma', initials: 'PS', color: '#43b3ff', text: 'Dark mode tokens are in Figma — feedback welcome.', time: '13:10' },
  ],
  marketing: [
    { who: 'Sara Noor', initials: 'SN', color: '#db672d', text: 'Launch blog draft is ready for engineering review.', time: '15:40' },
  ],
};

/* Per-task metadata used by the Properties panel */
const TASK_META = {
  category:  ['API Documentation', 'Engineering', 'Design', 'Performance', 'Security'],
  department: ['💻 Engineering', '🎨 Design', '📈 Marketing', '🛡 Security', '📚 Docs'],
  tags: [['Features', 'Improvements'], ['Bugs'], ['Features', 'Bugs', 'Improvements'], ['Improvements']],
  dates: ['March 15, 2025', 'April 2, 2025', 'April 18, 2025', 'May 1, 2025'],
  deadlines: ['May 15, 2025', 'June 1, 2025', 'June 20, 2025', 'July 10, 2025'],
};

const DISCUSSIONS = {
  default: [
    { who: 'David Lee', initials: 'DL', color: '#ffa575', text: 'Have you considered AI-driven task prioritization?' },
    { who: 'Priya Sharma', initials: 'PS', color: '#43b3ff', text: "Don't forget to add accessibility features in the design phase." },
  ],
};

const ATTACHMENTS = [
  { cls: 'xls', label: 'XLS', name: 'Client_Proposal.xls', sub: 'Today · 4 MB' },
  { cls: 'doc', label: 'DOC', name: 'PRD.docx', sub: 'Yesterday' },
  { cls: 'gdoc', label: 'G', name: 'Google Docs', sub: 'Linked document' },
];

/* ============================ HELPERS ============================ */

const $ = (sel, root = document) => root.querySelector(sel);
const pageEl = $('#page');
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let savedIds = [];
let readFlags = {};
let sortState = { key: null, dir: 1 };
const undoStack = [];
const LS_KEY = 'issueTracker.v1';

try {
  const s = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
  savedIds = Array.isArray(s.saved) ? s.saved : [];
  readFlags = s.read || {};
} catch (_) {}
INBOX_ITEMS.forEach((it, i) => { if (readFlags[i]) it.unread = false; });

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ saved: savedIds, read: readFlags }));
  } catch (_) { /* private mode / storage disabled — demo still works in-memory */ }
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
  const i = task.idx;
  return {
    category: TASK_META.category[i % TASK_META.category.length],
    department: TASK_META.department[i % TASK_META.department.length],
    tags: TASK_META.tags[i % TASK_META.tags.length],
    added: TASK_META.dates[i % TASK_META.dates.length],
    deadline: TASK_META.deadlines[i % TASK_META.deadlines.length],
  };
}

/* ============================ FILTERS / SORT / VISIBLE SET ============================ */

const STATUS_ORDER = ['Ongoing', 'In review', 'Completed', 'Pending'];
const URGENCY_ORDER = { Critical: 0, Moderate: 1, Minor: 2 };

let filterState = { progress: '', urgency: '', assignee: '' };

function visibleTasks() {
  let list = filteredTasks(); // search term applied
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
      if (k === 'assignee') r = PEOPLE[a.assignee].name.localeCompare(PEOPLE[b.assignee].name);
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
      <option value="">All owners</option>${PEOPLE.map((p, i) => `<option value="${i}" ${String(filterState.assignee) === String(i) ? 'selected' : ''}>${p.name}</option>`).join('')}
    </select>
    ${active ? '<button id="clear-filters" class="btn btn-ghost btn-sm">Clear filters ✕</button>' : ''}
    <span class="toolbar-spacer"></span>
    <button id="export-csv" class="btn btn-ghost btn-sm" title="Download tasks as CSV">⬇ Export CSV</button>
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
    [t.id, `"${t.name.replace(/"/g, '""')}"`, t.progress, t.urgency, PEOPLE[t.assignee].name, t.comments].join(',')));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tasks.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

/* ============================ MUTATIONS (edit / status / delete / undo) ============================ */

function updateTaskRow(idx) {
  const tr = document.querySelector(`.task-table tbody tr[data-idx="${idx}"]`);
  const t = TASKS.find(x => x.idx === idx);
  if (!tr || !t) return;
  const fresh = document.createElement('tr');
  fresh.innerHTML = taskRowHtml(t);
  fresh.dataset.idx = idx; fresh.tabIndex = 0;
  fresh.className = tr.className;
  tr.replaceWith(fresh);
}

function startRename(idx) {
  const cell = document.querySelector(`.task-table tbody tr[data-idx="${idx}"] .feature-name`);
  const t = TASKS.find(x => x.idx === idx);
  if (!cell || !t || cell.querySelector('input')) return;
  cell.innerHTML = `<input class="rename-input" type="text" value="${esc(t.name)}" aria-label="Rename task" />`;
  const inp = cell.querySelector('input');
  inp.focus(); inp.select();
  inp.addEventListener('blur', () => commit());
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') render();
  });
  let done = false;
  function commit() {
    if (done) return; done = true;
    const v = inp.value.trim();
    if (v && v !== t.name) {
      const old = t.name; t.name = v;
      toast(`✏ Renamed “${v}”`);
      showUndoToast(`Renamed “${old}”`, () => { t.name = old; render(); });
    } else render();
  }
}

function cycleStatus(idx) {
  const t = TASKS.find(x => x.idx === idx); if (!t) return;
  const old = t.progress;
  t.progress = STATUS_ORDER[(STATUS_ORDER.indexOf(old) + 1) % STATUS_ORDER.length];
  updateTaskRow(idx);
  showUndoToast(`“${t.name}”: ${old} → ${t.progress}`, () => { t.progress = old; render(); });
}

function deleteTask(idx) {
  const pos = TASKS.findIndex(x => x.idx === idx); if (pos < 0) return;
  const removed = TASKS[pos];
  undoStack.push({ label: `Deleted “${removed.name}”`, run: () => TASKS.splice(pos, 0, removed) });
  TASKS.splice(pos, 1);
  render();
  showUndoToast(`🗑 Deleted “${removed.name}”`);
}

function bulkDelete() {
  const boxes = [...document.querySelectorAll('.row-check:checked')];
  if (!boxes.length) return;
  const idxs = new Set(boxes.map(b => +b.dataset.idx));
  const removed = TASKS.filter(t => idxs.has(t.idx));
  TASKS = TASKS.filter(t => !idxs.has(t.idx));
  undoStack.push({ label: `Deleted ${removed.length} tasks`, run: () => removed.forEach(t => TASKS.push(t)) });
  render();
  showUndoToast(`🗑 Deleted ${removed.length} tasks`);
}

function undoLast() {
  const op = undoStack.pop();
  if (!op) return toast('Nothing to undo');
  op.run(); render(); toast(`↩ Undone: ${op.label}`);
}

function showUndoToast(msg) {
  const t = $('#toast');
  t.innerHTML = `${esc(msg)} <button id="undo-btn" class="undo-btn">Undo</button>`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 6000);
}

window.__app.startRename = startRename;
window.__app.cycleStatus = cycleStatus;

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
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

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
  const p = PEOPLE[t.assignee];
  return `
    <tr data-idx="${t.idx}" tabindex="0">
      <td class="check-cell"><input type="checkbox" class="row-check" data-idx="${t.idx}" aria-label="Select ${esc(t.name)}" /></td>
      <td><div class="feature-cell"><span class="tsk-id">${t.id}</span><span class="feature-name" title="Double-click to rename">${esc(t.name)}</span></div></td>
      <td><button class="progress-cell progress-btn" onclick="__app.cycleStatus(${t.idx})" title="Click to change status"><span class="status-dot ${PROGRESS[t.progress].dot}"></span>${t.progress}</button></td>
      <td><span class="pill ${URGENCY[t.urgency]}">${t.urgency}</span></td>
      <td>
        <div class="assignee">
          <button class="avatar link-avatar" style="--a:${p.color}" data-person="${t.assignee}" title="${p.name}">${p.initials}</button>
          <span class="assignee-name">${p.name}</span>
          ${t.comments ? `<span class="assignee-name" title="${t.comments} comments">💬 ${t.comments}</span>` : ''}
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

function taskTableHtml(tasks) {
  return `
    <table class="task-table">
      <thead><tr>
        <th class="check-cell"></th>
        <th><button class="th-sort" data-sort="feature">Feature ${sortIcon('feature')}</button></th>
        <th><button class="th-sort" data-sort="progress">Progress ${sortIcon('progress')}</button></th>
        <th><button class="th-sort" data-sort="urgency">Urgency ${sortIcon('urgency')}</button></th>
        <th><button class="th-sort" data-sort="assignee">Assigned to ${sortIcon('assignee')}</button></th>
        <th class="row-actions"></th>
      </tr></thead>
      <tbody id="task-rows">${tasks.map(taskRowHtml).join('')}</tbody>
    </table>`;
}

function propertiesPanelHtml(task) {
  const m = metaFor(task);
  const owner = PEOPLE[task.assignee];
  const comments = DISCUSSIONS[task.idx] || DISCUSSIONS.default;
  const isSaved = savedIds.includes(task.idx);
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
      <div id="board-body">
        ${tasks.length ? `${toolbarHtml()}${taskTableHtml(tasks)}`
          : `<div class="empty-state">No tasks in “${esc(title)}” yet.<br><button class="btn btn-primary btn-sm" id="new-feature-btn" style="margin-top:10px">＋ Create the first task</button></div>`}
      </div>
    </section>`;
}

/* ---------- Kanban view ---------- */
let kanbanDragIdx = null;

function renderKanban() {
  const host = $('#board-body'); if (!host) return;
  const tasks = visibleTasks();
  if (!tasks.length) { host.innerHTML = '<div class="empty-state">No tasks match your filters.</div>'; return; }
  host.innerHTML = `
    <div class="kanban">
      ${STATUS_ORDER.map(st => {
        const col = tasks.filter(t => t.progress === st);
        return `
        <div class="kb-col" data-status="${st}">
          <div class="kb-head"><span class="status-dot ${PROGRESS[st].dot}"></span><strong>${st}</strong><span class="kb-count">${col.length}</span></div>
          <div class="kb-drop">
            ${col.map(t => {
              const p = PEOPLE[t.assignee];
              return `<div class="kb-card" draggable="true" data-idx="${t.idx}" tabindex="0">
                <div class="kb-name">${esc(t.name)}</div>
                <div class="kb-meta"><span class="tsk-id">${t.id}</span><span class="pill ${URGENCY[t.urgency]}">${t.urgency}</span>
                  <span class="avatar avatar-xs" style="--a:${p.color}" title="${p.name}">${p.initials[0]}</span></div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>`;
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
        renderBoardBody();
        showUndoToast(`Moved “${t.name}” → ${st}`);
        undoStack.push({ label: `Move of “${t.name}”`, run: () => { t.progress = old; render(); } });
      }
    });
  });
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

function render() {
  const { name, param } = parseHash();
  const fn = routes[name] || routes.home;
  currentRoute = name;
  pageEl.innerHTML = fn(param);
  setActiveNav(name, param);
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
  const mine = TASKS.filter(t => t.assignee === 0);
  return `
    <section class="page-pad">
      <div class="page-head">
        <h1>Welcome back, Priya 👋</h1>
        <p>Here's what's happening across your workspace today.</p>
      </div>
      <div class="stat-grid">
        <button class="stat-card" data-goto="#/mytasks"><span class="stat-num">${TASKS.length}</span><span class="stat-label">Total tasks</span></button>
        <button class="stat-card" data-goto="#/projects"><span class="stat-num">${PROJECTS.length}</span><span class="stat-label">Active projects</span></button>
        <button class="stat-card" data-goto="#/inbox"><span class="stat-num">${INBOX_ITEMS.filter(i => i.unread).length}</span><span class="stat-label">Unread inbox</span></button>
        <button class="stat-card" data-goto="#/saved"><span class="stat-num">${savedIds.length}</span><span class="stat-label">Saved items</span></button>
      </div>
      <h2 class="section-title">Progress overview</h2>
      <div class="bar-chart">
        ${Object.entries(counts).map(([k, v]) => `
          <div class="bar-row">
            <span class="bar-label"><span class="status-dot ${PROGRESS[k].dot}"></span>${k}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${Math.round(v / TASKS.length * 100)}%"></div></div>
            <span class="bar-count">${v}</span>
          </div>`).join('')}
      </div>
      <h2 class="section-title">Recent activity</h2>
      <ul class="activity-list">
        ${INBOX_ITEMS.slice(0, 5).map((it, i) => `
          <li data-inbox="${i}" style="cursor:pointer"><span class="avatar avatar-sm" style="--a:${it.color}">${it.initials}</span>
              <span><strong>${it.who}</strong> ${esc(it.text)} <em>${it.time}</em></span></li>`).join('')}
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
        ${INBOX_ITEMS.map((it, i) => `
          <li class="inbox-item ${it.unread ? 'unread' : ''}" data-inbox="${i}">
            <span class="avatar avatar-sm" style="--a:${it.color}">${it.initials}</span>
            <div class="inbox-body">
              <div class="inbox-top"><strong>${it.who}</strong><span class="inbox-time">${it.time}</span></div>
              <p>${esc(it.text)}</p>
            </div>
            ${it.unread ? '<span class="unread-dot"></span>' : ''}
          </li>`).join('')}
      </ul>
    </section>`;
};

routes.saved = () => {
  setCrumbs([{ label: 'Overview' }, { label: 'Saved items' }]);
  const items = TASKS.filter(t => savedIds.includes(t.idx));
  return `
    <section class="page-pad">
      <div class="page-head"><h1>Saved items</h1><p>Tasks you bookmarked with ☆ in the Properties panel.</p></div>
      ${items.length ? taskTableHtml(items) : '<div class="empty-state">Nothing saved yet. Open a task and hit ☆ to save it.</div>'}
    </section>`;
};

routes.mytasks = () => {
  setCrumbs([{ label: 'Workspace' }, { label: 'My tasks' }]);
  const mine = TASKS.filter(t => t.assignee === 0);
  if (!mine.length) {
    return `<section class="page-pad"><div class="page-head"><h1>My tasks</h1></div>
      <div class="empty-state">No tasks assigned to you yet.</div></section>`;
  }
  return `
    <div class="content-split">
      ${boardSectionHtml('My tasks', ['Ongoing', 'All mine'], 0, mine.filter(t => t.progress === 'Ongoing'))}
      ${propertiesPanelHtml(mine[0])}
    </div>`;
};

routes.projects = () => {
  setCrumbs([{ label: 'Workspace' }, { label: 'Projects' }]);
  return `
    <section class="page-pad">
      <div class="page-head"><h1>Projects</h1>
        <p><button id="new-project-btn" class="btn btn-primary btn-sm">＋ New project</button></p></div>
      <div class="project-grid">
        ${PROJECTS.map((pr, i) => `
          <button class="project-card" data-project="${i}">
            <div class="pc-avatar" style="--a:${PEOPLE[i % 5].color}">${pr.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</div>
            <h3>${pr.name}</h3><p>${pr.desc}</p>
            <div class="pc-meta"><span>${pr.members} members</span><span>${TASKS.filter(t => t.project === slugify(pr.name) && t.progress !== 'Completed').length} open tasks</span></div>
          </button>`).join('')}
      </div>
    </section>`;
};

routes.project = (param) => {
  const pr = PROJECTS.find(p => slugify(p.name) === param);
  if (!pr) { location.hash = '#/projects'; return ''; }
  currentProject = slugify(pr.name);            // scope board/filters/search to this project
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
  setCrumbs([{ label: 'C Atlas, Inc' }, { label: 'Settings' }]);
  return `
    <section class="page-pad narrow">
      <div class="page-head"><h1>Settings</h1></div>
      <div class="settings-group">
        <h3>Profile</h3>
        <label>Display name<input id="set-name" type="text" value="Priya Sharma" /></label>
        <label>Email<input type="email" value="priya@catlas.inc" /></label>
      </div>
      <div class="settings-group">
        <h3>Preferences</h3>
        <label class="switch-row">Email notifications<input type="checkbox" checked /></label>
        <label class="switch-row">Weekly digest<input type="checkbox" /></label>
        <label class="switch-row">Dark mode (preview)<input type="checkbox" id="set-dark" ${document.documentElement.classList.contains('dark') ? 'checked' : ''} /></label>
      </div>
      <div class="settings-actions">
        <button id="save-settings" class="btn btn-primary">Save changes</button>
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
      <label>Assignee<select id="nf-assignee">${PEOPLE.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}</select></label>
      <label>Project<select id="nf-project">${PROJECTS.map(p => `<option value="${slugify(p.name)}" ${slugify(p.name) === currentProject ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <button type="submit" class="btn btn-primary">Create task</button>
    </form>`);
}

/* ============================ EVENT DELEGATION ============================ */

document.body.addEventListener('click', (e) => {
  const el = e.target.closest('[id],[data-goto],[data-calday],[data-project],[data-inbox],[data-attachment],[data-person],[data-plan]');
  if (!el) return;

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
    INBOX_ITEMS.forEach((_, i) => { readFlags[i] = true; });
    INBOX_ITEMS.forEach(it => it.unread = false);
    persist(); render(); return toast('Inbox cleared');
  }
  if (el.dataset.inbox !== undefined) {
    const it = INBOX_ITEMS[+el.dataset.inbox];
    readFlags[+el.dataset.inbox] = true; it.unread = false; persist();
    if (it.task != null) { location.hash = `#/task/${TASKS[it.task].idx}`; } else render();
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
    const pr = PROJECTS[+el.dataset.project];
    location.hash = `#/project/${slugify(pr.name)}`;
    return;
  }
  if (el.id === 'new-project-btn') {
    return openModal('New project', `<form id="new-project-form"><label>Project name<input id="np-name" type="text" required placeholder="e.g. Mobile App v3" /></label><label>Owner<select id="np-owner">${PEOPLE.map((p, i) => `<option value="${i}">${p.name}</option>`).join('')}</select></label><button class="btn btn-primary">Create project</button></form>`);
  }
  if (el.dataset.person !== undefined) {
    const p = PEOPLE[+el.dataset.person];
    return openModal(p.name, `
      <div class="profile-head"><span class="avatar" style="--a:${p.color};width:48px;height:48px;font-size:16px">${p.initials}</span>
      <div><h3>${p.name}</h3><p>Engineering · C Atlas, Inc</p></div></div>
      <p class="modal-lead">Assigned tasks:</p>
      <ul class="mini-tasks">${TASKS.filter(t => t.assignee === +el.dataset.person).map(t =>
        `<li><span class="status-dot ${PROGRESS[t.progress].dot}"></span><a href="#/task/${t.idx}">${esc(t.name)}</a></li>`).join('')}</ul>`);
  }
  if (el.dataset.attachment) { e.preventDefault(); return toast(`⬇ Downloading ${el.dataset.attachment}… (demo)`); }

  if (el.id === 'save-toggle') {
    const idx = +(el.dataset.idx ?? 0);
    if (savedIds.includes(idx)) { savedIds = savedIds.filter(i => i !== idx); toast('Removed from saved items'); }
    else { savedIds.push(idx); toast('★ Saved item'); }
    persist(); render(); return;
  }
  if (el.id === 'save-settings') return toast('✔ Settings saved');
  if (el.id === 'reset-data') {
    try { localStorage.clear(); } catch (_) {}
    savedIds = []; readFlags = {};
    INBOX_ITEMS.forEach((it, i) => { it.unread = [0, 1, 2].includes(i); });
    location.hash = '#/home'; render(); return toast('Demo data reset');
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
      fresh.innerHTML = propertiesPanelHtml(TASKS[+tr.dataset.idx]);
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

  /* ---- column sorting ---- */
  if (el.classList.contains('th-sort')) {
    const key = el.dataset.sort;
    if (sortState.key === key) sortState.dir *= -1;
    else sortState = { key, dir: 1 };
    renderBoardBody();
    return;
  }

  /* ---- clear filters / export csv / bulk actions / undo ---- */
  if (el.id === 'clear-filters') { filterState = { progress: '', urgency: '', assignee: '' }; renderBoardBody(); return; }
  if (el.id === 'export-csv') { exportCsv(visibleTasks()); return toast('⬇ tasks.csv downloaded'); }
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
    if (currentRoute === 'mytasks') {
      const mine = TASKS.filter(t => t.assignee === 0);
      host.innerHTML = taskTableHtml(i === 0 ? mine.filter(t => t.progress === 'Ongoing') : mine);
    } else {
      host.innerHTML = i === 0 ? overviewHtml() : (toolbarHtml() + (() => { const rows = visibleTasks(); return rows.length ? taskTableHtml(rows) : '<div class="empty-state">No tasks match your search or filters.</div>'; })());
    }
  }
});

/* ---- bulk action bar (appears when rows are checked) ---- */
document.body.addEventListener('change', (e) => {
  if (e.target.classList.contains('row-check')) updateBulkBar();
  if (e.target.id === 'flt-progress') { filterState.progress = e.target.value; renderBoardBody(); }
  if (e.target.id === 'flt-urgency')  { filterState.urgency = e.target.value; renderBoardBody(); }
  if (e.target.id === 'flt-assignee') { filterState.assignee = e.target.value; renderBoardBody(); }
  if (e.target.id === 'prop-status') {
    const idx = +e.target.dataset.idx;
    const t = TASKS.find(x => x.idx === idx);
    if (t) {
      const old = t.progress; t.progress = e.target.value;
      updateTaskRow(idx);
      showUndoToast(`Status → ${t.progress}`);
      undoStack.push({ label: `Status change`, run: () => { t.progress = old; render(); } });
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
        ${PEOPLE.map((p, i) => `<button class="avatar link-avatar" data-person="${i}" style="--a:${p.color}" title="${p.name}">${p.initials}</button>`).join('')}
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
      const scope = currentRoute === 'mytasks' ? TASKS.filter(t => t.assignee === 0)
                  : currentRoute === 'saved'   ? TASKS.filter(t => savedIds.includes(t.idx))
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
    TASKS.unshift({
      id: 'TSK-' + (nextTaskNum++), name,
      progress: $('#nf-progress').value, urgency: $('#nf-urgency').value,
      assignee: +$('#nf-assignee').value, comments: 0, idx: nextTaskNum * 1000, // unique stable key
      project: $('#nf-project') ? $('#nf-project').value : 'q3-plan',
    });
    closeModal(); toast(`✔ Created “${name}”`);
    if (!location.hash.startsWith('#/project') && !location.hash.startsWith('#/task')) location.hash = '#/project/q3-plan';
    else render();
  }
  if (e.target.id === 'new-project-form') {
    e.preventDefault();
    const name = $('#np-name').value.trim();
    if (!name) return;
    PROJECTS.unshift({ name, desc: 'Freshly created project', members: 1, open: 0 });
    closeModal(); toast(`✔ Project “${name}” created`); render();
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
    (DISCUSSIONS[idx] = DISCUSSIONS[idx] || [...DISCUSSIONS.default]).push({ who: 'Priya Sharma', initials: 'PS', color: '#43b3ff', text: v });
    if (t) t.comments = (t.comments || 0) + 1;
    const li = document.createElement('li');
    li.innerHTML = `<span class="avatar avatar-sm" style="--a:#43b3ff">PS</span><div class="comment-body"><div class="comment-author">Priya Sharma</div><p>${esc(v)}</p></div>`;
    $('#comment-list').appendChild(li);
    box.value = '';
    updateTaskRow(idx);
    toast('💬 Comment posted');
  }
  if (e.target.id === 'chat-form') {
    e.preventDefault();
    const box = $('#chat-box'); const v = box.value.trim();
    if (!v) return;
    const key = parseHash().param || 'engineering';
    (CHANNEL_MESSAGES[key] = CHANNEL_MESSAGES[key] || []).push({ who: 'Priya Sharma', initials: 'PS', color: '#43b3ff', text: v, time: new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' }) });
    const list = $('.chat-list');
    if (list.querySelector('.empty-state')) render();
    else {
      const li = document.createElement('li');
      li.innerHTML = `<span class="avatar avatar-sm" style="--a:#43b3ff">PS</span><div class="chat-body"><div class="chat-top"><strong>Priya Sharma</strong><em>now</em></div><p>${esc(v)}</p></div>`;
      list.appendChild(li);
    }
    box.value = '';
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
if (!location.hash) location.hash = '#/home';
render();
