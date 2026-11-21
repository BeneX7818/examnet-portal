    // --- EXCEL LIBRARY: loaded on demand (admins only; students never download it) ---
    // The export code below is unchanged and still synchronous. Anything that calls it must
    // `await ensureXlsx()` first (the Export button and the reset backup both do).
    const XLSX_LIB_URL = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
    let xlsxPromise = null;

    function ensureXlsx() {
      if (window.XLSX) return Promise.resolve();
      if (!xlsxPromise) {
        xlsxPromise = new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = XLSX_LIB_URL;
          s.onload = () => {
            if (window.XLSX) { resolve(); return; }
            xlsxPromise = null; s.remove();
            reject(new Error('The Excel library did not start correctly. Please try again.'));
          };
          s.onerror = () => {
            xlsxPromise = null; s.remove();   // allow a retry on the next click
            reject(new Error('Could not load the Excel library. Check your internet connection and try again.'));
          };
          document.head.appendChild(s);
        });
      }
      return xlsxPromise;
    }

    async function exportExcelFromButton() {
      try { await ensureXlsx(); }
      catch (err) { alert(err.message); return; }
      exportMultiSheetExcel();
    }

    // --- EXCEL STYLING HELPERS (header look matches the import template) ---
    const XL_HEADER_BG = "3B5BDB";
    const XL_BORDER = { style: "thin", color: { rgb: "B8C4EE" } };
    const XL_BORDERS = { top: XL_BORDER, bottom: XL_BORDER, left: XL_BORDER, right: XL_BORDER };

    // Styles one header row (blue fill, bold white centered text) plus the data rows below it.
    function styleTableRange(ws, headerRow, firstCol, lastCol, lastRow) {
      for (let r = headerRow; r <= lastRow; r++) {
        for (let c = firstCol; c <= lastCol; c++) {
          const ref = XLSX.utils.encode_cell({ r, c });
          if (!ws[ref]) ws[ref] = { t: "s", v: "" };
          ws[ref].s = (r === headerRow)
            ? {
                font: { bold: true, color: { rgb: "FFFFFF" }, name: "Calibri", sz: 11 },
                fill: { patternType: "solid", fgColor: { rgb: XL_HEADER_BG } },
                alignment: { horizontal: "center", vertical: "center" },
                border: XL_BORDERS
              }
            : {
                font: { name: "Calibri", sz: 11 },
                alignment: { vertical: "center" },
                border: XL_BORDERS
              };
        }
      }
    }

    // Table sheets (Master List and room sheets): header on row 0, widths fit the content.
    function styleTableSheet(ws) {
      const range = XLSX.utils.decode_range(ws['!ref']);
      styleTableRange(ws, 0, range.s.c, range.e.c, range.e.r);
      const widths = [];
      for (let c = range.s.c; c <= range.e.c; c++) {
        let max = 8;
        for (let r = range.s.r; r <= range.e.r; r++) {
          const cell = ws[XLSX.utils.encode_cell({ r, c })];
          if (cell && cell.v != null) max = Math.max(max, String(cell.v).length);
        }
        widths.push({ wch: Math.min(max + 4, 45) });
      }
      ws['!cols'] = widths;
      ws['!rows'] = [{ hpt: 24 }];
    }

    // --- MULTI-SHEET EXCEL EXPORT ENGINE (SHEETJS) ---
    function exportMultiSheetExcel(opts) {
      opts = (opts && typeof opts === 'object' && !(opts instanceof Event)) ? opts : {};
      if (studentsData.length === 0) {
        if (!opts.silent) alert("No student records available to export!");
        return false;
      }

      const wb = XLSX.utils.book_new();
      const termLabel = (opts.termLabel !== undefined && opts.termLabel !== null) ? opts.termLabel : currentTermLabel();

      // 1. SUMMARY SHEET
      const summaryData = [
        ["ExamNet System - Master Registration Summary"],
        ["Generated At:", new Date().toLocaleString()],
        ...(termLabel ? [["Semester:", termLabel]] : []),
        ["Total Registered Examinees:", studentsData.length],
        [],
        ["Course Breakdown"],
        ["Course", "Total Students"]
      ];

      // Row of the "Course | Total Students" header. Looked up, not hard-coded, because the
      // optional "Semester:" row above shifts everything below it down by one.
      const courseHeaderRow = summaryData.length - 1;

      const courseCounts = {};
      const roomCounts = {};

      studentsData.forEach(s => {
        courseCounts[s.course] = (courseCounts[s.course] || 0) + 1;
        roomCounts[s.room_number] = (roomCounts[s.room_number] || 0) + 1;
      });

      Object.entries(courseCounts).forEach(([crs, cnt]) => summaryData.push([crs, cnt]));
      
      summaryData.push([], ["Room Assignment Breakdown"], ["Room / Block", "Total Students"]);
      Object.entries(roomCounts).forEach(([rm, cnt]) => summaryData.push([rm, cnt]));

      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      // Style: bold title, then each breakdown table (header row + rows) like the other sheets
      const setCellStyle = (r, st) => { const c = summarySheet[XLSX.utils.encode_cell({ r, c: 0 })]; if (c) c.s = st; };
      setCellStyle(0, { font: { bold: true, sz: 14, name: "Calibri" } });
      const courseCount = Object.keys(courseCounts).length;
      const roomCount = Object.keys(roomCounts).length;
      styleTableRange(summarySheet, courseHeaderRow, 0, 1, courseHeaderRow + courseCount);
      const roomHeaderRow = courseHeaderRow + courseCount + 3; // after blank row + section title
      styleTableRange(summarySheet, roomHeaderRow, 0, 1, roomHeaderRow + roomCount);
      setCellStyle(courseHeaderRow - 1, { font: { bold: true, sz: 12, name: "Calibri" } });   // "Course Breakdown"
      setCellStyle(roomHeaderRow - 1, { font: { bold: true, sz: 12, name: "Calibri" } });     // "Room Assignment Breakdown"
      summarySheet['!cols'] = [{ wch: 34 }, { wch: 28 }];
      XLSX.utils.book_append_sheet(wb, summarySheet, "Overall Summary");

      // 2. MASTER LIST SHEET
      const masterRows = studentsData.map((s, idx) => ({
        "No.": idx + 1,
        "Full Name": s.full_name,
        "Student ID": s.student_id || "",
        "Username": s.username,
        "Default Initial Password": s.default_password || DEFAULT_PASS_PATTERN,
        "Course": s.course,
        "Room / Block": s.room_number,
        "Registration Timestamp": new Date(s.created_at).toLocaleString()
      }));
      const masterSheet = XLSX.utils.json_to_sheet(masterRows);
      styleTableSheet(masterSheet);
      XLSX.utils.book_append_sheet(wb, masterSheet, "Master List");

      // 3. GROUPED ROOM & COURSE SHEETS
      const grouped = {};
      studentsData.forEach(s => {
        const key = `${s.room_number} - ${s.course}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(s);
      });

      Object.keys(grouped).forEach(groupKey => {
        const sheetRows = grouped[groupKey].map((s, i) => ({
          "Seat No.": i + 1,
          "Full Name": s.full_name,
          "Student ID": s.student_id || "",
          "Username": s.username,
          "Default Initial Password": s.default_password || DEFAULT_PASS_PATTERN,
          "Course": s.course,
          "Room / Block": s.room_number
        }));

        const sheet = XLSX.utils.json_to_sheet(sheetRows);
        styleTableSheet(sheet);
        const safeSheetName = groupKey.replace(/[:\\/?*\[\]]/g, "").substring(0, 30);
        XLSX.utils.book_append_sheet(wb, sheet, safeSheetName);
      });

      const termSlug = termLabel ? '_' + termLabel.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : '';
      XLSX.writeFile(wb, `ExamNet_${opts.fileTag || 'Registrations'}${termSlug}_${new Date().toISOString().slice(0,10)}.xlsx`);
      return true;
    }


