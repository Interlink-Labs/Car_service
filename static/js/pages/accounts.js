/**
 * pages/accounts.js — раздел «Доступы» (учётные записи и роли).
 *
 * Здесь администратор заводит сотруднику логин и пароль — это и есть
 * «регистрация» механиков/менеджеров со стороны сервиса. Самостоятельная
 * регистрация на экране входа создаёт только mechanic/manager.
 */

import { el, mount, debounce, plural } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { accountsApi, workersApi } from '../core/api.js';
import { store } from '../core/store.js';
import { roleLabel, setRoles } from '../core/roles.js';
import { openModal, closeModal, confirmDialog } from '../components/modal.js';
import { notify } from '../components/toast.js';

function createState() {
    return { accounts: [], roles: [], query: '', loading: true, error: null };
}

/** Роли, которые можно выдать при создании доступа. */
function roleOptions(roles) {
    return roles.length
        ? roles.map((role) => ({ value: role.value, label: role.label }))
        : [{ value: 'mechanic', label: 'Механик' }];
}

/* ---------- Форма ---------- */

function buildAccountForm({ account = null, roles, onSubmit }) {
    const isEdit = Boolean(account);

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
        id: 'acc-username',
        type: 'text',
        value: account?.username ?? '',
        placeholder: 'ivanov',
        autocomplete: 'off',
        spellcheck: false,
        required: true,
        disabled: isEdit, // логин — идентификатор, не меняем
    });

    const nameInput = el('input', {
        class: 'input',
        id: 'acc-name',
        type: 'text',
        value: account?.name ?? '',
        placeholder: 'Иванов Иван Иванович',
        autocomplete: 'off',
    });

    const passwordInput = el('input', {
        class: 'input',
        id: 'acc-password',
        type: 'password',
        placeholder: isEdit ? 'оставьте пустым, чтобы не менять' : 'минимум 4 символа',
        autocomplete: 'new-password',
        required: !isEdit,
    });

    const roleSelect = el('select', { class: 'select', id: 'acc-role' },
        roleOptions(roles).map((role) => el('option', {
            value: role.value,
            text: role.label,
            selected: (account?.role ?? 'mechanic') === role.value,
        })),
    );

    const errorNode = el('div', { class: 'field-error', role: 'alert' });

    const form = el('form', {
        class: 'worker-form',
        novalidate: true,
        onsubmit: async (event) => {
            event.preventDefault();
            errorNode.textContent = '';

            const password = passwordInput.value;
            if (!isEdit && password.length < 4) {
                errorNode.textContent = 'Пароль — минимум 4 символа';
                return;
            }

            const payload = {
                name: nameInput.value.trim(),
                role: roleSelect.value,
            };
            if (password) payload.password = password;
            if (!isEdit) payload.username = usernameInput.value.trim().toLowerCase();

            const submit = event.target.querySelector('[type="submit"]');
            submit.disabled = true;
            submit.textContent = 'Сохраняем…';

            try {
                await onSubmit(payload);
            } catch (error) {
                errorNode.textContent = error.message || 'Не удалось сохранить доступ';
                passwordInput.select();
            } finally {
                submit.disabled = false;
                submit.textContent = isEdit ? 'Сохранить' : 'Создать доступ';
            }
        },
    }, [
        field('acc-username', 'Логин', usernameInput),
        field('acc-name', 'ФИО', nameInput, false),
        field('acc-password', isEdit ? 'Новый пароль' : 'Пароль', passwordInput, !isEdit),
        field('acc-role', 'Роль', roleSelect),
        errorNode,
        el('div', { class: 'modal-actions' }, [
            el('button', { class: 'btn btn-ghost', type: 'button', text: 'Отмена', onclick: closeModal }),
            el('button', {
                class: 'btn btn-primary',
                type: 'submit',
                text: isEdit ? 'Сохранить' : 'Создать доступ',
            }),
        ]),
    ]);

    return form;
}

/* ---------- Страница ---------- */

