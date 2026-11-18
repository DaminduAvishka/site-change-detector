const $ = (id) => document.getElementById(id);

let tab, origin, key;

init();

async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/.test(tab.url || '')) {
    $('headline').textContent = "Open a website to use this";
    $('sub').textContent = "This page can't be tracked. Try a regular http or https site.";
    return;
  }
  origin = new URL(tab.url).origin;
  key = pageKey(tab.url);
  $('host').textContent = new URL(tab.url).host;
  render();
}

async function render() {
  const { tracked = [] } = await chrome.storage.local.get('tracked');
  const isTracked = tracked.includes(origin);
  const stored = await chrome.storage.local.get(['snap:' + key, 'diff:' + key]);
  const snap = stored['snap:' + key];
  const change = stored['diff:' + key];

  $('results').replaceChildren();
  $('actions').replaceChildren();

  if (!isTracked) {
    setHeader("You're not tracking this site", "Track it, and next time you visit you'll see what's new.");
    addButton('Track this site', 'primary', trackSite);
    return;
  }

  if (!snap) {
    setHeader('Saving the first snapshot…', 'Keep this page open for a moment, then reopen this popup.');
  } else if (!change) {
    setHeader('No changes yet', 'Snapshot saved ' + fmt(snap.capturedAt) + '. Come back after the site updates.');
  } else {
    const n = change.diff.total;
    setHeader(n + (n === 1 ? ' change' : ' changes') + ' since ' + fmt(change.since), 'Found ' + fmt(change.at) + '.');
    renderDiff(change.diff);
    addButton('Mark as seen', 'primary', markSeen);
  }

  addButton('Rescan now', '', rescan);
  addButton('Stop tracking', 'ghost', stopTracking);
}

function setHeader(title, sub) {
  $('headline').textContent = title;
  $('sub').textContent = sub;
}

function addButton(label, kind, onClick) {
  const b = document.createElement('button');
  b.textContent = label;
  if (kind) b.className = kind;
  b.addEventListener('click', onClick);
  $('actions').append(b);
}

function fmt(ts) {
  return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

// Page text is untrusted: always textContent, never innerHTML.
function renderDiff(diff) {
  addSection('New sections', diff.headings.added.map((t) => ({ text: t })));
  addSection('New links', diff.links.added.map((l) => ({ text: l.text, href: l.href })));
  addSection('New text', diff.blocks.added.map((t) => ({ text: t })));

  const removed = [
    ...diff.headings.removed.map((t) => ({ text: t })),
    ...diff.links.removed.map((l) => ({ text: l.text })),
    ...diff.blocks.removed.map((t) => ({ text: t })),
  ];
  addSection('Removed', removed, true);
}

function addSection(title, items, removed = false) {
  if (!items.length) return;
  const section = document.createElement('section');
  const h = document.createElement('h2');
  h.textContent = title;
  const count = document.createElement('span');
  count.textContent = items.length;
  h.append(count);

  const ul = document.createElement('ul');
  for (const item of items.slice(0, 50)) {
    const li = document.createElement('li');
    if (removed) li.className = 'removed';
    const text = item.text.length > 200 ? item.text.slice(0, 200) + '…' : item.text;
    if (item.href) {
      const a = document.createElement('a');
      a.href = item.href;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.textContent = text;
      li.append(a);
      const small = document.createElement('small');
      small.textContent = new URL(item.href).host + new URL(item.href).pathname;
      li.append(small);
    } else {
      li.textContent = text;
    }
    ul.append(li);
  }
  section.append(h, ul);
  $('results').append(section);
}

async function trackSite() {
  const { tracked = [] } = await chrome.storage.local.get('tracked');
  if (!tracked.includes(origin)) tracked.push(origin);
  await chrome.storage.local.set({ tracked });
  await rescan();
}

async function rescan() {
  setHeader('Scanning…', '');
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'RESCAN' });
  } catch {
    setHeader('Reload this page first', "The extension can't read this tab until it is reloaded once.");
    return;
  }
  render();
}

async function markSeen() {
  await chrome.storage.local.remove('diff:' + key);
  chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  render();
}

async function stopTracking() {
  const all = await chrome.storage.local.get(null);
  const doomed = Object.keys(all).filter((k) => {
    const url = k.replace(/^(snap|diff):/, '');
    return k !== url && (url === origin || url.startsWith(origin + '/'));
  });
  const tracked = (all.tracked || []).filter((o) => o !== origin);
  await chrome.storage.local.remove(doomed);
  await chrome.storage.local.set({ tracked });
  chrome.action.setBadgeText({ tabId: tab.id, text: '' });
  render();
}
