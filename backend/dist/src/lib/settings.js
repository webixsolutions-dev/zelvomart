"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSetting = getSetting;
exports.setSetting = setSetting;
exports.getSettings = getSettings;
const db_1 = require("./db");
async function getSetting(key, fallback) {
    const row = await db_1.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? fallback;
}
async function setSetting(key, value) {
    return db_1.prisma.setting.upsert({
        where: { key },
        update: { value: value },
        create: { key, value: value },
    });
}
async function getSettings(keys) {
    const rows = await db_1.prisma.setting.findMany({ where: { key: { in: keys } } });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
