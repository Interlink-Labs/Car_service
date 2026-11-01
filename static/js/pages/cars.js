/**
 * pages/cars.js — раздел «Автомобили».
 * Список автопарка с поиском по VIN/госномеру, CRUD и привязкой к клиенту.
 */

import { el, mount, plural, debounce } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { carsApi, clientsApi } from '../core/api.js';
import { openModal, closeModal, confirmDialog } from '../components/modal.js';
import { notify } from '../components/toast.js';

function createState() {
    return { cars: [], clients: [], query: '', loading: true, error: null };
}

/* ---------- Форма ---------- */

function buildCarForm({ car = null, clients = [], onSubmit }) {
    const isEdit = Boolean(car);

    const inputs = {};
    const input = (id, props = {}) => {
        const node = el('input', { class: 'input', id, type: 'text', autocomplete: 'off', ...props });
        inputs[id] = node;
        return node;
    };
    const label = (text, required = false) => (required ? [text, ' ', el('span', { class: 'req', text: '*' })] : text);

    const clientSelect = el('select', { class: 'select', id: 'car-client' },
        [el('option', { value: '', text: '— без владельца —' })].concat(
            clients.map((client) => el('option', {
                value: String(client.id),
                text: `${client.full_name} · ${client.phone}`,
                selected: Number(car?.client_id) === client.id,
            })),
        ),
    );

    const errorNode = el('div', { class: 'field-error', role: 'alert' });

    const form = el('form', {
        class: 'worker-form',
        novalidate: true,
        onsubmit: async (event) => {
            event.preventDefault();

            const payload = {
                client_id: clientSelect.value ? Number(clientSelect.value) : null,
                brand: inputs['car-brand'].value.trim(),
                model: inputs['car-model'].value.trim(),
                year: inputs['car-year'].value ? Number(inputs['car-year'].value) : null,
                plate: inputs['car-plate'].value.trim() || null,
                vin: inputs['car-vin'].value.trim() || null,
                mileage: inputs['car-mileage'].value ? Number(inputs['car-mileage'].value) : null,
                color: inputs['car-color'].value.trim() || null,
                note: null,
            };

            if (!payload.brand || !payload.model) {
                errorNode.textContent = 'Укажите марку и модель';
                return;
            }
            if (payload.year && (payload.year < 1900 || payload.year > 2100)) {
                errorNode.textContent = 'Год выпуска должен быть в диапазоне 1900–2100';
                return;
            }
            if (payload.vin && payload.vin.length !== 17) {
                errorNode.textContent = 'VIN должен содержать 17 символов';
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
                submitBtn.textContent = isEdit ? 'Сохранить' : 'Добавить автомобиль';
            }
        },
    }, [
        el('div', { class: 'field' }, [
            el('label', { class: 'field-label', for: 'car-client', text: 'Владелец' }),
            clientSelect,
        ]),
        el('div', { class: 'field-row' }, [
            el('div', { class: 'field' }, [
                el('label', { class: 'field-label', for: 'car-brand' }, label('Марка', true)),
                input('car-brand', { placeholder: 'Toyota', value: car?.brand ?? '', required: true }),
            ]),
            el('div', { class: 'field' }, [
                el('label', { class: 'field-label', for: 'car-model' }, label('Модель', true)),
                input('car-model', { placeholder: 'Camry', value: car?.model ?? '', required: true }),
            ]),
        ]),
        el('div', { class: 'field-row' }, [
            el('div', { class: 'field' }, [
                el('label', { class: 'field-label', for: 'car-year', text: 'Год выпуска' }),
                input('car-year', { placeholder: '2019', value: car?.year ?? '', inputmode: 'numeric' }),
            ]),
            el('div', { class: 'field' }, [
                el('label', { class: 'field-label', for: 'car-plate', text: 'Госномер' }),
                input('car-plate', { placeholder: 'А 142 СВ 77', value: car?.plate ?? '' }),
            ]),
        ]),
        el('div', { class: 'field' }, [
            el('label', { class: 'field-label', for: 'car-vin', text: 'VIN' }),
            input('car-vin', { placeholder: '17 символов', value: car?.vin ?? '', maxlength: 17 }),
        ]),
        el('div', { class: 'field-row' }, [
            el('div', { class: 'field' }, [
                el('label', { class: 'field-label', for: 'car-mileage', text: 'Пробег, км' }),
                input('car-mileage', { placeholder: '84500', value: car?.mileage ?? '', inputmode: 'numeric' }),
            ]),
            el('div', { class: 'field' }, [
                el('label', { class: 'field-label', for: 'car-color', text: 'Цвет' }),
                input('car-color', { placeholder: 'Чёрный', value: car?.color ?? '' }),
            ]),
        ]),
        errorNode,
        el('div', { class: 'modal-foot', style: { padding: '12px 0 0', border: 'none', background: 'transparent' } }, [
            el('button', { class: 'btn btn-ghost', type: 'button', text: 'Отмена', onclick: closeModal }),
            el('button', {
                class: 'btn btn-primary',
                type: 'submit',
                text: isEdit ? 'Сохранить' : 'Добавить автомобиль',
            }),
        ]),
    ]);

    return form;
}

