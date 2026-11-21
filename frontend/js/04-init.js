    // --- INITIALIZATION ---
    window.addEventListener('DOMContentLoaded', () => {
      document.getElementById('footer-year').innerText = CURRENT_YEAR;
      initStudentIdField();
      lucide.createIcons();
      initRouting();
      initSupabaseConnection();
      loadRegistrations();
      initRegistrationDeadline();

      window.addEventListener('hashchange', initRouting);
    });

