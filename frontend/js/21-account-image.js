    // --- SAVE ACCOUNT DETAILS AS AN IMAGE (screenshot) ---
    // Draws a clean card on a <canvas> from the values already shown in the success modal,
    // then downloads it as a PNG. Works offline, needs no extra library, and is read-only:
    // it never touches the registration data, the form, the deadline or the database.
    async function saveAccountScreenshot() {
      const btn = document.getElementById('save-shot-btn');
      const label = document.getElementById('save-shot-label');
      const setLabel = (t) => { label.textContent = t; };
      try {
        btn.disabled = true;
        setLabel('Preparing image...');
        try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (_) {}

        const val = (id) => (document.getElementById(id).innerText || '').trim();
        const rows = [
          ['Full Name', val('succ-fullname'), '#ffffff'],
          ['Student ID', val('succ-studentid'), '#6ee7b7'],
          ['Username', val('succ-username'), '#60a5fa'],
          ['Room & Course', val('succ-room-course'), '#a5b4fc']
        ];
        const password = val('succ-password');

        const FONT = "'Plus Jakarta Sans', 'Segoe UI', Roboto, Arial, sans-serif";
        const MONO = "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace";
        const SCALE = 2, W = 720, PAD = 40, ROW_H = 64;
        const H = 150 + rows.length * ROW_H + 130 + 90;

        const canvas = document.createElement('canvas');
        canvas.width = W * SCALE;
        canvas.height = H * SCALE;
        const ctx = canvas.getContext('2d');
        ctx.scale(SCALE, SCALE);

        const rr = (x, y, w, h, r) => {
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.arcTo(x + w, y, x + w, y + h, r);
          ctx.arcTo(x + w, y + h, x, y + h, r);
          ctx.arcTo(x, y + h, x, y, r);
          ctx.arcTo(x, y, x + w, y, r);
          ctx.closePath();
        };
        // Shrinks the text until it fits the available width
        const fit = (text, weight, size, family, maxW) => {
          let sz = size;
          do { ctx.font = weight + ' ' + sz + 'px ' + family; sz -= 1; }
          while (ctx.measureText(text).width > maxW && sz > 10);
        };

        // Background
        ctx.fillStyle = '#0b0f19';
        ctx.fillRect(0, 0, W, H);

        // Card
        rr(16, 16, W - 32, H - 32, 24);
        ctx.fillStyle = '#111827';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(16,185,129,0.45)';
        ctx.stroke();

        // Title
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 28px ' + FONT;
        ctx.fillText('ExamNet Registration', W / 2, 70);
        ctx.fillStyle = '#34d399';
        ctx.font = '700 15px ' + FONT;
        ctx.fillText('\u2713 Registration Complete', W / 2, 98);

        // Detail rows
        let y = 130;
        rows.forEach((r, i) => {
          ctx.strokeStyle = 'rgba(255,255,255,0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(PAD, y);
          ctx.lineTo(W - PAD, y);
          ctx.stroke();

          ctx.textAlign = 'left';
          ctx.fillStyle = '#9ca3af';
          ctx.font = '600 15px ' + FONT;
          ctx.fillText(r[0], PAD, y + 38);

          ctx.textAlign = 'right';
          ctx.fillStyle = r[2];
          fit(r[1], '700', 20, (i === 1 || i === 2) ? MONO : FONT, W - PAD * 2 - 150);
          ctx.fillText(r[1], W - PAD, y + 38);
          y += ROW_H;
        });

        // Password box
        y += 14;
        rr(PAD, y, W - PAD * 2, 84, 14);
        ctx.fillStyle = 'rgba(59,130,246,0.14)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(59,130,246,0.45)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#93c5fd';
        ctx.font = '700 12px ' + FONT;
        ctx.fillText('INITIAL DEFAULT PASSWORD', PAD + 20, y + 32);
        ctx.fillStyle = '#ffffff';
        fit(password, '800', 28, MONO, W - PAD * 2 - 40);
        ctx.fillText(password, PAD + 20, y + 64);

        // Footer
        y += 84 + 36;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fbbf24';
        ctx.font = '600 13px ' + FONT;
        ctx.fillText('Use this temporary password for your first login. Keep this image private.', W / 2, y);
        ctx.fillStyle = '#6b7280';
        ctx.font = '500 12px ' + FONT;
        ctx.fillText('Saved on ' + new Date().toLocaleString(), W / 2, y + 24);

        const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
        if (!blob) throw new Error('Could not create the image');

        const safeId = (rows[1][1] || 'Registration').replace(/[^A-Za-z0-9_-]/g, '');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ExamNet_' + safeId + '.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);

        setLabel('Saved! Check your Downloads / Gallery');
      } catch (err) {
        console.error('Screenshot failed', err);
        setLabel('Could not save. Please screenshot manually');
      } finally {
        btn.disabled = false;
        setTimeout(() => setLabel('Save Screenshot'), 3500);
      }
    }


