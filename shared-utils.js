// shared-utils.js - Common utilities (shared by app.js and admin.js)
(() => {
  'use strict';

  window.GloveUtils = window.GloveUtils || {
    normalizeCode: (code) =>
      String(code || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, ''),

    slug: (s) =>
      String(s || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),

    uniqSorted: (arr) =>
      Array.from(new Set((arr || []).filter(Boolean).map(String))).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      ),

    safeJsonParse: (str, fallback) => {
      try {
        return JSON.parse(str);
      } catch {
        return fallback;
      }
    },

    debounce: (func, wait) => {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    },

    downloadText: (text, filename, mime) => {
      const blob = new Blob([text], { type: mime || 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    }
  };
})();
