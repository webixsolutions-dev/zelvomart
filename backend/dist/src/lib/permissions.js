"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.can = can;
const permissions = {
    OWNER: ["orders.read", "orders.write", "orders.export", "products.write", "content.write", "customers.read", "customers.write", "settings.write", "users.write", "reports.read"],
    MANAGER: ["orders.read", "orders.write", "orders.export", "products.write", "content.write", "customers.read", "customers.write", "reports.read"],
    ORDER_AGENT: ["orders.read", "orders.write", "customers.read", "customers.write"],
    MARKETER: ["products.write", "content.write", "reports.read"],
};
function can(role, permission) {
    return permissions[role].includes(permission);
}
