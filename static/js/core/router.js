/**
 * core/router.js — hash-роутер без зависимостей.
 *
 * Маршрут описывается как:
 *   registerRoute('/workers', { title, crumb, render: (ctx) => cleanupFn })
 *
 * render вызывается с { container, route }, может вернуть функцию очистки
 * (снять таймеры, отписаться от событий) — она вызовется при уходе со страницы.
 */

import { mount, el } from './dom.js';

const routes = new Map();
const listeners = new Set();

let container = null;
let currentCleanup = null;
let activeRoute = null;

export function registerRoute(path, config) {
    routes.set(path, config);
}

/** Разобрать hash: '#/workers?q=ivan' → { path: '/workers', params: URLSearchParams } */
function parseHash() {
    const raw = window.location.hash.replace(/^#/, '') || '/';
    const [pathPart, queryPart = ''] = raw.split('?');
    return {
        path: pathPart.replace(/\/+$/, '') || '/',
        params: new URLSearchParams(queryPart),
    };
}

export function currentPath() {
    return parseHash().path;
}

export function currentParams() {
    return parseHash().params;
}

export function currentRoute() {
    return activeRoute;
}

/**
 * Перейти на маршрут.
 * @param {string} path
 * @param {Record<string, string>} [params]  попадут в hash как query-строка
 */
export function navigate(path, params) {
    const query = params ? new URLSearchParams(params).toString() : '';
    const hash = query ? `${path}?${query}` : path;

    if (window.location.hash.replace(/^#/, '') === hash) {
        render();
        return;
    }
    window.location.hash = hash;
}

export function onRouteChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function notFoundView() {
    return el('div', { class: 'card card-body empty-state' }, [
        el('h4', { text: 'Раздел не найден' }),
        el('p', { text: 'Возможно, модуль ещё не подключён. Вернитесь на главный экран.' }),
        el('a', { class: 'btn btn-primary', href: '#/dashboard', text: 'На главную' }),
    ]);
}

async function render() {
    if (!container) return;

    // 1. Очистка предыдущей страницы
    if (typeof currentCleanup === 'function') {
        try {
            currentCleanup();
        } catch (error) {
            console.error('Ошибка очистки страницы:', error);
        }
    }
    currentCleanup = null;

    // 2. Определение маршрута (поддерживаем '/workers' и '/workers/')
    const { path, params } = parseHash();
    const route = routes.get(path);

    // Неизвестный маршрут — честный экран «раздел в разработке»,
    // а не молчаливый фолбэк на главный экран
    if (!route) {
        if (typeof currentCleanup === 'function') currentCleanup();
        currentCleanup = null;
        activeRoute = { path, params };
        for (const listener of listeners) listener(activeRoute);
        mount(container, notFoundView());
        return;
    }

    activeRoute = { path, params, ...route };

    // 3. Уведомляем подписчиков (топбар, сайдбар)
    for (const listener of listeners) listener(activeRoute);

    // 4. Рендер
    try {
        const result = await route.render({ container, route: activeRoute, params });
        if (typeof result === 'function') currentCleanup = result;
    } catch (error) {
        console.error('Ошибка рендера маршрута:', error);
        mount(container, notFoundView());
    }
}

export function startRouter({ root }) {
    container = root;

    window.addEventListener('hashchange', render);

    if (!window.location.hash) {
        // replace: не засоряем историю первой загрузкой
        window.history.replaceState(null, '', '#/dashboard');
    }

    return render();
}

export function rerender() {
    return render();
}