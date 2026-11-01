/**
 * core/roles.js — реестр ролей доступа.
 * Базовые названия заданы локально (чтобы UI не ждал сеть),
 * кастомные роли администратора догружаются с сервера через setRoles().
 */

const registry = {
    admin: 'Администратор',
    manager: 'Менеджер',
    mechanic: 'Механик',
};

/** @param {Array<{value: string, label: string}>} roles */
export function setRoles(roles) {
    if (!Array.isArray(roles)) return;
    for (const role of roles) {
        if (role?.value && role?.label) registry[role.value] = role.label;
    }
}

export function roleLabel(code) {
    if (!code) return 'Пользователь';
    return registry[code] || code.replace(/_/g, ' ');
}

export function knownRoles() {
    return Object.entries(registry).map(([value, label]) => ({ value, label }));
}