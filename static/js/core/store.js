/**
 * core/store.js — состояние сессии и темы + простая подписка на изменения.
 * Данные переживают перезагрузку через localStorage.
 */

const SESSION_KEY = 'as_session';
const THEME_KEY = 'as_theme';

const listeners = new Set();

function readJson(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

function emit() {
    for (const listener of listeners) listener(state);
}

const state = {
    user: readJson(SESSION_KEY),
    theme: localStorage.getItem(THEME_KEY) || 'dark',
};

export const store = {
    get user() {
        return state.user;
    },

    get isAuthenticated() {
        return Boolean(state.user);
    },

    get theme() {
        return state.theme;
    },

    /** @param {{username: string, role?: string, name?: string}} user */
    setUser(user) {
        state.user = user;
        localStorage.setItem(SESSION_KEY, JSON.stringify(user));
        emit();
    },

    clearUser() {
        state.user = null;
        localStorage.removeItem(SESSION_KEY);
        emit();
    },

    setTheme(theme) {
        state.theme = theme;
        localStorage.setItem(THEME_KEY, theme);
        document.documentElement.dataset.theme = theme;
        emit();
    },

    toggleTheme() {
        this.setTheme(state.theme === 'dark' ? 'light' : 'dark');
    },

    /** Подписка на изменения; возвращает функцию отписки. */
    subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    },
};

/** Применить сохранённую тему сразу при импорте модуля. */
document.documentElement.dataset.theme = state.theme;