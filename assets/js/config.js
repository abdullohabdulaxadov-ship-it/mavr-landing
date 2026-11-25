/* ============================================================================
   Mavr — sayt sozlamalari.  ⚠️ SHU FAYLNI TAHRIRLANG.
   Boshqa fayllarga tegmasdan aloqa ma'lumotlarini va manzilni o'zgartirasiz.
   ========================================================================= */
window.MAVR_CONFIG = {
    // ── Aloqa ────────────────────────────────────────────────────────────────
    // TODO: haqiqiy raqamni qo'ying
    phone: '+998 90 000 00 00',
    phoneHref: '+998900000000',
    telegram: 'https://t.me/mavruz',        // TODO
    instagram: 'https://instagram.com/mavr.uz', // TODO

    // ── Manzil ───────────────────────────────────────────────────────────────
    // TODO: markazning haqiqiy manzili
    address: "Toshkent sh., (ko'cha nomi), (uy raqami)",
    addressHint: "Mo'ljal: (yaqin bekat yoki bino nomi)",
    workHours: 'Dushanba – Shanba: 09:00 – 19:00',
    // Google Maps'dan "Share → Embed a map" orqali olingan iframe manzili.
    // Bo'sh qoldirilsa — o'rniga chiroyli placeholder ko'rinadi.
    mapEmbed: '',

    // ── Arizalar qayerga ketadi ─────────────────────────────────────────────
    // O'quvchi arizalari (bosh sahifa va 2+6) — CRM'ning "Ingliz tili" voronkasiga.
    // Standart holatda saytning o'z serveri (server.js) orqali yuboriladi:
    // maxfiy kalit brauzerga chiqmaydi.
    leadEndpoint: '/api/ariza',
    // Vakansiya arizalari — HR Telegram kanaliga.
    hrEndpoint: '/api/vakansiya',
};