/* ---------- Строка таблицы ---------- */

function carRow(car, context) {
    return el('tr', { dataset: { id: car.id } }, [
        el('td', { class: 'cell-id', text: `#${car.id}` }),

        el('td', {}, [
            el('div', { class: 'cell-person' }, [
                el('div', { class: 'avatar avatar-square' }, [icon('car', { size: 16 })]),
                el('div', { class: 'person-info' }, [
                    el('div', { class: 'person-name', text: `${car.brand} ${car.model}` }),
                    el('div', { class: 'person-sub', text: [car.year, car.color].filter(Boolean).join(' · ') || '—' }),
                ]),
            ]),
        ]),

        el('td', {}, [
            el('div', { class: 'role-cell' }, [
                el('span', { class: 'plate', text: car.plate || 'без номера' }),
                el('span', { class: 'role-code', text: car.vin || 'VIN не указан' }),
            ]),
        ]),

        el('td', { class: 'cell-hide-sm' }, [
            car.client_name
                ? el('div', { class: 'person-info' }, [
                    el('div', { class: 'person-name', text: car.client_name }),
                    el('div', { class: 'person-sub', text: car.client_phone || '' }),
                ])
                : el('span', { class: 'muted', text: 'без владельца' }),
        ]),

        el('td', { class: 'cell-hide-sm' }, [
            el('span', { class: 'badge', text: car.mileage ? `${car.mileage.toLocaleString('ru-RU')} км` : '—' }),
        ]),

        el('td', { class: 'col-actions' }, [
            el('div', { class: 'actions-cell' }, [
                el('button', {
                    class: 'btn-icon',
                    type: 'button',
                    title: 'Редактировать',
                    'aria-label': `Редактировать ${car.brand} ${car.model}`,
                    onclick: () => context.onEdit(car),
                }, [icon('edit', { size: 16 })]),
                el('button', {
                    class: 'btn-icon is-danger',
                    type: 'button',
                    title: 'Удалить',
                    'aria-label': `Удалить ${car.brand} ${car.model}`,
                    onclick: () => context.onDelete(car),
                }, [icon('trash', { size: 16 })]),
            ]),
        ]),
    ]);
}

/* ---------- Страница ---------- */

