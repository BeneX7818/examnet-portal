    // --- REALTIME USERNAME NO-SPACE & AVAILABILITY VALIDATION ---
    function handleUsernameInput(input) {
      let value = input.value.replace(/\s+/g, '');
      input.value = value;

      const badge = document.getElementById('username-status-badge');

      if (!value) {
        badge.classList.add('hidden');
        isUsernameAvailable = false;
        return;
      }

      badge.classList.remove('hidden');
      badge.className = "text-xs px-2 py-0.5 rounded-md font-semibold bg-gray-800 text-gray-400 animate-pulse";
      badge.innerText = "Checking availability...";

      clearTimeout(usernameDebounceTimer);
      usernameDebounceTimer = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 300);
    }

    async function checkUsernameAvailability(username) {
      const badge = document.getElementById('username-status-badge');
      let isTaken = false;
      await ensureTermsLoaded();
      const termId = getCheckTermId();

      if (supabaseClient) {
        try {
          const { data, error } = await termFilter(supabaseClient
            .from('exam_registrations')
            .select('id')
            .ilike('username', username), termId)
            .limit(1);

          if (!error && data && data.length > 0) {
            isTaken = true;
          }
        } catch (e) {
          console.error("Availability check error:", e);
        }
      } else {
        const localData = readLocalStudents().filter(s => termMatches(s, termId));
        isTaken = localData.some(s => s.username.toLowerCase() === username.toLowerCase());
      }

      if (isTaken) {
        isUsernameAvailable = false;
        badge.className = "text-xs px-2.5 py-0.5 rounded-md font-bold bg-red-500/20 text-red-400 border border-red-500/30";
        badge.innerText = "Username Taken";
      } else {
        isUsernameAvailable = true;
        badge.className = "text-xs px-2.5 py-0.5 rounded-md font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
        badge.innerText = "Available";
      }
    }


