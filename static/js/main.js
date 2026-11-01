/**
 * main.js — точка входа приложения.
 * 1. Инициализация оболочки (сайдбар, топбар).
 * 2. Проверка авторизации.
 * 3. Регистрация маршрутов и старт роутера.
 */

import { registerRoute, startRouter, navigate, onRouteChange } from './core/router.js';
import { store } from './core/store.js';
import { setRoles } from './core/roles.js';
import { workersApi } from './core/api.js';
import { initSidebar } from './components/sidebar.js';
import { initTopbar } from './components/topbar.js';
import { renderAuth, unmountAuth } from './components/auth.js';
import { notify } from './components/toast.js';
import { closeModal } from './components/modal.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderWorkers } from './pages/workers.js';
import { renderClients } from './pages/clients.js';
import { renderCars } from './pages/cars.js';

const shell = document.getElementById('app');
const pageRoot = document.getElementById('page-root');
const sidebarRoot = document.getElementById('sidebar-root');
const topbarRoot = document.getElementById('topbar-root');
const authRoot = document.getElementById('auth-root');

/* ---------- 1. Выход из системы ---------- */

function logout() {
    store.clearUser();
    unmountAuth(authRoot);
    pageRoot.replaceChildren();
    showAuth();
}

/* ---------- 2. Оболочка ---------- */

let shellReady = false;

function initShell() {
    if (shellReady) return;
    initSidebar(sidebarRoot);
    initTopbar(topbarRoot, { onLogout: logout });
    shellReady = true;

    // Реестр ролей: кастомные роли администратора подтягиваем один раз
    workersApi.roles().then(setRoles).catch(() => {});
}

/* ---------- 3. Авторизация ---------- */

function showAuth() {
    renderAuth(authRoot, {
        onSuccess: () => {
            initShell();
            startRouter({ root: pageRoot });
            if (!window.location.hash) navigate('/dashboard');
        },
    });
}

/* ---------- 4. Маршруты ---------- */

registerRoute('/dashboard', {
    title: 'Главный экран',
    crumb: 'Автосервис · Обзор',
    render: renderDashboard,
});

registerRoute('/workers', {
    title: 'Сотрудники',
    crumb: 'Автосервис · Персонал',
    render: renderWorkers,
});

registerRoute('/clients', {
    title: 'Клиенты',
    crumb: 'Автосервис · Клиенты',
    render: renderClients,
});

registerRoute('/cars', {
    title: 'Автомобили',
    crumb: 'Автосервис · Автопарк',
    render: renderCars,
});

// '/' ведёт на главный экран
registerRoute('/', {
    title: 'Главный экран',
    crumb: 'Автосервис · Обзор',
    render: renderDashboard,
});

/* ---------- 5. Старт ---------- */

// Модалка не должна переживать смену раздела — иначе висит поверх новой страницы
onRouteChange(() => closeModal());

function boot() {
    if (store.isAuthenticated) {
        initShell();
        startRouter({ root: pageRoot });
    } else {
        showAuth();
    }

    // Снимаем прелоадер после первого кадра: атрибут гасит оверлей через CSS,
    // а из DOM узел удаляем — он больше не нужен и не должен попадать в accessibility-дерево
    requestAnimationFrame(() => {
        shell.dataset.state = 'ready';
        const bootScreen = document.getElementById('boot-screen');
        if (bootScreen) setTimeout(() => bootScreen.remove(), 400);
    });
}

// Глобальная обработка необработанных ошибок — не оставляем пользователя в тишине
window.addEventListener('unhandledrejection', (event) => {
    console.error('Необработанная ошибка:', event.reason);
    notify.error(event.reason?.message || 'Произошла непредвиденная ошибка');
});

boot();