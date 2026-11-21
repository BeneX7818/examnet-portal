    // --- REGISTRATION DEADLINE (server-clock based) ---
    // The deadline lives in exam_config (key = 'registration') as
    //   { closes_at: "<UTC ISO>" | null, manual_closed: true | false }
    // "Now" comes from the Supabase server (get_server_time), and the database
    // itself refuses inserts after the deadline (registration_is_open policy),
    // so changing the device clock cannot get around it.
    const REG_TZ = 'Asia/Manila';
    const REG_UTC_OFFSET_MS = 8 * 3600 * 1000;

    let regConfig = { closes_at: null, manual_closed: false };
    let serverBaseMs = null;      // server time (ms) at the last sync
    let serverPerfBase = 0;       // performance.now() at the last sync (not affected by device clock changes)
    let serverTimeTrusted = false;
    let serverSaysOpen = null;    // true / false from the database, null = unknown

    function nowMs() {
      return serverTimeTrusted ? serverBaseMs + (performance.now() - serverPerfBase) : Date.now();
    }

    async function syncServerTime() {
      if (!supabaseClient) { serverTimeTrusted = false; return; }
      try {
        const t0 = performance.now();
        const { data, error } = await supabaseClient.rpc('get_server_time');
        const t1 = performance.now();
        if (error || data === null || isNaN(Number(data))) throw (error || new Error('Bad server time'));
        serverBaseMs = Number(data) + (t1 - t0) / 2;
        serverPerfBase = t1;
        serverTimeTrusted = true;
      } catch (err) {
        console.warn('Server time unavailable (run the Registration Deadline SQL):', err && err.message);
      }
    }

    async function loadRegistrationConfig() {
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient.from('exam_config').select('value').eq('key', 'registration').maybeSingle();
          if (!error) {
            const v = data && data.value ? data.value : {};
            regConfig = { closes_at: v.closes_at || null, manual_closed: !!v.manual_closed };
            return;
          }
        } catch (err) { console.warn('Could not load registration config', err); }
        return; // keep what we already have if the cloud is unreachable
      }
      try {
        const v = JSON.parse(localStorage.getItem('examnet_registration') || '{}');
        regConfig = { closes_at: v.closes_at || null, manual_closed: !!v.manual_closed };
      } catch (e) { regConfig = { closes_at: null, manual_closed: false }; }
    }

    async function refreshRegistrationState() {
      await loadRegistrationConfig();
      await syncServerTime();
      serverSaysOpen = null;
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient.rpc('registration_is_open');
          if (!error && typeof data === 'boolean') serverSaysOpen = data;
        } catch (e) { /* function not installed yet */ }
      }
      renderRegistrationState();
    }

    function getRegistrationStatus() {
      if (regConfig.manual_closed) return { open: false, reason: 'manual' };
      let msLeft = null;
      if (regConfig.closes_at) {
        const closesMs = Date.parse(regConfig.closes_at);
        if (!isNaN(closesMs)) {
          msLeft = closesMs - nowMs();
          if (msLeft <= 0) return { open: false, reason: 'deadline' };
        }
      }
      if (serverSaysOpen === false) return { open: false, reason: 'server' };
      return { open: true, msLeft };
    }

    async function verifyRegistrationOpen() {
      await refreshRegistrationState();
      const st = getRegistrationStatus();
      if (!st.open) {
        alert('Registration is closed. Your entry was not saved.');
        return false;
      }
      return true;
    }

    function fmtDuration(ms) {
      let s = Math.max(0, Math.floor(ms / 1000));
      const d = Math.floor(s / 86400); s %= 86400;
      const hh = Math.floor(s / 3600); s %= 3600;
      const mm = Math.floor(s / 60); s %= 60;
      const p = n => String(n).padStart(2, '0');
      return (d ? d + 'd ' : '') + p(hh) + 'h ' + p(mm) + 'm ' + p(s) + 's';
    }

    function fmtDeadline(iso) {
      const ms = Date.parse(iso);
      if (isNaN(ms)) return '';
      return new Date(ms).toLocaleString('en-PH', { timeZone: REG_TZ, dateStyle: 'medium', timeStyle: 'short' });
    }

    function isoToManilaInput(iso) {
      const ms = Date.parse(iso);
      if (isNaN(ms)) return '';
      return new Date(ms + REG_UTC_OFFSET_MS).toISOString().slice(0, 16);
    }

    function manilaInputToMs(v) {
      const withSeconds = v.length === 16 ? v + ':00' : v;
      return Date.parse(withSeconds + '+08:00');
    }

    function renderRegistrationState() {
      const st = getRegistrationStatus();
      const banner = document.getElementById('reg-deadline-banner');
      const title = document.getElementById('reg-deadline-title');
      const sub = document.getElementById('reg-deadline-sub');
      const form = document.getElementById('student-form');
      if (banner && form) {
        const base = 'mb-6 rounded-xl border px-4 py-3 text-xs flex items-start gap-3 ';
        if (!st.open) {
          banner.className = base + 'bg-red-500/10 border-red-500/30 text-red-200';
          title.textContent = 'Registration is closed';
          if (st.reason === 'manual') sub.textContent = 'Registration is currently closed by the administrator. Please contact your instructor if you still need to register.';
          else if (regConfig.closes_at) sub.textContent = 'The deadline was ' + fmtDeadline(regConfig.closes_at) + ' (Philippine time). Please contact your instructor if you still need to register.';
          else sub.textContent = 'Please contact your instructor if you still need to register.';
          form.inert = true;
          form.classList.add('opacity-40', 'pointer-events-none', 'select-none');
        } else {
          form.inert = false;
          form.classList.remove('opacity-40', 'pointer-events-none', 'select-none');
          if (st.msLeft !== null) {
            const urgent = st.msLeft < 3600 * 1000;
            banner.className = base + (urgent ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-blue-500/10 border-blue-500/30 text-blue-200');
            title.textContent = 'Registration closes in ' + fmtDuration(st.msLeft);
            sub.textContent = 'Deadline: ' + fmtDeadline(regConfig.closes_at) + ' (Philippine time). Timing is checked on the server, not your device clock.';
          } else {
            banner.className = 'hidden';
          }
        }
      }
      renderDeadlineAdmin(st);
    }

    function renderDeadlineAdmin(st) {
      const box = document.getElementById('dl-status');
      if (!box) return;
      st = st || getRegistrationStatus();
      const note = document.getElementById('dl-server-note');
      const tog = document.getElementById('dl-toggle-btn');
      if (!st.open) {
        box.className = 'rounded-xl border px-3.5 py-3 text-xs font-semibold bg-red-500/10 border-red-500/30 text-red-300';
        box.textContent = st.reason === 'manual'
          ? 'Status: CLOSED (manually closed by admin)'
          : 'Status: CLOSED (deadline reached' + (regConfig.closes_at ? ': ' + fmtDeadline(regConfig.closes_at) : '') + ')';
      } else if (st.msLeft !== null) {
        box.className = 'rounded-xl border px-3.5 py-3 text-xs font-semibold bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
        box.textContent = 'Status: OPEN. Closes ' + fmtDeadline(regConfig.closes_at) + ' (in ' + fmtDuration(st.msLeft) + ')';
      } else {
        box.className = 'rounded-xl border px-3.5 py-3 text-xs font-semibold bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
        box.textContent = 'Status: OPEN (no deadline set)';
      }
      if (note) {
        if (!supabaseClient) {
          note.className = 'text-[11px] leading-relaxed rounded-lg border px-3 py-2 bg-amber-500/10 border-amber-500/30 text-amber-300';
          note.textContent = 'LocalStorage mode: the deadline only applies on this device. Connect Supabase so every student device follows it.';
        } else if (serverSaysOpen === null || !serverTimeTrusted) {
          note.className = 'text-[11px] leading-relaxed rounded-lg border px-3 py-2 bg-amber-500/10 border-amber-500/30 text-amber-300';
          note.textContent = 'Server clock not detected. Open Supabase Settings, copy the SQL, and run the "REGISTRATION DEADLINE" block once. Until then the deadline uses each device clock and can be bypassed.';
        } else {
          note.className = 'text-[11px] leading-relaxed rounded-lg border px-3 py-2 bg-emerald-500/10 border-emerald-500/20 text-emerald-300';
          note.textContent = 'Server clock active: the database itself rejects registrations after the deadline.';
        }
      }
      if (tog) {
        if (regConfig.manual_closed) {
          tog.className = 'col-span-2 px-4 py-2.5 rounded-xl text-xs font-bold border bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/30';
          tog.textContent = 'Reopen Registration';
        } else {
          tog.className = 'col-span-2 px-4 py-2.5 rounded-xl text-xs font-bold border bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30';
          tog.textContent = 'Close Registration Now';
        }
      }
    }

    async function saveRegistrationConfig() {
      localStorage.setItem('examnet_registration', JSON.stringify(regConfig));
      if (supabaseClient) {
        try {
          const { error } = await supabaseClient.from('exam_config').upsert([{ key: 'registration', value: regConfig }], { onConflict: 'key' });
          if (error) { alert('Could not save to Supabase: ' + error.message); return false; }
        } catch (err) {
          alert('Failed to reach Supabase. The deadline was NOT saved to the cloud.');
          return false;
        }
      }
      await refreshRegistrationState();
      return true;
    }

    function openDeadlineModal() {
      document.getElementById('dl-input').value = regConfig.closes_at ? isoToManilaInput(regConfig.closes_at) : '';
      renderDeadlineAdmin();
      openModal('deadline-modal');
      refreshRegistrationState();
    }

    async function saveDeadline() {
      const v = document.getElementById('dl-input').value;
      if (!v) { alert('Please pick a deadline date and time.'); return; }
      const ms = manilaInputToMs(v);
      if (isNaN(ms)) { alert('That date and time is not valid.'); return; }
      const inPast = ms <= nowMs();
      if (inPast && !confirm('That time has already passed, so registration will close immediately. Continue?')) return;
      regConfig = { closes_at: new Date(ms).toISOString(), manual_closed: inPast ? regConfig.manual_closed : false };
      await saveRegistrationConfig();
    }

    async function clearDeadline() {
      regConfig = { closes_at: null, manual_closed: regConfig.manual_closed };
      document.getElementById('dl-input').value = '';
      await saveRegistrationConfig();
    }

    async function toggleManualClose() {
      if (!regConfig.manual_closed && !confirm('Close registration right now? Students will not be able to submit until you reopen it.')) return;
      regConfig = { closes_at: regConfig.closes_at, manual_closed: !regConfig.manual_closed };
      await saveRegistrationConfig();
    }

    function initRegistrationDeadline() {
      refreshRegistrationState();
      setInterval(renderRegistrationState, 1000);   // live countdown (uses the server-anchored clock)
      setInterval(refreshRegistrationState, 30000); // pick up admin changes and re-sync the server time
    }