export async function renderCars({ container, params }) {
    const state = createState();
    state.query = params?.get('q') || '';

    const tableBody = el('tbody');
    const metaNode = el('span', { class: 'table-meta', text: '' });

    const searchInput = el('input', {
        class: 'input',
        type: 'search',
        placeholder: 'Поиск по VIN, госномеру, марке или владельцу',
        value: state.query,
        'aria-label': 'Поиск автомобилей',
    });

    const addBtn = el('button', {
        class: 'btn btn-primary',
        type: 'button',
        onclick: () => openCarModal(null),
    }, [icon('plus', { size: 16 }), 'Добавить автомобиль']);

    function filtered() {
        const query = state.query.trim().toLowerCase();
        if (!query) return state.cars;
        return state.cars.filter((car) =>
            [car.brand, car.model, car.plate, car.vin, car.client_name, car.color]
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
                    el('h4', { text: 'Не удалось загрузить автопарк' }),
                    el('p', { text: state.error }),
                ]),
            ])])]);
            return;
        }

        const rows = filtered();

        if (!rows.length) {
            mount(tableBody, [el('tr', {}, [el('td', { colspan: 5 }, [
                el('div', { class: 'empty-state' }, [
                    icon('car', { size: 40 }),
                    el('h4', { text: state.query ? 'Ничего не найдено' : 'Автомобилей пока нет' }),
                    el('p', { text: state.query ? 'Проверьте VIN или госномер.' : 'Добавьте первый автомобиль в базу сервиса.' }),
                ]),
            ])])]);
            metaNode.textContent = '';
            return;
        }

        const context = { onEdit: openCarModal, onDelete: removeCar };
        mount(tableBody, rows.map((car) => carRow(car, context)));
        metaNode.textContent = `${rows.length} ${plural(rows.length, ['автомобиль', 'автомобиля', 'автомобилей'])}`;
    }

    async function reload() {
        state.loading = true;
        state.error = null;
        renderTable();

        try {
            state.cars = await carsApi.list();
        } catch (error) {
            state.error = error.message || 'Ошибка сети';
            state.cars = [];
        } finally {
            state.loading = false;
            renderTable();
        }
    }

    async function openCarModal(car) {
        const isEdit = Boolean(car);

        // Справочник владельцев нужен только при открытии формы
        if (!state.clients.length) {
            try {
                state.clients = await clientsApi.list();
            } catch {
                state.clients = [];
            }
        }

        openModal({
            title: isEdit ? 'Карточка автомобиля' : 'Новый автомобиль',
            subtitle: isEdit ? `ID ${car.id}` : 'Заполните данные авто и выберите владельца',
            size: 'sm',
            body: buildCarForm({
                car,
                clients: state.clients,
                onSubmit: async (payload) => {
                    if (isEdit) {
                        await carsApi.update(car.id, payload);
                        notify.success('Данные автомобиля обновлены');
                    } else {
                        await carsApi.create(payload);
                        notify.success('Автомобиль добавлен');
                    }
                    closeModal();
                    await reload();
                },
            }),
        });
    }

    async function removeCar(car) {
        const confirmed = await confirmDialog({
            title: 'Удалить автомобиль?',
            message: `${car.brand} ${car.model} (${car.plate || 'без номера'}) будет удалён из базы.`,
            confirmText: 'Удалить',
            danger: true,
        });
        if (!confirmed) return;

        try {
            await carsApi.remove(car.id);
            notify.success('Автомобиль удалён');
            await reload();
        } catch (error) {
            notify.error(error.message || 'Не удалось удалить автомобиль');
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
                el('h1', { class: 'page-title', text: 'Автомобили' }),
                el('p', { class: 'page-description', text: 'Автопарк сервиса: VIN, госномер, пробег и владелец.' }),
            ]),
            el('div', { class: 'page-header-actions' }, [addBtn]),
        ]),

        el('section', { class: 'card' }, [
            el('div', { class: 'table-toolbar' }, [searchField, metaNode]),
            el('div', { class: 'table-wrap' }, [
                el('table', { class: 'table workers-table' }, [
                    el('thead', {}, [el('tr', {}, [
                        el('th', { text: 'ID' }),
                        el('th', { text: 'Автомобиль' }),
                        el('th', { text: 'Номер / VIN' }),
                        el('th', { class: 'cell-hide-sm', text: 'Владелец' }),
                        el('th', { class: 'cell-hide-sm', text: 'Пробег' }),
                        el('th', { class: 'col-actions', text: 'Действия' }),
                    ])]),
                    tableBody,
                ]),
            ]),
        ]),
    ]);

    mount(container, [page]);
    await reload();
    return () => { state.cars = []; };
}