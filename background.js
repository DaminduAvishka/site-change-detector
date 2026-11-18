importScripts('lib.js');

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SNAPSHOT') {
    handleSnapshot(msg.snapshot, sender.tab && sender.tab.id).then(sendResponse);
    return true; // keep the channel open for the async reply
  }
});

async function handleSnapshot(snapshot, tabId) {
  const key = pageKey(snapshot.url);
  const snapKey = 'snap:' + key;
  const diffKey = 'diff:' + key;

  const stored = await chrome.storage.local.get(snapKey);
  const previous = stored[snapKey];

  const updates = { [snapKey]: snapshot }; // today's page becomes the new baseline
  let result = { status: previous ? 'unchanged' : 'baseline', total: 0 };

  if (previous && previous.hash !== snapshot.hash) {
    const diff = diffSnapshots(previous, snapshot);
    if (diff.total > 0) {
      updates[diffKey] = { at: Date.now(), since: previous.capturedAt, diff };
      result = { status: 'changed', total: diff.total };
    }
  }

  await chrome.storage.local.set(updates);
  if (tabId != null) setBadge(tabId, result.total);
  return result;
}

function setBadge(tabId, count) {
  chrome.action.setBadgeText({ tabId, text: count ? (count > 99 ? '99+' : String(count)) : '' });
  if (count) chrome.action.setBadgeBackgroundColor({ tabId, color: '#17714F' });
}
