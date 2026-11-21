    // --- STUDENT ID (self-generated: YEAR-XXXX) ---
    function initStudentIdField() {
      document.getElementById('studentid-prefix').innerText = STUDENT_ID_PREFIX;
      document.getElementById('studentid-example').innerText = STUDENT_ID_PREFIX + 'A001';
    }

    function randomStudentIdSuffix() {
      // "A" followed by 3 random digits (000-999), e.g. A001, A427
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      return 'A' + String(buf[0] % 1000).padStart(3, '0');
    }

    function setStudentIdBadge(kind, text) {
      const badge = document.getElementById('studentid-status-badge');
      if (!kind) { badge.className = "hidden"; return; }
      const styles = {
        checking: "bg-gray-800 text-gray-400 animate-pulse",
        ok:       "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        taken:    "bg-red-500/20 text-red-400 border border-red-500/30",
        warn:     "bg-amber-500/20 text-amber-300 border border-amber-500/30"
      };
      badge.className = `text-xs px-2.5 py-0.5 rounded-md font-bold ${styles[kind]}`;
      badge.innerText = text;
    }

    // Returns 'available' | 'taken' | 'unknown' (unknown = could not reach / column missing)
    async function lookupStudentId(fullId) {
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient
            .from('exam_registrations')
            .select('id')
            .eq('student_id', fullId)
            .limit(1);
          if (error) return 'unknown';
          return (data && data.length > 0) ? 'taken' : 'available';
        } catch (e) {
          return 'unknown';
        }
      }
      const localData = JSON.parse(localStorage.getItem('examnet_students') || '[]');
      return localData.some(s => (s.student_id || '').toUpperCase() === fullId) ? 'taken' : 'available';
    }

    function applyStudentIdResult(result) {
      if (result === 'taken') {
        isStudentIdAvailable = false;
        setStudentIdBadge('taken', 'ID Taken');
      } else if (result === 'unknown') {
        // Could not verify (offline, or the Supabase column is not added yet).
        // The database still enforces uniqueness when the form is submitted.
        isStudentIdAvailable = true;
        setStudentIdBadge('warn', 'Could not verify');
      } else {
        isStudentIdAvailable = true;
        setStudentIdBadge('ok', 'Available');
      }
    }

    async function generateStudentId() {
      const input = document.getElementById('reg-studentid');
      const btn = document.getElementById('generate-id-btn');
      btn.disabled = true;
      isStudentIdAvailable = false;
      setStudentIdBadge('checking', 'Generating...');

      let chosen = null;
      let result = 'unknown';
      for (let i = 0; i < 20; i++) {
        const candidate = randomStudentIdSuffix();
        result = await lookupStudentId(STUDENT_ID_PREFIX + candidate);
        if (result !== 'taken') { chosen = candidate; break; }
      }

      btn.disabled = false;
      if (!chosen) {
        isStudentIdAvailable = false;
        setStudentIdBadge('taken', 'Try again');
        return;
      }
      input.value = chosen;
      applyStudentIdResult(result);
    }

    // Turns a database error into a message a student can act on.
    function friendlyDbError(error, action) {
      const msg = `${error.message || ''} ${error.details || ''}`;
      if (error.code === '42501' || /row-level security/i.test(msg)) {
        refreshRegistrationState();
        return 'Registration is closed. Your entry was not saved.';
      }
      if (error.code === '23505' || /duplicate key/i.test(msg)) {
        if (/name_room/i.test(msg)) return 'This name is already registered in that room.';
        if (/student_id/i.test(msg)) {
          isStudentIdAvailable = false;
          setStudentIdBadge('taken', 'ID Taken');
          return 'That Student ID was just taken. Tap Generate to get a new one.';
        }
        if (/username/i.test(msg)) return 'That username was just taken. Please choose another.';
      }
      if (error.code === '23514' || /student_id_format/i.test(msg)) {
        return `Student ID must look like ${STUDENT_ID_PREFIX}A001 (the letter A followed by 3 digits).`;
      }
      if (/student_id/i.test(msg) && /(column|schema cache)/i.test(msg)) {
        return 'Your Supabase table does not have the student_id column yet. Open Admin > Supabase Settings, copy the SQL, run the "ALREADY HAVE THE TABLE" block in the Supabase SQL Editor, then try again.';
      }
      return `Supabase ${action} Error: ` + error.message;
    }


