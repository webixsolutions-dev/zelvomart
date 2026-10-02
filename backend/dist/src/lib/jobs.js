"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBoss = getBoss;
exports.dispatchJobRow = dispatchJobRow;
exports.enqueueJob = enqueueJob;
const pg_boss_1 = __importDefault(require("pg-boss"));
const db_1 = require("./db");
let boss = null;
async function getBoss() {
    if (!boss) {
        boss = new pg_boss_1.default({ connectionString: process.env.DATABASE_URL });
        boss.on("error", (error) => console.error("pg-boss", error));
        await boss.start();
    }
    return boss;
}
async function dispatchJobRow(jobId) {
    const row = await db_1.prisma.job.findUnique({ where: { id: jobId } });
    if (!row)
        throw new Error(`Job log ${jobId} not found`);
    const queue = await getBoss();
    const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
    const externalId = await queue.send(row.name, { ...payload, jobLogId: row.id, orderId: row.orderId }, { retryLimit: 5, retryDelay: 30, retryBackoff: true });
    await db_1.prisma.job.update({
        where: { id: row.id },
        data: { externalId: externalId || undefined, status: "QUEUED" },
    });
    return row;
}
async function enqueueJob(name, payload, orderId) {
    const row = await db_1.prisma.job.create({
        data: { name, payload: payload, orderId },
    });
    await dispatchJobRow(row.id);
    return row;
}
