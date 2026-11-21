    // Configurable Dynamic Lists
    const DEFAULT_COURSES = ["BSIT", "BSCS", "BSIS", "BSEMC", "BSCPE"];
    const DEFAULT_ROOMS = ["Room 101", "Room 102", "Room 103", "Lab A", "Lab B"];
    let availableCourses = [...DEFAULT_COURSES];
    let availableRooms = [...DEFAULT_ROOMS];

    const CURRENT_YEAR = new Date().getFullYear();

    // Student ID = "<current year>-A<3 random digits>", e.g. 2026-A001 (upper case, no spaces).
    // The validation regex stays loose so older IDs (e.g. 2026-0A01) remain valid.
    const STUDENT_ID_PREFIX = `${CURRENT_YEAR}-`;
    const STUDENT_ID_REGEX = /^\d{4}-[A-Z0-9]{4}$/;
    const DEFAULT_PASS_PATTERN = `ZDSPGC@${CURRENT_YEAR}`;
    
    // Obfuscated default fallback credentials ("superadmin" encoded to base64)
    const OBFUSCATED_DEFAULT = "c3VwZXJhZG1pbg==";

    let lastCreatedAccount = null;

