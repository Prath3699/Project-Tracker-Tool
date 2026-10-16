#!/usr/bin/env node
/* Issue Tracker Dashboard — backend server
 * Zero-dependency Node.js server:
 *   - Serves the static frontend (index.html, app.js, styles.css, ...)
 *   - Exposes a JSON REST API under /api/* backed by a persistent JSON file (data/db.json)
 *
 * Run:  node server.js [port]     (default port 3000)
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.argv[2] || process.env.PORT || 3000);

/* ------------------------------------------------------------------ */
/* Storage layer (simple JSON-file "database" with atomic writes)      */
/* ------------------------------------------------------------------ */

function seedData() {
  const people = [
    { id: 'p1', name: 'Parth Sharma', initials: 'PT', color: '#43b3ff' },
    { id: 'p2', name: 'David Lee',    initials: 'DL', color: '#ffa575' },
    { id: 'p3', name: 'Maya Chen',    initials: 'MC', color: '#7b60ff' },
    { id: 'p4', name: 'Alex Kim',     initials: 'AK', color: '#3eb957' },
    { id: 'p5', name: 'Sara Noor',    initials: 'SN', color: '#db672d' },
  ];

  const projects = [
    { id: 'q3-plan',        name: 'Q3 Plan',           desc: 'Product roadmap & delivery plan for Q3', members: ['p1','p2','p3','p4','p5'] },
    { id: 'website-redesign', name: 'Website Redesign', desc: 'New marketing site and design system',   members: ['p1','p2','p3','p4'] },
    { id: 'mobile-app-v2',  name: 'Mobile App v2.0',   desc: 'Feature parity with web + offline mode', members: ['p1','p2','p3','p4','p5'] },
    { id: 'api-docs',       name: 'API Documentation', desc: 'Public developer docs refresh',          members: ['p2','p3','p5'] },
    { id: 'customer-portal',name: 'Customer Portal',   desc: 'Self-service dashboard for clients',     members: ['p1','p3','p4','p5'] },
    { id: 'internal-tools', name: 'Internal Tools',    desc: 'Admin utilities and ops automation',     members: ['p4'] },
  ];

  const mk = (id, name, progress, urgency, assignee, comments, project, idx) => ({
    id, name, progress, urgency, assignee, comments: comments || 0, project: project || 'q3-plan',
    idx, createdAt: new Date().toISOString(),
  });

  /* The 15 design-mockup tasks (idx 0-14) live in the Q3 Plan project; two extra
     "On hold" tasks exercise the fifth status bucket. */
  const tasks = [
    mk('TSK-8',  'Improve Navigation & Menu Organization', 'Ongoing',   'Moderate', 'p3', 0, 'q3-plan', 0),
    mk('TSK-20', 'Enhance Search Functionality',           'Completed', 'Critical', 'p2', 6, 'q3-plan', 1),
    mk('TSK-22', 'Dark Mode Implementation',               'In review', 'Minor',    'p1', 0, 'q3-plan', 2),
    mk('TSK-6',  'Optimize Mobile Responsiveness',         'Ongoing',   'Moderate', 'p4', 0, 'q3-plan', 3),
    mk('TSK-6b', 'Redesign Checkout Flow',                 'Ongoing',   'Critical', 'p5', 0, 'q3-plan', 4),
    mk('TSK-10', 'Speed Optimization for Home Page',       'Ongoing',   'Critical', 'p2', 0, 'q3-plan', 5),
    mk('TSK-40', 'Reduce Load Time for Large Data Sets',   'Pending',   'Minor',    'p3', 0, 'q3-plan', 6),
    mk('TSK-12', 'Optimize Image Compression for Faster Loading', 'In review', 'Moderate', 'p1', 0, 'q3-plan', 7),
    mk('TSK-18', 'Introduce AI-powered Task Prioritization', 'Completed', 'Moderate', 'p4', 4, 'q3-plan', 8),
    mk('TSK-12b','Multi-language Support Implementation',  'Completed', 'Critical', 'p5', 1, 'q3-plan', 9),
    mk('TSK-12c','Missing Tooltip on Product Images',      'Completed', 'Moderate', 'p2', 0, 'q3-plan', 10),
    mk('TSK-22b','Integrate Third-party Calendar Sync',    'Completed', 'Critical', 'p3', 4, 'q3-plan', 11),
    mk('TSK-14', 'Enhance User Authentication with 2FA',   'Pending',   'Minor',    'p1', 0, 'q3-plan', 12),
    mk('TSK-27', 'GDPR Compliance Updates',                'Pending',   'Minor',    'p4', 0, 'q3-plan', 13),
    mk('TSK-18b','Data Encryption for Sensitive Information', 'In review', 'Minor', 'p5', 3, 'q3-plan', 14),
    mk('TSK-31', 'Vendor Contract Renewal Review',         'On hold',   'Minor',    'p2', 0, 'q3-plan', 15),
    mk('TSK-33', 'Legacy Data Migration Assessment',       'On hold',   'Moderate', 'p5', 0, 'q3-plan', 16),
  ];

  /* Seed a few tasks into the other projects so their boards aren't dead ends */
  let seedIdx = 500;
  ['website-redesign', 'mobile-app-v2', 'api-docs', 'customer-portal', 'internal-tools'].forEach((pid, pi) => {
    const owners = [people[pi % people.length].id, people[(pi + 2) % people.length].id];
    const pName = projects.find(p => p.id === pid).name;
    [`Kick-off & scope “${pName}”`, `Define success metrics for ${pName}`].forEach((n, ni) => {
      tasks.push(mk(
        'TSK-' + (50 + pi * 2 + ni), n,
        ni === 0 ? 'Ongoing' : 'Pending',
        ['Moderate', 'Minor', 'Critical'][pi % 3],
        owners[ni], 0, pid, seedIdx++));
    });
  });

  const now = Date.now();
  const inbox = [
    { id: 'inbox-1', who: 'David Lee',    initials: 'DL', color: '#ffa575', text: 'mentioned you in “Enhance Search Functionality”',            ago: 10 * 60e3,      task: 'TSK-20',  unread: true  },
    { id: 'inbox-2', who: 'Parth Sharma', initials: 'PT', color: '#43b3ff', text: 'assigned you “Dark Mode Implementation”',                    ago: 32 * 60e3,      task: 'TSK-22',  unread: true  },
    { id: 'inbox-3', who: 'Maya Chen',    initials: 'MC', color: '#7b60ff', text: 'completed “Introduce AI-powered Task Prioritization”',       ago: 60 * 60e3,      task: 'TSK-18',  unread: true  },
    { id: 'inbox-4', who: 'Alex Kim',     initials: 'AK', color: '#3eb957', text: 'commented on “Optimize Mobile Responsiveness”',              ago: 3 * 3600e3,     task: 'TSK-6',   unread: false },
    { id: 'inbox-5', who: 'Sara Noor',    initials: 'SN', color: '#db672d', text: 'requested review of “Data Encryption for Sensitive Information”', ago: 26 * 3600e3, task: 'TSK-18b', unread: false },
    { id: 'inbox-6', who: 'David Lee',    initials: 'DL', color: '#ffa575', text: 'changed urgency of “Redesign Checkout Flow” to Critical',    ago: 28 * 3600e3,    task: 'TSK-6b',  unread: false },
    { id: 'inbox-7', who: 'Parth Sharma', initials: 'PT', color: '#43b3ff', text: 'shared the project “Q3 Plan” with you',                      ago: 48 * 3600e3,    task: null,    unread: false },
  ].map(it => ({ ...it, at: new Date(now - it.ago).toISOString() }));

  const channelMessages = {
    engineering: [
      { who: 'Alex Kim',  initials: 'AK', color: '#3eb957', text: 'Deployed build #482 to staging — search latency down 30%.', time: '09:12' },
      { who: 'Maya Chen', initials: 'MC', color: '#7b60ff', text: 'Nice! Any regressions on the nav menu task (TSK-8)?',       time: '09:15' },
      { who: 'Alex Kim',  initials: 'AK', color: '#3eb957', text: 'None so far. QA signed off on mobile responsiveness too.',  time: '09:18' },
    ],
    docs: [
      { who: 'Parth Sharma', initials: 'PT', color: '#43b3ff', text: 'PRD.docx updated with the new accessibility section.', time: '11:02' },
      { who: 'David Lee',    initials: 'DL', color: '#ffa575', text: 'I’ll add the API examples before Friday.',             time: '11:20' },
    ],
    teams:       [{ who: 'Sara Noor', initials: 'SN', color: '#db672d', text: 'Reminder: retro at 4 pm in the big room.', time: '10:00' }],
    initiatives: [{ who: 'David Lee', initials: 'DL', color: '#ffa575', text: 'Q3 initiative tracker is live — see the Q3 Plan project.', time: '08:45' }],
    'active-sprint': [
      { who: 'Maya Chen', initials: 'MC', color: '#7b60ff', text: 'Standup notes: TSK-20 done, TSK-22 in review.',        time: '09:30' },
      { who: 'Alex Kim',  initials: 'AK', color: '#3eb957', text: 'Blocker: need designs for the checkout flow revamp.',  time: '09:32' },
    ],
    design:    [{ who: 'Parth Sharma', initials: 'PT', color: '#43b3ff', text: 'Dark mode tokens are in Figma — feedback welcome.', time: '13:10' }],
    marketing: [{ who: 'Sara Noor',    initials: 'SN', color: '#db672d', text: 'Launch blog draft is ready for engineering review.', time: '15:40' }],
  };

  return {
    meta: { nextTaskNum: 100, nextIdx: 1000 },
    people,
    projects,
    tasks,
    inbox,
    discussions: {},  // taskId -> [{ who, initials, color, text, at }]
    messages: channelMessages,   // channelId -> [{ who, initials, color, text, time }]
    savedIds: [],
    readFlags: {},
  };
}

