    // =====================================================================
    // ADMIN: ADD STUDENT FROM THE DASHBOARD
    // Same rules as the public form (name+room duplicate, unique Student ID,
    // unique username). Does NOT touch the public form, its deadline or its state.
    // =====================================================================
    const ADM_KEY_STORE = 'examnet_admin_entry_key';
    let admSeq = 0, admTimer = null, admSaving = false;

    function admEl(id) { return document.getElementById('adm-' + id); }

    function admBuildFullName() {
      const last = tidyName(admEl('lastname').value);
      const first = tidyName(admEl('firstname').value);
      const mi = (admEl('middleinit').value.match(/\p{L}/u) || [''])[0].toUpperCase();
      const suffix = admEl('suffix').value;
      if (!last && !first) return '';
      return [(last && first) ? last + ',' : last, first, mi ? mi + '.' : '', suffix]
        .filter(Boolean).join(' ').replace(/,\s*$/, '');
    }

    function admRefreshName() {
      admEl('fullname-preview').textContent = admBuildFullName() || '\u2014';
      admScheduleChecks();
    }

    function admSetError(msg) {
      const box = admEl('error');
      box.textContent = msg || '';
      box.classList.toggle('hidden', !msg);
    }

    function admSetBadge(id, kind, text) {
      const b = admEl(id);
      if (!kind) { b.className = 'hidden'; b.textContent = ''; return; }
      const styles = {
        checking: 'bg-gray-800 text-gray-400 animate-pulse',
        ok:       'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        taken:    'bg-red-500/20 text-red-400 border border-red-500/30',
        warn:     'bg-amber-500/20 text-amber-300 border border-amber-500/30'
      };
      b.className = 'text-xs px-2.5 py-0.5 rounded-md font-bold ' + styles[kind];
      b.textContent = text;
    }

    function admSetDup(kind, text) {
      const box = admEl('dup-status');
      if (!kind) { box.className = 'hidden'; box.textContent = ''; return; }
      const styles = {
        checking: 'bg-gray-800 text-gray-400 border-gray-700 animate-pulse',
        ok:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        warn:     'bg-amber-500/10 text-amber-400 border-amber-500/30',
        dup:      'bg-red-500/10 text-red-400 border-red-500/40'
      };
      box.className = 'text-xs font-semibold rounded-lg px-3 py-2 border ' + styles[kind];
      box.textContent = text;
    }

    // 'available' | 'taken' | 'unknown'
    async function lookupUsername(username) {
      await ensureTermsLoaded();
      const termId = getCheckTermId();
      if (supabaseClient) {
        try {
          const safe = username.replace(/[\\%_]/g, m => '\\' + m);
          const { data, error } = await termFilter(supabaseClient
            .from('exam_registrations').select('id').ilike('username', safe), termId).limit(1);
          if (error) return 'unknown';
          return (data && data.length) ? 'taken' : 'available';
        } catch (e) { return 'unknown'; }
      }
      const local = readLocalStudents().filter(s => termMatches(s, termId));
      return local.some(s => (s.username || '').toLowerCase() === username.toLowerCase()) ? 'taken' : 'available';
    }

    function admScheduleChecks() {
      clearTimeout(admTimer);
      admTimer = setTimeout(admRunChecks, 350);
    }

    async function admRunChecks() {
      const seq = ++admSeq;
      const room = admEl('room').value;
      const last = tidyName(admEl('lastname').value);
      const first = tidyName(admEl('firstname').value);

      // 1) same name in the same room
      if (last.length >= 2 && first.length >= 2 && room) {
        admSetDup('checking', 'Checking if this name is already registered in ' + room + '...');
        const res = await findNameDuplicate(admBuildFullName(), room, null);
        if (seq !== admSeq) return;
        if (res.match) admSetDup('dup', 'Already registered: ' + res.match.full_name + ' is already in ' + room + '.');
        else if (!res.verified) admSetDup('warn', 'Could not verify duplicates right now. It will be checked again when you save.');
        else admSetDup('ok', 'No duplicate found in ' + room + '.');
      } else {
        admSetDup(null);
      }

      // 2) username
      const uname = admEl('username').value.trim();
      if (uname) {
        admSetBadge('username-badge', 'checking', 'Checking...');
        const r = await lookupUsername(uname);
        if (seq !== admSeq) return;
        if (r === 'taken') admSetBadge('username-badge', 'taken', 'Username Taken');
        else if (r === 'unknown') admSetBadge('username-badge', 'warn', 'Could not verify');
        else admSetBadge('username-badge', 'ok', 'Available');
      } else {
        admSetBadge('username-badge', null);
      }

      // 3) student ID
      const sfx = admEl('studentid').value.trim().toUpperCase();
      if (sfx.length === 4) {
        admSetBadge('studentid-badge', 'checking', 'Checking...');
        const r = await lookupStudentId(STUDENT_ID_PREFIX + sfx);
        if (seq !== admSeq) return;
        if (r === 'taken') admSetBadge('studentid-badge', 'taken', 'ID Taken');
        else if (r === 'unknown') admSetBadge('studentid-badge', 'warn', 'Could not verify');
        else admSetBadge('studentid-badge', 'ok', 'Available');
      } else {
        admSetBadge('studentid-badge', null);
      }
    }

    async function admGenerateId() {
      const btn = admEl('generate-btn');
      btn.disabled = true;
      admSetBadge('studentid-badge', 'checking', 'Generating...');
      let chosen = null;
      for (let i = 0; i < 20; i++) {
        const cand = randomStudentIdSuffix();
        const r = await lookupStudentId(STUDENT_ID_PREFIX + cand);
        if (r !== 'taken') { chosen = cand; break; }
      }
      btn.disabled = false;
      if (!chosen) { admSetBadge('studentid-badge', 'taken', 'Try again'); return; }
      admEl('studentid').value = chosen;
      admScheduleChecks();
    }

    // Shows whether the public form is open or closed and whether the key field is needed
    function admRenderState() {
      const st = getRegistrationStatus();
      const box = admEl('state');
      if (st.open) {
        box.className = 'mb-4 rounded-xl border px-3 py-2 text-[11px] font-semibold bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
        box.textContent = 'Public registration is open. Students are saved the normal way.';
        admEl('keywrap').classList.add('hidden');
      } else {
        box.className = 'mb-4 rounded-xl border px-3 py-2 text-[11px] font-semibold bg-amber-500/10 border-amber-500/30 text-amber-200';
        box.textContent = 'Public registration is closed. Admin entry will be used (needs your Admin Entry Key). The public form stays closed.';
        admEl('keywrap').classList.remove('hidden');
      }
    }

    function openAdminAddModal() {
      if (termsReady && selectedTermId !== activeTermId) {
        alert('You are viewing "' + currentTermLabel() + '", which is not the active semester. Switch the Semester selector to "' + termLabelById(activeTermId) + '" (or make this one active) before adding a student.');
        return;
      }
      admEl('studentid-prefix').textContent = STUDENT_ID_PREFIX;
      admEl('studentid-example').textContent = STUDENT_ID_PREFIX + 'A001';
      admEl('defpass').textContent = DEFAULT_PASS_PATTERN;

      // keep the dropdowns in sync with Manage Rooms & Courses
      admEl('course').innerHTML = availableCourses.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
      admEl('room').innerHTML = `<option value="" disabled selected>Select room</option>` +
        availableRooms.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');

      document.getElementById('admin-add-form').reset();
      admEl('key').value = sessionStorage.getItem(ADM_KEY_STORE) || '';
      admEl('fullname-preview').textContent = '\u2014';
      admSetError('');
      admSetDup(null);
      admSetBadge('username-badge', null);
      admSetBadge('studentid-badge', null);
      admRenderState();
      openModal('admin-add-modal');
      lucide.createIcons();
      refreshRegistrationState().then(admRenderState).catch(() => {});
      admEl('lastname').focus();
    }

    function initAdminAddForm() {
      ['lastname', 'firstname'].forEach(id => {
        const el = admEl(id);
        el.addEventListener('input', () => {
          enforceUpperName(el);
          el.value = el.value.replace(/,/g, '');
          admSetError('');
          admRefreshName();
        });
        el.addEventListener('blur', () => { el.value = tidyName(el.value); admRefreshName(); });
      });
      const mi = admEl('middleinit');
      mi.addEventListener('input', () => {
        mi.value = (mi.value.match(/\p{L}/u) || [''])[0].toUpperCase();
        admRefreshName();
      });
      admEl('suffix').addEventListener('change', admRefreshName);
      admEl('room').addEventListener('change', admScheduleChecks);
      admEl('username').addEventListener('input', e => {
        e.target.value = e.target.value.replace(/\s+/g, '');
        admSetError('');
        admScheduleChecks();
      });
      admEl('studentid').addEventListener('input', e => {
        e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        admSetError('');
        admScheduleChecks();
      });
    }
    document.addEventListener('DOMContentLoaded', initAdminAddForm);

    function admDbError(error) {
      const msg = `${error.message || ''} ${error.details || ''}`;
      if (error.code === '23505' || /duplicate key/i.test(msg)) {
        if (/name_room/i.test(msg)) return 'This name is already registered in that room.';
        if (/student_id/i.test(msg)) return 'That Student ID was just taken. Use another one.';
        if (/username/i.test(msg)) return 'That username was just taken. Use another one.';
        return 'This record already exists.';
      }
      if (error.code === '23514' || /student_id_format/i.test(msg)) {
        return `Student ID must look like ${STUDENT_ID_PREFIX}A001 (the letter A followed by 3 digits).`;
      }
      return 'Supabase error: ' + (error.message || 'unknown error');
    }

    // Saves one record. Order: normal insert first (works while open); if the database
    // says registration is closed, use the key-protected admin function instead.
    async function admInsertRecord(rec) {
      if (!supabaseClient) {
        studentsData.unshift({ id: crypto.randomUUID(), ...rec, created_at: new Date().toISOString() });
        saveToLocal();
        return { ok: true };
      }

      let res;
      try { res = await supabaseClient.from('exam_registrations').insert([rec]); }
      catch (e) { return { ok: false, message: 'Could not reach Supabase. Nothing was saved. Check your connection and try again.' }; }
      if (!res.error) return { ok: true };

      const blocked = res.error.code === '42501' || /row-level security/i.test(res.error.message || '');
      if (!blocked) return { ok: false, message: admDbError(res.error) };

      // Registration is closed at the database level -> admin function
      admEl('keywrap').classList.remove('hidden');
      const key = admEl('key').value;
      if (!key) return { ok: false, message: 'Registration is closed. Enter your Admin Entry Key to add this student.' };

      let rpc;
      try {
        rpc = await supabaseClient.rpc('admin_add_registration', {
          p_key: key,
          p_full_name: rec.full_name,
          p_username: rec.username,
          p_student_id: rec.student_id,
          p_default_password: rec.default_password,
          p_course: rec.course,
          p_room: rec.room_number
        });
      } catch (e) { return { ok: false, message: 'Could not reach Supabase. Nothing was saved.' }; }

      if (!rpc.error) { sessionStorage.setItem(ADM_KEY_STORE, key); return { ok: true }; }

      const m = `${rpc.error.message || ''} ${rpc.error.details || ''}`;
      if (rpc.error.code === 'PGRST202' || /could not find the function|schema cache/i.test(m)) {
        return { ok: false, message: 'Admin entry is not installed yet. Open Supabase Settings, copy the SQL, and run the "ADMIN ENTRY WHILE CLOSED" block in the Supabase SQL Editor.' };
      }
      if (rpc.error.code === '28000' || /invalid admin key/i.test(m)) {
        sessionStorage.removeItem(ADM_KEY_STORE);
        return { ok: false, message: 'Wrong Admin Entry Key.' };
      }
      return { ok: false, message: admDbError(rpc.error) };
    }

    async function handleAdminAddSubmit(e) {
      e.preventDefault();
      if (admSaving) return;
      admSetError('');

      const last = tidyName(admEl('lastname').value);
      const first = tidyName(admEl('firstname').value);
      if (last.length < 2) { admSetError('Please enter the last name.'); admEl('lastname').focus(); return; }
      if (first.length < 2) { admSetError('Please enter the first name.'); admEl('firstname').focus(); return; }

      const fullName = admBuildFullName();
      const username = admEl('username').value.trim().replace(/\s+/g, '');
      const sfx = admEl('studentid').value.trim().toUpperCase();
      const studentId = STUDENT_ID_PREFIX + sfx;
      const course = admEl('course').value;
      const room = admEl('room').value;

      if (!room) { admSetError('Please select a room.'); return; }
      if (!course) { admSetError('Please select a course.'); return; }
      if (!username) { admSetError('Please enter a username.'); admEl('username').focus(); return; }
      if (!sfx) { admSetError('Please enter or generate a Student ID.'); admEl('studentid').focus(); return; }
      if (!STUDENT_ID_REGEX.test(studentId)) {
        admSetError(`Student ID must look like ${STUDENT_ID_PREFIX}A001 (4 letters/digits after the dash).`);
        admEl('studentid').focus();
        return;
      }

      const btn = admEl('submit-btn');
      admSaving = true;
      btn.disabled = true;
      btn.textContent = 'Checking...';
      const done = () => { admSaving = false; btn.disabled = false; btn.textContent = 'Add Student'; };

      // Fresh duplicate checks right before saving (never trust the live badges alone)
      const [dup, uRes, idRes] = await Promise.all([
        findNameDuplicate(fullName, room, null),
        lookupUsername(username),
        lookupStudentId(studentId)
      ]);
      if (dup.match) { admSetDup('dup', 'Already registered: ' + dup.match.full_name + ' is already in ' + room + '.'); admSetError('Duplicate name in this room. Not saved.'); done(); return; }
      if (uRes === 'taken') { admSetBadge('username-badge', 'taken', 'Username Taken'); admSetError('That username is already taken.'); done(); return; }
      if (idRes === 'taken') { admSetBadge('studentid-badge', 'taken', 'ID Taken'); admSetError('That Student ID is already taken. Tap Generate for another.'); done(); return; }

      btn.textContent = 'Saving...';
      const rec = {
        full_name: fullName,
        username: username,
        student_id: studentId,
        default_password: DEFAULT_PASS_PATTERN,
        course: course,
        room_number: room,
        ...(termsReady && activeTermId ? { term_id: activeTermId } : {})
      };
      const result = await admInsertRecord(rec);
      done();
      if (!result.ok) { admSetError(result.message); return; }

      lastCreatedAccount = { ...rec };
      document.getElementById('succ-fullname').innerText = fullName;
      document.getElementById('succ-studentid').innerText = studentId;
      document.getElementById('succ-username').innerText = username;
      document.getElementById('succ-room-course').innerText = `${room} (${course})`;
      document.getElementById('succ-password').innerText = DEFAULT_PASS_PATTERN;

      closeModal('admin-add-modal');
      openModal('success-modal');
      loadRegistrations();
    }


