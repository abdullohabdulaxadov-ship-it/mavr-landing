/* ============================================================================
   Mavr landing — statik server + arizalarni uzatish.
   Qo'shimcha npm paketi YO'Q (faqat Node 20+ standart kutubxonasi).

   Ishga tushirish:  node server.js       ->  http://localhost:4500

   Yo'llar:
     GET  /                    -> index.html
     GET  /2plus6              -> 2plus6/index.html
     GET  /vakansiyalar        -> vakansiyalar/index.html
     POST /api/ariza           -> CRM "Ingliz tili" voronkasiga lid
     POST /api/vakansiya       -> HR Telegram kanaliga rezyume
     GET  /api/health          -> holat
   ========================================================================= */
require('node:fs');
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

// ── .env (oddiy o'qish — dotenv paketi kerak emas) ──────────────────────────
(function loadEnv() {
    const file = path.join(__dirname, '.env');
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
        if (!m) continue;
        const value = m[2].trim().replace(/^["']|["']$/g, '');
        if (!(m[1] in process.env)) process.env[m[1]] = value;
    }
})();

const PORT = Number(process.env.PORT) || 4500;
const ROOT = __dirname;

// CRM (Mavriyat admin panel) — o'quvchi arizalari shu yerga tushadi
const CRM_URL = (process.env.CRM_URL || '').replace(/\/+$/, '');
const CRM_WEBHOOK_SECRET = process.env.CRM_WEBHOOK_SECRET || '';

// HR Telegram kanali — vakansiya arizalari shu yerga tushadi
const HR_BOT_TOKEN = process.env.HR_BOT_TOKEN || '';
const HR_CHAT_ID = process.env.HR_CHAT_ID || '';

// Tashqi xizmat sozlanmagan bo'lsa ariza yo'qolmasin — diskka yoziladi
const INBOX_DIR = path.join(ROOT, 'arizalar');

const MAX_BODY = 9 * 1024 * 1024;   // 9 MB (CV fayli bilan birga)

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
};

// ── Yordamchilar ────────────────────────────────────────────────────────────

function sendJson(res, code, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(code, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
    });
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', c => {
            size += c.length;
            if (size > MAX_BODY) { reject(new Error('Fayl yoki so\'rov hajmi juda katta (9 MB dan oshdi)')); req.destroy(); return; }
            chunks.push(c);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

// JSON ham, multipart ham qabul qilinadi (CV fayli multipart bilan keladi)
async function parsePayload(req) {
    const raw = await readBody(req);
    const type = String(req.headers['content-type'] || '');
    if (type.includes('application/json')) {
        return { fields: JSON.parse(raw.toString('utf8') || '{}'), file: null };
    }
    if (type.includes('multipart/form-data')) {
        const form = await new Response(raw, { headers: { 'content-type': type } }).formData();
        const fields = {};
        let file = null;
        for (const [key, value] of form.entries()) {
            if (typeof value === 'string') { fields[key] = value; continue; }
            if (value.size > 0) file = { name: value.name, type: value.type, bytes: Buffer.from(await value.arrayBuffer()) };
        }
        return { fields, file };
    }
    return { fields: Object.fromEntries(new URLSearchParams(raw.toString('utf8'))), file: null };
}

function normalizePhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    if (!digits) return '';
    if (digits.length === 9) return '+998' + digits;
    if (digits.length === 12 && digits.startsWith('998')) return '+' + digits;
    return '+' + digits;
}

