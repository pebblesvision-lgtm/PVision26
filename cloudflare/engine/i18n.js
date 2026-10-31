/* Strings that end up on exported drawings, per language (data comes from data.js). */
(function (PV) {
  "use strict";
  PV.i18n = {
    t: (lang, key) => ((PV.STRINGS[lang] || PV.STRINGS.en)[key]) || PV.STRINGS.en[key] || key,
    finishName: (kind, lang) => { const n = PV.FINISH_NAMES[kind] || [kind, kind]; return lang === "nl" ? n[0] : n[1]; },
  };
})(globalThis.PV = globalThis.PV || {});
