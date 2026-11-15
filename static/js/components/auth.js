/**
 * components/auth.js — экран входа и регистрации.
 * Требование ТЗ: доступ к системе только после авторизации.
 * Показывается, пока в store нет пользователя.
 */

import { el, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { authApi } from '../core/api.js';
import { store } from '../core/store.js';
import { notify } from './toast.js';

/** Роли, доступные при самостоятельной регистрации (админа создаёт админ). */
const SELF_REGISTER_ROLES = [
    { value: 'user', label: 'Обычный пользователь' },
];

const LOGIN_MIN = 3;
const PASSWORD_MIN = 4;

/**
 * @param {HTMLElement} root  контейнер #auth-root
 * @param {{ onSuccess?: (user: object) => void }} options
 */
export function renderAuth(root, { onSuccess } = {}) {
    if (!root) return;

    let mode = 'login'; // 'login' | 'register'
    let submitting = false;

    /* ---------- поля ---------- */

    const field = (id, labelText, input, required = true) =>
        el('div', { class: 'field' }, [
            el('label', { class: 'field-label', for: id }, [
                labelText,
                required ? el('span', { class: 'req', text: ' *' }) : null,
            ]),
            input,
        ]);

    const usernameInput = el('input', {
        class: 'input',
        id: 'auth-username',
        type: 'text',
        name: 'username',
        placeholder: 'ivanov',
        autocomplete: 'username',
        spellcheck: false,
        required: true,
    });

    const passwordInput = el('input', {
        class: 'input',
        id: 'auth-password',
        type: 'password',
        name: 'password',
        placeholder: '••••••',
        autocomplete: 'current-password',
        required: true,
    });

    const phoneInput = el('input', {
        class: 'input', id: 'auth-phone', type: 'tel', name: 'phone',
        placeholder: '+7 900 000-00-00', autocomplete: 'tel',
    });

    const nameInput = el('input', {
        class: 'input',
        id: 'auth-name',
        type: 'text',
        name: 'name',
        placeholder: 'Иванов Иван Иванович',
        autocomplete: 'name',
    });

    const roleSelect = el('select', { class: 'select', id: 'auth-role' },
        SELF_REGISTER_ROLES.map((role) => el('option', { value: role.value, text: role.label })),
    );

    // Поля регистрации живут в отдельном контейнере — так их проще скрывать
    const registerFields = el('div', { class: 'auth-extra' }, [
        field('auth-name', 'ФИО', nameInput, true),
        field('auth-phone', 'Телефон', phoneInput, true),
        field('auth-role', 'Роль', roleSelect),
    ]);

    const errorNode = el('div', { class: 'auth-error', role: 'alert' });
    const submitBtn = el('button', { class: 'btn btn-primary btn-block', type: 'submit' });
    const titleNode = el('h2', { class: 'auth-title' });
    const subtitleNode = el('p', { class: 'auth-subtitle' });

    const loginTab = el('button', { class: 'auth-tab', type: 'button', text: 'Вход' });
    const registerTab = el('button', { class: 'auth-tab', type: 'button', text: 'Регистрация' });
    const tabs = el('div', { class: 'auth-tabs', role: 'tablist' }, [loginTab, registerTab]);

    const hintNode = el('div', { class: 'auth-hint' });

    /* ---------- переключение режима ---------- */

    function syncMode() {
        const isLogin = mode === 'login';

        loginTab.classList.toggle('is-active', isLogin);
        registerTab.classList.toggle('is-active', !isLogin);
        loginTab.setAttribute('aria-selected', String(isLogin));
        registerTab.setAttribute('aria-selected', String(!isLogin));

        titleNode.textContent = isLogin ? 'Вход в систему' : 'Регистрация';
        subtitleNode.textContent = isLogin
            ? 'Доступ к панели автосервиса по логину и паролю.'
            : 'Создайте учётную запись сотрудника — вход будет доступен сразу.';

        registerFields.hidden = isLogin;
        passwordInput.autocomplete = isLogin ? 'current-password' : 'new-password';
        submitBtn.textContent = isLogin ? 'Войти' : 'Создать аккаунт';
        errorNode.textContent = '';

        mount(hintNode, isLogin
            ? ['Тестовый доступ: ', el('code', { text: 'admin' }), ' / ', el('code', { text: 'admin' })]
            : [
                'После регистрации администратор сможет назначить вам роль: механик или менеджер.'
            ]);
    }

    function switchMode(next) {
        if (mode === next) return;
        mode = next;
        syncMode();
        (next === 'login' ? usernameInput : nameInput).focus();
    }

    loginTab.addEventListener('click', () => switchMode('login'));
    registerTab.addEventListener('click', () => switchMode('register'));

    /* ---------- отправка ---------- */

    function validate(username, password, name) {
        if (!username || !password) return 'Заполните логин и пароль';
        if (mode === 'register') {
            if (username.length < LOGIN_MIN) return `Логин — минимум ${LOGIN_MIN} символа`;
            if (!/^[a-z0-9_.-]+$/i.test(username)) {
                return 'Логин: только латиница, цифры, «_», «.» и «-»';
            }
            if (password.length < PASSWORD_MIN) return `Пароль — минимум ${PASSWORD_MIN} символа`;
            if (name && !name.trim()) return 'Укажите ФИО или оставьте поле пустым';
        }
        return null;
    }

    async function submit(event) {
        event.preventDefault();
        if (submitting) return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();

        const problem = validate(username, password, name);
        if (mode === 'register' && phone.replace(/\D/g, '').length < 7) {
            errorNode.textContent = 'Укажите корректный телефон клиента';
            return;
        }
        if (problem) {
            errorNode.textContent = problem;
            return;
        }

        submitting = true;
        submitBtn.disabled = true;
        submitBtn.textContent = mode === 'login' ? 'Проверяем…' : 'Создаём…';
        errorNode.textContent = '';

        try {
            const response = mode === 'login'
                ? await authApi.login(username, password)
                : await authApi.register({
                    username,
                    password,
                    name: name || undefined,
                    phone,
                    role: roleSelect.value || 'user',
                });

            const user = response?.user || { username, role: 'user' };
            if (response?.token) localStorage.setItem('as_token', response.token);
            store.setUser({ ...user, username });

            notify.success(mode === 'login'
                ? `Добро пожаловать, ${user.name || username}!`
                : `Аккаунт создан. Добро пожаловать, ${user.name || username}!`);

            mount(root, []);
            if (typeof onSuccess === 'function') onSuccess(user);
        } catch (error) {
            errorNode.textContent = error.message || 'Не удалось выполнить запрос';
            passwordInput.select();
        } finally {
            submitting = false;
            submitBtn.disabled = false;
            syncMode();
        }
    }

    /* ---------- разметка ---------- */

    const form = el('form', { class: 'auth-form', novalidate: true, onsubmit: submit }, [
        field('auth-username', 'Логин', usernameInput),
        field('auth-password', 'Пароль', passwordInput),
        registerFields,
        errorNode,
        el('div', { style: { marginTop: '16px' } }, [submitBtn]),
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
                tabs,
                titleNode,
                subtitleNode,
                form,
                hintNode,
            ]),
        ]),
    ]);

    syncMode();
    usernameInput.focus();
}

export function unmountAuth(root) {
    if (root) mount(root, []);
}