function clean(value, max = 300) {
    return String(value || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
}

// Ariza diskka yoziladi (zaxira nusxa — tashqi xizmat ishlamay qolsa ham yo'qolmaydi)
async function saveToInbox(kind, data, file) {
    await fsp.mkdir(INBOX_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = path.join(INBOX_DIR, `${stamp}-${kind}`);
    await fsp.writeFile(base + '.json', JSON.stringify(data, null, 2), 'utf8');
    if (file) await fsp.writeFile(base + '-' + file.name.replace(/[^\w.\-]/g, '_'), file.bytes);
    return base;
}

// ── 1. O'quvchi arizasi -> CRM "Ingliz tili" voronkasi ──────────────────────

async function handleAriza(req, res) {
    let fields;
    try {
        ({ fields } = await parsePayload(req));
    } catch (err) {
        return sendJson(res, 400, { ok: false, error: err.message });
    }

    const name = clean(fields.name, 80);
    const phone = normalizePhone(fields.phone);
    if (!name || !phone) return sendJson(res, 400, { ok: false, error: 'Ism va telefon raqami kerak' });

    // Menejer qo'ng'iroq qilishdan oldin ko'radigan izoh
    const note = [
        fields.formName ? 'Forma: ' + clean(fields.formName, 60) : '',
        fields.page ? 'Sahifa: ' + clean(fields.page, 40) : '',
        fields.daraja ? 'Daraja: ' + clean(fields.daraja, 40) : '',
        clean(fields.note, 200),
    ].filter(Boolean).join(' | ');

    const lead = {
        name,
        phone,
        language: 'english',            // barcha o'quvchi arizalari — "Ingliz tili" voronkasiga
        source: 'organik',              // sayt (mavr.uz) — organik lid
        contactTime: clean(fields.contactTime, 40),
        note,
        externalId: 'mavr_' + Date.now().toString(36),
    };

    if (!CRM_URL || !CRM_WEBHOOK_SECRET) {
        const saved = await saveToInbox('lid', lead, null);
        console.warn('[ariza] CRM sozlanmagan (CRM_URL / CRM_WEBHOOK_SECRET) — diskka saqlandi:', saved + '.json');
        return sendJson(res, 200, { ok: true, saved: true });
    }

    try {
        const crmRes = await fetch(CRM_URL + '/api/leads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': CRM_WEBHOOK_SECRET },
            body: JSON.stringify(lead),
            signal: AbortSignal.timeout(12000),
        });
        const data = await crmRes.json().catch(() => ({}));
        if (!crmRes.ok) throw new Error(data.error || 'CRM javobi: ' + crmRes.status);
        console.log(`[ariza] CRM'ga yuborildi  ism="${name}" tel=${phone} id=${data.id || '-'}`);
        return sendJson(res, 200, { ok: true, id: data.id || null });
    } catch (err) {
        // Lid hech qachon yo'qolmasligi kerak — xatoda ham diskka yoziladi
        const saved = await saveToInbox('lid', { ...lead, xato: err.message }, null);
        console.error('[ariza] CRM XATO:', err.message, '— diskka saqlandi:', saved + '.json');
        return sendJson(res, 200, { ok: true, saved: true });
    }
}

// ── 2. Vakansiya arizasi -> HR Telegram kanali ──────────────────────────────

async function handleVakansiya(req, res) {
    let fields, file;
    try {
        ({ fields, file } = await parsePayload(req));
    } catch (err) {
        return sendJson(res, 400, { ok: false, error: err.message });
    }

    const name = clean(fields.name, 80);
    const phone = normalizePhone(fields.phone);
    if (!name || !phone) return sendJson(res, 400, { ok: false, error: 'Ism va telefon raqami kerak' });

    const application = {
        name,
        phone,
        telegram: clean(fields.telegram, 60),
        vakansiya: clean(fields.vakansiya, 40) || 'Ko\'rsatilmagan',
        cvLink: clean(fields.cvLink, 300),
        page: clean(fields.page, 40),
        sana: new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }),
    };

    const text = [
        '🧑‍💼 <b>Yangi vakansiya arizasi</b>',
        '',
        `<b>Ism:</b> ${application.name}`,
        `<b>Telefon:</b> ${application.phone}`,
        application.telegram ? `<b>Telegram:</b> ${application.telegram}` : '',
        `<b>Vakansiya:</b> ${application.vakansiya}`,
        application.cvLink ? `<b>CV havolasi:</b> ${application.cvLink}` : '',
        file ? `<b>CV fayli:</b> ${file.name}` : '',
        '',
        `<i>${application.sana} · mavr.uz/vakansiyalar</i>`,
    ].filter(Boolean).join('\n');

    // Zaxira nusxa har doim saqlanadi — Telegram ishlamay qolsa ham ariza qoladi
    await saveToInbox('vakansiya', application, file).catch(() => {});

    if (!HR_BOT_TOKEN || !HR_CHAT_ID) {
        console.warn('[vakansiya] HR Telegram sozlanmagan (HR_BOT_TOKEN / HR_CHAT_ID) — faqat diskka saqlandi');
        return sendJson(res, 200, { ok: true, saved: true });
    }

    try {
        const api = `https://api.telegram.org/bot${HR_BOT_TOKEN}/`;
        if (file) {
            const form = new FormData();
            form.set('chat_id', HR_CHAT_ID);
            form.set('caption', text.slice(0, 1000));
            form.set('parse_mode', 'HTML');
            form.set('document', new File([file.bytes], file.name, { type: file.type || 'application/octet-stream' }));
            const r = await fetch(api + 'sendDocument', { method: 'POST', body: form, signal: AbortSignal.timeout(20000) });
            if (!r.ok) throw new Error('Telegram sendDocument: ' + r.status);
        } else {
            const r = await fetch(api + 'sendMessage', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: HR_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
                signal: AbortSignal.timeout(12000),
            });
            if (!r.ok) throw new Error('Telegram sendMessage: ' + r.status);
        }
        console.log(`[vakansiya] HR kanaliga yuborildi  ism="${name}" yo'nalish=${application.vakansiya}`);
        return sendJson(res, 200, { ok: true });
    } catch (err) {
        console.error('[vakansiya] TELEGRAM XATO:', err.message, '— ariza diskda saqlangan');
        return sendJson(res, 200, { ok: true, saved: true });
    }
}

