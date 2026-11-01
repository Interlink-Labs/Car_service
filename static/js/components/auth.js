/**
 * components/auth.js — экран входа. Требование ТЗ: доступ строго после авторизации.
 * Показывается, пока в store нет пользователя.
 */

import { el, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { authApi } from '../core/api.js';
import { store } from '../core/store.js';
import { notify } from './toast.js';

/**
 * @param {HTMLElement} root  контейнер #auth-root
 * @param {{ onSuccess?: (user: object) => void }} options
 */
export function renderAuth(root, { onSuccess } = {}) {
    if (!root) return;

    let isLoginMode = true;
    let submitting = false;

    const usernameInput = el('input', {
        class: 'input',
        type: 'text',
        name: 'username',
        placeholder: 'admin',
        autocomplete: 'username',
        required: true,
    });

    const passwordInput = el('input', {
        class: 'input',
        type: 'password',
        name: 'password',
        placeholder: '••••••',
        autocomplete: 'current-password',
        required: true,
    });

    const errorNode = el('div', { class: 'auth-error', role: 'alert' });
    const submitBtn = el('button', { class: 'btn btn-primary btn-block', type: 'submit' });
    const titleNode = el('h2', { class: 'auth-title', text: 'Вход в систему' });
    const subtitleNode = el('p', {
        class: 'auth-subtitle',
        text: 'Доступ к панели автосервиса по логину и паролю.',
    });
    const toggleBtn = el('button', {
        class: 'btn btn-ghost btn-block btn-sm',
        type: 'button',
        text: 'Нет аккаунта? Зарегистрироваться',
    });

    function syncMode() {
        titleNode.textContent = isLoginMode ? 'Вход в систему' : 'Регистрация';
        subtitleNode.textContent = isLoginMode
            ? 'Доступ к панели автосервиса по логину и паролю.'
            : 'Создайте учётную запись сотрудника.';
        submitBtn.textContent = isLoginMode ? 'Войти' : 'Создать аккаунт';
        toggleBtn.textContent = isLoginMode
            ? 'Нет аккаунта? Зарегистрироваться'
            : 'Уже есть аккаунт? Войти';
        passwordInput.autocomplete = isLoginMode ? 'current-password' : 'new-password';
        errorNode.textContent = '';
    }

    toggleBtn.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        syncMode();
        usernameInput.focus();
    });

    async function submit(event) {
        event.preventDefault();
        if (submitting) return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            errorNode.textContent = 'Заполните логин и пароль';
            return;
        }

        submitting = true;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Проверяем…';
        errorNode.textContent = '';

        try {
            const response = isLoginMode
                ? await authApi.login(username, password)
                : await authApi.register(username, password);

            const user = response?.user || { username, role: 'manager' };
            store.setUser({ ...user, username });
            notify.success(`Добро пожаловать, ${user.name || username}!`);

            mount(root, []);
            if (typeof onSuccess === 'function') onSuccess(user);
        } catch (error) {
            errorNode.textContent = error.message || 'Не удалось выполнить вход';
            passwordInput.select();
        } finally {
            submitting = false;
            submitBtn.disabled = false;
            syncMode();
        }
    }

    const form = el('form', { class: 'auth-form', onsubmit: submit }, [
        el('div', { class: 'field' }, [
            el('label', { class: 'field-label', text: 'Логин', for: 'auth-username' }),
            usernameInput,
        ]),
        el('div', { class: 'field', style: { marginTop: '12px' } }, [
            el('label', { class: 'field-label', text: 'Пароль', for: 'auth-password' }),
            passwordInput,
        ]),
        errorNode,
        el('div', { style: { marginTop: '16px' } }, [submitBtn]),
        el('div', { style: { marginTop: '8px' } }, [toggleBtn]),
    ]);

    mount(root, [
        el('div', { class: 'auth-screen' }, [
            el('div', { class: 'auth-panel' }, [
                el('div', { class: 'brand' }, [
                    el('div', { class: 'brand-mark' }, [icon('wrench', { size: 20 })]),
                    el('div', { class: 'brand-text' }, [
                        el('span', { class: 'brand-title', text: 'Автосервис' }),
                        el('span', { class: 'brand-subtitle', text: 'Interlink-Labs' }),
                    ]),
                ]),
                titleNode,
                subtitleNode,
                form,
                el('div', { class: 'auth-hint' }, [
                    'Тестовый доступ: ',
                    el('code', { text: 'admin' }),
                    ' / ',
                    el('code', { text: 'admin' }),
                ]),
            ]),
        ]),
    ]);

    syncMode();
    usernameInput.focus();
}

export function unmountAuth(root) {
    if (root) mount(root, []);
}