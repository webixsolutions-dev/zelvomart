"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.money = money;
exports.percentageOff = percentageOff;
function money(value) {
    const amount = Number(value ?? 0);
    return new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        maximumFractionDigits: 0,
    }).format(amount);
}
function percentageOff(regular, sale) {
    if (!sale || sale >= regular || regular <= 0)
        return 0;
    return Math.round(((regular - sale) / regular) * 100);
}
