/**
 * pages/dashboard.js — главный экран.
 * Собирает KPI по сотрудникам, показывает готовые модули и последние записи.
 */

import { el, mount, initials, plural } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { createStatCard, setStatValue } from '../components/stat-card.js';
import { workersApi, clientsApi, carsApi } from '../core/api.js';
import { store } from '../core/store.js';
import { navigate } from '../core/router.js';
import { roleLabel } from '../core/roles.js';
import { notify } from '../components/toast.js';

/** Модули системы из ТЗ. available=false → плашка «скоро». */
const MODULES = [
    { path: '/cars', name: 'Автомобили', desc: 'База авто, поиск по VIN и госномеру', icon: 'car' },
    { path: '/clients', name: 'Клиенты', desc: 'Карточки клиентов и история обращений', icon: 'client' },
    { path: '/requests', name: 'Заявки', desc: 'Приём, статусы, история работ', icon: 'request' },
    { path: '/details', name: 'Детали', desc: 'Каталог и проверка совместимости', icon: 'detail' },
    { path: '/services', name: 'Услуги', desc: 'Прайс работ и нормативы', icon: 'service' },
    { path: '/reports', name: 'Отчёты', desc: 'Выручка, загрузка, история авто', icon: 'report' },
];

function greeting() {
    const hour = new Date().getHours();
    if (hour < 6) return 'Доброй ночи';
    if (hour < 12) return 'Доброе утро';
    if (hour < 18) return 'Добрый день';
    return 'Добрый вечер';
}

