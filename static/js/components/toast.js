/**
 * components/toast.js — всплывающие уведомления в правом нижнем углу.
 * Использование: toast('Сотрудник добавлен') / toast('Ошибка', 'error').
 */

import { el } from '../core/dom.js';

const AUTO_HIDE = 3500;

function layer() {
    return document.getElementById('toast-root');
}

export function toast(message, type = 'success', timeout = AUTO_HIDE) {
    const root = layer();
    if (!root) return;

    const node = el('div', { class: `toast toast-${type}`, role: 'status' }, [
        el('span', { text: message }),
        el('button', {
            class: 'toast-close',
            type: 'button',
            'aria-label': 'Закрыть',
            text: '×',
            onclick: () => hide(node),
        }),
    ]);

    root.append(node);

    // Автоскрытие; таймер снимаем, если закрыли вручную
    const timer = setTimeout(() => hide(node), timeout);
    node.addEventListener('remove', () => clearTimeout(timer), { once: true });

    return node;
}

function hide(node) {
    if (!node.isConnected) return;
    node.classList.add('is-leaving');
    node.addEventListener('animationend', () => node.remove(), { once: true });
    // fallback, если анимация отключена (prefers-reduced-motion)
    setTimeout(() => node.remove(), 400);
}

export const notify = {
    success: (message) => toast(message, 'success'),
    error: (message) => toast(message, 'error', 5000),
    info: (message) => toast(message, 'info'),
    warning: (message) => toast(message, 'warning', 4500),
};