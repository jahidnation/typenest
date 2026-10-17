const memoryCache = new Map();
const inFlightRequests = new Map();

const fetchWithTimeout = async (url, ms = 2000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    return JSON.parse(text);
  } catch {
    clearTimeout(timer);
    return null;
  }
};

const isNewerVersion = (remote, current) => {
  const r = remote.split(".").map(Number);
  const c = current.split(".").map(Number);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rv = r[i] || 0;
    const cv = c[i] || 0;
    if (rv > cv) return true;
    if (rv < cv) return false;
  }
  return false;
};

const checkForUpdates = async () => {
  const manifestUrl = "https://raw.githubusercontent.com/jahidnation/suggest/main/manifest.json";
  const remoteData = await fetchWithTimeout(manifestUrl, 3000);
  if (!remoteData || !remoteData.version) return;

  const currentVersion = chrome.runtime.getManifest().version;
  const hasUpdate = isNewerVersion(remoteData.version, currentVersion);

  if (hasUpdate) {
    chrome.action.setBadgeText({ text: "NEW" });
    chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }

  chrome.storage.local.set({
    sat_update_info: {
      hasUpdate,
      latestVersion: remoteData.version,
      currentVersion,
      checkedAt: Date.now(),
      releaseUrl: "https://github.com/jahidnation/suggest"
    }
  });
};

const queryGoogleServices = async (query) => {
  const clean = query.trim().toLowerCase();
  if (memoryCache.has(clean)) {
    return memoryCache.get(clean);
  }

  if (inFlightRequests.has(clean)) {
    return inFlightRequests.get(clean);
  }

  const promise = (async () => {
    const firefoxUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(clean)}`;
    const phoneticUrl = `https://inputtools.google.com/request?text=${encodeURIComponent(clean)}&itc=bn-t-i0-und&num=3`;

    const [suggestRes, phoneticRes] = await Promise.allSettled([
      fetchWithTimeout(firefoxUrl),
      fetchWithTimeout(phoneticUrl)
    ]);

    const suggestions = [];

    const suggestData = suggestRes.status === "fulfilled" ? suggestRes.value : null;
    if (suggestData && Array.isArray(suggestData[1])) {
      suggestData[1].slice(0, 7).forEach((word) => {
        const str = String(word).trim();
        if (str && !suggestions.some((s) => s.text.toLowerCase() === str.toLowerCase())) {
          suggestions.push({ text: str, type: "google" });
        }
      });
    }

    const pData = phoneticRes.status === "fulfilled" ? phoneticRes.value : null;
    if (pData && pData[0] === "SUCCESS" && pData[1]?.[0]?.[1]) {
      pData[1][0][1].slice(0, 3).forEach((bnWord) => {
        const str = String(bnWord).trim();
        if (str && !suggestions.some((s) => s.text === str)) {
          suggestions.push({ text: str, type: "phonetic" });
        }
      });
    }

    if (memoryCache.size > 800) {
      const firstKey = memoryCache.keys().next().value;
      memoryCache.delete(firstKey);
    }

    memoryCache.set(clean, suggestions);
    inFlightRequests.delete(clean);
    return suggestions;
  })();

  inFlightRequests.set(clean, promise);
  return promise;
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("periodicUpdateCheck", { periodInMinutes: 360 });
  checkForUpdates();
});

chrome.runtime.onStartup.addListener(() => {
  checkForUpdates();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "periodicUpdateCheck") {
    checkForUpdates();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchGoogleSuggestions") {
    const query = (request.query || "").trim();
    if (!query || query.length < 2) {
      sendResponse({ suggestions: [] });
      return true;
    }

    queryGoogleServices(query)
      .then((suggestions) => sendResponse({ suggestions }))
      .catch(() => sendResponse({ suggestions: [] }));

    return true;
  }

  if (request.action === "checkUpdateManual") {
    checkForUpdates().then(() => sendResponse({ success: true }));
    return true;
  }
});