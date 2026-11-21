    // --- ROUTING ENGINE ---
    function initRouting() {
      const hash = window.location.hash || '#register';

      document.getElementById('view-register').classList.add('hidden');
      document.getElementById('view-admin-login').classList.add('hidden');
      document.getElementById('view-dashboard').classList.add('hidden');
      document.getElementById('admin-logout-btn').classList.add('hidden');

      if (hash === '#admin') {
        if (sessionStorage.getItem('examnet_admin_auth') === 'true') {
          window.location.hash = '#dashboard';
          return;
        }
        document.getElementById('view-admin-login').classList.remove('hidden');
      } else if (hash === '#dashboard') {
        if (sessionStorage.getItem('examnet_admin_auth') !== 'true') {
          window.location.hash = '#admin';
          return;
        }
        document.getElementById('view-dashboard').classList.remove('hidden');
        document.getElementById('admin-logout-btn').classList.remove('hidden');
        loadRegistrations();
        ensureXlsx().catch(() => {});   // warm up the Excel library for the admin (the click retries if this fails)
      } else {
        document.getElementById('view-register').classList.remove('hidden');
      }
    }

    function logoutAdmin() {
      sessionStorage.removeItem('examnet_admin_auth');
      sessionStorage.removeItem(ADM_KEY_STORE);
      window.location.hash = '#register';
    }


