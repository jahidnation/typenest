const memoryCache = new Map();
const inFlightRequests = new Map();
const translationCache = new Map();

const fetchWithTimeout = async (url, ms = 2500) => {
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
  const manifestUrl = "https://raw.githubusercontent.com/jahidnation/typenest/main/manifest.json";
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
      releaseUrl: "https://github.com/jahidnation/typenest"
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
    const phoneticUrl = `https://inputtools.google.com/request?text=${encodeURIComponent(clean)}&itc=bn-t-i0-und&num=5`;

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
      pData[1][0][1].slice(0, 5).forEach((bnWord) => {
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

const executeTranslation = async (text, customFrom, customTo) => {
  const clean = (text || "").trim();
  if (!clean) return { translatedText: "", fromLang: "", toLang: "" };

  const hasBangla = /[\u0980-\u09FF]/.test(clean);
  const fromLang = customFrom || (hasBangla ? "bn" : "en");
  const toLang = customTo || (hasBangla ? "en" : "bn");
  const cacheKey = `${fromLang}_${toLang}_${clean.toLowerCase()}`;

  if (translationCache.has(cacheKey)) {
    return { translatedText: translationCache.get(cacheKey), fromLang, toLang };
  }

  const u1 = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=${fromLang}&tl=${toLang}&q=${encodeURIComponent(clean)}`;
  const d1 = await fetchWithTimeout(u1, 2500);
  if (d1) {
    let res = "";
    if (d1.sentences && Array.isArray(d1.sentences)) {
      res = d1.sentences.map((s) => s.trans || "").join(" ").trim();
    } else if (Array.isArray(d1)) {
      res = typeof d1[0] === "string" ? d1.join(" ") : d1[0].map((i) => i[0]).filter(Boolean).join(" ");
    }
    if (res && res !== clean) {
      if (translationCache.size > 500) {
        translationCache.delete(translationCache.keys().next().value);
      }
      translationCache.set(cacheKey, res);
      return { translatedText: res, fromLang, toLang };
    }
  }

  const u2 = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${fromLang}&tl=${toLang}&dt=t&q=${encodeURIComponent(clean)}`;
  const d2 = await fetchWithTimeout(u2, 2500);
  if (d2 && d2[0]) {
    const res = d2[0].map((item) => item[0]).filter(Boolean).join("").trim();
    if (res && res !== clean) {
      if (translationCache.size > 500) {
        translationCache.delete(translationCache.keys().next().value);
      }
      translationCache.set(cacheKey, res);
      return { translatedText: res, fromLang, toLang };
    }
  }

  const u3 = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=${fromLang}|${toLang}`;
  const d3 = await fetchWithTimeout(u3, 2500);
  if (d3?.responseData?.translatedText) {
    const res = d3.responseData.translatedText.trim();
    if (res && !res.toLowerCase().includes("mymemory")) {
      if (translationCache.size > 500) {
        translationCache.delete(translationCache.keys().next().value);
      }
      translationCache.set(cacheKey, res);
      return { translatedText: res, fromLang, toLang };
    }
  }

  return { translatedText: clean, fromLang, toLang };
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
    if (!query || query.length < 1) {
      sendResponse({ suggestions: [] });
      return true;
    }

    queryGoogleServices(query)
      .then((suggestions) => sendResponse({ suggestions }))
      .catch(() => sendResponse({ suggestions: [] }));

    return true;
  }

  if (request.action === "translateText") {
    executeTranslation(request.text, request.fromLang, request.toLang)
      .then((result) => sendResponse(result))
      .catch(() => sendResponse({ translatedText: request.text || "", fromLang: "auto", toLang: "auto" }));

    return true;
  }

  if (request.action === "checkUpdateManual") {
    checkForUpdates().then(() => sendResponse({ success: true }));
    return true;
  }
});