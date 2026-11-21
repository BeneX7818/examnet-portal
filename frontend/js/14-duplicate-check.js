    // --- DUPLICATE NAME CHECK (same name + same room) ---
    let nameDupSeq = 0;
    let nameDupTimer = null;

    // Order/case/punctuation-insensitive key: "DELA CRUZ, JUAN C." == "Juan C. Dela Cruz"
    function nameKey(n) {
      return (n || '').toUpperCase().replace(/[^\p{L}\s]/gu, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
    }

    // Returns { match, verified }. match = the existing record with the same name in that room.
    async function findNameDuplicate(fullName, room, excludeId) {
      const key = nameKey(fullName);
      if (!key || !room) return { match: null, verified: true };
      await ensureTermsLoaded();
      const termId = getCheckTermId();
      let rows;
      if (supabaseClient) {
        try {
          const { data, error } = await termFilter(supabaseClient
            .from('exam_registrations')
            .select('id, full_name')
            .eq('room_number', room), termId);
          if (error || !data) return { match: null, verified: false };
          rows = data;
        } catch (e) {
          return { match: null, verified: false };
        }
      } else {
        rows = readLocalStudents().filter(s => s.room_number === room && termMatches(s, termId));
      }
      const match = rows.find(r => r.id !== excludeId && nameKey(r.full_name) === key) || null;
      return { match, verified: true };
    }

    function setNameDupStatus(kind, text) {
      const box = document.getElementById('name-dup-status');
      if (!kind) { box.classList.add('hidden'); box.textContent = ''; return; }
      const styles = {
        checking: 'bg-gray-800 text-gray-400 border-gray-700 animate-pulse',
        ok:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        warn:     'bg-amber-500/10 text-amber-400 border-amber-500/30',
        dup:      'bg-red-500/10 text-red-400 border-red-500/40'
      };
      box.className = 'mt-2 text-xs font-semibold rounded-lg px-3 py-2 border ' + styles[kind];
      box.textContent = text;
    }

    function scheduleNameDupCheck() {
      clearTimeout(nameDupTimer);
      nameDupTimer = setTimeout(runNameDupCheck, 350);
    }

    async function runNameDupCheck() {
      const seq = ++nameDupSeq;
      const room = document.getElementById('reg-room').value;
      const full = document.getElementById('reg-fullname').value;
      const last = tidyName(document.getElementById('reg-lastname').value);
      const first = tidyName(document.getElementById('reg-firstname').value);
      if (last.length < 2 || first.length < 2 || !room) { setNameDupStatus(null); return; }

      setNameDupStatus('checking', 'Checking if this name is already registered in ' + room + '...');
      const res = await findNameDuplicate(full, room, null);
      if (seq !== nameDupSeq) return;   // a newer check replaced this one

      if (res.match) {
        setNameDupStatus('dup', 'Already registered: ' + res.match.full_name + ' is already in ' + room + '. You cannot register twice in the same room.');
      } else if (!res.verified) {
        setNameDupStatus('warn', 'Could not verify duplicates right now. The system will check again when you submit.');
      } else {
        setNameDupStatus('ok', 'No duplicate found in ' + room + '.');
      }
    }


