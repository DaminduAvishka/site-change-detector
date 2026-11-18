/* Shared by the content script, the background worker and the popup. */

// Parts of a page that change constantly and aren't "content".
const NOISE =
  'script,style,noscript,template,svg,iframe,nav,footer,aside,' +
  '[role="navigation"],[role="banner"],[role="contentinfo"],[aria-hidden="true"],' +
  '[class*="cookie" i],[id*="cookie" i],[class*="advert" i],ins.adsbygoogle';

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function uniq(list) {
  return [...new Set(list)];
}

// One snapshot per page: origin + path (query string and #hash are ignored).
function pageKey(url) {
  const u = new URL(url);
  return u.origin + u.pathname.replace(/\/+$/, '');
}

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

// Turns a page into a small, comparable summary: headings, text blocks, links.
function extractSnapshot(doc, url) {
  const main = doc.querySelector('main, article, [role="main"]') || doc.body;
  const root = main.cloneNode(true);
  root.querySelectorAll(NOISE).forEach((el) => el.remove());

  const headings = uniq(
    [...root.querySelectorAll('h1,h2,h3')].map((el) => clean(el.textContent)).filter((t) => t.length > 1)
  ).slice(0, 100);

  const blocks = uniq(
    [...root.querySelectorAll('p,li,blockquote,figcaption,td,dd')]
      .filter((el) => !el.querySelector('p,li,blockquote')) // keep the innermost blocks only
      .map((el) => clean(el.textContent))
      .filter((t) => t.length >= 20)
  ).slice(0, 400);

  const links = [];
  const seen = new Set();
  for (const a of root.querySelectorAll('a[href]')) {
    let href;
    try {
      const u = new URL(a.getAttribute('href'), url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      u.hash = '';
      href = u.href;
    } catch {
      continue;
    }
    const text = clean(a.textContent) || clean(a.getAttribute('aria-label')) || clean(a.getAttribute('title'));
    if (!text || seen.has(href)) continue;
    seen.add(href);
    links.push({ href, text: text.slice(0, 120) });
    if (links.length >= 400) break;
  }

  return {
    url,
    title: clean(doc.title),
    capturedAt: Date.now(),
    headings,
    blocks,
    links,
    hash: hashString(JSON.stringify([headings, blocks, links.map((l) => l.href)])),
  };
}

function diffBy(oldItems, newItems, keyOf) {
  const oldKeys = new Set(oldItems.map(keyOf));
  const newKeys = new Set(newItems.map(keyOf));
  return {
    added: newItems.filter((i) => !oldKeys.has(keyOf(i))),
    removed: oldItems.filter((i) => !newKeys.has(keyOf(i))),
  };
}

function diffSnapshots(oldSnap, newSnap) {
  const same = (x) => x;
  const diff = {
    headings: diffBy(oldSnap.headings, newSnap.headings, same),
    blocks: diffBy(oldSnap.blocks, newSnap.blocks, same),
    links: diffBy(oldSnap.links, newSnap.links, (l) => l.href),
  };
  diff.total = ['headings', 'blocks', 'links'].reduce(
    (sum, k) => sum + diff[k].added.length + diff[k].removed.length,
    0
  );
  return diff;
}
