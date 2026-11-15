/**
 * components/sidebar.js — навигация по модулям системы.
 * Пункты с available: false помечены как «скоро»: их подключим по мере готовности
 * details_dir / services_dir / requests_dir.
 */

import { el, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { currentPath, onRouteChange } from '../core/router.js';
import { store } from '../core/store.js';
import { roleLabel } from '../core/roles.js';

const NAV = [
    {
        label: 'Рабочее пространство',
        items: [
            { path: '/dashboard', label: 'Главный экран', icon: 'dashboard', available: true },
            { path: '/workers', label: 'Сотрудники', icon: 'users', available: true, roles: ['admin', 'manager'] },
        ],
    },
    {
        label: 'Учёт',
        items: [
            { path: '/cars', label: 'Автомобили', icon: 'car', available: true, roles: ['admin', 'manager', 'mechanic'] },
            { path: '/clients', label: 'Клиенты', icon: 'client', available: true, roles: ['admin', 'manager'] },
        ],
    },
    {
        label: 'Администрирование',
        items: [
            { path: '/accounts', label: 'Доступы', icon: 'shield', available: true, adminOnly: true },
        ],
    },
    {
        label: 'Рабочие модули',
        items: [
            { path: '/requests', label: 'Заявки', icon: 'request', available: true, roles: ['admin', 'manager', 'mechanic', 'user'] },
            { path: '/details', label: 'Детали', icon: 'detail', available: true, roles: ['admin', 'manager', 'mechanic'] },
            { path: '/services', label: 'Услуги', icon: 'service', available: true, roles: ['admin', 'manager', 'mechanic'] },
            { path: '/reports', label: 'Отчёты', icon: 'report', available: true, roles: ['admin'] },
        ],
    },
];

function navLink(item, activePath) {
    const isActive = activePath === item.path;
    const allowed = !item.roles || item.roles.includes(store.user?.role);
    if (!allowed) return null;

    if (!item.available) {
        return el(
            'span',
            { class: 'nav-link is-disabled', title: 'Модуль ещё не подключён' },
            [icon(item.icon, { size: 18 }), el('span', { text: item.label }), el('span', { class: 'nav-badge', text: 'скоро' })],
        );
    }

    return el(
        'a',
        {
            class: `nav-link${isActive ? ' is-active' : ''}`,
            href: `#${item.path}`,
            'aria-current': isActive ? 'page' : null,
            onclick: () => closeSidebar(),
        },
        [icon(item.icon, { size: 18 }), el('span', { text: item.label })],
    );
}

export function renderSidebar(root, { activePath = currentPath() } = {}) {
    if (!root) return;

    mount(root, [
        el('div', { class: 'brand' }, [
            el('div', { class: 'brand-mark' }, [icon('wrench', { size: 20 })]),
            el('div', { class: 'brand-text' }, [
                el('span', { class: 'brand-title', text: 'Автосервис' }),
                el('span', { class: 'brand-subtitle', text: 'Interlink-Labs' }),
            ]),
        ]),

        // Разделы «только для администратора» не показываем остальным ролям
        ...NAV.map((group) => {
            const items = group.items.filter((item) => (!item.adminOnly || store.user?.role === 'admin') && (!item.roles || item.roles.includes(store.user?.role)));
            if (!items.length) return null;

            return el('nav', { class: 'nav-group', 'aria-label': group.label }, [
                el('span', { class: 'nav-group-label', text: group.label }),
                ...items.map((item) => navLink(item, activePath)),
            ]);
        }).filter(Boolean),

        el('div', { class: 'sidebar-footer' }, [
            el('div', { class: 'sidebar-hint' }, [
                icon('shield', { size: 16 }),
                el('div', {}, [
                    el('strong', { text: 'Доступ по ролям' }),
                    'Содержимое рабочего пространства зависит от вашей роли.',
                ]),
            ]),
        ]),
    ]);
}

export function initSidebar(root) {
    renderSidebar(root);

    const unsubscribe = onRouteChange((route) => {
        renderSidebar(root, { activePath: route.path });
        closeSidebar();
    });

    // Клик по затемнению закрывает мобильный сайдбар
    document.addEventListener('click', (event) => {
        const shell = document.getElementById('app');
        if (shell?.dataset.sidebar !== 'open') return;
        if (event.target.closest('#sidebar-root') || event.target.closest('[data-sidebar-toggle]')) return;
        closeSidebar();
    });

    return unsubscribe;
}

export function toggleSidebar() {
    const shell = document.getElementById('app');
    if (!shell) return;
    shell.dataset.sidebar = shell.dataset.sidebar === 'open' ? 'closed' : 'open';
}

export function closeSidebar() {
    const shell = document.getElementById('app');
    if (shell) shell.dataset.sidebar = 'closed';
}