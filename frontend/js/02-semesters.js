    // =====================================================================
    // SEMESTERS (TERMS)
    // Every registration belongs to a semester. New registrations always go
    // to the ACTIVE semester. The dashboard shows one semester at a time.
    // If the Semester SQL has not been run yet, everything below stays
    // dormant ("legacy" mode) and the portal works exactly as before.
    // Student IDs stay unique across ALL semesters (deliberate).
    // =====================================================================
    const DEFAULT_TERM_LABEL = 'AY 2026-2027, 1st Sem';
    let terms = [];
    let termsReady = false;          // true when semesters are available
    let termsState = 'unknown';      // 'ok' | 'legacy' (SQL not run) | 'error' (could not load)
    let activeTermId = null;
    let selectedTermId = null;       // semester shown on the dashboard
    let termsPromise = null;
    let ntBusy = false;

    function ensureTermsLoaded() {
      if (!termsPromise) termsPromise = loadTerms();
      return termsPromise;
    }

    function readLocalStudents() {
      try { return JSON.parse(localStorage.getItem('examnet_students') || '[]'); } catch (_) { return []; }
    }

    function readLocalTerms() {
      let list = [];
      try { list = JSON.parse(localStorage.getItem('examnet_terms') || '[]'); } catch (_) {}
      if (!Array.isArray(list) || !list.length) {
        list = [{ id: crypto.randomUUID(), label: DEFAULT_TERM_LABEL, is_active: true, created_at: new Date().toISOString() }];
        localStorage.setItem('examnet_terms', JSON.stringify(list));
      }
      // Records saved before semesters existed belong to the first semester
      const all = readLocalStudents();
      let changed = false;
      all.forEach(st => { if (!st.term_id) { st.term_id = list[0].id; changed = true; } });
      if (changed) localStorage.setItem('examnet_students', JSON.stringify(all));
      return list;
    }

    async function loadTerms() {
      let list = null;
      let state = 'ok';
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient.from('exam_terms').select('*').order('created_at', { ascending: true });
          if (error) {
            const m = `${error.message || ''} ${error.code || ''}`;
            const missing = error.code === '42P01' || error.code === 'PGRST205' ||
              (/exam_terms/i.test(m) && /(does not exist|schema cache|could not find)/i.test(m));
            state = missing ? 'legacy' : 'error';
            console.warn('Semesters unavailable:', error.message);
          } else if (!data || !data.length) {
            state = 'legacy';
          } else {
            list = data;
          }
        } catch (e) {
          state = 'error';
        }
      } else {
        list = readLocalTerms();
      }

      termsState = state;
      if (list) {
        terms = list;
        termsReady = true;
        const act = list.find(t => t.is_active) || list[list.length - 1];
        activeTermId = act.id;
        if (!selectedTermId || !list.some(t => t.id === selectedTermId)) selectedTermId = activeTermId;
      } else {
        terms = [];
        termsReady = false;
        activeTermId = null;
        selectedTermId = null;
        if (state === 'error') termsPromise = null; // try again next time
      }
      renderTermUI();
    }

    function termLabelById(id) {
      const t = terms.find(x => x.id === id);
      return t ? t.label : '';
    }
    function currentTermLabel() { return termsReady ? termLabelById(selectedTermId) : ''; }

    // The semester that duplicate checks should look at:
    // the dashboard looks at the semester being viewed; the public form at the active one.
    function getCheckTermId() {
      if (!termsReady) return null;
      return (window.location.hash === '#dashboard') ? selectedTermId : activeTermId;
    }
    function termFilter(query, termId) {
      return (termsReady && termId) ? query.eq('term_id', termId) : query;
    }
    function termMatches(row, termId) {
      return !termsReady || !termId || row.term_id === termId;
    }

    function renderTermUI() {
      const bar = document.getElementById('term-bar');
      const banner = document.getElementById('term-archived-banner');
      const regLbl = document.getElementById('reg-term-label');
      if (!bar || !banner || !regLbl) return;

      if (!termsReady) {
        bar.classList.add('hidden');
        banner.classList.add('hidden');
        regLbl.classList.add('hidden');
        return;
      }

      bar.classList.remove('hidden');
      const sel = document.getElementById('term-select');
      const ordered = terms.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      sel.innerHTML = ordered.map(t =>
        `<option value="${escapeHtml(t.id)}"${t.id === selectedTermId ? ' selected' : ''}>${escapeHtml(t.label)}${t.is_active ? ' (active)' : ''}</option>`
      ).join('');

      const viewingOld = selectedTermId !== activeTermId;
      document.getElementById('term-make-active-btn').classList.toggle('hidden', !viewingOld);
      banner.classList.toggle('hidden', !viewingOld);
      if (viewingOld) {
        document.getElementById('term-archived-text').textContent =
          `You are viewing "${termLabelById(selectedTermId)}", which is not the active semester. New registrations go to "${termLabelById(activeTermId)}". Add Student is disabled here.`;
      }

      document.getElementById('reg-term-label-text').textContent = 'Registering for: ' + termLabelById(activeTermId);
      regLbl.classList.remove('hidden');
    }

    function onTermSelectChange(id) {
      selectedTermId = id;
      loadRegistrations();
    }

    function saveLocalTerms(list) {
      localStorage.setItem('examnet_terms', JSON.stringify(list));
    }

    function setNtError(msg) {
      const el = document.getElementById('nt-error');
      el.textContent = msg;
      el.classList.toggle('hidden', !msg);
    }

    function openNewTermModal() {
      document.getElementById('nt-label').value = '';
      document.getElementById('nt-pass').value = '';
      setNtError('');
      openModal('new-term-modal');
      setTimeout(() => document.getElementById('nt-label').focus(), 50);
    }

    async function handleNewTerm(e) {
      e.preventDefault();
      if (ntBusy) return;
      setNtError('');

      const label = document.getElementById('nt-label').value.trim().replace(/\s+/g, ' ');
      const typed = document.getElementById('nt-pass').value;
      if (label.length < 3 || label.length > 60) { setNtError('Enter a semester name between 3 and 60 characters.'); return; }
      if (terms.some(t => t.label.toLowerCase() === label.toLowerCase())) { setNtError('A semester with that name already exists.'); return; }
      if (typed !== getStoredAdminPassword()) {
        document.getElementById('nt-pass').value = '';
        setNtError('Incorrect admin password. Nothing was changed.');
        return;
      }

      ntBusy = true;
      const btn = document.getElementById('nt-submit-btn');
      btn.disabled = true;
      btn.textContent = 'Starting...';
      try {
        if (supabaseClient) {
          const { error } = await supabaseClient.rpc('start_new_term', { p_label: label });
          if (error) {
            if (error.code === 'PGRST202' || /could not find the function|schema cache/i.test(error.message || '')) {
              throw new Error('The semester functions are not installed yet. Open Supabase Settings, copy the SQL, and run the "SEMESTER TERMS" block once.');
            }
            if (error.code === '23505') throw new Error('A semester with that name already exists.');
            throw new Error(error.message || 'Could not start the semester.');
          }
        } else {
          const list = readLocalTerms().map(t => ({ ...t, is_active: false }));
          list.push({ id: crypto.randomUUID(), label: label, is_active: true, created_at: new Date().toISOString() });
          saveLocalTerms(list);
        }

        // Registration opens for the new semester, with no deadline
        regConfig = { closes_at: null, manual_closed: false };
        document.getElementById('dl-input').value = '';
        await saveRegistrationConfig();

        termsPromise = null;
        selectedTermId = null;
        await ensureTermsLoaded();
        await loadRegistrations();
        closeModal('new-term-modal');
        alert('"' + label + '" is now the active semester. Registration is open with no deadline (set one from Registration Deadline if needed). Previous records were kept under their own semester.');
      } catch (err) {
        setNtError(err.message || 'Could not start the semester.');
      } finally {
        ntBusy = false;
        btn.disabled = false;
        btn.textContent = 'Start Semester';
      }
    }

    async function makeSelectedTermActive() {
      const id = selectedTermId;
      const label = termLabelById(id);
      if (!id || id === activeTermId) return;
      if (!confirm('Make "' + label + '" the active semester?\n\nNew student registrations will go into it. Records in other semesters are not changed.')) return;
      try {
        if (supabaseClient) {
          const { error } = await supabaseClient.rpc('set_active_term', { p_id: id });
          if (error) throw new Error(error.message || 'Could not change the active semester.');
        } else {
          saveLocalTerms(readLocalTerms().map(t => ({ ...t, is_active: t.id === id })));
        }
        termsPromise = null;
        await ensureTermsLoaded();
        await loadRegistrations();
      } catch (err) {
        alert(err.message || 'Could not change the active semester.');
      }
    }

    // Rename the semester shown in the selector (name only; records stay linked by id)
    let etBusy = false;

    function setEtError(msg) {
      const el = document.getElementById('et-error');
      el.textContent = msg;
      el.classList.toggle('hidden', !msg);
    }

    function openEditTermModal() {
      if (!termsReady || !selectedTermId) return;
      document.getElementById('et-label').value = termLabelById(selectedTermId);
      document.getElementById('et-pass').value = '';
      setEtError('');
      openModal('edit-term-modal');
      setTimeout(() => { const i = document.getElementById('et-label'); i.focus(); i.select(); }, 50);
    }

    async function handleEditTerm(e) {
      e.preventDefault();
      if (etBusy) return;
      setEtError('');

      const id = selectedTermId;
      const oldLabel = termLabelById(id);
      const label = document.getElementById('et-label').value.trim().replace(/\s+/g, ' ');
      const typed = document.getElementById('et-pass').value;
      if (!id) { setEtError('No semester selected.'); return; }
      if (label.length < 3 || label.length > 60) { setEtError('Enter a semester name between 3 and 60 characters.'); return; }
      if (label === oldLabel) { closeModal('edit-term-modal'); return; }
      if (terms.some(t => t.id !== id && t.label.toLowerCase() === label.toLowerCase())) { setEtError('A semester with that name already exists.'); return; }
      if (typed !== getStoredAdminPassword()) {
        document.getElementById('et-pass').value = '';
        setEtError('Incorrect admin password. Nothing was changed.');
        return;
      }

      etBusy = true;
      const btn = document.getElementById('et-submit-btn');
      btn.disabled = true;
      btn.textContent = 'Saving...';
      try {
        if (supabaseClient) {
          const { error } = await supabaseClient.rpc('rename_term', { p_id: id, p_label: label });
          if (error) {
            if (error.code === 'PGRST202' || /could not find the function|schema cache/i.test(error.message || '')) {
              throw new Error('The rename function is not installed yet. Open Supabase Settings, copy the SQL, and run the "EDIT SEMESTER NAME" block once.');
            }
            if (error.code === '23505') throw new Error('A semester with that name already exists.');
            throw new Error(error.message || 'Could not update the semester.');
          }
        } else {
          saveLocalTerms(readLocalTerms().map(t => t.id === id ? { ...t, label: label } : t));
        }
        termsPromise = null;
        await ensureTermsLoaded();   // keeps the same semester selected (same id)
        closeModal('edit-term-modal');
      } catch (err) {
        setEtError(err.message || 'Could not update the semester.');
      } finally {
        etBusy = false;
        btn.disabled = false;
        btn.textContent = 'Save Changes';
      }
    }

    // All registrations from every semester (used by the full-reset backup and counts)
    async function fetchAllRegistrationsRaw() {
      if (!supabaseClient) return readLocalStudents();
      const rows = [];
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await supabaseClient.from('exam_registrations').select('*')
          .order('created_at', { ascending: true }).range(from, from + page - 1);
        if (error) throw new Error('Could not read all semesters: ' + error.message);
        rows.push(...data);
        if (data.length < page) break;
      }
      return rows;
    }

    async function getTotalRegistrationCount() {
      if (supabaseClient) {
        const { count, error } = await supabaseClient.from('exam_registrations').select('id', { count: 'exact', head: true });
        return error ? '?' : (count || 0);
      }
      return readLocalStudents().length;
    }

    async function backupBeforeReset(scope) {
      let rows = studentsData, label = null, tag = 'BACKUP_Before_Reset';
      if (scope === 'all' && termsReady) {
        rows = await fetchAllRegistrationsRaw();
        label = 'All semesters';
        tag = 'BACKUP_AllSemesters_Before_Reset';
      }
      if (!rows.length) return true;
      const keep = studentsData;
      studentsData = rows;
      try { return exportMultiSheetExcel({ silent: true, fileTag: tag, termLabel: label }); }
      finally { studentsData = keep; }
    }

    function getResetScope() {
      const r = document.querySelector('input[name="reset-scope"]:checked');
      return (termsReady && r) ? r.value : 'all';
    }

    function initResetScope() {
      const wrap = document.getElementById('reset-scope-wrap');
      wrap.classList.toggle('hidden', !termsReady);
      const radios = document.querySelectorAll('input[name="reset-scope"]');
      radios.forEach(r => { r.checked = (r.value === 'term'); });
      document.getElementById('reset-scope-term-label').textContent = '"' + currentTermLabel() + '"';
      updateResetScopeText();
    }

    async function updateResetScopeText() {
      const countEl = document.getElementById('reset-count');
      const txt = document.getElementById('reset-scope-text');
      if (!termsReady) { countEl.innerText = studentsData.length; txt.textContent = ''; return; }
      if (getResetScope() === 'all') {
        countEl.innerText = '...';
        txt.textContent = ' across every semester';
        const n = await getTotalRegistrationCount();
        if (getResetScope() === 'all') countEl.innerText = n;
      } else {
        countEl.innerText = studentsData.length;
        txt.textContent = ' in "' + currentTermLabel() + '"';
      }
    }