function todayLabel() {
    return new Date().toLocaleDateString('ru-RU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    });
}

function renderHero() {
    const user = store.user || {};
    const name = (user.name || user.username || '').split(' ')[0];

    return el('section', { class: 'hero' }, [
        el('div', { class: 'hero-text' }, [
            el('span', { class: 'hero-eyebrow' }, [
                icon('clock', { size: 12 }),
                todayLabel(),
            ]),
            el('h1', {
                class: 'hero-title',
                text: `${greeting()}${name ? `, ${name}` : ''}`,
            }),
            el('p', {
                class: 'hero-subtitle',
                text: 'Панель автосервиса: сотрудники, автомобили, заявки и расчёты — в одном месте. Подключённые модули доступны сразу, остальные появятся по мере готовности.',
            }),
        ]),
        el('div', { class: 'hero-actions' }, [
            el('button', {
                class: 'btn btn-primary',
                type: 'button',
                onclick: () => navigate('/workers'),
            }, [icon('plus', { size: 16 }), 'Управление сотрудниками']),
            el('a', { class: 'btn btn-ghost', href: '/docs', target: '_blank', rel: 'noreferrer' }, [
                icon('report', { size: 16 }), 'API-документация',
            ]),
        ]),
    ]);
}

function renderModules() {
    return el('section', { class: 'card' }, [
        el('div', { class: 'card-header' }, [
            el('div', {}, [
                el('div', { class: 'card-title', text: 'Модули системы' }),
                el('div', { class: 'card-subtitle', text: 'Готовность разделов по ТЗ' }),
            ]),
        ]),
        el('div', { class: 'module-grid' }, MODULES.map((module) => {
            const isReady = module.path === '/cars' || module.path === '/clients';

            return el(isReady ? 'a' : 'div', {
                class: `module-card${isReady ? ' is-active' : ' is-soon'}`,
                href: isReady ? `#${module.path}` : null,
                role: isReady ? null : 'presentation',
            }, [
                icon(module.icon, { size: 20 }),
                el('span', { class: 'module-name', text: module.name }),
                el('span', { class: 'module-desc', text: module.desc }),
                el('span', { class: 'module-status', text: isReady ? 'доступно' : 'скоро' }),
            ]);
        })),
    ]);
}

function recentSkeleton() {
    return el('div', { class: 'recent-list' }, [1, 2, 3].map(() =>
        el('div', { class: 'recent-skeleton' }, [
            el('div', { class: 'skeleton skeleton-circle' }),
            el('div', { class: 'skeleton skeleton-line' }),
        ]),
    ));
}

function renderRecentCard() {
    const list = el('div', { class: 'recent-list' }, [recentSkeleton()]);

    const card = el('section', { class: 'card' }, [
        el('div', { class: 'card-header' }, [
            el('div', {}, [
                el('div', { class: 'card-title', text: 'Команда' }),
                el('div', { class: 'card-subtitle', text: 'Последние сотрудники в системе' }),
            ]),
            el('div', { class: 'card-actions' }, [
                el('button', {
                    class: 'btn btn-ghost btn-sm',
                    type: 'button',
                    text: 'Все',
                    onclick: () => navigate('/workers'),
                }),
            ]),
        ]),
        list,
    ]);

    return { card, list };
}

export async function renderDashboard({ container }) {
    const user = store.user || {};

    const statCards = {
        total: createStatCard({ label: 'Сотрудников', value: '—', icon: 'users', hint: 'всего в системе', tone: 'accent' }),
        cars: createStatCard({ label: 'Автомобилей', value: '—', icon: 'car', hint: 'автопарк сервиса', tone: 'info' }),
        clients: createStatCard({ label: 'Клиентов', value: '—', icon: 'client', hint: 'карточки в базе', tone: 'success' }),
        roles: createStatCard({ label: 'Ролей доступа', value: '—', icon: 'shield', hint: 'разграничение прав', tone: 'warning' }),
    };

    const recent = renderRecentCard();

    mount(container, [
        el('div', { class: 'dashboard' }, [
            renderHero(),
            el('div', { class: 'stat-grid' }, Object.values(statCards)),
            el('div', { class: 'dashboard-columns' }, [renderModules(), recent.card]),
        ]),
    ]);

    let disposed = false;

    try {
        // Независимые запросы — параллельно; падение одного не рушит остальные KPI
        const [stats, workers, carStats, clientStats] = await Promise.all([
            workersApi.stats(),
            workersApi.list(),
            carsApi.stats().catch(() => null),
            clientsApi.stats().catch(() => null),
        ]);
        if (disposed) return;

        const list = Array.isArray(workers) ? workers : [];
        const workersTotal = stats.total ?? list.length;

        setStatValue(statCards.total, workersTotal, `${workersTotal} ${plural(workersTotal, ['человек', 'человека', 'человек'])} в базе`);
        setStatValue(statCards.cars, carStats?.total ?? 0, carStats ? `средний возраст ${carStats.avg_age} лет` : 'автопарк сервиса');
        setStatValue(statCards.clients, clientStats?.total ?? 0, clientStats ? `${clientStats.with_cars} с автомобилями` : 'карточки в базе');
        setStatValue(statCards.roles, stats.roles ?? 0, 'разграничение прав');

        const recentWorkers = list.slice(-4).reverse();
        if (!recentWorkers.length) {
            recent.list.replaceChildren(
                el('div', { class: 'recent-empty', text: 'Пока никого нет. Добавьте первого сотрудника.' }),
            );
        } else {
            recent.list.replaceChildren(...recentWorkers.map((worker) =>
                el('div', { class: 'recent-row' }, [
                    el('div', { class: 'avatar', text: initials(worker.name) }),
                    el('div', { class: 'recent-main' }, [
                        el('div', { class: 'recent-name', text: worker.name }),
                        el('div', { class: 'recent-role', text: worker.role }),
                    ]),
                    el('span', { class: 'badge badge-accent', text: roleLabel(worker.access_level) }),
                ]),
            ));
        }
    } catch (error) {
        if (disposed) return;
        console.error(error);
        notify.error(error.message || 'Не удалось загрузить данные');
        recent.list.replaceChildren(
            el('div', { class: 'recent-empty', text: 'Данные недоступны. Проверьте, запущен ли сервер.' }),
        );
    }

    // Возвращаем cleanup: страница не должна писать в DOM после ухода
    return () => {
        disposed = true;
    };
}