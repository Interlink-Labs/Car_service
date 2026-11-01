/**
 * components/sidebar.js — навигация по модулям системы.
 * Пункты с available: false помечены как «скоро»: их подключим по мере готовности
 * details_dir / services_dir / requests_dir.
 */

import { el, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { currentPath, onRouteChange } from '../core/router.js';

const NAV = [
    {
        label: 'Рабочее пространство',
        items: [
            { path: '/dashboard', label: 'Главный экран', icon: 'dashboard', available: true },
            { path: '/workers', label: 'Сотрудники', icon: 'users', available: true },
        ],
    },
    {
        label: 'Учёт',
        items: [
            { path: '/cars', label: 'Автомобили', icon: 'car', available: true },
            { path: '/clients', label: 'Клиенты', icon: 'client', available: true },
        ],
    },
    {
        label: 'Модули (в разработке)',
        items: [
            { path: '/requests', label: 'Заявки', icon: 'request', available: false },
            { path: '/details', label: 'Детали', icon: 'detail', available: false },
            { path: '/services', label: 'Услуги', icon: 'service', available: false },
            { path: '/reports', label: 'Отчёты', icon: 'report', available: false },
        ],
    },
];

function navLink(item, activePath) {
    const isActive = activePath === item.path;

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

        ...NAV.map((group) =>
            el('nav', { class: 'nav-group', 'aria-label': group.label }, [
                el('span', { class: 'nav-group-label', text: group.label }),
                ...group.items.map((item) => navLink(item, activePath)),
            ]),
        ),

        el('div', { class: 'sidebar-footer' }, [
            el('div', { class: 'sidebar-hint' }, [
                icon('shield', { size: 16 }),
                el('div', {}, [
                    el('strong', { text: 'Доступ по ролям' }),
                    'Механик, менеджер и администратор видят разные разделы.',
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