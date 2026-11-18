/* Runs on every page. Only does anything on sites the user chose to track. */
(function () {
  async function capture() {
    const { tracked = [] } = await chrome.storage.local.get('tracked');
    if (!tracked.includes(location.origin)) return { status: 'untracked' };
    const snapshot = extractSnapshot(document, location.href);
    return chrome.runtime.sendMessage({ type: 'SNAPSHOT', snapshot });
  }

  // The popup's "Rescan now" button.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'RESCAN') {
      capture().then(sendResponse);
      return true;
    }
  });

  // Give JavaScript-rendered pages a moment to finish drawing.
  setTimeout(capture, 1500);
})();
