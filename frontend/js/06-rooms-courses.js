    // --- DYNAMIC LIST MANAGEMENT (SUPABASE + LOCAL STORAGE) ---
    async function loadDynamicLists() {
      let loadedFromCloud = false;

      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient.from('exam_config').select('*');
          if (!error && data && data.length > 0) {
            data.forEach(row => {
              if (row.key === 'courses' && Array.isArray(row.value)) {
                availableCourses = row.value;
              }
              if (row.key === 'rooms' && Array.isArray(row.value)) {
                availableRooms = row.value;
              }
            });
            loadedFromCloud = true;
          }
        } catch (err) {
          console.error("Failed to load config from Supabase:", err);
        }
      }

      if (!loadedFromCloud) {
        const savedCourses = localStorage.getItem('examnet_courses');
        const savedRooms = localStorage.getItem('examnet_rooms');

        if (savedCourses) availableCourses = JSON.parse(savedCourses);
        if (savedRooms) availableRooms = JSON.parse(savedRooms);
      }

      populateDropdowns();
      renderOrganizeLists();
    }

    async function saveDynamicLists() {
      // Save locally as backup
      localStorage.setItem('examnet_courses', JSON.stringify(availableCourses));
      localStorage.setItem('examnet_rooms', JSON.stringify(availableRooms));

      // Save to Supabase cloud if connected
      if (supabaseClient) {
        try {
          await supabaseClient.from('exam_config').upsert([
            { key: 'courses', value: availableCourses },
            { key: 'rooms', value: availableRooms }
          ], { onConflict: 'key' });
        } catch (err) {
          console.error("Failed to sync config to Supabase:", err);
        }
      }

      populateDropdowns();
      renderOrganizeLists();
    }

    function populateDropdowns() {
      const regCourse = document.getElementById('reg-course');
      const editCourse = document.getElementById('edit-course');
      const filterCourse = document.getElementById('filter-course');

      if (!regCourse) return;

      const courseOpts = availableCourses.map(c => `<option value="${c}">${c}</option>`).join('');
      
      regCourse.innerHTML = `<option value="" disabled selected>Select your course</option>` + courseOpts;
      if (editCourse) editCourse.innerHTML = courseOpts;
      if (filterCourse) filterCourse.innerHTML = `<option value="ALL">All Courses</option>` + courseOpts;

      const regRoom = document.getElementById('reg-room');
      const editRoom = document.getElementById('edit-room');
      const filterRoom = document.getElementById('filter-room');

      const roomOpts = availableRooms.map(r => `<option value="${r}">${r}</option>`).join('');

      regRoom.innerHTML = `<option value="" disabled selected>Select room assignment</option>` + roomOpts;
      if (editRoom) editRoom.innerHTML = roomOpts;
      if (filterRoom) filterRoom.innerHTML = `<option value="ALL">All Rooms</option>` + roomOpts;
    }

    function renderOrganizeLists() {
      const courseContainer = document.getElementById('courses-list-container');
      if (!courseContainer) return;

      courseContainer.innerHTML = availableCourses.map((c, i) => `
        <div class="flex items-center justify-between bg-gray-800/80 px-3 py-1.5 rounded-lg text-xs">
          <span class="font-medium text-gray-200">${c}</span>
          <button onclick="removeCourseOption(${i})" class="text-red-400 hover:text-red-300">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `).join('');

      const roomContainer = document.getElementById('rooms-list-container');
      roomContainer.innerHTML = availableRooms.map((r, i) => `
        <div class="flex items-center justify-between bg-gray-800/80 px-3 py-1.5 rounded-lg text-xs">
          <span class="font-medium text-gray-200">${r}</span>
          <button onclick="removeRoomOption(${i})" class="text-red-400 hover:text-red-300">
            <i data-lucide="x" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `).join('');

      lucide.createIcons();
    }

    function addCourseOption() {
      const input = document.getElementById('new-course-input');
      const val = input.value.trim().toUpperCase();
      if (val && !availableCourses.includes(val)) {
        availableCourses.push(val);
        saveDynamicLists();
        input.value = '';
      }
    }

    function removeCourseOption(index) {
      if (availableCourses.length <= 1) {
        alert("You must keep at least one course option.");
        return;
      }
      availableCourses.splice(index, 1);
      saveDynamicLists();
    }

    function addRoomOption() {
      const input = document.getElementById('new-room-input');
      const val = input.value.trim();
      if (val && !availableRooms.includes(val)) {
        availableRooms.push(val);
        saveDynamicLists();
        input.value = '';
      }
    }

    function removeRoomOption(index) {
      if (availableRooms.length <= 1) {
        alert("You must keep at least one room option.");
        return;
      }
      availableRooms.splice(index, 1);
      saveDynamicLists();
    }


