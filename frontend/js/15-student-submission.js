    // --- STUDENT SUBMISSION WORKFLOW ---
    async function handleStudentSubmit(e) {
      e.preventDefault();

      // Deadline check against the server clock (the database enforces it too)
      if (!(await verifyRegistrationOpen())) return;

      if (!validateFullName()) return;
      const fullName = document.getElementById('reg-fullname').value.trim();
      const username = document.getElementById('reg-username').value.trim();
      const studentId = STUDENT_ID_PREFIX + document.getElementById('reg-studentid').value.trim().toUpperCase();
      const course = document.getElementById('reg-course').value;
      const room = document.getElementById('reg-room').value;

      const dupRes = await findNameDuplicate(fullName, room, null);
      if (dupRes.match) {
        setNameDupStatus('dup', 'Already registered: ' + dupRes.match.full_name + ' is already in ' + room + '. You cannot register twice in the same room.');
        document.getElementById('name-dup-status').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      if (!document.getElementById('reg-studentid').value) {
        alert('Please tap the Generate button to get your Student ID first.');
        return;
      }

      if (!STUDENT_ID_REGEX.test(studentId) || !isStudentIdAvailable) {
        alert('Your Student ID could not be confirmed. Please tap Generate to get a new one.');
        return;
      }

      if (username.includes(' ')) {
        alert('Username cannot contain spaces.');
        return;
      }

      if (!isUsernameAvailable) {
        alert('Username is already taken or being verified. Please enter a unique username.');
        return;
      }

      const defaultPassword = DEFAULT_PASS_PATTERN;

      const newRecord = {
        id: crypto.randomUUID(),
        full_name: fullName,
        username: username,
        student_id: studentId,
        default_password: defaultPassword,
        course: course,
        room_number: room,
        ...(termsReady && activeTermId ? { term_id: activeTermId } : {}),
        created_at: new Date().toISOString()
      };

      const btn = document.getElementById('submit-btn');
      btn.disabled = true;
      btn.innerText = "Saving Registration...";

      if (supabaseClient) {
        try {
          const { error } = await supabaseClient
            .from('exam_registrations')
            .insert([{
              full_name: fullName,
              username: username,
              student_id: studentId,
              default_password: defaultPassword,
              course: course,
              room_number: room,
              ...(termsReady && activeTermId ? { term_id: activeTermId } : {})
            }]);

          if (error) {
            alert(friendlyDbError(error, 'Insert'));
            btn.disabled = false;
            btn.innerText = "Submit Registration";
            return;
          }
        } catch (err) {
          alert("Failed to reach Supabase. Saving locally.");
          studentsData.unshift(newRecord);
          saveToLocal();
        }
      } else {
        studentsData.unshift(newRecord);
        saveToLocal();
      }

      document.getElementById('student-form').reset();
      refreshFullName();
      document.getElementById('username-status-badge').classList.add('hidden');
      isUsernameAvailable = false;
      setStudentIdBadge(null);
      isStudentIdAvailable = false;
      btn.disabled = false;
      btn.innerText = "Submit Registration";

      lastCreatedAccount = newRecord;

      document.getElementById('succ-fullname').innerText = fullName;
      document.getElementById('succ-studentid').innerText = studentId;
      document.getElementById('succ-username').innerText = username;
      document.getElementById('succ-room-course').innerText = `${room} (${course})`;
      document.getElementById('succ-password').innerText = defaultPassword;

      openModal('success-modal');
      loadRegistrations();
    }


