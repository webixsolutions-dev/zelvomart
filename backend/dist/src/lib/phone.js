"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePakistanPhone = normalizePakistanPhone;
function normalizePakistanPhone(input) {
    const raw = input.replace(/[^0-9+]/g, "");
    let digits = raw.replace(/\D/g, "");
    if (digits.startsWith("0092"))
        digits = digits.slice(2);
    if (digits.startsWith("03") && digits.length === 11)
        digits = `92${digits.slice(1)}`;
    if (digits.startsWith("3") && digits.length === 10)
        digits = `92${digits}`;
    if (!/^923\d{9}$/.test(digits))
        return null;
    return `+${digits}`;
}
