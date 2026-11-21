    // --- RESET ALL DATA (admin password required) ---
    // Wipes examinee records (and, optionally, rooms/courses + registration deadline).
    // NEVER touches: the admin password (examnet_admin_key), the Supabase URL/key, or the admin session.
    let resetBusy = false;

    function openResetModal() {
      document.getElementById('reset-count').innerText = studentsData.length;
      initResetScope();
      document.getElementById('reset-pass').value = '';
      document.getElementById('reset-backup').checked = true;
      document.getElementById('reset-config').checked = true;
      setResetError('');
      setResetProgress('');
      setResetBusy(false);
      openModal('reset-modal');
      setTimeout(() => document.getElementById('reset-pass').focus(), 50);
    }

    function closeResetModal() {
      if (resetBusy) return; // don't close mid-reset
      document.getElementById('reset-pass').value = '';
      closeModal('reset-modal');
    }

    function setResetError(msg) {
      const el = document.getElementById('reset-error');
      el.textContent = msg;
      el.classList.toggle('hidden', !msg);
    }

    function setResetProgress(msg) {
      const el = document.getElementById('reset-progress');
      el.textContent = msg;
      el.classList.toggle('hidden', !msg);
    }

    function setResetBusy(busy) {
      resetBusy = busy;
      document.getElementById('reset-submit-btn').disabled = busy;
      document.getElementById('reset-cancel-btn').disabled = busy;
      document.getElementById('reset-pass').disabled = busy;
    }

    async function handleResetAllData(e) {
      e.preventDefault();
      if (resetBusy) return;
      setResetError('');

      // 1) Admin password gate
      const typed = document.getElementById('reset-pass').value;
      if (typed !== getStoredAdminPassword()) {
        document.getElementById('reset-pass').value = '';
        setResetError('Incorrect admin password. Nothing was deleted.');
        return;
      }

      const wantBackup = document.getElementById('reset-backup').checked;
      const resetConfig = document.getElementById('reset-config').checked;
      if (termsState === 'error') {
        setResetError('Could not load the semester list, so nothing was deleted. Check your connection, reload the page and try again.');
        return;
      }
      const scope = getResetScope();            // 'term' = only the semester on screen, 'all' = every semester
      const scopeTermId = selectedTermId;
      const scopeLabel = currentTermLabel();
      setResetBusy(true);

      try {
        // 2) Pull the latest records so the backup and the wipe cover everything students just submitted
        setResetProgress('Loading the latest records...');
        await loadRegistrations();

        // 3) Backup first. If it fails, stop before deleting anything.
        if (wantBackup) {
          setResetProgress('Downloading Excel backup...');
          try {
            const ok = await backupBeforeReset(scope);
            if (!ok) throw new Error('Backup was not created');
          } catch (err) {
            console.error('Backup failed', err);
            setResetError('Backup failed, so nothing was deleted. Untick the backup option if you really want to continue without one.');
            setResetProgress('');
            setResetBusy(false);
            return;
          }
        }

        // 4) Delete registrations
        setResetProgress('Deleting examinee records...');
        if (supabaseClient) {
          const delBase = supabaseClient.from('exam_registrations').delete();
          const { error: delErr } = await (scope === 'term' ? delBase.eq('term_id', scopeTermId) : delBase.not('id', 'is', null));
          if (delErr) throw new Error('Supabase delete error: ' + delErr.message);

          // Verify. RLS can silently block deletes without returning an error.
          const cntBase = supabaseClient.from('exam_registrations').select('id', { count: 'exact', head: true });
          const { count, error: cntErr } = await (scope === 'term' ? cntBase.eq('term_id', scopeTermId) : cntBase);
          if (cntErr) throw new Error('Could not verify the reset: ' + cntErr.message);
          if (count && count > 0) {
            throw new Error(count + ' record(s) are still in Supabase. Your table may be missing the "Allow public deletes" policy (see Supabase Settings > SQL).');
          }
        }
        studentsData = [];
        saveToLocal();
        if (scope === 'all') localStorage.setItem('examnet_students', '[]');

        // 5) Optional: rooms/courses + registration deadline back to defaults
        if (resetConfig) {
          setResetProgress('Resetting rooms, courses and deadline...');
          availableCourses = [...DEFAULT_COURSES];
          availableRooms = [...DEFAULT_ROOMS];
          await saveDynamicLists();

          regConfig = { closes_at: null, manual_closed: false };
          document.getElementById('dl-input').value = '';
          await saveRegistrationConfig();
        }

        // 6) Refresh the screen
        renderTable();
        updateMetrics();
        setResetProgress('');
        setResetBusy(false);
        closeModal('reset-modal');
        document.getElementById('reset-pass').value = '';
        alert('Reset complete. ' + (scope === 'term' ? 'Records for "' + scopeLabel + '"' : 'All examinee data from every semester') + (resetConfig ? ', rooms/courses and the deadline' : '') + ' cleared. ' + (scope === 'term' ? 'Other semesters, the ' : 'The ') + 'admin password and Supabase settings were kept.');
      } catch (err) {
        console.error('Reset failed', err);
        // Re-sync the screen with whatever is actually stored
        try { await loadRegistrations(); } catch (_) {}
        setResetProgress('');
        setResetError(err.message || 'Reset failed.');
        setResetBusy(false);
      }
    }


