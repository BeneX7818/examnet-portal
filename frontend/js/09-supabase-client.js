    // --- SUPABASE CLIENT SETUP ---
    function initSupabaseConnection() {
      termsPromise = null;
      const url = localStorage.getItem('examnet_sp_url') || 'https://btlqfacbxdilyaejcywf.supabase.co';
      const key = localStorage.getItem('examnet_sp_key') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0bHFmYWNieGRpbHlhZWpjeXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MTkzNzEsImV4cCI6MjEwOTE5NTM3MX0.VOprGy2aPUeQkDX2feiXeJgzLbDbdD13I9DNcJMHPxw';

      const badgeDot = document.getElementById('status-dot');
      const badgeText = document.getElementById('status-text');
      const statSync = document.getElementById('stat-sync');

      if (url && key && window.supabase) {
        try {
          supabaseClient = window.supabase.createClient(url, key);
          badgeDot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
          badgeText.innerText = "Supabase Live";
          if (statSync) statSync.innerText = "Supabase Cloud DB";
          
          document.getElementById('sp-url').value = url;
          document.getElementById('sp-key').value = key;
        } catch (err) {
          console.error("Supabase init failed", err);
          fallbackToLocal();
        }
      } else {
        fallbackToLocal();
      }

      // Load configuration lists after initializing client
      loadDynamicLists();
    }

    function fallbackToLocal() {
      supabaseClient = null;
      document.getElementById('status-dot').className = "w-2 h-2 rounded-full bg-amber-400";
      document.getElementById('status-text').innerText = "LocalStorage Mode";
      const statSync = document.getElementById('stat-sync');
      if (statSync) statSync.innerText = "LocalStorage (Offline)";
      loadDynamicLists();
    }

    function saveSupabaseSettings() {
      const url = document.getElementById('sp-url').value.trim();
      const key = document.getElementById('sp-key').value.trim();

      if (!url || !key) {
        alert("Please provide both Supabase URL and Anon Key.");
        return;
      }

      localStorage.setItem('examnet_sp_url', url);
      localStorage.setItem('examnet_sp_key', key);

      initSupabaseConnection();
      closeModal('supabase-modal');
      loadRegistrations();
      refreshRegistrationState();
    }

    function disconnectSupabase() {
      localStorage.removeItem('examnet_sp_url');
      localStorage.removeItem('examnet_sp_key');
      document.getElementById('sp-url').value = '';
      document.getElementById('sp-key').value = '';
      fallbackToLocal();
      closeModal('supabase-modal');
      loadRegistrations();
      refreshRegistrationState();
    }


