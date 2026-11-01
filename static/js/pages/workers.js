/**
 * pages/workers.js — раздел «Сотрудники» (worker_dir).
 * CRUD: список, поиск, фильтр по роли, создание, редактирование, удаление.
 */

import { el, mount, initials, plural, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { workersApi } from '../core/api.js';
import { openModal, closeModal, confirmDialog } from '../components/modal.js';
import { roleLabel, setRoles } from '../core/roles.js';
import { notify } from '../components/toast.js';

/* ---------- Состояние раздела ---------- */

function createState() {
    return {
        workers: [],
        roles: [],
        query: '',
        roleFilter: 'all',
        loading: true,
        error: null,
    };
}

/* ---------- Форма создания/редактирования ---------- */

function buildWorkerForm({ worker = null, roles = [], onSubmit }) {
    const isEdit = Boolean(worker);

    const nameInput = el('input', {
        class: 'input',
        type: 'text',
        id: 'worker-name',
        placeholder: 'Например: Иванов Иван Иванович',
        value: worker?.name ?? '',
        autocomplete: 'off',
        required: true,
    });

    const roleInput = el('input', {
        class: 'input',
        type: 'text',
        id: 'worker-speciality',
        placeholder: 'Например: Механик по двигателям',
        value: worker?.role ?? '',
        autocomplete: 'off',
        required: true,
    });

    const accessSelect = el('select', { class: 'select', id: 'worker-access' },
        roles.map((role) => el('option', {
            value: role.value,
            text: role.label,
            selected: (worker?.access_level ?? 'mechanic') === role.value,
        })),
    );

    const errorNode = el('div', { class: 'field-error', role: 'alert' });

    const form = el('form', {
        class: 'worker-form',
        novalidate: true,
        onsubmit: async (event) => {
            event.preventDefault();

            const payload = {
                name: nameInput.value.trim(),
                role: roleInput.value.trim(),
                access_level: accessSelect.value,
            };

            if (payload.name.length < 3) {
                errorNode.textContent = 'Укажите ФИО (минимум 3 символа)';
                nameInput.classList.add('is-invalid');
                nameInput.focus();
                return;
            }
            if (!payload.role) {
                errorNode.textContent = 'Укажите специализацию';
                roleInput.classList.add('is-invalid');
                roleInput.focus();
                return;
            }

            errorNode.textContent = '';
            nameInput.classList.remove('is-invalid');
            roleInput.classList.remove('is-invalid');

            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Сохраняем…';

            try {
                await onSubmit(payload);
            } catch (error) {
                errorNode.textContent = error.message || 'Не удалось сохранить';
                submitBtn.disabled = false;
                submitBtn.textContent = isEdit ? 'Сохранить' : 'Добавить сотрудника';
            }
        },
    }, [
        el('div', { class: 'field' }, [
            el('label', { class: 'field-label', for: 'worker-name' }, ['ФИО ', el('span', { class: 'req', text: '*' })]),
            nameInput,
        ]),
        el('div', { class: 'field' }, [
            el('label', { class: 'field-label', for: 'worker-speciality' }, ['Специализация ', el('span', { class: 'req', text: '*' })]),
            roleInput,
        ]),
        el('div', { class: 'field' }, [
            el('label', { class: 'field-label', for: 'worker-access' }, 'Уровень доступа'),
            accessSelect,
            el('span', { class: 'role-hint', text: 'Роль определяет, какие разделы сотрудник увидит после входа.' }),
        ]),
        errorNode,
        el('div', { class: 'modal-foot', style: { padding: '12px 0 0', border: 'none', background: 'transparent' } }, [
            el('button', { class: 'btn btn-ghost', type: 'button', text: 'Отмена', onclick: closeModal }),
            el('button', {
                class: 'btn btn-primary',
                type: 'submit',
                text: isEdit ? 'Сохранить' : 'Добавить сотрудника',
            }),
        ]),
    ]);

    return form;
}

/* ---------- Строка таблицы ---------- */

function workerRow(worker, context) {
    return el('tr', { dataset: { id: worker.id } }, [
        el('td', { class: 'cell-id', text: `#${worker.id}` }),

        el('td', {}, [
            el('div', { class: 'cell-person' }, [
                el('div', { class: 'avatar', text: initials(worker.name) }),
                el('div', { class: 'person-info' }, [
                    el('div', { class: 'person-name', text: worker.name }),
                    el('div', { class: 'person-sub', text: worker.access_level === 'admin' ? 'Полный доступ' : 'Ограниченный доступ' }),
                ]),
            ]),
        ]),

        el('td', { class: 'cell-hide-sm' }, [
            el('div', { class: 'role-cell' }, [
                el('span', { text: worker.role }),
                el('span', { class: 'role-code', text: worker.access_level }),
            ]),
        ]),

        el('td', {}, [
            el('span', { class: 'badge badge-accent', text: roleLabel(worker.access_level) }),
        ]),

        el('td', { class: 'col-actions' }, [
            el('div', { class: 'actions-cell' }, [
                el('button', {
                    class: 'btn-icon',
                    type: 'button',
                    title: 'Редактировать',
                    'aria-label': `Редактировать ${worker.name}`,
                    dataset: { action: 'edit', id: worker.id },
                    onclick: () => context.onEdit(worker),
                }, [icon('edit', { size: 16 })]),

                el('button', {
                    class: 'btn-icon is-danger',
                    type: 'button',
                    title: 'Удалить',
                    'aria-label': `Удалить ${worker.name}`,
                    dataset: { action: 'delete', id: worker.id },
                    onclick: () => context.onDelete(worker),
                }, [icon('trash', { size: 16 })]),
            ]),
        ]),
    ]);
}

/* ---------- Страница ---------- */

export async function renderWorkers({ container, params }) {
    const state = createState();
    state.query = params?.get('q') || '';

    /* Кусок страницы, который перерисовывается при фильтрации */
    const tableBody = el('tbody');
    const metaNode = el('span', { class: 'table-meta', text: '' });
    const roleStatsNode = el('div', { class: 'role-stats' });
    const searchInput = el('input', {
        class: 'input',
        type: 'search',
        placeholder: 'Поиск по ФИО или специализации',
        value: state.query,
        'aria-label': 'Поиск сотрудников',
    });

    const addBtn = el('button', {
        class: 'btn btn-primary',
        type: 'button',
        onclick: () => openWorkerModal(null),
    }, [icon('plus', { size: 16 }), 'Добавить сотрудника']);

    /* ---------- Рендер данных ---------- */

    function filteredWorkers() {
        const query = state.query.trim().toLowerCase();

        return state.workers.filter((worker) => {
            const matchRole = state.roleFilter === 'all' || worker.access_level === state.roleFilter;
            if (!matchRole) return false;
            if (!query) return true;

            return [worker.name, worker.role, worker.access_level]
                .filter(Boolean)
                .some((field) => String(field).toLowerCase().includes(query));
        });
    }

    function renderTable() {
        const rows = filteredWorkers();

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
                            el('h4', { text: 'Не удалось загрузить список' }),
                            el('p', { text: state.error }),
                        ]),
                    ]),
                ]),
            ]);
            metaNode.textContent = '';
            return;
        }

        if (!rows.length) {
            mount(tableBody, [
                el('tr', {}, [
                    el('td', { colspan: 5 }, [
                        el('div', { class: 'empty-state' }, [
                            icon('users', { size: 40 }),
                            el('h4', { text: state.query || state.roleFilter !== 'all' ? 'Ничего не найдено' : 'Список пуст' }),
                            el('p', {
                                text: state.query || state.roleFilter !== 'all'
                                    ? 'Измените запрос или сбросьте фильтр по роли.'
                                    : 'Добавьте первого сотрудника, чтобы начать работу.',
                            }),
                        ]),
                    ]),
                ]),
            ]);
            metaNode.textContent = '';
            return;
        }

        const context = { onEdit: openWorkerModal, onDelete: removeWorker };
        mount(tableBody, rows.map((worker) => workerRow(worker, context)));
        metaNode.textContent = `${rows.length} ${plural(rows.length, ['сотрудник', 'сотрудника', 'сотрудников'])}`;
    }

    function renderRoleStats() {
        const groups = new Map();
        for (const worker of state.workers) {
            groups.set(worker.access_level, (groups.get(worker.access_level) || 0) + 1);
        }

        if (!groups.size) {
            mount(roleStatsNode, []);
            return;
        }

        mount(roleStatsNode, [...groups.entries()].map(([role, count]) =>
            el('span', { class: 'role-stat' }, [roleLabel(role), el('b', { text: String(count) })]),
        ));
    }

    function renderChips() {
        const chips = [{ value: 'all', label: 'Все сотрудники' }].concat(
            state.roles.map((role) => ({ value: role.value, label: role.label })),
        );

        return chips.map((chip) =>
            el('button', {
                class: `chip${state.roleFilter === chip.value ? ' is-active' : ''}`,
                type: 'button',
                text: chip.label,
                onclick: (event) => {
                    state.roleFilter = chip.value;
                    // Перерисовка только панели фильтров и таблицы
                    const parent = event.currentTarget.parentElement;
                    mount(parent, renderChips());
                    renderTable();
                },
            }),
        );
    }

    /* ---------- Действия ---------- */

    async function reload() {
        state.loading = true;
        state.error = null;
        renderTable();

        try {
            state.workers = await workersApi.list();
        } catch (error) {
            state.error = error.message || 'Ошибка сети';
            state.workers = [];
        } finally {
            state.loading = false;
            renderTable();
            renderRoleStats();
        }
    }

    function openWorkerModal(worker) {
        const isEdit = Boolean(worker);

        openModal({
            title: isEdit ? 'Карточка сотрудника' : 'Новый сотрудник',
            subtitle: isEdit ? `ID ${worker.id}` : 'Заполните данные и выберите уровень доступа',
            size: 'sm',
            body: buildWorkerForm({
                worker,
                roles: state.roles,
                onSubmit: async (payload) => {
                    if (isEdit) {
                        await workersApi.update(worker.id, payload);
                        notify.success('Данные сотрудника обновлены');
                    } else {
                        await workersApi.create(payload);
                        notify.success('Сотрудник добавлен');
                    }
                    closeModal();
                    await reload();
                },
            }),
        });
    }

    async function removeWorker(worker) {
        const confirmed = await confirmDialog({
            title: 'Удалить сотрудника?',
            message: `Карточка «${worker.name}» будет удалена без возможности восстановления.`,
            confirmText: 'Удалить',
            danger: true,
        });

        if (!confirmed) return;

        try {
            await workersApi.remove(worker.id);
            notify.success('Сотрудник удалён');
            await reload();
        } catch (error) {
            notify.error(error.message || 'Не удалось удалить сотрудника');
        }
    }

    /* ---------- Сборка страницы ---------- */

    const searchField = el('div', { class: 'search-field' }, [icon('search', { size: 16 }), searchInput]);

    searchInput.addEventListener('input', debounce(() => {
        state.query = searchInput.value;
        renderTable();
    }, 200));

    const page = el('div', { class: 'workers-page' }, [
        el('div', { class: 'page-header' }, [
            el('div', { class: 'page-header-text' }, [
                el('h1', { class: 'page-title', text: 'Сотрудники' }),
                el('p', {
                    class: 'page-description',
                    text: 'Учёт персонала автосервиса и разграничение прав доступа по ролям.',
                }),
            ]),
            el('div', { class: 'page-header-actions' }, [addBtn]),
        ]),

        el('section', { class: 'card' }, [
            el('div', { class: 'table-toolbar' }, [
                searchField,
                el('div', { class: 'workers-filters' }, renderChips()),
                metaNode,
            ]),
            el('div', { class: 'table-wrap' }, [
                el('table', { class: 'table workers-table' }, [
                    el('thead', {}, [
                        el('tr', {}, [
                            el('th', { text: 'ID' }),
                            el('th', { text: 'Сотрудник' }),
                            el('th', { class: 'cell-hide-sm', text: 'Специализация' }),
                            el('th', { text: 'Доступ' }),
                            el('th', { class: 'col-actions', text: 'Действия' }),
                        ]),
                    ]),
                    tableBody,
                ]),
            ]),
            roleStatsNode,
        ]),
    ]);

    mount(container, [page]);

    /* ---------- Загрузка ---------- */

    try {
        state.roles = await workersApi.roles();
        setRoles(state.roles);
    } catch {
        // Если ручка ролей недоступна — работаем с базовым набором
        state.roles = [
            { value: 'mechanic', label: 'Механик' },
            { value: 'manager', label: 'Менеджер' },
            { value: 'admin', label: 'Администратор' },
        ];
    }

    await reload();

    return () => {
        // Страница ушла — сбрасываем состояние, чтобы не держать ссылки на DOM
        state.workers = [];
    };
}