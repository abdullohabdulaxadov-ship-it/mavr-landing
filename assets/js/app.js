/* ============================================================================
   Mavr — landing sahifalar mantiqi (kutubxonasiz, vanilla JS)
   • aloqa ma'lumotlarini config'dan joylash
   • mobil menyu
   • 2 daqiqalik daraja testi (kviz)
   • barcha formalarni yuborish (CRM va HR)
   ========================================================================= */
(function () {
    'use strict';

    const CFG = window.MAVR_CONFIG || {};

    // ── 1. Aloqa ma'lumotlari ────────────────────────────────────────────────
    document.querySelectorAll('[data-mavr]').forEach(el => {
        const key = el.dataset.mavr;
        if (key === 'phone') {
            el.textContent = CFG.phone || '';
            if (el.tagName === 'A') el.href = 'tel:' + (CFG.phoneHref || '');
        } else if (key === 'telegram') {
            if (el.tagName === 'A') el.href = CFG.telegram || '#';
        } else if (key === 'instagram') {
            if (el.tagName === 'A') el.href = CFG.instagram || '#';
        } else if (CFG[key]) {
            el.textContent = CFG[key];
        }
    });

    const mapBox = document.getElementById('mapBox');
    if (mapBox && CFG.mapEmbed) {
        const frame = document.createElement('iframe');
        frame.src = CFG.mapEmbed;
        frame.loading = 'lazy';
        frame.title = 'Mavr markazi joylashuvi';
        frame.referrerPolicy = 'no-referrer-when-downgrade';
        mapBox.innerHTML = '';
        mapBox.appendChild(frame);
    }

    // ── 2. Mobil menyu ───────────────────────────────────────────────────────
    const burger = document.getElementById('burger');
    const nav = document.getElementById('nav');
    if (burger && nav) {
        burger.addEventListener('click', () => {
            const open = nav.classList.toggle('is-open');
            burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        nav.addEventListener('click', e => {
            if (e.target.tagName === 'A') {
                nav.classList.remove('is-open');
                burger.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // ── 3. Telefon raqami ────────────────────────────────────────────────────
    // Foydalanuvchi "90 123 45 67", "+998901234567" yoki "901234567" deb yozishi
    // mumkin — hammasi bitta ko'rinishga keltiriladi.
    function normalizePhone(raw) {
        const digits = String(raw || '').replace(/\D/g, '');
        if (!digits) return '';
        if (digits.length === 9) return '+998' + digits;
        if (digits.length === 12 && digits.startsWith('998')) return '+' + digits;
        if (digits.length === 13 && digits.startsWith('9998')) return '+' + digits.slice(1);
        return digits.length >= 9 ? '+' + digits : '';
    }

    document.querySelectorAll('input[type="tel"]').forEach(input => {
        input.addEventListener('blur', () => {
            const norm = normalizePhone(input.value);
            if (norm) input.value = norm;
        });
    });

    // ── 4. Formalarni yuborish ───────────────────────────────────────────────
    function showMessage(form, text, ok) {
        const box = form.querySelector('.form-msg');
        if (!box) return;
        box.textContent = text;
        box.className = 'form-msg ' + (ok ? 'is-ok' : 'is-err');
    }

    // Formani yuboradi. `extra` — qo'shimcha maydonlar (kviz javoblari va h.k.)
    async function sendForm(form, endpoint, extra = {}, asFile = false) {
        const btn = form.querySelector('[type="submit"]');
        const name = (form.querySelector('[name="name"]')?.value || '').trim();
        const phone = normalizePhone(form.querySelector('[name="phone"]')?.value);

        if (name.length < 2) { showMessage(form, 'Ismingizni to\'liq kiriting.', false); return false; }
        if (!phone) { showMessage(form, 'Telefon raqamni to\'g\'ri kiriting: 90 123 45 67', false); return false; }

        const original = btn ? btn.textContent : '';
        if (btn) { btn.disabled = true; btn.textContent = 'Yuborilmoqda...'; }

        try {
            let res;
            if (asFile) {
                const data = new FormData(form);
                data.set('phone', phone);
                Object.entries(extra).forEach(([k, v]) => data.set(k, v));
                data.set('page', location.pathname);
                res = await fetch(endpoint, { method: 'POST', body: data });
            } else {
                const payload = { name, phone, page: location.pathname, ...extra };
                form.querySelectorAll('input, select, textarea').forEach(el => {
                    if (el.name && !(el.name in payload) && el.type !== 'file') payload[el.name] = el.value;
                });
                res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }

            const data = await res.json().catch(() => ({}));
            if (!res.ok || data.ok === false) throw new Error(data.error || 'Server javob bermadi');

            form.reset();
            showMessage(form, form.dataset.okText
                || 'Arizangiz qabul qilindi! Menejerimiz tez orada bog\'lanadi.', true);
            return true;
        } catch (err) {
            showMessage(form, 'Yuborishda xatolik: ' + err.message
                + '. Iltimos, ' + (CFG.phone || 'telefon') + ' raqamiga qo\'ng\'iroq qiling.', false);
            return false;
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = original; }
        }
    }

    // O'quvchi arizalari (CRM — "Ingliz tili" voronkasi)
    document.querySelectorAll('form[data-form="lead"]').forEach(form => {
        form.addEventListener('submit', e => {
            e.preventDefault();
            sendForm(form, CFG.leadEndpoint || '/api/ariza', {
                formName: form.dataset.formName || 'Sayt formasi',
            });
        });
    });

    // Vakansiya arizalari (HR Telegram kanali) — fayl bilan
    document.querySelectorAll('form[data-form="hr"]').forEach(form => {
        const fileInput = form.querySelector('input[type="file"]');
        const fileLabel = form.querySelector('[data-file-label]');
        if (fileInput && fileLabel) {
            fileInput.addEventListener('change', () => {
                const f = fileInput.files[0];
                fileLabel.textContent = f
                    ? `📎 ${f.name} (${Math.round(f.size / 1024)} KB)`
                    : '📎 CV faylini tanlash (PDF, DOCX — 8 MB gacha)';
            });
        }
        form.addEventListener('submit', e => {
            e.preventDefault();
            sendForm(form, CFG.hrEndpoint || '/api/vakansiya', {}, true);
        });
    });

    // ── 5. Daraja testi (kviz) ───────────────────────────────────────────────
    const quiz = document.getElementById('quiz');
    if (quiz) {
        const steps = [...quiz.querySelectorAll('.quiz__step')];
        const bar = quiz.querySelector('.quiz__bar i');
        const answers = {};
        let current = 0;

        function show(index) {
            current = index;
            steps.forEach((s, i) => s.classList.toggle('is-active', i === index));
            if (bar) bar.style.width = Math.round(((index + 1) / steps.length) * 100) + '%';
            const focusable = steps[index].querySelector('input, button');
            if (focusable && index > 0) focusable.focus({ preventScroll: true });
        }

        quiz.querySelectorAll('.opt input').forEach(input => {
            input.addEventListener('change', () => {
                answers[input.name] = input.dataset.label || input.value;
                // Javob tanlanishi bilan keyingi savolga o'tadi — ortiqcha bosish shart emas
                setTimeout(() => { if (current < steps.length - 1) show(current + 1); }, 180);
            });
        });

        quiz.querySelectorAll('.quiz__back').forEach(btn => {
            btn.addEventListener('click', () => show(Math.max(0, current - 1)));
        });

        const quizForm = quiz.querySelector('form');
        if (quizForm) {
            quizForm.addEventListener('submit', async e => {
                e.preventDefault();
                const note = [
                    answers.maqsad ? 'Maqsad: ' + answers.maqsad : '',
                    answers.daraja ? 'Daraja: ' + answers.daraja : '',
                    answers.vaqt ? 'Qulay vaqt: ' + answers.vaqt : '',
                ].filter(Boolean).join(' | ');

                const ok = await sendForm(quizForm, CFG.leadEndpoint || '/api/ariza', {
                    formName: 'Daraja testi',
                    note,
                    contactTime: answers.vaqt || '',
                });
                if (ok) {
                    const done = quiz.querySelector('.quiz__done');
                    if (done) { steps.forEach(s => s.classList.remove('is-active')); done.style.display = 'block'; if (bar) bar.style.width = '100%'; }
                }
            });
        }

        show(0);
    }

    // ── 6. Menyudagi faol bo'limni belgilash ─────────────────────────────────
    const sections = [...document.querySelectorAll('section[id]')];
    const navLinks = [...document.querySelectorAll('.nav a[href^="#"], .nav a[href*="#"]')];
    if (sections.length && navLinks.length && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const id = entry.target.id;
                navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href').endsWith('#' + id)));
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        sections.forEach(s => observer.observe(s));
    }
})();