export function renderAccounts({ container }) {
    const state = createState();
    const isAdmin = store.user?.role === 'admin';

    const searchInput = el('input', {
        type: 'search',
        placeholder: 'Поиск по логину или ФИО',
        'aria-label': 'Поиск по учётным записям',
    });

    const tableBody = el('tbody', {});
    const metaNode = el('span', { class: 'table-meta' });
    const rolesNode = el('div', { class: 'roles-grid' });
    const errorNode = el('div', { class: 'field-error', role: 'alert' });

    const addBtn = el('button', { class: 'btn btn-primary', type: 'button' }, [
        icon('plus', { size: 16 }), 'Создать доступ',
    ]);
    addBtn.addEventListener('click', () => openAccountModal(null));

    /* ----- таблица ----- */

    function filtered() {
        const query = state.query.trim().toLowerCase();
        if (!query) return state.accounts;
        return state.accounts.filter((account) =>
            [account.username, account.name, roleLabel(account.role)]
                .filter(Boolean)
                .some((field) => String(field).toLowerCase().includes(query)));
    }

    function renderTable() {
        if (state.loading) {
            mount(tableBody, [1, 2, 3].map(() =>
                el('tr', {}, [1, 2, 3, 4, 5].map(() =>
                    el('td', {}, [el('div', { class: 'skeleton', style: { height: '14px' } })]),
                )),
            ));
            metaNode.textContent = '';
            return;
        }

        if (state.error) {
            mount(tableBody, [
                el('tr', {}, [
                    el('td', { colspan: 5 }, [
                        el('div', { class: 'empty-state' }, [
                            icon('shield', { size: 40 }),
                            el('h4', { text: 'Не удалось загрузить доступы' }),
                            el('p', { text: state.error }),
                        ]),
                    ]),
                ]),
            ]);
            return;
        }

        const rows = filtered();
        metaNode.textContent = rows.length
            ? `${rows.length} ${plural(rows.length, 'запись', 'записи', 'записей')}`
            : '';

        if (!rows.length) {
            mount(tableBody, [
                el('tr', {}, [
                    el('td', { colspan: 5 }, [
                        el('div', { class: 'empty-state' }, [
                            icon('users', { size: 40 }),
                            el('h4', { text: 'Учётных записей не найдено' }),
                            el('p', { text: 'Измените запрос или создайте новый доступ.' }),
                        ]),
                    ]),
                ]),
            ]);
            return;
        }

        mount(tableBody, rows.map((account) => {
            const isSelf = account.username === store.user?.username;

            return el('tr', { class: account.is_active ? '' : 'is-muted' }, [
                el('td', { class: 'cell-id', text: String(account.id) }),
                el('td', {}, [
                    el('div', { class: 'worker-name' }, [
                        el('span', { text: account.name || account.username }),
                        isSelf ? el('span', { class: 'badge badge-soft', text: 'это вы' }) : null,
                    ]),
                    el('span', { class: 'worker-sub', text: `@${account.username}` }),
                ]),
                el('td', {}, [
                    el('span', {
                        class: `badge ${account.role === 'admin' ? 'badge-accent' : 'badge-soft'}`,
                        text: roleLabel(account.role),
                    }),
                ]),
                el('td', {}, [
                    el('span', {
                        class: `status-dot ${account.is_active ? 'is-online' : 'is-offline'}`,
                        title: account.is_active ? 'Доступ открыт' : 'Доступ отключён',
                    }, [
                        el('span', { class: 'status-dot-mark' }),
                        el('span', { text: account.is_active ? 'Активен' : 'Отключён' }),
                    ]),
                ]),
                el('td', { class: 'col-actions' }, [
                    el('button', {
                        class: 'icon-btn',
                        type: 'button',
                        title: 'Изменить',
                        'aria-label': `Изменить ${account.username}`,
                        onclick: () => openAccountModal(account),
                    }, [icon('edit', { size: 16 })]),
                    el('button', {
                        class: 'icon-btn',
                        type: 'button',
                        title: account.is_active ? 'Отключить доступ' : 'Включить доступ',
                        'aria-label': account.is_active ? 'Отключить доступ' : 'Включить доступ',
                        disabled: isSelf,
                        onclick: () => toggleActive(account),
                    }, [icon(account.is_active ? 'lock' : 'unlock', { size: 16 })]),
                    el('button', {
                        class: 'icon-btn icon-btn-danger',
                        type: 'button',
                        title: 'Удалить',
                        'aria-label': `Удалить ${account.username}`,
                        disabled: isSelf,
                        onclick: () => removeAccount(account),
                    }, [icon('trash', { size: 16 })]),
                ]),
            ]);
        }));
    }

    function renderRoles() {
        mount(rolesNode, state.roles.map((role) =>
            el('div', { class: 'role-card' }, [
                el('div', { class: 'role-card-head' }, [
                    el('span', { class: 'role-card-title', text: role.label }),
                    el('span', { class: 'role-card-count', text: String(role.users_count ?? 0) }),
                ]),
                el('p', { class: 'role-card-desc', text: describeRole(role.value) }),
                el('code', { class: 'role-card-code', text: role.value }),
            ]),
        ));
    }

    /* ----- действия ----- */

    function openAccountModal(account) {
        openModal({
            title: account ? 'Изменить доступ' : 'Новый доступ',
            subtitle: account ? `@${account.username}` : 'Сотрудник сможет войти под этим логином',
            size: 'sm',
            body: buildAccountForm({
                account,
                roles: state.roles,
                onSubmit: async (payload) => {
                    if (account) {
                        await accountsApi.update(account.id, payload);
                        notify.success('Доступ обновлён');
                    } else {
                        await accountsApi.create(payload);
                        notify.success('Доступ создан');
                    }
                    closeModal();
                    await reload();
                },
            }),
        });
    }

    async function toggleActive(account) {
        try {
            await accountsApi.update(account.id, { is_active: !account.is_active });
            notify.success(account.is_active ? 'Доступ отключён' : 'Доступ включён');
            await reload();
        } catch (error) {
            notify.error(error.message || 'Не удалось изменить доступ');
        }
    }

    async function removeAccount(account) {
        const confirmed = await confirmDialog({
            title: 'Удалить доступ?',
            message: `Учётная запись @${account.username} будет удалена. Если сотрудник уволился, лучше отключить доступ.`,
            confirmText: 'Удалить',
            danger: true,
        });
        if (!confirmed) return;

        try {
            await accountsApi.remove(account.id);
            notify.success('Доступ удалён');
            await reload();
        } catch (error) {
            notify.error(error.message || 'Не удалось удалить доступ');
        }
    }

    async function reload() {
        state.loading = true;
        state.error = null;
        renderTable();

        try {
            const [accounts, roles] = await Promise.all([
                accountsApi.list(),
                workersApi.roles(),
            ]);
            state.accounts = accounts || [];
            state.roles = roles || [];
            setRoles(state.roles); // новые роли сразу доступны в остальных разделах
        } catch (error) {
            state.error = error.message || 'Ошибка загрузки';
        } finally {
            state.loading = false;
            renderTable();
            renderRoles();
        }
    }

    /* ----- разметка ----- */

    searchInput.addEventListener('input', debounce(() => {
        state.query = searchInput.value;
        renderTable();
    }, 200));

    const page = el('div', { class: 'workers-page' }, [
        el('div', { class: 'page-header' }, [
            el('div', { class: 'page-header-text' }, [
                el('h1', { class: 'page-title', text: 'Доступы' }),
                el('p', {
                    class: 'page-description',
                    text: 'Логины и роли сотрудников. Регистрация на экране входа создаёт только механика или менеджера — администратора заводит администратор.',
                }),
            ]),
            el('div', { class: 'page-header-actions' }, isAdmin ? [addBtn] : []),
        ]),

        errorNode,

        el('section', { class: 'card' }, [
            el('div', { class: 'table-toolbar' }, [
                el('div', { class: 'search-field' }, [icon('search', { size: 16 }), searchInput]),
                metaNode,
            ]),
            el('div', { class: 'table-wrap' }, [
                el('table', { class: 'table workers-table' }, [
                    el('thead', {}, [
                        el('tr', {}, [
                            el('th', { text: 'ID' }),
                            el('th', { text: 'Сотрудник' }),
                            el('th', { text: 'Роль' }),
                            el('th', { text: 'Статус' }),
                            el('th', { class: 'col-actions', text: 'Действия' }),
                        ]),
                    ]),
                    tableBody,
                ]),
            ]),
        ]),

        el('section', { class: 'card' }, [
            el('div', { class: 'card-head' }, [
                el('h2', { class: 'card-title', text: 'Роли доступа' }),
                el('p', { class: 'card-subtitle', text: 'Сколько учётных записей на каждой роли' }),
            ]),
            rolesNode,
        ]),
    ]);

    mount(container, page);
    reload();
}

/** Короткое описание роли для карточки. */
function describeRole(code) {
    switch (code) {
        case 'admin':
            return 'Полный доступ: сотрудники, доступы, удаление данных.';
        case 'manager':
            return 'Клиенты, автомобили, сотрудники. Учётные записи — только просмотр.';
        case 'mechanic':
            return 'Заявки, автомобили и фиксация выполненных работ.';
        case 'user':
            return 'Обычный пользователь: просмотр доступных данных без управления.';
        default:
            return 'Пользовательская роль: права настраиваются администратором.';
    }
}