const memoryCache = new Map();
const inFlightRequests = new Map();

const fetchWithTimeout = async (url, ms = 1500) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok ? await res.json() : null;
  } catch {
    clearTimeout(timer);
    return null;
  }
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
    const chromeUrl = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(clean)}`;
    const firefoxUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(clean)}`;
    const phoneticUrl = `https://inputtools.google.com/request?text=${encodeURIComponent(clean)}&itc=bn-t-i0-und&num=2`;

    const [chromeRes, phoneticRes] = await Promise.allSettled([
      fetchWithTimeout(chromeUrl),
      fetchWithTimeout(phoneticUrl)
    ]);

    let suggestData = chromeRes.status === "fulfilled" ? chromeRes.value : null;

    if (!suggestData) {
      suggestData = await fetchWithTimeout(firefoxUrl);
    }

    const suggestions = [];

    if (suggestData && Array.isArray(suggestData[1])) {
      suggestData[1].slice(0, 4).forEach((word) => {
        const str = String(word).trim();
        if (str && !suggestions.some((s) => s.text.toLowerCase() === str.toLowerCase())) {
          suggestions.push({ text: str, type: "google" });
        }
      });
    }

    const pData = phoneticRes.status === "fulfilled" ? phoneticRes.value : null;
    if (pData && pData[0] === "SUCCESS" && pData[1]?.[0]?.[1]) {
      pData[1][0][1].slice(0, 2).forEach((bnWord) => {
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
});