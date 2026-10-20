(() => {
  const storage = typeof chrome !== "undefined" && chrome.storage ? (chrome.storage.sync || chrome.storage.local) : null;

  const defaultSettings = {
    sat_enabled: true,
    sat_bangla_phonetic: false,
    sat_floating_magic_btn: true,
    sat_disabled_domains: [],
    sat_snippets: [],
    sat_custom_dict: [],
    sat_learned_dict: {}
  };

  const getSettings = (callback) => {
    if (storage) {
      storage.get(defaultSettings, callback);
    } else {
      callback({
        sat_enabled: localStorage.getItem("sat_enabled") !== "false",
        sat_bangla_phonetic: localStorage.getItem("sat_bangla_phonetic") === "true",
        sat_floating_magic_btn: localStorage.getItem("sat_floating_magic_btn") !== "false",
        sat_disabled_domains: JSON.parse(localStorage.getItem("sat_disabled_domains") || "[]"),
        sat_snippets: JSON.parse(localStorage.getItem("sat_snippets") || "[]"),
        sat_custom_dict: JSON.parse(localStorage.getItem("sat_custom_dict") || "[]"),
        sat_learned_dict: JSON.parse(localStorage.getItem("sat_learned_dict") || "{}")
      });
    }
  };

  const saveSettings = (data, callback) => {
    if (storage) {
      storage.set(data, callback);
    } else {
      Object.entries(data).forEach(([k, v]) => {
        localStorage.setItem(k, typeof v === "object" ? JSON.stringify(v) : String(v));
      });
      if (callback) callback();
    }
  };

  const exportBackup = (callback) => {
    getSettings((data) => {
      const exportObject = {
        version: "2.1",
        date: new Date().toISOString(),
        bangla_phonetic: data.sat_bangla_phonetic || false,
        floating_magic_btn: data.sat_floating_magic_btn !== false,
        disabled_domains: data.sat_disabled_domains || [],
        snippets: data.sat_snippets || [],
        custom: data.sat_custom_dict || [],
        learned: data.sat_learned_dict || {}
      };

      const blob = new Blob([JSON.stringify(exportObject, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "typenext_backup.json";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 150);

      if (callback) callback();
    });
  };

  const importBackup = (file, onSuccess, onError) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        getSettings((current) => {
          const importedSnippets = Array.isArray(imported.snippets) ? imported.snippets : [];
          const importedCustom = Array.isArray(imported.custom) ? imported.custom : (Array.isArray(imported) ? imported : []);
          const importedLearned = imported.learned && typeof imported.learned === "object" ? imported.learned : {};
          const importedDomains = Array.isArray(imported.disabled_domains) ? imported.disabled_domains : [];
          const importedPhonetic = typeof imported.bangla_phonetic === "boolean" ? imported.bangla_phonetic : current.sat_bangla_phonetic;
          const importedFloating = typeof imported.floating_magic_btn === "boolean" ? imported.floating_magic_btn : current.sat_floating_magic_btn;

          const snippetMap = new Map();
          (current.sat_snippets || []).forEach((s) => snippetMap.set(s.trigger.toLowerCase(), s));
          importedSnippets.forEach((s) => snippetMap.set(s.trigger.toLowerCase(), s));

          const combinedCustom = Array.from(new Set([...(current.sat_custom_dict || []), ...importedCustom]));
          const combinedLearned = { ...(current.sat_learned_dict || {}), ...importedLearned };
          const combinedDomains = Array.from(new Set([...(current.sat_disabled_domains || []), ...importedDomains]));

          const payload = {
            sat_bangla_phonetic: importedPhonetic,
            sat_floating_magic_btn: importedFloating,
            sat_disabled_domains: combinedDomains,
            sat_snippets: Array.from(snippetMap.values()),
            sat_custom_dict: combinedCustom,
            sat_learned_dict: combinedLearned
          };

          saveSettings(payload, () => {
            if (onSuccess) onSuccess(payload);
          });
        });
      } catch {
        if (onError) onError();
      }
    };
    reader.readAsText(file);
  };

  window.TypeNextStorage = {
    getSettings,
    saveSettings,
    exportBackup,
    importBackup
  };
})();