    // --- FULL NAME FIELD: LAST, FIRST M. SUFFIX (all caps) ---
    const NAME_BAD_CHARS = /[^\p{L}\s'\u2019.\-]/gu;

    function tidyName(v) {
      return (v || '').toUpperCase().replace(NAME_BAD_CHARS, '').replace(/\s+/g, ' ').trim();
    }

    // Uppercase + strip invalid characters while typing, keeping the caret in place
    function enforceUpperName(el) {
      const pos = el.selectionStart;
      const before = el.value;
      const after = before.toUpperCase().replace(/[^\p{L}\s'\u2019.,\-]/gu, '').replace(/\s{2,}/g, ' ').replace(/^\s+/, '');
      if (after !== before) {
        el.value = after;
        const np = Math.max(0, pos - (before.length - after.length));
        try { el.setSelectionRange(np, np); } catch (e) {}
      }
    }

    function getMiddleInitial() {
      const m = (document.getElementById('reg-middleinit').value.match(/\p{L}/u) || [''])[0].toUpperCase();
      return m ? m + '.' : '';
    }

    // Builds e.g. "DELA CRUZ, JUAN C. JR."
    function buildFullName() {
      const last = tidyName(document.getElementById('reg-lastname').value);
      const first = tidyName(document.getElementById('reg-firstname').value);
      const suffix = document.getElementById('reg-suffix').value;
      if (!last && !first) return '';
      return [(last && first) ? last + ',' : last, first, getMiddleInitial(), suffix]
        .filter(Boolean).join(' ').replace(/,\s*$/, '');
    }

    function refreshFullName() {
      const v = buildFullName();
      document.getElementById('reg-fullname').value = v;
      document.getElementById('fullname-preview').textContent = v || '\u2014';
      scheduleNameDupCheck();
    }

    function showNameError(msg, focusEl) {
      const box = document.getElementById('fullname-error');
      box.textContent = msg;
      box.classList.toggle('hidden', !msg);
      ['reg-lastname', 'reg-firstname'].forEach(id => {
        document.getElementById(id).classList.toggle('border-red-500', !!msg && document.getElementById(id) === focusEl);
      });
      if (msg && focusEl) focusEl.focus();
    }

    function validateFullName() {
      const lastEl = document.getElementById('reg-lastname');
      const firstEl = document.getElementById('reg-firstname');
      if (tidyName(lastEl.value).length < 2) { showNameError('Please enter your last name.', lastEl); return false; }
      if (tidyName(firstEl.value).length < 2) { showNameError('Please enter your first name.', firstEl); return false; }
      showNameError('', null);
      refreshFullName();
      return true;
    }

    function initNameField() {
      ['reg-lastname', 'reg-firstname'].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('input', () => {
          enforceUpperName(el);
          el.value = el.value.replace(/,/g, '');   // no commas: the app adds the comma itself
          showNameError('', null);
          refreshFullName();
        });
        el.addEventListener('blur', () => { el.value = tidyName(el.value); refreshFullName(); });
      });
      const mi = document.getElementById('reg-middleinit');
      mi.addEventListener('input', () => {
        mi.value = (mi.value.match(/\p{L}/u) || [''])[0].toUpperCase();   // one letter only
        refreshFullName();
      });
      document.getElementById('reg-suffix').addEventListener('change', refreshFullName);
      document.getElementById('reg-room').addEventListener('change', scheduleNameDupCheck);
      refreshFullName();
    }
    document.addEventListener('DOMContentLoaded', initNameField);


