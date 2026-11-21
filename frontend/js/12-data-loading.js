    // --- DATA LOADING & PERSISTENCE ---
    async function loadRegistrations() {
      await ensureTermsLoaded();
      if (supabaseClient) {
        try {
          const { data, error } = await termFilter(supabaseClient
            .from('exam_registrations')
            .select('*'), selectedTermId)
            .order('created_at', { ascending: false });

          if (!error && data) {
            studentsData = data;
          } else {
            console.error(error);
            loadFromLocal();
          }
        } catch (e) {
          loadFromLocal();
        }
      } else {
        loadFromLocal();
      }

      renderTable();
      updateMetrics();
      renderTermUI();
    }

    function loadFromLocal() {
      const all = readLocalStudents();
      studentsData = termsReady ? all.filter(st => st.term_id === selectedTermId) : all;
    }

    // Keeps other semesters' local records when saving the semester on screen
    function saveToLocal() {
      if (!termsReady) {
        localStorage.setItem('examnet_students', JSON.stringify(studentsData));
        return;
      }
      const mine = new Set(studentsData.map(st => st.id));
      const others = readLocalStudents().filter(st => st.term_id !== selectedTermId && !mine.has(st.id));
      localStorage.setItem('examnet_students', JSON.stringify(studentsData.concat(others)));
    }


