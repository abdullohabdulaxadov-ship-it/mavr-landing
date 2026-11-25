# Mavr — landing sahifalar (mavr.uz)

Uchta sahifadan iborat sayt. Build kerak emas — sof HTML, CSS va vanilla JS,
hech qanday npm paketi ishlatilmaydi.

```
mavr.uz/                 → Standart ingliz tili kursi (400 000 so'm) + sinov darsi
mavr.uz/2plus6/          → "2+6" maxsus loyihasi (600 000 so'm)
mavr.uz/vakansiyalar/    → Karyera va kadrlar arizasi
```

## Ishga tushirish

```bash
node server.js
```

Brauzer: [http://localhost:4500](http://localhost:4500)

Sozlamalar uchun `.env.example` dan nusxa oling:

```bash
cp .env.example .env
```

## Tuzilma

```
mavr-landing/
├── index.html              # 1-sahifa: standart ingliz tili kursi
├── 2plus6/index.html       # 2-sahifa: "2+6" loyihasi
├── vakansiyalar/index.html # 3-sahifa: vakansiyalar va HR ariza
├── 404.html
├── server.js               # statik server + arizalarni uzatish (paketlarsiz)
├── assets/
│   ├── css/styles.css      # butun dizayn tizimi (CSS o'zgaruvchilari)
│   ├── js/config.js        # ⚙️ TAHRIRLANADI: telefon, manzil, xarita
│   └── js/app.js           # menyu, daraja testi, formalar
└── arizalar/               # zaxira nusxalar (git'ga tushmaydi)
```

## ⚠️ To'ldirilishi kerak

`assets/js/config.js` faylida hozircha vaqtinchalik qiymatlar turibdi:

| Maydon | Nima yoziladi |
|---|---|
| `phone` / `phoneHref` | Markazning haqiqiy telefon raqami |
| `telegram`, `instagram` | Ijtimoiy tarmoq havolalari |
| `address`, `addressHint` | Markaz manzili va mo'ljal |
| `workHours` | Ish vaqti |
| `mapEmbed` | Google Maps → "Share → Embed a map" dagi `src` havolasi |

Bosh sahifadagi **Natijalar** bo'limida o'quvchilarning haqiqiy video/sharhlari
uchun joy ajratilgan (`index.html` ichida izoh sifatida namuna kartochka bor).
Hozircha faqat raqamlar ko'rsatilmoqda — o'ylab topilgan sharhlar qo'yilmadi.

## Arizalar qayerga tushadi

### 1. O'quvchi arizalari → CRM "Ingliz tili" voronkasi

Bosh sahifadagi va 2+6 sahifasidagi **barcha** formalar (hero formasi, daraja
testi, pastdagi yozilish formasi) `POST /api/ariza` ga boradi. Server esa uni
CRM'ning `/api/leads` webhookiga uzatadi:

```
language = english     → CRM'dagi "Ingliz tili" voronkasi
source   = organik     → "Organik" manba
status   = yangi-lidlar → "Yangi lidlar" ustuni
```

Daraja testining javoblari (maqsad, daraja, qulay vaqt) lidga **izoh** sifatida
qo'shiladi — menejer qo'ng'iroq qilishdan oldin ko'radi.

`.env` da sozlanadi:

```
CRM_URL=https://crm.mavr.uz
CRM_WEBHOOK_SECRET=<CRM'ning .env faylidagi LEADS_WEBHOOK_SECRET>
```

> Maxfiy kalit faqat serverda turadi — brauzerga hech qachon chiqmaydi.

### 2. Vakansiya arizalari → HR Telegram kanali

`mavr.uz/vakansiyalar` dagi formalar `POST /api/vakansiya` ga boradi va
to'g'ridan-to'g'ri **alohida** Telegram kanaliga yuboriladi — sotuv lidlari bilan
aralashmaydi. CV fayli ham fayl sifatida yuboriladi (8 MB gacha).

```
HR_BOT_TOKEN=<@BotFather dan olingan token>
HR_CHAT_ID=<kanal ID si, masalan -1001234567890>
```

Botni kanalga **admin** qilib qo'shish kerak, aks holda Telegram xabar
yubormaydi.

### Ariza yo'qolmaydi

CRM yoki Telegram javob bermasa ham ariza `arizalar/` papkasiga JSON bo'lib
saqlanadi (CV fayli bilan birga). Foydalanuvchi doim "qabul qilindi" javobini
oladi.

## Deploy

**A) Statik hosting (Netlify, Cloudflare Pages, Vercel)** — sahifalar shundoq
ishlaydi, lekin `server.js` ishlamaydi. Bu holda formalar uchun endpoint
kerak: `assets/js/config.js` dagi `leadEndpoint` / `hrEndpoint` ni ishlaydigan
manzilga (masalan CRM domenidagi funksiya) o'zgartiring.

**B) Node bilan (tavsiya etiladi)** — `node server.js`, oldiga Nginx yoki
Cloudflare tunnel. Formalar tayyor holda ishlaydi, kalitlar yashirin qoladi.

Nginx uchun namuna:

```nginx
server {
    server_name mavr.uz;
    location / { proxy_pass http://127.0.0.1:4500; }
}
```

## Dizayn tizimi

Ranglar `assets/css/styles.css` boshidagi `:root` da:

```css
--navy: #0B132B;    /* to'q ko'k — matn va footer */
--cobalt: #1E56B3;  /* asosiy urg'u rangi, tugmalar */
--bg: #F6F8FC;      /* och fon */
```

Shrift — Inter. Logotip `assets/img/` da (CRM bilan bir xil fayllar).