// ── 3. Statik fayllar ───────────────────────────────────────────────────────

function serveStatic(req, res, urlPath) {
    let rel = decodeURIComponent(urlPath);
    if (rel.endsWith('/')) rel += 'index.html';

    let file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end('Ruxsat yo\'q'); return; }

    // "Toza" manzillar: /2plus6 -> /2plus6/index.html
    if (!path.extname(file)) {
        if (fs.existsSync(path.join(file, 'index.html'))) file = path.join(file, 'index.html');
        else if (fs.existsSync(file + '.html')) file += '.html';
    }
    // Ichki fayllar tashqariga ochilmaydi
    if (/(^|[\\/])(server\.js|\.env|arizalar|README\.md|package\.json)([\\/]|$)/i.test(path.relative(ROOT, file))) {
        res.writeHead(404).end('Topilmadi');
        return;
    }

    fs.readFile(file, (err, buf) => {
        if (err) {
            fs.readFile(path.join(ROOT, '404.html'), (e2, page) => {
                res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(e2 ? '<h1>404</h1>' : page);
            });
            return;
        }
        const ext = path.extname(file).toLowerCase();
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            // CSS/JS tez-tez yangilanadi — brauzer eski nusxada qolib ketmasin
            // (ETag orqali tekshiradi, keshsiz emas). Rasm/shrift esa uzoq keshlanadi.
            'Cache-Control': /.(html|css|js)$/.test(ext) ? 'no-cache' : 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
        });
        res.end(buf);
    });
}

// ── Server ──────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/api/health') {
        return sendJson(res, 200, {
            status: 'ok',
            service: 'Mavr landing',
            crm: Boolean(CRM_URL && CRM_WEBHOOK_SECRET),
            hrTelegram: Boolean(HR_BOT_TOKEN && HR_CHAT_ID),
        });
    }
    if (url.pathname === '/api/ariza' && req.method === 'POST') return handleAriza(req, res);
    if (url.pathname === '/api/vakansiya' && req.method === 'POST') return handleVakansiya(req, res);
    if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { ok: false, error: 'Topilmadi' });

    return serveStatic(req, res, url.pathname);
});

if (!CRM_URL || !CRM_WEBHOOK_SECRET) {
    console.warn('[mavr] OGOHLANTIRISH: CRM_URL/CRM_WEBHOOK_SECRET yo\'q — o\'quvchi arizalari faqat "arizalar/" papkasiga yoziladi.');
}
if (!HR_BOT_TOKEN || !HR_CHAT_ID) {
    console.warn('[mavr] OGOHLANTIRISH: HR_BOT_TOKEN/HR_CHAT_ID yo\'q — vakansiya arizalari faqat "arizalar/" papkasiga yoziladi.');
}

server.listen(PORT, () => console.log(`Mavr landing: http://localhost:${PORT}`));
