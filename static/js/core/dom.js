/**
 * core/dom.js — минимальный набор хелперов для построения DOM без innerHTML-склейки.
 * Всё через textContent → XSS-безопасно по умолчанию.
 */

export const qs = (selector, root = document) => root.querySelector(selector);
export const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];

/**
 * Создать элемент.
 * @param {string} tag
 * @param {object} props  class | text | html | dataset | style | on*() | любые атрибуты
 * @param {Array} children строки и узлы
 */
export function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);

    for (const [key, value] of Object.entries(props)) {
        if (value === null || value === undefined || value === false) continue;

        if (key === 'class') node.className = value;
        else if (key === 'text') node.textContent = value;
        else if (key === 'html') node.innerHTML = value;
        else if (key === 'dataset') Object.assign(node.dataset, value);
        else if (key === 'style') Object.assign(node.style, value);
        else if (key.startsWith('on') && typeof value === 'function') {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key in node && key !== 'list' && key !== 'form') {
            node[key] = value;
        } else {
            node.setAttribute(key, value === true ? '' : value);
        }
    }

    appendChildren(node, children);
    return node;
}

export function appendChildren(node, children) {
    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
}

export function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
}

/** Заменить содержимое контейнера. */
export function mount(container, children) {
    clear(container);
    appendChildren(container, children);
    return container;
}

/** Экранирование для мест, где без строки не обойтись. */
export function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
}

/**
 * Делегирование события: один обработчик на контейнер вместо N на строки таблицы.
 * Селектор ищется вверх от target — работает и на вложенных иконках.
 */
export function delegate(root, eventName, selector, handler) {
    root.addEventListener(eventName, (event) => {
        const target = event.target.closest(selector);
        if (target && root.contains(target)) handler(event, target);
    });
}

/** Отложенный вызов с отменой предыдущего — для поиска по вводу. */
export function debounce(fn, delay = 250) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

/** Инициалы для аватара: «Иванов Иван» → «ИИ». */
export function initials(name = '') {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0] || '')
        .join('')
        .toUpperCase();
}

/** Склонение: plural(5, ['сотрудник', 'сотрудника', 'сотрудников']). */
export function plural(count, forms) {
    const n = Math.abs(count) % 100;
    const n1 = n % 10;
    if (n > 10 && n < 20) return forms[2];
    if (n1 > 1 && n1 < 5) return forms[1];
    if (n1 === 1) return forms[0];
    return forms[2];
}