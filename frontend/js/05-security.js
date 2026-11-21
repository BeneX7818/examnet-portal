    // --- SECURITY & ADMIN CREDENTIAL ENGINE ---
    function getStoredAdminPassword() {
      const stored = localStorage.getItem('examnet_admin_key');
      if (stored) return stored;
      return atob(OBFUSCATED_DEFAULT);
    }

    function handleAdminLogin(e) {
      e.preventDefault();
      const inputPass = document.getElementById('admin-pass').value;
      const validPass = getStoredAdminPassword();

      if (inputPass === validPass) {
        sessionStorage.setItem('examnet_admin_auth', 'true');
        document.getElementById('admin-pass').value = '';
        window.location.hash = '#dashboard';
      } else {
        alert('Incorrect admin security key!');
      }
    }

    function handleUpdateAdminPassword(e) {
      e.preventDefault();
      const newPass = document.getElementById('new-admin-pass').value.trim();
      const confirmPass = document.getElementById('confirm-admin-pass').value.trim();

      if (!newPass) {
        alert("Password cannot be empty.");
        return;
      }

      if (newPass !== confirmPass) {
        alert("New password and confirmation do not match!");
        return;
      }

      localStorage.setItem('examnet_admin_key', newPass);
      document.getElementById('new-admin-pass').value = '';
      document.getElementById('confirm-admin-pass').value = '';
      closeModal('change-pass-modal');
      alert("Admin password updated successfully!");
    }


