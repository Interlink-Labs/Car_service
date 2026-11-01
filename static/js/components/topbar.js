/**
 * components/topbar.js — шапка: заголовок текущего раздела, поиск, тема, профиль.
 */

import { el, mount, initials } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { store } from '../core/store.js';
import { currentRoute, onRouteChange, navigate } from '../core/router.js';
import { roleLabel } from '../core/roles.js';
import { toggleSidebar } from './sidebar.js';
import { notify } from './toast.js';

export function renderTopbar(root, { onLogout } = {}) {
    if (!root) return;

    const route = currentRoute() || {};
    const user = store.user || { username: 'guest' };
    const displayName = user.name || user.username;

    const searchInput = el('input', {
        type: 'search',
        placeholder: 'Поиск: сотрудник, роль…',
        'aria-label': 'Поиск по системе',
        onkeydown: (event) => {
            if (event.key !== 'Enter') return;
            const query = searchInput.value.trim();
            if (!query) return;
            // Глобальный поиск ведёт в раздел сотрудников с готовым фильтром
            navigate('/workers', { q: query });
        },
    });

    mount(root, [
        el('button', {
            class: 'icon-btn sidebar-toggle',
            type: 'button',
            'aria-label': 'Открыть меню',
            'data-sidebar-toggle': 'true',
            onclick: toggleSidebar,
        }, [icon('menu', { size: 18 })]),

        el('div', { class: 'topbar-titles' }, [
            el('div', { class: 'topbar-title', text: route.title || 'Панель управления' }),
            el('div', { class: 'topbar-crumb', text: route.crumb || 'Автосервис' }),
        ]),

        el('div', { class: 'topbar-actions' }, [
            el('div', { class: 'topbar-search' }, [icon('search', { size: 16 }), searchInput]),

            el('button', {
                class: 'icon-btn',
                type: 'button',
                'aria-label': 'Переключить тему',
                title: 'Светлая / тёмная тема',
                onclick: () => {
                    store.toggleTheme();
                    // Перерисовываем иконку под текущую тему
                    renderTopbar(root, { onLogout });
                },
            }, [icon(store.theme === 'dark' ? 'sun' : 'moon', { size: 18 })]),

            el('div', { class: 'user-chip', title: displayName }, [
                el('div', { class: 'user-chip-info' }, [
                    el('span', { class: 'user-chip-name', text: displayName }),
                    el('span', { class: 'user-chip-role', text: roleLabel(user.role) }),
                ]),
                el('div', { class: 'avatar', text: initials(displayName) }),
            ]),

            el('button', {
                class: 'icon-btn',
                type: 'button',
                'aria-label': 'Выйти',
                title: 'Выйти из системы',
                onclick: async () => {
                    if (typeof onLogout === 'function') await onLogout();
                    else notify.info('Вы вышли из системы');
                },
            }, [icon('logout', { size: 18 })]),
        ]),
    ]);
}

export function initTopbar(root, options = {}) {
    renderTopbar(root, options);

    return onRouteChange(() => renderTopbar(root, options));
}