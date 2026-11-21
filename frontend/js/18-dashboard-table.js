    // --- RENDER DASHBOARD TABLE ---
    function renderTable() {
      const tbody = document.getElementById('student-table-body');
      const emptyState = document.getElementById('empty-state');
      if (!tbody) return;

      const searchQuery = (document.getElementById('admin-search')?.value || '').toLowerCase();
      const courseFilter = document.getElementById('filter-course')?.value || 'ALL';
      const roomFilter = document.getElementById('filter-room')?.value || 'ALL';

      const filtered = studentsData.filter(s => {
        const matchesSearch = s.full_name.toLowerCase().includes(searchQuery) || s.username.toLowerCase().includes(searchQuery) || (s.student_id || '').toLowerCase().includes(searchQuery);
        const matchesCourse = courseFilter === 'ALL' || s.course === courseFilter;
        const matchesRoom = roomFilter === 'ALL' || s.room_number === roomFilter;
        return matchesSearch && matchesCourse && matchesRoom;
      });

      if (filtered.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
      }

      emptyState.classList.add('hidden');
      tbody.innerHTML = filtered.map(s => `
        <tr class="hover:bg-gray-800/40 transition">
          <td class="py-3.5 px-6 font-semibold text-white">${escapeHtml(s.full_name)}</td>
          <td class="py-3.5 px-6 font-mono text-xs text-emerald-300">${s.student_id ? escapeHtml(s.student_id) : '<span class="text-gray-600">&mdash;</span>'}</td>
          <td class="py-3.5 px-6 font-mono text-xs text-blue-400">${escapeHtml(s.username)}</td>
          <td class="py-3.5 px-6 font-mono text-xs text-amber-300 font-bold">${escapeHtml(s.default_password || DEFAULT_PASS_PATTERN)}</td>
          <td class="py-3.5 px-6">
            <span class="px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">${escapeHtml(s.course)}</span>
          </td>
          <td class="py-3.5 px-6">
            <span class="px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">${escapeHtml(s.room_number)}</span>
          </td>
          <td class="py-3.5 px-6 text-xs text-gray-400">${new Date(s.created_at).toLocaleDateString()} ${new Date(s.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
          <td class="py-3.5 px-6 text-right space-x-1">
            <button onclick="openEditStudentModal('${s.id}')" class="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition" title="Edit Student">
              <i data-lucide="pencil" class="w-4 h-4"></i>
            </button>
            <button onclick="deleteRecord('${s.id}')" class="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition" title="Delete Student">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </td>
        </tr>
      `).join('');

      lucide.createIcons();
    }

    function updateMetrics() {
      document.getElementById('stat-total').innerText = studentsData.length;
      
      const uniqueCourses = new Set(studentsData.map(s => s.course));
      const uniqueRooms = new Set(studentsData.map(s => s.room_number));

      document.getElementById('stat-courses').innerText = uniqueCourses.size;
      document.getElementById('stat-rooms').innerText = uniqueRooms.size;
    }


