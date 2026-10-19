'use strict';
/* SwiftFix – Meadow House repairs. Vanilla JS, localStorage only.
   SECURITY: all user text is inserted via textContent / text nodes (see h()). Never innerHTML with user data. */
(function () {
  const KEY = 'swiftfix_v1';
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONF = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DEFCAT = 'Other / not sure';
  const CATS = [['Alarms / Smoke Detectors','🚨'],['Appliances','🔌'],['Bathrooms','🚿'],['Kitchen','🍳'],['Doors / Garages / Locks','🔑'],['Electricity','⚡'],['Garden','🌿'],['Lighting','💡'],['Pests','🐜'],['Roof','🏚️'],['Water & Leaks','💧'],['Windows','🪟'],['Internet','📶'],['Heating & Boiler','🔥'],['Gas & Fire','🧯'],['Furniture','🛋️'],[DEFCAT,'❓']];
  const LOGO = '<svg viewBox="0 0 64 64" width="40" height="40" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="14" fill="#0A0A0A" stroke="#6EE7A0" stroke-width="2"/><rect x="7" y="26" width="15" height="3" rx="1.5" fill="#F5F5F0"/><rect x="10" y="32" width="13" height="3" rx="1.5" fill="#F5F5F0"/><rect x="13" y="38" width="11" height="3" rx="1.5" fill="#F5F5F0"/><text x="26" y="47" font-family="Arial Black,Arial,sans-serif" font-size="40" font-style="italic" font-weight="900" fill="#F5F5F0">S</text><circle cx="50" cy="42" r="4" fill="#6EE7A0"/></svg>';

  /* ---------- helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  function h(tag, attrs) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, v);
    }
    for (const c of Array.prototype.slice.call(arguments, 2).flat(Infinity)) {
      if (c == null || c === false) continue;
      e.append(c && c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  }
  const icon = (t) => h('span', { 'aria-hidden': 'true' }, t);
  const pad = (n) => String(n).padStart(2, '0');
  function fmt(iso) { const d = new Date(iso); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear() + ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  const isToday = (iso) => !!iso && new Date(iso).toDateString() === new Date().toDateString();
  const byNew = (a, b) => b.createdAt.localeCompare(a.createdAt);
  function greet() { const hr = new Date().getHours(); return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'; }
  function toast(msg, kind) {
    const t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + (kind || '');
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.className = 'toast'; }, 7000);
  }

  /* ---------- store ---------- */
  function def() { return { jobs: [], counter: 1000, notifs: [], reports: [], feedback: [], msgs: {}, settings: { theme: 'dark', text: 'S', lang: 'English' }, session: null, consent: false }; }
  function load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && Array.isArray(d.jobs)) return Object.assign(def(), d); } catch (e) { /* ignore */ } return def(); }
  let S = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); return true; } catch (e) { return false; } }
  function notify(role, msg, jobId) { S.notifs.unshift({ id: Date.now() + '-' + Math.random(), role, msg, jobId: jobId || null, t: new Date().toISOString(), read: false }); S.notifs = S.notifs.slice(0, 200); }
  function hist(j, label, note, by) { j.history.push({ t: new Date().toISOString(), label, status: j.status, note: note || '', by: by || (S.session ? S.session.name : '') }); }
  function getJob(id) { return S.jobs.find((j) => j.id === id); }
  function createJob(o) {
    S.counter += 1;
    const j = { id: 'SF-' + S.counter, house: 'Meadow House', category: o.category || DEFCAT, description: o.description, reporter: o.reporter, priority: o.priority, status: 'New', createdAt: new Date().toISOString(), attachments: o.attachments || [], latestNote: '', completionNote: '', completedAt: null, history: [], parentJobId: o.parentJobId || null, feedback: null };
    hist(j, 'Job created', 'Report submitted by ' + o.reporter + '. Status set to New.', o.reporter);
    S.jobs.push(j);
    notify('maint', 'New ' + j.priority + ' job ' + j.id + ': ' + j.category, j.id);
    notify('care', 'Report ' + j.id + ' submitted', j.id);
    return j;
  }
  function applySettings() {
    const el = document.documentElement;
    el.setAttribute('data-theme', S.settings.theme); el.setAttribute('data-text', S.settings.text);
  }

  /* ---------- small components ---------- */
  const pBadge = (p) => h('span', { class: 'badge ' + (p === 'Urgent' ? 'urgent' : 'normal') }, p === 'Urgent' ? [icon('⚠ '), 'Urgent'] : 'Normal');
  const sBadge = (s) => h('span', { class: 'badge ' + (s === 'New' ? 's-new' : s === 'In Progress' ? 's-prog' : 's-done') }, s);
  function field(id, label, control, hint) {
    const err = h('p', { id: id + '-err', class: 'err', role: 'alert' });
    const ids = [id + '-err']; if (hint) ids.push(id + '-hint');
    control.setAttribute('id', id); control.setAttribute('aria-describedby', ids.join(' ')); control.setAttribute('aria-invalid', 'false');
    return { node: h('div', {}, h('label', { for: id }, label), control, hint ? h('p', { class: 'hint', id: id + '-hint' }, hint) : null, err), control, err };
  }
  function setErr(f, msg) { f.err.textContent = msg || ''; f.control.setAttribute('aria-invalid', msg ? 'true' : 'false'); return !!msg; }
  function jobCard(j, role, extra) {
    return h('li', { class: 'card' },
      h('div', { class: 'badges' }, pBadge(j.priority), sBadge(j.status)),
      h('h3', { class: 'jt' }, j.description),
      h('p', { class: 'meta' }, j.id + ' · ' + j.category + ' · Reported by ' + j.reporter + ' · ' + fmt(j.createdAt)),
      extra || null,
      h('a', { class: 'btn', href: '#/' + role + '/job/' + j.id }, 'View job details'));
  }
  const empty = (t) => h('p', { class: 'card muted' }, t);
  function backLink(href, text) { return h('p', {}, h('a', { href }, '← ' + text)); }

  /* ---------- shell ---------- */
  const NAV = {
    care: [['Report', '🔧', '#/care/report'], ['History', '🕘', '#/care/history'], ['Home', '🏠', '#/care/home'], ['Chat', '💬', '#/care/chat'], ['Profile', '👤', '#/care/profile']],
    maint: [['Calendar', '📅', '#/maint/calendar'], ['Reviews', '⭐', '#/maint/reviews'], ['Home', '🏠', '#/maint/home'], ['Messages', '💬', '#/maint/messages'], ['Profile', '👤', '#/maint/profile']]
  };
  function activeNav(role, parts) {
    const k = parts[0] === role ? parts[1] : '';
    if (role === 'care') return { home: 'Home', report: 'Report', submitted: 'Report', history: 'History', job: 'History', chat: 'Chat', profile: 'Profile', feedback: 'Home' }[k] || '';
    return { home: 'Home', jobs: 'Home', job: 'Home', calendar: 'Calendar', reviews: 'Reviews', messages: 'Messages', profile: 'Profile' }[k] || '';
  }
  function shell(role, nodes, parts) {
    const unread = S.notifs.filter((n) => n.role === role && !n.read).length;
    const active = activeNav(role, parts);
    const header = h('header', { class: 'top' }, h('div', { class: 'wrap' },
      h('a', { class: 'brand', href: '#/' + role + '/home', 'aria-label': 'SwiftFix home' }, h('span', { class: 'logo' }), h('span', {}, 'SWIFT', h('span', { class: 'fix' }, 'FIX'))),
      h('a', { class: 'iconbtn', href: '#/notifications', 'aria-label': 'Notifications' + (unread ? ', ' + unread + ' unread' : '') }, icon('🔔'), unread ? h('span', { class: 'dot', 'aria-hidden': 'true' }, unread) : null),
      h('a', { class: 'iconbtn', href: '#/settings', 'aria-label': 'Settings' }, icon('⚙️'))));
    header.querySelector('.logo').innerHTML = LOGO; // static constant, no user data
    const main = h('main', { id: 'main', tabindex: '-1' }, h('div', { class: 'wrap' }, nodes));
    const nav = h('nav', { class: 'bottom', 'aria-label': 'Main navigation' }, h('ul', {}, NAV[role].map((n) =>
      h('li', {}, h('a', { href: n[2], 'aria-current': n[0] === active ? 'page' : null }, h('span', { class: 'ni', 'aria-hidden': 'true' }, n[1]), n[0])))));
    return [header, main, nav].concat(safety(role));
  }

  /* ---------- safety drawer ---------- */
  function safety(role) {
    const side = role === 'care' ? 'right' : 'left';
    let view = 'menu'; let opener = null;
    const back = h('div', { class: 'backdrop', hidden: true, onclick: close });
    const dr = h('aside', { class: 'drawer ' + side, role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Safety menu', hidden: true });
    const fab = h('button', { class: 'fab ' + side, type: 'button', 'aria-haspopup': 'dialog', 'aria-label': 'Safety menu: emergency services and report harassment', onclick: open }, icon('⚠️'), h('span', {}, 'Safety'));
    function open() { opener = document.activeElement; view = 'menu'; back.hidden = false; dr.hidden = false; draw(); }
    function close() { back.hidden = true; dr.hidden = true; if (opener && opener.focus) opener.focus(); }
    dr.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = Array.from(dr.querySelectorAll('a[href],button,input,textarea,select')).filter((x) => !x.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    function draw() {
      let title = 'Safety menu', body;
      if (view === 'menu') {
        body = h('div', {}, h('p', {}, 'Choose an option. Both care staff and maintenance staff can use these.'),
          h('button', { class: 'btn danger block', type: 'button', onclick: () => { view = 'emergency'; draw(); } }, icon('🚑'), 'Emergency Services'),
          h('div', { class: 'row' }),
          h('button', { class: 'btn block', type: 'button', onclick: () => { view = 'harass'; draw(); } }, icon('🛡️'), 'Report Harassment'));
      } else if (view === 'emergency') {
        title = 'Emergency Services';
        body = h('div', {}, h('p', {}, 'If someone is in immediate danger, call now.'),
          h('a', { class: 'btn danger block', href: 'tel:999' }, 'Call 999 – Emergency services'), h('div', { class: 'row' }),
          h('a', { class: 'btn danger block', href: 'tel:112' }, 'Call 112'), h('div', { class: 'row' }),
          h('button', { class: 'btn block', type: 'button', onclick: () => { view = 'menu'; draw(); } }, 'Back'));
      } else if (view === 'harass') {
        title = 'Report Harassment';
        const what = field('hr-what', 'What happened?', h('textarea', { rows: 4 }));
        const where = field('hr-where', 'Where did it happen? (optional)', h('input', { type: 'text' }));
        const who = field('hr-who', 'Who was involved? (optional)', h('input', { type: 'text' }));
        const f = h('form', { novalidate: true, onsubmit: (e) => {
          e.preventDefault();
          if (setErr(what, !what.control.value.trim() && 'Please describe what happened – this can\'t be empty.')) { what.control.focus(); return; }
          S.reports.push({ t: new Date().toISOString(), by: S.session.name, role, what: what.control.value.trim(), where: where.control.value.trim(), who: who.control.value.trim() });
          save(); view = 'harassdone'; draw();
        } }, h('p', { class: 'hint' }, 'Use this if something inappropriate happened during a maintenance check or fix. Fictional demo data only.'),
          what.node, where.node, who.node, h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Submit Report'), h('button', { class: 'btn', type: 'button', onclick: () => { view = 'menu'; draw(); } }, 'Back')));
        body = f;
      } else {
        title = 'Report Harassment';
        body = h('div', {}, h('p', { class: 'ok', role: 'status' }, 'Your harassment report has been saved. A manager will review it.'), h('button', { class: 'btn block', type: 'button', onclick: close }, 'Close'));
      }
      dr.replaceChildren(h('div', { class: 'dr-head' }, h('h2', { id: 'dr-title', tabindex: '-1' }, title), h('button', { class: 'btn', type: 'button', onclick: close, 'aria-label': 'Close safety menu' }, 'Close')), body);
      const t = $('#dr-title', dr); if (t) t.focus();
    }
    return [fab, back, dr];
  }

  /* ---------- welcome & sign-in ---------- */
  function welcome() {
    const logo = h('div', { class: 'hero' }, h('span', { class: 'logo' }));
    logo.firstChild.innerHTML = LOGO.replace('width="40" height="40"', 'width="88" height="88"');
    return [h('main', { id: 'main', tabindex: '-1' }, h('div', { class: 'wrap' },
      logo.firstChild && h('div', { class: 'hero' }, logo.firstChild,
        h('h1', {}, 'Welcome to the SwiftFix Portal'),
        h('p', { class: 'tag' }, 'Swift service, smarter solutions'),
        h('p', { class: 'muted' }, 'Repair reporting for Meadow House. Choose your portal to continue.')),
      h('div', { class: 'portals' },
        h('section', { class: 'card', 'aria-labelledby': 'p1' }, h('div', { class: 'wi' }, icon('👥')), h('h2', { id: 'p1' }, 'Care Staff'), h('p', {}, 'Report repairs, track progress and give feedback for Meadow House.'), h('a', { class: 'btn primary', href: '#/signin/care' }, 'Continue as Care Staff →')),
        h('section', { class: 'card', 'aria-labelledby': 'p2' }, h('div', { class: 'wi' }, icon('🛠️')), h('h2', { id: 'p2' }, 'Maintenance Staff'), h('p', {}, 'View, accept and complete repair jobs for Meadow House.'), h('a', { class: 'btn primary', href: '#/signin/maint' }, 'Continue as Maintenance Staff →'))),
      h('p', { class: 'hint', style: 'text-align:center;margin-top:1.5rem' }, 'Demo app – fictional people and data only. No password needed.')))];
  }
  function signIn(role) {
    if (role !== 'care' && role !== 'maint') { location.hash = '#/welcome'; return []; }
    const name = field('si-name', 'Your name', h('input', { type: 'text', autocomplete: 'off' }), 'Fictional name only, e.g. Alex Morgan.');
    return [h('main', { id: 'main', tabindex: '-1' }, h('div', { class: 'wrap' }, h('h1', {}, role === 'care' ? 'Care Staff sign in' : 'Maintenance Staff sign in'),
      h('form', { novalidate: true, onsubmit: (e) => {
        e.preventDefault();
        if (setErr(name, !name.control.value.trim() && 'Please enter your name to continue.')) { name.control.focus(); return; }
        S.session = { role, name: name.control.value.trim() }; save(); location.hash = '#/' + role + '/home';
      } }, name.node, h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Continue'), h('a', { class: 'btn', href: '#/welcome' }, 'Back')))))];
  }

  /* ---------- uploader ---------- */
  function uploader(files) {
    const list = h('ul', { class: 'files' }); const msg = h('p', { class: 'err', role: 'alert' });
    let replaceIdx = null;
    const input = h('input', { type: 'file', accept: 'image/*,video/*,.pdf,.doc,.docx,.txt', multiple: true, tabindex: '-1', 'aria-hidden': 'true', style: 'display:none' });
    function draw() {
      list.replaceChildren(...files.map((f, i) => h('li', {},
        f.type.startsWith('image/') ? h('img', { class: 'th', src: f.dataUrl, alt: 'Preview of ' + f.name }) : icon('📎'),
        h('span', {}, f.name),
        h('button', { class: 'btn', type: 'button', onclick: () => { replaceIdx = i; input.multiple = false; input.click(); } }, 'Change'),
        h('button', { class: 'btn', type: 'button', onclick: () => { files.splice(i, 1); draw(); } }, 'Delete'))));
    }
    input.addEventListener('change', () => {
      msg.textContent = '';
      Array.from(input.files).forEach((f) => {
        if (f.size > 1.5 * 1024 * 1024) { msg.textContent = f.name + ' is too large (maximum 1.5 MB per file).'; return; }
        const r = new FileReader();
        r.onload = () => { const o = { name: f.name, type: f.type || 'file', dataUrl: r.result }; if (replaceIdx != null) { files[replaceIdx] = o; } else files.push(o); replaceIdx = null; draw(); };
        r.readAsDataURL(f);
      });
      input.value = '';
    });
    draw();
    return h('div', {}, h('p', { class: 'meta', style: 'font-weight:700;margin-bottom:0' }, 'Photo, video or document (optional)'),
      h('p', { class: 'hint' }, 'Recommended – helps the maintenance team prioritise and avoids wasted visits. Maximum 1.5 MB per file.'),
      h('button', { class: 'btn', type: 'button', onclick: () => { replaceIdx = null; input.multiple = true; input.click(); } }, icon('📷'), 'Add photo, video or document'), input, list, msg);
  }
  function attachments(j) {
    if (!j.attachments || !j.attachments.length) return null;
    return h('div', { class: 'attach' }, h('h2', {}, 'Attachments'), j.attachments.map((a) =>
      a.type.startsWith('image/') ? h('img', { src: a.dataUrl, alt: 'Attachment: ' + a.name }) :
      a.type.startsWith('video/') ? h('video', { src: a.dataUrl, controls: true, 'aria-label': 'Attachment: ' + a.name }) :
      h('p', {}, icon('📎 '), a.name)));
  }

  /* ---------- care pages ---------- */
  let pending = null;
  function widget(href, ic, title, text) { return h('a', { class: 'card widget', href }, h('div', { class: 'wi' }, icon(ic)), h('h2', {}, title), h('p', { class: 'muted' }, text)); }
  function careHome() {
    const latest = S.jobs.slice().sort(byNew)[0];
    return [h('h1', { tabindex: '-1' }, greet() + ', ' + S.session.name), h('p', { class: 'muted' }, 'Meadow House · Care staff'),
      h('section', { class: 'card', 'aria-labelledby': 'cur' }, h('h2', { id: 'cur' }, 'Current / latest issue'),
        latest ? [h('div', { class: 'badges' }, pBadge(latest.priority), sBadge(latest.status)), h('h3', { class: 'jt' }, latest.description), h('p', { class: 'meta' }, latest.id + ' · ' + fmt(latest.createdAt)), h('a', { class: 'btn', href: '#/care/job/' + latest.id }, 'View job details')] : h('p', { class: 'muted' }, 'No issues reported yet.')),
      widget('#/care/report', '🔧', 'Report an Issue', 'Tell maintenance what needs fixing.'),
      widget('#/care/history', '🕘', 'History Log', 'Review previous and current reports.'),
      widget('#/care/feedback', '📝', 'Give Feedback', 'Tell us how the service is going.')];
  }
  function reportCategory() {
    return [h('h1', {}, 'Report an Issue'), h('p', { class: 'muted' }, 'Step 1: choose the type of problem, or skip to the form.'),
      h('div', { class: 'tiles' }, CATS.map((c) => h('button', { class: 'tile', type: 'button', onclick: () => { pending = { category: c[0] }; location.hash = '#/care/report/form'; } }, h('span', { class: 'ti', 'aria-hidden': 'true' }, c[1]), c[0]))),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/care/report/form' }, 'Skip to the form'))];
  }
  function reportForm() {
    const pre = pending || {}; pending = null;
    const files = [];
    const cat = h('select', {}, CATS.map((c) => h('option', { value: c[0], selected: c[0] === (pre.category || DEFCAT) }, c[0])));
    const catF = field('rf-cat', 'Category', cat);
    const desc = field('rf-desc', 'Description of the problem', h('textarea', { rows: 4 }), 'Say what is wrong and where.');
    desc.control.value = pre.description || '';
    const rep = field('rf-rep', 'Reporter / staff name', h('input', { type: 'text', autocomplete: 'off' }));
    const pr = h('fieldset', {}, h('legend', {}, 'Priority'),
      h('label', { class: 'opt', for: 'pr-n' }, h('input', { type: 'radio', name: 'prio', id: 'pr-n', value: 'Normal', checked: pre.priority !== 'Urgent' }), 'Normal'),
      h('label', { class: 'opt', for: 'pr-u' }, h('input', { type: 'radio', name: 'prio', id: 'pr-u', value: 'Urgent', checked: pre.priority === 'Urgent' }), 'Urgent – needs attention quickly'));
    const form = h('form', { novalidate: true, onsubmit: (e) => {
      e.preventDefault();
      const d = desc.control.value.trim(), r = rep.control.value.trim();
      const e1 = setErr(desc, !d && 'Please describe the problem – the description can\'t be empty.');
      const e2 = setErr(rep, !r && 'Please enter the reporter\'s name – it can\'t be empty.');
      if (e1) { desc.control.focus(); return; }
      if (e2) { rep.control.focus(); return; }
      const j = createJob({ description: d, reporter: r, priority: pr.querySelector('input:checked').value, category: cat.value, attachments: files.slice(), parentJobId: pre.parentJobId });
      if (!save()) { j.attachments = []; save(); toast('Report saved, but the attachments were too big to store.', 'bad'); }
      location.hash = '#/care/submitted/' + j.id;
    } },
      catF.node, pr, desc.node, rep.node,
      h('p', {}, h('strong', {}, 'House: '), 'Meadow House'),
      uploader(files),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Submit Report'), h('a', { class: 'btn', href: '#/care/report' }, 'Back')));
    return [h('h1', {}, pre.parentJobId ? 'Report This Again' : 'Report a Repair'), pre.parentJobId ? h('p', { class: 'muted' }, 'Follow-up to ' + pre.parentJobId + '. Details are pre-filled – just add your name.') : null, form];
  }
  function submitted(id) {
    const j = getJob(id); if (!j) return [empty('Job not found.')];
    return [h('h1', {}, 'Your report has been submitted'), h('p', { class: 'ok', role: 'status' }, 'Report submitted – Job ' + j.id + ' created with status New.'),
      h('section', { class: 'card' }, h('div', { class: 'badges' }, pBadge(j.priority), sBadge(j.status)), h('h2', {}, 'Summary'), detailKV(j), h('p', {}, h('strong', {}, 'Description: '), j.description)),
      h('div', { class: 'row' }, h('a', { class: 'btn primary', href: '#/care/home' }, 'Back to Home'), h('a', { class: 'btn', href: '#/care/history' }, 'Back to Reports'), h('a', { class: 'btn', href: '#/care/report' }, 'Report Another Issue'))];
  }
  function detailKV(j) {
    return h('dl', { class: 'kv' }, [['Job ID', j.id], ['House', j.house], ['Status', j.status], ['Priority', j.priority], ['Reported by', j.reporter], ['Date reported', fmt(j.createdAt)], ['Category', j.category]].map((p) => h('div', {}, h('dt', {}, p[0]), h('dd', {}, p[1]))));
  }
  let careFilter = 'All';
  function careHistory() {
    const box = h('ul', { class: 'list' });
    const chips = h('div', { class: 'row', role: 'group', 'aria-label': 'Filter reports by status' });
    function draw() {
      chips.replaceChildren(...['All', 'New', 'In Progress', 'Completed'].map((s) => h('button', { class: 'btn', type: 'button', 'aria-pressed': String(careFilter === s), onclick: () => { careFilter = s; draw(); } }, s)));
      const js = S.jobs.filter((j) => careFilter === 'All' || j.status === careFilter).sort(byNew);
      box.replaceChildren(...(js.length ? js.map((j) => jobCard(j, 'care')) : [h('li', {}, empty('No reports to show.'))]));
    }
    draw();
    return [h('h1', {}, 'History Log'), h('p', { class: 'muted' }, 'Your reports, newest first. Select one to see its full history.'), chips, box];
  }

  /* ---------- job detail ---------- */
  function timeline(j) {
    return h('section', { 'aria-labelledby': 'hist-h' }, h('h2', { id: 'hist-h' }, 'Job history'), h('ol', { class: 'tl' }, j.history.map((x) =>
      h('li', {}, h('strong', {}, x.label + (x.status ? ' – ' + x.status : '')), h('span', { class: 'meta' }, fmt(x.t) + (x.by ? ' · ' + x.by : '')), x.note ? h('p', {}, x.note) : null))),
      h('p', { class: 'hint' }, 'History is preserved: new updates are added to the timeline and never replace earlier entries.'));
  }
  function jobDetail(id, role) {
    const j = getJob(id); if (!j) return [backLink('#/' + role + '/home', 'Back'), empty('Job not found.')];
    const out = [backLink(role === 'care' ? '#/care/history' : '#/maint/home', role === 'care' ? 'Back to history' : 'Back to jobs'),
      h('h1', {}, 'Job ' + j.id), h('div', { class: 'badges' }, pBadge(j.priority), sBadge(j.status)),
      h('section', { class: 'card' }, detailKV(j), j.parentJobId ? h('p', { class: 'meta' }, 'Follow-up to ' + j.parentJobId) : null,
        h('h2', {}, 'Repair description'), h('p', {}, j.description),
        j.latestNote ? [h('h2', {}, 'Latest progress note'), h('p', {}, j.latestNote)] : null,
        j.status === 'Completed' ? h('div', { class: 'ok' }, h('strong', {}, 'Completion explanation: '), j.completionNote, h('div', { class: 'meta' }, 'Completed ' + fmt(j.completedAt))) : null,
        attachments(j))];
    if (role === 'care') {
      out.push(h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { pending = { category: j.category, description: j.description, priority: j.priority, parentJobId: j.id }; location.hash = '#/care/report/form'; } }, 'Report This Again'),
        j.status === 'Completed' ? h('a', { class: 'btn', href: '#/care/feedback/' + j.id }, j.feedback ? 'Update Feedback' : 'Give Feedback') : null));
      if (j.feedback) out.push(h('p', { class: 'card' }, 'Your feedback: ' + '★'.repeat(j.feedback.rating) + '☆'.repeat(5 - j.feedback.rating) + (j.feedback.comment ? ' – ' + j.feedback.comment : '')));
    } else if (j.status !== 'Completed') out.push(maintActions(j));
    else if (j.feedback) out.push(h('p', { class: 'card' }, 'Care staff feedback: ' + '★'.repeat(j.feedback.rating) + '☆'.repeat(5 - j.feedback.rating) + (j.feedback.comment ? ' – ' + j.feedback.comment : '')));
    out.push(timeline(j));
    return out;
  }
  function maintActions(j) {
    const wrap = h('section', { class: 'card', 'aria-labelledby': 'act-h' }, h('h2', { id: 'act-h' }, 'Update repair'));
    if (j.status === 'New') {
      wrap.append(h('p', {}, 'Review the report, assess the risk and update the job when work begins.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => { startWork(j, 'Work started', 'Status changed to In Progress.'); save(); toast('Job ' + j.id + ' moved to In Progress.'); render(); } }, 'Start Work'));
    }
    if (j.status === 'In Progress') {
      const note = field('pn-' + j.id, 'Progress note', h('textarea', { rows: 3 }), 'Describe the work done so far. Earlier notes are kept.');
      wrap.append(h('form', { novalidate: true, onsubmit: (e) => {
        e.preventDefault(); const v = note.control.value.trim();
        if (setErr(note, !v && 'Please enter a progress note – it can\'t be empty.')) { note.control.focus(); return; }
        j.latestNote = v; hist(j, 'Progress update', v); notify('care', j.id + ' update: ' + v, j.id); save(); toast('Progress note saved for ' + j.id + '.'); render();
      } }, note.node, h('button', { class: 'btn primary', type: 'submit' }, 'Save Progress Update')));
    }
    const cn = field('cn-' + j.id, 'Completion note', h('textarea', { rows: 3 }), 'Required. Explain what was done to finish the repair.');
    wrap.append(h('hr', { style: 'border-color:var(--border);margin:1.2rem 0' }), h('form', { novalidate: true, onsubmit: (e) => {
      e.preventDefault(); const v = cn.control.value.trim();
      if (setErr(cn, !v && 'A completion note is required – please explain what was done. The job has not been changed.')) { cn.control.focus(); toast('Completion note required. Job not changed.', 'bad'); return; }
      j.status = 'Completed'; j.completionNote = v; j.completedAt = new Date().toISOString(); hist(j, 'Completed', v); notify('care', j.id + ' completed: ' + v, j.id);
      save(); toast('Job ' + j.id + ' marked as Completed.'); render();
    } }, cn.node, h('button', { class: 'btn primary', type: 'submit' }, 'Mark as Completed')));
    return wrap;
  }
  function startWork(j, label, note) { j.status = 'In Progress'; hist(j, label, note); notify('care', j.id + ' is now In Progress', j.id); }

  /* ---------- feedback ---------- */
  function feedbackPage(jobId) {
    const j = jobId ? getJob(jobId) : null;
    const rating = h('fieldset', { id: 'fb-rating' }, h('legend', {}, 'Rating'), [1, 2, 3, 4, 5].map((n) => h('label', { class: 'opt', for: 'fb-r' + n }, h('input', { type: 'radio', name: 'rating', id: 'fb-r' + n, value: n }), n + (n === 1 ? ' star – poor' : n === 5 ? ' stars – excellent' : ' stars'))));
    const rErr = h('p', { class: 'err', role: 'alert' });
    const topic = field('fb-topic', 'Topic', h('select', {}, ['General', 'Speed of repair', 'Communication', 'Quality of work', 'Staff conduct'].map((t) => h('option', { value: t }, t))));
    const cm = field('fb-c', 'Comment (optional)', h('textarea', { rows: 4 }));
    return [backLink(j ? '#/care/job/' + j.id : '#/care/home', 'Back'), h('h1', {}, j ? 'Feedback on ' + j.id : 'Give Feedback'),
      h('form', { novalidate: true, onsubmit: (e) => {
        e.preventDefault(); const sel = rating.querySelector('input:checked');
        rErr.textContent = sel ? '' : 'Please choose a rating from 1 to 5.';
        if (!sel) { rating.querySelector('input').focus(); return; }
        const f = { id: 'fb' + Date.now(), jobId: j ? j.id : null, rating: Number(sel.value), topic: topic.control.value, comment: cm.control.value.trim(), by: S.session.name, t: new Date().toISOString() };
        S.feedback.push(f); if (j) j.feedback = { rating: f.rating, comment: f.comment }; save();
        toast('Thank you – your feedback was saved.'); location.hash = j ? '#/care/job/' + j.id : '#/care/home';
      } }, rating, rErr, topic.node, cm.node, h('button', { class: 'btn primary', type: 'submit' }, 'Submit Feedback'))];
  }

  /* ---------- chat (scripted, no LLM) ---------- */
  const TIPS = [[/heat|boiler|radiator|cold|hot water/, 'Check the boiler display for an error and that the pressure is around 1–1.5 bar. Is the thermostat set above room temperature?'], [/leak|water|drip|tap|flood/, 'If it is safe, turn off the water at the stopcock and put a bucket under the leak.'], [/plug|socket|power|electric|light|trip|bulb/, 'Check whether a trip switch on the fuse board has flipped. Reset it once only.'], [/lock|door|key|handle/, 'Check whether the lock is dirty or the door has swollen. A little graphite lubricant can help.'], [/internet|wifi|wi-fi|router/, 'Switch the router off for 30 seconds, then on again and wait two minutes.']];
  let chat = [{ from: 'bot', text: 'Hi! I\'m the SwiftFix helper. What\'s the problem?' }]; let chatAsked = false;
  function botReply(t) {
    const l = t.toLowerCase().trim();
    if (chatAsked && /^(yes|yeah|yep|fixed|sorted|works|solved)/.test(l)) { chatAsked = false; return { text: 'Great – glad that\'s sorted! Tell me if anything else comes up.' }; }
    if (!chatAsked) { const m = TIPS.find((x) => x[0].test(l)); if (m) { chatAsked = true; return { text: m[1] + ' Reply "yes" if that fixed it, or "no" if not.' }; } }
    chatAsked = false; return { text: 'I can\'t solve this one by chat. Would you like to speak to someone?', escalate: true };
  }
  function chatPage() {
    const log = h('div', { class: 'chat', role: 'log', 'aria-live': 'polite', 'aria-label': 'Chat with the SwiftFix helper' });
    const video = h('section', { class: 'card', hidden: true, 'aria-label': 'Video call (demo)' });
    const input = h('input', { type: 'text', id: 'chat-in', autocomplete: 'off' });
    function draw() {
      log.replaceChildren(...chat.map((m) => h('div', { class: 'msg ' + m.from }, m.text, m.escalate ? h('div', { class: 'row' },
        h('a', { class: 'btn primary', href: 'tel:01514960000' }, icon('📞'), 'Call maintenance'),
        h('button', { class: 'btn', type: 'button', onclick: startVideo }, icon('🎥'), 'Start video call'),
        h('a', { class: 'btn', href: '#/care/report' }, 'Report an Issue')) : null)));
      log.scrollTop = log.scrollHeight;
    }
    let stream = null;
    function stopVideo() { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; video.hidden = true; }
    function startVideo() {
      video.hidden = false; const st = h('p', { role: 'status' }, 'Connecting to maintenance… (demo)');
      const v = h('video', { autoplay: true, playsinline: true, muted: true, 'aria-label': 'Your camera preview' });
      video.replaceChildren(h('h2', {}, 'Video call (demo)'), st, v, h('button', { class: 'btn', type: 'button', onclick: stopVideo }, 'End call'));
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { st.textContent = 'Video is not available on this device. Please call maintenance instead.'; return; }
      navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((s) => { stream = s; v.srcObject = s; st.textContent = 'Camera on – a maintenance colleague would join here in the full product.'; }).catch(() => { st.textContent = 'Camera or microphone is blocked. Please allow access, or call maintenance instead.'; });
    }
    draw();
    return [h('h1', {}, 'Chat with the SwiftFix helper'), h('p', { class: 'muted' }, 'Scripted helper (no AI service). Try "my heating is not working".'), log,
      h('form', { novalidate: true, onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (!v) { input.focus(); return; } chat.push({ from: 'me', text: v }); chat.push(Object.assign({ from: 'bot' }, botReply(v))); input.value = ''; draw(); input.focus(); } },
        h('label', { for: 'chat-in' }, 'Your message'), input, h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Send'), h('button', { class: 'btn', type: 'button', onclick: startVideo }, icon('🎥'), 'Start video call'))), video];
  }

  /* ---------- profile / notifications / settings ---------- */
  function profilePage(role) {
    return [h('h1', {}, 'Profile'), h('section', { class: 'card' }, h('h2', {}, 'Account details'), h('dl', { class: 'kv' },
      [['Name', S.session.name], ['Role', role === 'care' ? 'Care staff' : 'Maintenance staff'], ['Company', 'Meadow House'], ['Portal', 'SwiftFix']].map((p) => h('div', {}, h('dt', {}, p[0]), h('dd', {}, p[1])))),
      h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/settings' }, 'Open Settings')))];
  }
  function notifPage(role) {
    const ns = S.notifs.filter((n) => n.role === role);
    return [backLink('#/' + role + '/home', 'Back'), h('h1', {}, 'Notifications'),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: () => { ns.forEach((n) => { n.read = true; }); save(); render(); } }, 'Mark all as read')),
      ns.length ? h('ul', { class: 'list' }, ns.map((n) => h('li', { class: 'card' }, h('p', {}, (n.read ? '' : '● New · ') + n.msg), h('p', { class: 'meta' }, fmt(n.t)), n.jobId ? h('a', { href: '#/' + role + '/job/' + n.jobId }, 'View ' + n.jobId) : null))) : empty('No notifications yet. Updates on your jobs will appear here.')];
  }
  const SECTIONS = [['company', 'Company Profile'], ['account', 'Account Details'], ['appearance', 'App Appearance'], ['help', 'Help & Support'], ['about', 'About SwiftFix'], ['terms', 'Data Protection Consent / Terms & Conditions']];
  function settingsPage(sec) {
    const role = S.session.role;
    if (!sec) return [backLink('#/' + role + '/home', 'Back'), h('h1', {}, 'Settings'), h('ul', { class: 'card setlist' }, SECTIONS.map((s) => h('li', {}, h('a', { href: '#/settings/' + s[0] }, s[1], icon('›')))),
      h('li', {}, h('a', { href: '#/settings/signout' }, 'Sign Out', icon('›'))))];
    const back = backLink('#/settings', 'Settings');
    if (sec === 'company') return [back, h('h1', {}, 'Company Profile'), h('section', { class: 'card' }, h('dl', { class: 'kv' }, [['House name', 'Meadow House'], ['Address', '1 Meadow Lane, Exampletown (fictional)'], ['Manager', 'Jordan Ellis (fictional)'], ['Phone', '0151 496 0000 (fictional)'], ['Email', 'hello@meadowhouse.example']].map((p) => h('div', {}, h('dt', {}, p[0]), h('dd', {}, p[1])))))];
    if (sec === 'account') return [back].concat(profilePage(role));
    if (sec === 'appearance') {
      const th = field('ap-theme', 'Theme', h('select', {}, [['dark', 'Dark (black and mint)'], ['light', 'Light']].map((o) => h('option', { value: o[0], selected: S.settings.theme === o[0] }, o[1]))));
      const tx = field('ap-text', 'Text size', h('select', {}, [['S', 'Standard'], ['M', 'Large'], ['L', 'Extra large']].map((o) => h('option', { value: o[0], selected: S.settings.text === o[0] }, o[1]))));
      const lg = field('ap-lang', 'Language', h('select', {}, ['English', 'Español', 'Français', 'Cymraeg'].map((o) => h('option', { value: o, selected: S.settings.lang === o }, o))), 'Demo only – interface text stays in English.');
      th.control.addEventListener('change', () => { S.settings.theme = th.control.value; save(); applySettings(); toast('Theme saved.'); });
      tx.control.addEventListener('change', () => { S.settings.text = tx.control.value; save(); applySettings(); toast('Text size saved.'); });
      lg.control.addEventListener('change', () => { S.settings.lang = lg.control.value; save(); toast('Language saved (demo).'); });
      return [back, h('h1', {}, 'App Appearance'), h('div', { class: 'card' }, th.node, tx.node, lg.node)];
    }
    if (sec === 'help') return [back, h('h1', {}, 'Help & Support'), h('section', { class: 'card' }, h('h2', {}, 'Using SwiftFix'), h('p', {}, 'Care staff: use Report to create a repair job. Maintenance staff: accept a job, start work, add notes, then complete it with a note.'), h('p', {}, 'Support: support@swiftfix.example (fictional).')),
      h('section', { class: 'card' }, h('h2', {}, 'Demo tools'), h('p', { class: 'hint' }, 'Optional. Data is stored only in this browser.'), h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: () => { seedDemo(); toast('Demo data loaded.'); render(); } }, 'Load demo data'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => { if (confirm('Delete all jobs and data stored in this browser?')) { const s = S.session; S = def(); S.session = s; save(); toast('All data reset.'); render(); } } }, 'Reset all data')))];
    if (sec === 'about') return [back, h('h1', {}, 'About SwiftFix'), h('section', { class: 'card' }, h('p', {}, 'SwiftFix – swift service, smarter solutions.'), h('p', {}, 'A repair reporting and tracking portal for the fictional Meadow House, built for the Omega Digital hackathon. Version 1.0 demo.'))];
    if (sec === 'terms') {
      const cb = h('input', { type: 'checkbox', id: 'consent', checked: S.consent, onchange: () => { S.consent = cb.checked; save(); toast(cb.checked ? 'Consent saved.' : 'Consent withdrawn.'); } });
      return [back, h('h1', {}, 'Data Protection & Terms'), h('section', { class: 'card' }, h('p', {}, 'SwiftFix stores repair reports only in your browser for this demo. Use fictional people and care data only. Never enter real care records, passwords or personal data.'), h('p', {}, 'Terms: this demo is provided as-is for judging purposes.'), h('label', { class: 'opt', for: 'consent' }, cb, 'I consent to this demo storing my entries in this browser.'))];
    }
    if (sec === 'signout') return [back, h('h1', {}, 'Sign Out'), h('section', { class: 'card' }, h('p', {}, 'Your saved jobs stay in this browser.'), h('button', { class: 'btn primary', type: 'button', onclick: () => { S.session = null; save(); location.hash = '#/welcome'; } }, 'Sign Out'))];
    return [back, empty('Page not found.')];
  }
  function seedDemo() {
    const mk = (d, r, p, c) => createJob({ description: d, reporter: r, priority: p, category: c });
    mk('Garden fence damaged', 'Alex Morgan', 'Urgent', 'Garden');
    const k = mk('Kitchen light not working', 'Priya Shah', 'Normal', 'Lighting'); startWork(k, 'Work started', 'Status changed to In Progress.');
    const b = mk('Bedroom door handle loose', 'Sam Taylor', 'Normal', 'Doors / Garages / Locks'); startWork(b, 'Work started', 'Status changed to In Progress.');
    b.status = 'Completed'; b.completionNote = 'Handle tightened and checked.'; b.completedAt = new Date().toISOString(); hist(b, 'Completed', b.completionNote, 'Jamie Carter'); save();
  }

  /* ---------- maintenance pages ---------- */
  const open = (j) => j.status !== 'Completed';
  const KINDS = {
    new: ['New Jobs', (j) => j.status === 'New'],
    progress: ['In Progress', (j) => j.status === 'In Progress'],
    urgent: ['Urgent Jobs', (j) => j.priority === 'Urgent' && open(j)],
    done: ['Completed Today', (j) => j.status === 'Completed' && isToday(j.completedAt)]
  };
  function maintHome() {
    const c = (k) => S.jobs.filter(KINDS[k][1]).length;
    const stat = (k, ic) => h('a', { class: 'card widget', href: '#/maint/jobs/' + k, 'aria-label': KINDS[k][0] + ': ' + c(k) }, h('div', { class: 'wi' }, icon(ic)), h('div', { class: 'stat', 'aria-hidden': 'true' }, c(k)), h('p', { class: 'muted', style: 'margin:0' }, KINDS[k][0]));
    const js = S.jobs.slice().sort(byNew);
    return [h('h1', {}, greet() + ', ' + S.session.name), h('p', { class: 'muted' }, 'Here is the current maintenance workload at Meadow House.'),
      h('div', { class: 'grid2' }, stat('new', '📥'), stat('progress', '🔧'), stat('urgent', '⚠️'), stat('done', '✅')),
      h('section', { 'aria-labelledby': 'rj' }, h('h2', { id: 'rj', style: 'margin-top:1.2rem' }, 'Repair jobs'), js.length ? h('ul', { class: 'list' }, js.map((j) => jobCard(j, 'maint'))) : empty('No repair jobs yet. New reports from care staff will appear here.'))];
  }
  let filt = { priority: '', category: '', sort: 'newest' };
  function maintList(kind) {
    if (!KINDS[kind]) return [empty('List not found.')];
    const box = h('ul', { class: 'list' }); const panel = h('div', { class: 'card', hidden: true, id: 'filter-panel' });
    const fb = h('button', { class: 'btn', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'filter-panel', onclick: () => { panel.hidden = !panel.hidden; fb.setAttribute('aria-expanded', String(!panel.hidden)); } }, icon('🔎'), 'Filter');
    const sel = (id, label, opts, key) => { const s = h('select', {}, opts.map((o) => h('option', { value: o[0], selected: filt[key] === o[0] }, o[1]))); const f = field(id, label, s); s.addEventListener('change', () => { filt[key] = s.value; draw(); }); return f.node; };
    panel.append(sel('f-pri', 'Priority', [['', 'All priorities'], ['Urgent', 'Urgent'], ['Normal', 'Normal']], 'priority'),
      sel('f-cat', 'Category', [['', 'All categories']].concat(CATS.map((c) => [c[0], c[0]])), 'category'),
      sel('f-sort', 'Sort by', [['newest', 'Newest first'], ['oldest', 'Oldest first'], ['urgency', 'Most urgent first']], 'sort'));
    function draw() {
      let js = S.jobs.filter(KINDS[kind][1]).filter((j) => (!filt.priority || j.priority === filt.priority) && (!filt.category || j.category === filt.category));
      const s = kind === 'urgent' && filt.sort === 'newest' ? 'urgency' : filt.sort;
      js.sort((a, b) => s === 'oldest' ? a.createdAt.localeCompare(b.createdAt) : s === 'urgency' ? ((b.priority === 'Urgent') - (a.priority === 'Urgent')) || a.createdAt.localeCompare(b.createdAt) : byNew(a, b));
      box.replaceChildren(...(js.length ? js.map((j) => jobCard(j, 'maint', kind === 'new' ? newActions(j) : null)) : [h('li', {}, empty('No jobs to show.'))]));
    }
    draw();
    return [backLink('#/maint/home', 'Back to dashboard'), h('h1', {}, KINDS[kind][0]), h('div', { class: 'row' }, fb), panel, box];
  }
  function newActions(j) {
    const reason = field('dr-' + j.id, 'Reason for declining (optional)', h('input', { type: 'text' }));
    const dbox = h('div', { hidden: true }, reason.node, h('button', { class: 'btn danger', type: 'button', onclick: () => { hist(j, 'Declined', reason.control.value.trim() || 'Declined by ' + S.session.name); notify('care', j.id + ' was declined by maintenance and remains New.', j.id); save(); toast('Job ' + j.id + ' declined. It stays New.'); render(); } }, 'Confirm Decline'));
    return h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { startWork(j, 'Accepted', 'Job accepted by ' + S.session.name + '. Status changed to In Progress.'); save(); toast('Job ' + j.id + ' accepted and moved to In Progress.'); render(); } }, 'Accept Job'),
      h('button', { class: 'btn', type: 'button', onclick: () => { dbox.hidden = !dbox.hidden; } }, 'Decline'), dbox);
  }
  let cal = { y: new Date().getFullYear(), m: new Date().getMonth(), sel: new Date().getDate() };
  function calendarPage() {
    const wrap = h('div', {});
    function dayKey(iso) { const d = new Date(iso); return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
    function draw() {
      const first = new Date(cal.y, cal.m, 1), n = new Date(cal.y, cal.m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
      const map = {}; S.jobs.forEach((j) => { [j.createdAt, j.completedAt].filter(Boolean).forEach((iso) => { const k = dayKey(iso); (map[k] = map[k] || new Set()).add(j.id); }); });
      const cells = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => h('div', { class: 'dn' }, d));
      for (let i = 0; i < lead; i++) cells.push(h('div', { class: 'pad' }));
      for (let d = 1; d <= n; d++) { const cnt = (map[cal.y + '-' + cal.m + '-' + d] || new Set()).size; cells.push(h('button', { type: 'button', class: cnt ? 'has' : '', 'aria-pressed': String(cal.sel === d), 'aria-label': d + ' ' + MONF[cal.m] + ' ' + cal.y + ', ' + cnt + (cnt === 1 ? ' job' : ' jobs'), onclick: () => { cal.sel = d; draw(); } }, String(d), cnt ? h('div', { class: 'meta' }, cnt + '●') : null)); }
      const ids = Array.from(map[cal.y + '-' + cal.m + '-' + cal.sel] || []); const js = ids.map(getJob).filter(Boolean);
      wrap.replaceChildren(h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', 'aria-label': 'Previous month', onclick: () => { cal.m--; if (cal.m < 0) { cal.m = 11; cal.y--; } cal.sel = 1; draw(); } }, '‹ Prev'),
        h('strong', { role: 'status' }, MONF[cal.m] + ' ' + cal.y),
        h('button', { class: 'btn', type: 'button', 'aria-label': 'Next month', onclick: () => { cal.m++; if (cal.m > 11) { cal.m = 0; cal.y++; } cal.sel = 1; draw(); } }, 'Next ›')),
        h('div', { class: 'cal' }, cells), h('h2', { style: 'margin-top:1rem' }, 'Jobs on ' + cal.sel + ' ' + MONF[cal.m] + ' ' + cal.y),
        js.length ? h('ul', { class: 'list' }, js.map((j) => jobCard(j, 'maint'))) : empty('No jobs on this day.'));
    }
    draw();
    return [h('h1', {}, 'Calendar'), h('p', { class: 'muted' }, 'Days with jobs are outlined. Select a day to see them.'), wrap];
  }
  function reviewsPage() {
    const done = S.jobs.filter((j) => j.status === 'Completed').sort(byNew);
    return [h('h1', {}, 'Reviews & History'), h('section', { 'aria-labelledby': 'fbh' }, h('h2', { id: 'fbh' }, 'Feedback on completed jobs'),
      S.jobs.some((j) => j.feedback) ? h('ul', { class: 'list' }, S.jobs.filter((j) => j.feedback).map((j) => h('li', { class: 'card' }, h('p', {}, h('strong', {}, j.id + ': '), '★'.repeat(j.feedback.rating) + '☆'.repeat(5 - j.feedback.rating)), j.feedback.comment ? h('p', {}, j.feedback.comment) : null, h('a', { href: '#/maint/job/' + j.id }, 'View job')))) : empty('No feedback received yet.')),
      h('section', { 'aria-labelledby': 'jh' }, h('h2', { id: 'jh' }, 'Completed job history'), done.length ? h('ul', { class: 'list' }, done.map((j) => jobCard(j, 'maint'))) : empty('No completed jobs yet.'))];
  }
  const CONTACTS = [['Priya Shah', 'Care staff'], ['Sam Taylor', 'Care staff'], ['Jamie Carter', 'Maintenance'], ['Riley Smith', 'Maintenance']];
  function messagesPage(idx) {
    if (idx === undefined) return [h('h1', {}, 'Messages'), h('p', { class: 'muted' }, 'Coordinate jobs with colleagues or send updates to care staff.'), h('ul', { class: 'card setlist' }, CONTACTS.map((c, i) => h('li', {}, h('a', { href: '#/maint/messages/' + i }, h('span', {}, h('strong', {}, c[0]), ' · ', c[1]), icon('›')))))];
    const c = CONTACTS[Number(idx)]; if (!c) return [empty('Conversation not found.')];
    const key = 'c' + idx; const thread = S.msgs[key] = S.msgs[key] || [];
    const log = h('div', { class: 'chat', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation with ' + c[0] });
    const input = h('input', { type: 'text', id: 'msg-in', autocomplete: 'off' });
    function draw() { log.replaceChildren(...[{ from: 'them', text: 'Hi ' + S.session.name + ', any update on the jobs today?' }].concat(thread).map((m) => h('div', { class: 'msg ' + m.from }, m.text))); log.scrollTop = log.scrollHeight; }
    draw();
    return [backLink('#/maint/messages', 'All messages'), h('h1', {}, c[0]), h('p', { class: 'muted' }, c[1]), log,
      h('form', { novalidate: true, onsubmit: (e) => { e.preventDefault(); const v = input.value.trim(); if (!v) { input.focus(); return; } thread.push({ from: 'me', text: v }); save(); input.value = ''; draw(); input.focus(); } },
        h('label', { for: 'msg-in' }, 'Message to ' + c[0]), input, h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'submit' }, 'Send Message')))];
  }

  /* ---------- router ---------- */
  function render() {
    applySettings();
    const root = $('#app'); const parts = location.hash.replace(/^#\/?/, '').split('/');
    let nodes;
    const head = parts[0];
    if (head === 'signin') nodes = signIn(parts[1]);
    else if (!S.session || head === 'welcome') nodes = (!S.session || head === 'welcome') ? welcome() : [];
    else if (head === '') { location.hash = '#/' + S.session.role + '/home'; return; }
    else {
      const role = S.session.role; let page;
      if (head === 'notifications') page = notifPage(role);
      else if (head === 'settings') page = settingsPage(parts[1]);
      else if (head === role) {
        const k = parts[1] || 'home', a = parts[2], b = parts[3];
        if (role === 'care') {
          page = k === 'home' ? careHome() : k === 'report' ? (a === 'form' ? reportForm() : reportCategory()) : k === 'submitted' ? submitted(a) : k === 'history' ? careHistory() : k === 'job' ? jobDetail(a, 'care') : k === 'feedback' ? feedbackPage(a) : k === 'chat' ? chatPage() : k === 'profile' ? profilePage('care') : null;
        } else {
          page = k === 'home' ? maintHome() : k === 'jobs' ? maintList(a) : k === 'job' ? jobDetail(a, 'maint') : k === 'calendar' ? calendarPage() : k === 'reviews' ? reviewsPage() : k === 'messages' ? messagesPage(a) : k === 'profile' ? profilePage('maint') : null;
        }
        void b;
      } else { location.hash = '#/' + role + '/home'; return; }
      if (!page) { location.hash = '#/' + role + '/home'; return; }
      nodes = shell(role, page, parts);
    }
    root.replaceChildren(...nodes);
    window.scrollTo(0, 0);
    const t = $('main h1') || $('main'); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); }
  }
  window.addEventListener('hashchange', render);
  render();
})();
