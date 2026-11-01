/**
 * pages/clients.js — раздел «Клиенты».
 * CRUD: список, поиск, создание, редактирование, удаление, переход к авто клиента.
 */

import { el, mount, initials, plural, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { clientsApi, carsApi } from '../core/api.js';
import { openModal, closeModal, confirmDialog } from '../components/modal.js';
import { notify } from '../components/toast.js';

function createState() {
    return { clients: [], query: '', loading: true, error: null };
}

/* ---------- Форма ---------- */

function buildClientForm({ client = null, onSubmit }) {
    const isEdit = Boolean(client);

    const field = (id, label, props = {}, required = false) => {
        const input = el('input', {
            class: 'input',
            id,
            type: 'text',
            autocomplete: 'off',
            value: props.value ?? '',
            ...props,
        });
        return {
            input,
            node: el('div', { class: 'field' }, [
                el('label', { class: 'field-label', for: id }, required ? [label, ' ', el('span', { class: 'req', text: '*' })] : label),
                input,
            ]),
        };
    };

    const name = field('client-name', 'ФИО', { placeholder: 'Смирнов Алексей Петрович', value: client?.full_name }, true);
    const phone = field('client-phone', 'Телефон', { placeholder: '+7 916 240-18-32', value: client?.phone, inputmode: 'tel' }, true);
    const email = field('client-email', 'E-mail', { placeholder: 'client@mail.ru', value: client?.email, type: 'email' });
    const address = field('client-address', 'Адрес', { placeholder: 'ул. Гагарина, 12', value: client?.address });

    const note = el('textarea', {
        class: 'input textarea',
        id: 'client-note',
        rows: 3,
        placeholder: 'Комментарий по клиенту',
        value: client?.note ?? '',
    });

    const errorNode = el('div', { class: 'field-error', role: 'alert' });

    const form = el('form', {
        class: 'worker-form',
        novalidate: true,
        onsubmit: async (event) => {
            event.preventDefault();

            const payload = {
                full_name: name.input.value.trim(),
                phone: phone.input.value.trim(),
                email: email.input.value.trim() || null,
                address: address.input.value.trim() || null,
                note: note.value.trim() || null,
            };

            if (payload.full_name.length < 3) {
                errorNode.textContent = 'Укажите ФИО (минимум 3 символа)';
                name.input.focus();
                return;
            }
            if (payload.phone.replace(/\D/g, '').length < 7) {
                errorNode.textContent = 'Укажите корректный телефон';
                phone.input.focus();
                return;
            }

            errorNode.textContent = '';
            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Сохраняем…';

            try {
                await onSubmit(payload);
            } catch (error) {
                errorNode.textContent = error.message || 'Не удалось сохранить';
                submitBtn.disabled = false;
                submitBtn.textContent = isEdit ? 'Сохранить' : 'Добавить клиента';
            }
        },
    }, [
        name.node,
        el('div', { class: 'field-row' }, [phone.node, email.node]),
        address.node,
        el('div', { class: 'field' }, [
            el('label', { class: 'field-label', for: 'client-note', text: 'Примечание' }),
            note,
        ]),
        errorNode,
        el('div', { class: 'modal-foot', style: { padding: '12px 0 0', border: 'none', background: 'transparent' } }, [
            el('button', { class: 'btn btn-ghost', type: 'button', text: 'Отмена', onclick: closeModal }),
            el('button', {
                class: 'btn btn-primary',
                type: 'submit',
                text: isEdit ? 'Сохранить' : 'Добавить клиента',
            }),
        ]),
    ]);

    return form;
}

/* ---------- Строка таблицы ---------- */

function clientRow(client, context) {
    return el('tr', { dataset: { id: client.id } }, [
        el('td', { class: 'cell-id', text: `#${client.id}` }),

        el('td', {}, [
            el('div', { class: 'cell-person' }, [
                el('div', { class: 'avatar', text: initials(client.full_name) }),
                el('div', { class: 'person-info' }, [
                    el('div', { class: 'person-name', text: client.full_name }),
                    el('div', { class: 'person-sub', text: client.email || 'без e-mail' }),
                ]),
            ]),
        ]),

        el('td', {}, [
            el('a', { class: 'link-phone', href: `tel:${client.phone.replace(/[^+\d]/g, '')}`, text: client.phone }),
        ]),

        el('td', { class: 'cell-hide-sm' }, [
            el('span', { class: 'badge', text: `${client.cars_count} ${plural(client.cars_count, ['авто', 'авто', 'авто'])}` }),
        ]),

        el('td', { class: 'col-actions' }, [
            el('div', { class: 'actions-cell' }, [
                el('button', {
                    class: 'btn-icon',
                    type: 'button',
                    title: 'Автомобили клиента',
                    'aria-label': `Автомобили клиента ${client.full_name}`,
                    onclick: () => context.onShowCars(client),
                }, [icon('car', { size: 16 })]),

                el('button', {
                    class: 'btn-icon',
                    type: 'button',
                    title: 'Редактировать',
                    'aria-label': `Редактировать ${client.full_name}`,
                    onclick: () => context.onEdit(client),
                }, [icon('edit', { size: 16 })]),

                el('button', {
                    class: 'btn-icon is-danger',
                    type: 'button',
                    title: 'Удалить',
                    'aria-label': `Удалить ${client.full_name}`,
                    onclick: () => context.onDelete(client),
                }, [icon('trash', { size: 16 })]),
            ]),
        ]),
    ]);
}

/* ---------- Страница ---------- */

export async function renderClients({ container, params }) {
    const state = createState();
    state.query = params?.get('q') || '';

    const tableBody = el('tbody');
    const metaNode = el('span', { class: 'table-meta', text: '' });

    const searchInput = el('input', {
        class: 'input',
        type: 'search',
        placeholder: 'Поиск по ФИО, телефону, e-mail',
        value: state.query,
        'aria-label': 'Поиск клиентов',
    });

    const addBtn = el('button', {
        class: 'btn btn-primary',
        type: 'button',
        onclick: () => openClientModal(null),
    }, [icon('plus', { size: 16 }), 'Добавить клиента']);

    function filtered() {
        const query = state.query.trim().toLowerCase();
        if (!query) return state.clients;
        return state.clients.filter((client) =>
            [client.full_name, client.phone, client.email, client.address]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(query)),
        );
    }

    function renderTable() {
        if (state.loading) {
            mount(tableBody, [1, 2, 3].map(() =>
                el('tr', {}, [1, 2, 3, 4, 5].map(() =>
                    el('td', {}, [el('div', { class: 'skeleton', style: { height: '14px' } })]),
                )),
            ));
            return;
        }

        if (state.error) {
            mount(tableBody, [el('tr', {}, [el('td', { colspan: 5 }, [
                el('div', { class: 'empty-state' }, [
                    icon('shield', { size: 40 }),
                    el('h4', { text: 'Не удалось загрузить клиентов' }),
                    el('p', { text: state.error }),
                ]),
            ])])]);
            return;
        }

        const rows = filtered();

        if (!rows.length) {
            mount(tableBody, [el('tr', {}, [el('td', { colspan: 5 }, [
                el('div', { class: 'empty-state' }, [
                    icon('client', { size: 40 }),
                    el('h4', { text: state.query ? 'Ничего не найдено' : 'Клиентов пока нет' }),
                    el('p', { text: state.query ? 'Измените поисковый запрос.' : 'Добавьте первого клиента, чтобы оформлять заявки.' }),
                ]),
            ])])]);
            metaNode.textContent = '';
            return;
        }

        const context = { onEdit: openClientModal, onDelete: removeClient, onShowCars: showClientCars };
        mount(tableBody, rows.map((client) => clientRow(client, context)));
        metaNode.textContent = `${rows.length} ${plural(rows.length, ['клиент', 'клиента', 'клиентов'])}`;
    }

    async function reload() {
        state.loading = true;
        state.error = null;
        renderTable();

        try {
            state.clients = await clientsApi.list();
        } catch (error) {
            state.error = error.message || 'Ошибка сети';
            state.clients = [];
        } finally {
            state.loading = false;
            renderTable();
        }
    }

    function openClientModal(client) {
        const isEdit = Boolean(client);

        openModal({
            title: isEdit ? 'Карточка клиента' : 'Новый клиент',
            subtitle: isEdit ? `ID ${client.id}` : 'Данные для связи и оформления заявок',
            size: 'sm',
            body: buildClientForm({
                client,
                onSubmit: async (payload) => {
                    if (isEdit) {
                        await clientsApi.update(client.id, payload);
                        notify.success('Данные клиента обновлены');
                    } else {
                        await clientsApi.create(payload);
                        notify.success('Клиент добавлен');
                    }
                    closeModal();
                    await reload();
                },
            }),
        });
    }

    async function showClientCars(client) {
        const listNode = el('div', { class: 'mini-list' }, [el('div', { class: 'skeleton', style: { height: '40px' } })]);

        openModal({
            title: `Автомобили · ${client.full_name}`,
            subtitle: `Телефон: ${client.phone}`,
            size: 'sm',
            body: listNode,
        });

        try {
            const cars = await carsApi.list({ client_id: client.id });
            if (!cars.length) {
                mount(listNode, [el('p', { class: 'muted', text: 'У клиента нет добавленных автомобилей.' })]);
                return;
            }
            mount(listNode, cars.map((car) =>
                el('div', { class: 'mini-list-row' }, [
                    el('div', { class: 'person-info' }, [
                        el('div', { class: 'person-name', text: `${car.brand} ${car.model}` }),
                        el('div', { class: 'person-sub', text: [car.year, car.plate, car.vin].filter(Boolean).join(' · ') }),
                    ]),
                    el('span', { class: 'badge', text: car.mileage ? `${car.mileage.toLocaleString('ru-RU')} км` : '—' }),
                ]),
            ));
        } catch (error) {
            mount(listNode, [el('p', { class: 'field-error', text: error.message })]);
        }
    }

    async function removeClient(client) {
        const confirmed = await confirmDialog({
            title: 'Удалить клиента?',
            message: `Клиент «${client.full_name}» будет удалён. Автомобили останутся в базе без владельца.`,
            confirmText: 'Удалить',
            danger: true,
        });
        if (!confirmed) return;

        try {
            await clientsApi.remove(client.id);
            notify.success('Клиент удалён');
            await reload();
        } catch (error) {
            notify.error(error.message || 'Не удалось удалить клиента');
        }
    }

    const searchField = el('div', { class: 'search-field' }, [icon('search', { size: 16 }), searchInput]);
    searchInput.addEventListener('input', debounce(() => {
        state.query = searchInput.value;
        renderTable();
    }, 200));

    const page = el('div', { class: 'workers-page' }, [
        el('div', { class: 'page-header' }, [
            el('div', { class: 'page-header-text' }, [
                el('h1', { class: 'page-title', text: 'Клиенты' }),
                el('p', { class: 'page-description', text: 'Карточки клиентов, контактные данные и привязанные автомобили.' }),
            ]),
            el('div', { class: 'page-header-actions' }, [addBtn]),
        ]),

        el('section', { class: 'card' }, [
            el('div', { class: 'table-toolbar' }, [searchField, metaNode]),
            el('div', { class: 'table-wrap' }, [
                el('table', { class: 'table workers-table' }, [
                    el('thead', {}, [el('tr', {}, [
                        el('th', { text: 'ID' }),
                        el('th', { text: 'Клиент' }),
                        el('th', { text: 'Телефон' }),
                        el('th', { class: 'cell-hide-sm', text: 'Авто' }),
                        el('th', { class: 'col-actions', text: 'Действия' }),
                    ])]),
                    tableBody,
                ]),
            ]),
        ]),
    ]);

    mount(container, [page]);
    await reload();
    return () => { state.clients = []; };
}