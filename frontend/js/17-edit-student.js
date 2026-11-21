    // --- EDITING STUDENT RECORD ---
    function openEditStudentModal(id) {
      const student = studentsData.find(s => s.id === id);
      if (!student) return;

      document.getElementById('edit-student-id').value = student.id;
      document.getElementById('edit-fullname').value = student.full_name;
      document.getElementById('edit-studentid').value = student.student_id || '';
      document.getElementById('edit-username').value = student.username;
      document.getElementById('edit-course').value = student.course;
      document.getElementById('edit-room').value = student.room_number;

      openModal('edit-student-modal');
    }

    async function handleSaveEditedStudent(e) {
      e.preventDefault();

      const id = document.getElementById('edit-student-id').value;
      const fullName = document.getElementById('edit-fullname').value.toUpperCase().replace(/\s+/g, ' ').trim();
      const username = document.getElementById('edit-username').value.trim().replace(/\s+/g, '');
      const course = document.getElementById('edit-course').value;
      const room = document.getElementById('edit-room').value;

      const studentIdRaw = document.getElementById('edit-studentid').value.trim().toUpperCase().replace(/\s+/g, '');
      if (studentIdRaw && !STUDENT_ID_REGEX.test(studentIdRaw)) {
        alert('Student ID must look like 2026-A001: a 4-digit year, a dash, the letter A, then 3 digits.');
        return;
      }
      const studentId = studentIdRaw || null;

      const before = studentsData.find(s => s.id === id);
      if (!before || nameKey(before.full_name) !== nameKey(fullName) || before.room_number !== room) {
        const dupEdit = await findNameDuplicate(fullName, room, id);
        if (dupEdit.match) {
          alert(dupEdit.match.full_name + ' is already registered in ' + room + '. Change the name or the room.');
          return;
        }
      }

      if (supabaseClient) {
        try {
          const { error } = await supabaseClient
            .from('exam_registrations')
            .update({
              full_name: fullName,
              username: username,
              student_id: studentId,
              course: course,
              room_number: room
            })
            .eq('id', id);

          if (error) {
            alert(friendlyDbError(error, 'Update'));
            return;
          }
        } catch (err) {
          console.error("Update failed", err);
        }
      }

      const index = studentsData.findIndex(s => s.id === id);
      if (index !== -1) {
        studentsData[index].full_name = fullName;
        studentsData[index].username = username;
        studentsData[index].student_id = studentId;
        studentsData[index].course = course;
        studentsData[index].room_number = room;
        saveToLocal();
      }

      closeModal('edit-student-modal');
      renderTable();
      updateMetrics();
    }

    async function deleteRecord(id) {
      if (!confirm("Are you sure you want to delete this examinee record?")) return;

      if (supabaseClient) {
        await supabaseClient.from('exam_registrations').delete().eq('id', id);
      }
      studentsData = studentsData.filter(s => s.id !== id);
      saveToLocal();
      renderTable();
      updateMetrics();
    }

    function copyAccountInfo() {
      if (!lastCreatedAccount) return;
      const infoText = `ExamNet Login Details:\nFull Name: ${lastCreatedAccount.full_name}\nStudent ID: ${lastCreatedAccount.student_id}\nUsername: ${lastCreatedAccount.username}\nCourse: ${lastCreatedAccount.course}\nRoom: ${lastCreatedAccount.room_number}\nDefault Password: ${lastCreatedAccount.default_password}`;
      navigator.clipboard.writeText(infoText);
      alert("Login details copied to clipboard!");
    }