let db;

/* Additive migration so older db.json files gain new collections/counters. */
function migrate(d) {
  const seed = seedData();
  d.meta = { ...seed.meta, ...(d.meta || {}) };
  if (!Array.isArray(d.inbox)) d.inbox = seed.inbox;
  if (!d.discussions || typeof d.discussions !== 'object') d.discussions = {};
  if (!d.messages || typeof d.messages !== 'object') d.messages = seed.messages;
  if (!Array.isArray(d.savedIds)) d.savedIds = [];
  if (!d.readFlags || typeof d.readFlags !== 'object') d.readFlags = {};
  return d;
}

function loadDb() {
  try {
    db = migrate(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
  } catch (_) {
    db = seedData();
    saveDbSync();
  }
}

let saveTimer = null;
function saveDb() {            // debounced atomic write
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDbSync, 50);
}
function saveDbSync() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE); // atomic swap
}

loadDb();

/* ------------------------------------------------------------------ */
/* Tiny router helpers                                                 */
/* ------------------------------------------------------------------ */

const VALID_PROGRESS = ['Ongoing', 'In review', 'Completed', 'Pending', 'On hold'];
const VALID_URGENCY  = ['Critical', 'Moderate', 'Minor'];

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 1e6) { reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch (_) { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function sanitizeTask(input, existing = {}) {
  const t = { ...existing };
  if (typeof input.name === 'string' && input.name.trim()) t.name = input.name.trim().slice(0, 200);
  if (input.progress !== undefined) {
    if (!VALID_PROGRESS.includes(input.progress)) throw new Error(`invalid progress "${input.progress}"`);
    t.progress = input.progress;
  }
  if (input.urgency !== undefined) {
    if (!VALID_URGENCY.includes(input.urgency)) throw new Error(`invalid urgency "${input.urgency}"`);
    t.urgency = input.urgency;
  }
  if (input.assignee !== undefined) {
    if (!db.people.some(p => p.id === input.assignee)) throw new Error(`unknown assignee "${input.assignee}"`);
    t.assignee = input.assignee;
  }
  if (input.project !== undefined) {
    if (!db.projects.some(p => p.id === input.project)) throw new Error(`unknown project "${input.project}"`);
    t.project = input.project;
  }
  if (input.comments !== undefined) {
    const n = Number(input.comments);
    if (!Number.isInteger(n) || n < 0) throw new Error('comments must be a non-negative integer');
    t.comments = n;
  }
  return t;
}

function nextTaskId(name) {
  // Generate TSK-### unique ids, seeded from stored counter
  let num = db.meta.nextTaskNum;
  let id;
  do { id = 'TSK-' + num++; } while (db.tasks.some(t => t.id === id));
  db.meta.nextTaskNum = num;
  return id;
}

function nextIdx() {           // stable internal numeric key for deep links / saved items
  return db.meta.nextIdx++;
}

/* ------------------------------------------------------------------ */
/* API routes                                                          */
/* ------------------------------------------------------------------ */

async function handleApi(req, res, url) {
  const parts = url.pathname.replace(/^\/api\//, '').split('/').filter(Boolean);
  const seg = parts[0] || '';
  const param = parts[1];
  const method = req.method;

  /* --- bootstrap: everything the frontend needs in one call --- */
  if (seg === 'bootstrap' && method === 'GET') {
    return send(res, 200, {
      people: db.people,
      projects: db.projects.map(p => ({
        ...p,
        open: db.tasks.filter(t => t.project === p.id && t.progress !== 'Completed').length,
      })),
      tasks: db.tasks,
      inbox: db.inbox.map(it => ({ ...it, unread: !db.readFlags[it.id] })),
      discussions: db.discussions,
      messages: db.messages,
      savedIds: db.savedIds,
      readFlags: db.readFlags,
    });
  }

  /* --- people --- */
  if (seg === 'people' && method === 'GET' && !param) {
    return send(res, 200, db.people);
  }

  /* --- inbox (server-persisted notifications + read flags) --- */
  if (seg === 'inbox') {
    if (method === 'GET' && !param) {
      return send(res, 200, db.inbox.map(it => ({ ...it, unread: !db.readFlags[it.id] })));
    }
    if (method === 'PATCH' && param === 'read-all') {
      db.inbox.forEach(it => { db.readFlags[it.id] = true; });
      saveDb();
      return send(res, 200, { ok: true });
    }
    const it = db.inbox.find(x => x.id === param);
    if (!it) return send(res, 404, { error: 'inbox item not found' });
    if (method === 'PATCH' || method === 'PUT') {
      const b = await readBody(req);
      if (b.unread === false || b.read === true) db.readFlags[it.id] = true;
      if (b.unread === true) delete db.readFlags[it.id];
      saveDb();
      return send(res, 200, { ...it, unread: !db.readFlags[it.id] });
    }
    if (method === 'DELETE') {
      db.inbox = db.inbox.filter(x => x.id !== param);
      delete db.readFlags[param];
      saveDb();
      return send(res, 200, { deleted: true, id: param });
    }
    return send(res, 405, { error: 'method not allowed' });
  }

  /* --- task discussions (Properties panel comments) --- */
  if (seg === 'discussions') {
    const list = () => db.discussions[param] || [];
    if (method === 'GET' && param) return send(res, 200, list());
    if (method === 'POST' && param) {
      const b = await readBody(req);
      if (!b.text || !String(b.text).trim()) return send(res, 400, { error: 'text is required' });
      if (!db.tasks.some(t => t.id === param)) return send(res, 404, { error: 'task not found' });
      const c = {
        who: String(b.who || 'You'),
        initials: String(b.initials || 'YO'),
        color: String(b.color || '#43b3ff'),
        text: String(b.text).trim().slice(0, 2000),
        at: new Date().toISOString(),
      };
      (db.discussions[param] = db.discussions[param] || []).push(c);
      const task = db.tasks.find(t => t.id === param);
      task.comments = (task.comments || 0) + 1;
      saveDb();
      return send(res, 201, { comment: c, comments: task.comments });
    }
    return send(res, 405, { error: 'method not allowed' });
  }

  /* --- projects --- */
  if (seg === 'projects') {
    if (method === 'GET' && !param) {
      return send(res, 200, db.projects.map(p => ({
        ...p,
        open: db.tasks.filter(t => t.project === p.id && t.progress !== 'Completed').length,
      })));
    }
    if (method === 'POST' && !param) {
      const b = await readBody(req);
      if (!b.name || !String(b.name).trim()) return send(res, 400, { error: 'name is required' });
      const id = String(b.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        + '-' + crypto.randomBytes(2).toString('hex');
      const proj = { id, name: String(b.name).trim(), desc: String(b.desc || ''), members: Array.isArray(b.members) ? b.members : [] };
      db.projects.push(proj);
      saveDb();
      return send(res, 201, proj);
    }
    const proj = db.projects.find(p => p.id === param);
    if (!proj) return send(res, 404, { error: 'project not found' });
    if (method === 'GET') return send(res, 200, proj);
    if (method === 'PATCH' || method === 'PUT') {
      const b = await readBody(req);
      if (b.name) proj.name = String(b.name).trim();
      if (b.desc !== undefined) proj.desc = String(b.desc);
      if (Array.isArray(b.members)) proj.members = b.members;
      saveDb();
      return send(res, 200, proj);
    }
    if (method === 'DELETE') {
      db.projects = db.projects.filter(p => p.id !== param);
      db.tasks = db.tasks.filter(t => t.project !== param);
      saveDb();
      return send(res, 200, { deleted: true, id: param });
    }
    return send(res, 405, { error: 'method not allowed' });
  }

  /* --- tasks --- */
  if (seg === 'tasks') {
    if (method === 'GET' && !param) {
      let list = db.tasks;
      if (url.searchParams.has('project')) list = list.filter(t => t.project === url.searchParams.get('project'));
      if (url.searchParams.has('progress')) list = list.filter(t => t.progress === url.searchParams.get('progress'));
      if (url.searchParams.has('urgency')) list = list.filter(t => t.urgency === url.searchParams.get('urgency'));
      if (url.searchParams.has('assignee')) list = list.filter(t => t.assignee === url.searchParams.get('assignee'));
      if (url.searchParams.has('q')) {
        const q = url.searchParams.get('q').toLowerCase();
        list = list.filter(t => t.name.toLowerCase().includes(q) || t.id.toLowerCase().includes(q));
      }
      return send(res, 200, list);
    }
    if (method === 'POST' && !param) {
      const b = await readBody(req);
      if (!b.name || !String(b.name).trim()) return send(res, 400, { error: 'name is required' });
      let task;
      try {
        task = sanitizeTask(b, {
          id: nextTaskId(b.name),
          name: String(b.name).trim(),
          progress: 'Pending',
          urgency: 'Moderate',
          assignee: db.people[0].id,
          project: 'q3-plan',
          comments: 0,
          idx: nextIdx(),
          createdAt: new Date().toISOString(),
        });
      } catch (e) { return send(res, 400, { error: e.message }); }
      db.tasks.unshift(task);   // newest first — matches the frontend's unshift()
      saveDb();
      return send(res, 201, task);
    }
    const idx = db.tasks.findIndex(t => t.id === param);
    if (idx === -1) {
      // also accept the stable numeric key used by frontend deep links (#/task/:idx)
      const byIdx = db.tasks.findIndex(t => t.idx === Number(param));
      if (byIdx !== -1) {
        if (method === 'GET') return send(res, 200, db.tasks[byIdx]);
        if (method === 'PATCH' || method === 'PUT') {
          const b = await readBody(req);
          try { db.tasks[byIdx] = sanitizeTask(b, db.tasks[byIdx]); }
          catch (e) { return send(res, 400, { error: e.message }); }
          saveDb();
          return send(res, 200, db.tasks[byIdx]);
        }
      }
      return send(res, 404, { error: 'task not found' });
    }
    if (method === 'GET') return send(res, 200, db.tasks[idx]);
    if (method === 'PATCH' || method === 'PUT') {
      const b = await readBody(req);
      try {
        db.tasks[idx] = sanitizeTask(b, db.tasks[idx]);
      } catch (e) { return send(res, 400, { error: e.message }); }
      saveDb();
      return send(res, 200, db.tasks[idx]);
    }
    if (method === 'DELETE') {
      const [removed] = db.tasks.splice(idx, 1);
      db.savedIds = db.savedIds.filter(id => id !== removed.id);
      saveDb();
      return send(res, 200, { deleted: true, id: removed.id });
    }
    return send(res, 405, { error: 'method not allowed' });
  }

  /* --- board-level bulk update (drag & drop persistence) --- */
  if (seg === 'board' && method === 'PATCH') {
    const b = await readBody(req);
    if (!Array.isArray(b.order)) return send(res, 400, { error: 'order must be an array of task ids' });
    const known = new Set(db.tasks.map(t => t.id));
    if (!b.order.every(id => known.has(id))) return send(res, 400, { error: 'order contains unknown task ids' });
    const byId = Object.fromEntries(db.tasks.map(t => [t.id, t]));
    db.tasks = b.order.map(id => byId[id]).concat(db.tasks.filter(t => !b.order.includes(t.id)));
    saveDb();
    return send(res, 200, { ok: true });
  }

  /* --- saved items / read flags (user prefs) --- */
  if (seg === 'prefs') {
    if (method === 'GET') return send(res, 200, { savedIds: db.savedIds, readFlags: db.readFlags });
    if (method === 'PATCH' || method === 'PUT') {
      const b = await readBody(req);
      if (Array.isArray(b.savedIds)) db.savedIds = b.savedIds.filter(x => typeof x === 'string');
      if (b.readFlags && typeof b.readFlags === 'object') db.readFlags = b.readFlags;
      saveDb();
      return send(res, 200, { savedIds: db.savedIds, readFlags: db.readFlags });
    }
    return send(res, 405, { error: 'method not allowed' });
  }

  /* --- channel messages --- */
  if (seg === 'channels') {
    if (method === 'GET' && param) {
      return send(res, 200, db.messages[param] || []);
    }
    if (method === 'POST' && param) {
      const b = await readBody(req);
      if (!b.text || !String(b.text).trim()) return send(res, 400, { error: 'text is required' });
      const msg = {
        who: String(b.who || 'You'),
        initials: String(b.initials || 'YO'),
        color: String(b.color || '#43b3ff'),
        text: String(b.text).trim().slice(0, 2000),
        time: new Date().toTimeString().slice(0, 5),
      };
      (db.messages[param] = db.messages[param] || []).push(msg);
      saveDb();
      return send(res, 201, msg);
    }
    return send(res, 405, { error: 'method not allowed' });
  }

  return send(res, 404, { error: 'unknown API endpoint', endpoint: '/api/' + parts.join('/') });
}

/* ------------------------------------------------------------------ */
/* Static file serving                                                 */
/* ------------------------------------------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.pdf':  'application/pdf',
  '.txt':  'text/plain; charset=utf-8',
};

function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const filePath = path.normalize(path.join(ROOT, p));
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    return send(res, 403, { error: 'forbidden' }, { 'Content-Type': 'text/plain' });
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  });
}

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // CORS (permissive, handy for local dev / separate frontend hosting)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, url);
    } catch (e) {
      send(res, e.message === 'invalid JSON' || e.message === 'body too large' ? 400 : 500,
           { error: e.message });
    }
    return;
  }
  if (url.pathname === '/api' || url.pathname === '/api/') {
    return send(res, 200, { name: 'Issue Tracker API', version: 1, endpoints: [
      'GET    /api/bootstrap',
      'GET    /api/people',
      'GET    /api/projects            POST /api/projects',
      'GET    /api/projects/:id        PATCH /api/projects/:id  DELETE /api/projects/:id',
      'GET    /api/tasks?project=&progress=&urgency=&assignee=&q=',
      'POST   /api/tasks               GET/PATCH/DELETE /api/tasks/:id',
      'PATCH  /api/board               (bulk reorder)',
      'GET    /api/prefs               PATCH /api/prefs',
      'GET    /api/channels/:id        POST /api/channels/:id',
    ]});
  }
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Issue Tracker backend running at http://localhost:${PORT}`);
  console.log(`  API base:  http://localhost:${PORT}/api`);
  console.log(`  Data file: ${DB_FILE}`);
});
