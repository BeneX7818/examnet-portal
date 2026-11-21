    // --- HELPERS & MODALS ---
    function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
    function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
    
    function copySQL() {
      const sql = document.getElementById('sql-snippet').innerText;
      navigator.clipboard.writeText(sql);
      alert("SQL Schema copied to clipboard!");
    }

    function escapeHtml(str) {
      return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }