import { el, mount, debounce, plural } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { workflowApi, clientsApi, carsApi, workersApi } from '../core/api.js';
import { openModal, closeModal, confirmDialog } from '../components/modal.js';
import { notify } from '../components/toast.js';
import { store } from '../core/store.js';

const REQUEST_STATUSES = {
    new: ['Новая', 'info'],
    diagnostics: ['Диагностика', 'warning'],
    approved: ['Согласована', 'accent'],
    in_progress: ['В работе', 'accent'],
    waiting_parts: ['Ожидает детали', 'warning'],
    completed: ['Завершена', 'success'],
    cancelled: ['Отменена', 'danger'],
};

const money = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
const statusLabel = (value) => REQUEST_STATUSES[value]?.[0] || value;
const statusBadge = (value) => el('span', { class: `badge badge-${REQUEST_STATUSES[value]?.[1] || 'neutral'}`, text: statusLabel(value) });
const field = (label, control) => el('div', { class: 'field' }, [el('label', { class: 'field-label', text: label }), control]);
const inputField = (label, value = '', type = 'text') => { const node = el('input', { class: 'input', type, value }); return { node, wrap: field(label, node) }; };
const areaField = (label, value = '') => { const node = el('textarea', { class: 'input textarea', rows: 3, value }); return { node, wrap: field(label, node) }; };
const selectField = (label, options, selected = '') => { const node = el('select', { class: 'select' }, options.map(option => el('option', { value: String(option.value), text: option.label, selected: String(option.value) === String(selected) }))); return { node, wrap: field(label, node) }; };
const errorNode = () => el('div', { class: 'field-error', role: 'alert' });
const storeAllowsCatalogWrite = () => ['admin', 'manager'].includes(store.user?.role);
const storeAllowsRequestEdit = () => ['admin', 'manager', 'mechanic'].includes(store.user?.role);
const modalFooter = (label) => el('div', { class: 'modal-foot' }, [el('button', { class: 'btn btn-ghost', type: 'button', text: 'Отмена', onclick: closeModal }), el('button', { class: 'btn btn-primary', type: 'submit', text: label })]);

function catalogForm(kind, item, onSubmit) {
    const isService = kind === 'services';
    const editing = Boolean(item);
    const name = inputField('Название', item?.name || '');
    const code = inputField(isService ? 'Код услуги' : 'Артикул', item?.[isService ? 'code' : 'article'] || '');
    const price = inputField('Цена, ₽', item?.price ?? '', 'number');
    const description = areaField('Описание', item?.description || '');
    const quantity = inputField(isService ? 'Длительность, минут' : 'Остаток на складе', item?.[isService ? 'duration_minutes' : 'stock_quantity'] ?? (isService ? 60 : 0), 'number');
    const minimum = isService ? null : inputField('Минимальный остаток', item?.min_stock ?? 0, 'number');
    const active = selectField('Статус', [{ value: 'true', label: 'Активна' }, { value: 'false', label: 'Отключена' }], String(item?.is_active ?? true));
    const error = errorNode();
    const form = el('form', { class: 'worker-form', onsubmit: async (event) => {
        event.preventDefault();
        error.textContent = '';
        const nameValue = name.node.value.trim();
        const codeValue = code.node.value.trim();
        const priceValue = Number(price.node.value);
        const quantityValue = Number(quantity.node.value);
        const invalidQuantity = !Number.isFinite(quantityValue) || (isService ? quantityValue <= 0 : quantityValue < 0);
        if (!nameValue || !codeValue || !Number.isFinite(priceValue) || priceValue < 0 || invalidQuantity) {
            error.textContent = 'Заполните обязательные поля и проверьте числовые значения';
            return;
        }
        const payload = isService
            ? { name: nameValue, code: codeValue.toUpperCase(), description: description.node.value.trim(), price: priceValue, duration_minutes: quantityValue, is_active: active.node.value === 'true' }
            : { name: nameValue, article: codeValue, description: description.node.value.trim(), price: priceValue, stock_quantity: quantityValue, min_stock: Number(minimum.node.value), is_active: active.node.value === 'true' };
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        submit.textContent = 'Сохраняем…';
        try { await onSubmit(payload); } catch (errorValue) { error.textContent = errorValue.message || 'Не удалось сохранить'; submit.disabled = false; submit.textContent = editing ? 'Сохранить' : 'Добавить'; }
    } }, [el('div', { class: 'field-row' }, [name.wrap, code.wrap]), el('div', { class: 'field-row' }, [price.wrap, quantity.wrap]), minimum?.wrap, description.wrap, active.wrap, error, modalFooter(editing ? 'Сохранить' : 'Добавить')]);
    return form;
}

function catalogRow(item, kind, actions) {
    const isService = kind === 'services';
    const isLow = !isService && item.stock_quantity <= item.min_stock;
    return el('tr', {}, [
        el('td', { class: 'cell-id', text: `#${item.id}` }),
        el('td', {}, [el('div', { class: 'cell-person' }, [el('div', { class: 'avatar avatar-square' }, [icon(isService ? 'service' : 'detail', { size: 16 })]), el('div', { class: 'person-info' }, [el('div', { class: 'person-name', text: item.name }), el('div', { class: 'person-sub', text: item.description || 'Без описания' })])])]),
        el('td', { class: 'cell-strong', text: isService ? item.code : item.article }),
        el('td', { text: money(item.price) }),
        isService ? el('td', { text: `${item.duration_minutes} мин.` }) : el('td', {}, [el('span', { class: `badge ${isLow ? 'badge-warning' : 'badge-success'}`, text: `${item.stock_quantity} шт.` })]),
        el('td', {}, [el('span', { class: `badge ${item.is_active ? 'badge-success' : 'badge-neutral'}`, text: item.is_active ? 'Активна' : 'Отключена' })]),
        el('td', { class: 'col-actions' }, [el('div', { class: 'actions-cell' }, [el('button', { class: 'btn-icon', type: 'button', title: 'Редактировать', 'aria-label': `Редактировать ${item.name}`, onclick: () => actions.edit(item) }, [icon('edit', { size: 16 })]), el('button', { class: 'btn-icon is-danger', type: 'button', title: 'Удалить', 'aria-label': `Удалить ${item.name}`, onclick: () => actions.remove(item) }, [icon('trash', { size: 16 })])])]),
    ]);
}

export async function renderCatalog({ container, kind }) {
    const isService = kind === 'services';
    const title = isService ? 'Услуги' : 'Детали';
    const state = { rows: [], query: '', loading: true, error: null };
    const body = el('tbody');
    const meta = el('span', { class: 'table-meta' });
    const search = el('input', { class: 'input', type: 'search', placeholder: isService ? 'Поиск по названию или коду…' : 'Поиск по названию или артикулу…', 'aria-label': `Поиск: ${title}` });

    const reload = async () => {
        state.loading = true;
        state.error = null;
        renderTable();
        try { state.rows = isService ? await workflowApi.services() : await workflowApi.details(); } catch (error) { state.error = error.message; state.rows = []; } finally { state.loading = false; renderTable(); }
    };
    const edit = (item) => openModal({ title: item ? `Редактирование: ${title.toLowerCase()}` : `Новая ${isService ? 'услуга' : 'деталь'}`, subtitle: item ? `ID ${item.id}` : 'Заполните карточку', body: catalogForm(kind, item, async payload => { if (item) { if (isService) await workflowApi.updateService(item.id, payload); else await workflowApi.updateDetail(item.id, payload); notify.success('Изменения сохранены'); } else { if (isService) await workflowApi.createService(payload); else await workflowApi.createDetail(payload); notify.success(`${isService ? 'Услуга' : 'Деталь'} добавлена`); } closeModal(); await reload(); }) });
    const remove = async (item) => {
        const ok = await confirmDialog({ title: `Удалить ${isService ? 'услугу' : 'деталь'}?`, message: `«${item.name}» будет удалена из каталога.`, confirmText: 'Удалить', danger: true });
        if (!ok) return;
        try { if (isService) await workflowApi.removeService(item.id); else await workflowApi.removeDetail(item.id); notify.success('Запись удалена'); await reload(); } catch (error) { notify.error(error.message); }
    };
    const renderTable = () => {
        const rows = state.rows.filter(row => !state.query || [row.name, row.code, row.article, row.description].filter(Boolean).some(value => String(value).toLowerCase().includes(state.query.toLowerCase())));
        meta.textContent = `${rows.length} ${plural(rows.length, isService ? ['услуга', 'услуги', 'услуг'] : ['деталь', 'детали', 'деталей'])}`;
        if (state.loading) {
            const skeletonRows = [1, 2, 3].map(() => el('tr', {}, [1, 2, 3, 4, 5, 6, 7].map(() => el('td', {}, [el('div', { class: 'skeleton', style: { height: '14px' } })]))));
            mount(body, skeletonRows);
            return;
        }
        if (state.error) {
            const empty = el('div', { class: 'empty-state' }, [icon('shield', { size: 40 }), el('h4', { text: 'Не удалось загрузить данные' }), el('p', { text: state.error })]);
            mount(body, [el('tr', {}, [el('td', { colspan: 7 }, [empty])])]);
            return;
        }
        if (!rows.length) {
            const empty = el('div', { class: 'empty-state' }, [icon(isService ? 'service' : 'detail', { size: 40 }), el('h4', { text: state.query ? 'Ничего не найдено' : 'Записей пока нет' }), el('p', { text: 'Добавьте первую запись кнопкой выше.' })]);
            mount(body, [el('tr', {}, [el('td', { colspan: 7 }, [empty])])]);
            return;
        }
        mount(body, rows.map(row => catalogRow(row, kind, { edit, remove })));
    };
    search.addEventListener('input', debounce(() => { state.query = search.value.trim(); renderTable(); }, 180));
    const page = el('div', { class: 'workers-page' }, [
        el('div', { class: 'page-header' }, [el('div', { class: 'page-header-text' }, [el('h1', { class: 'page-title', text: title }), el('p', { class: 'page-description', text: isService ? 'Прайс-лист работ, нормативная длительность и доступность для заявок.' : 'Склад деталей: цены, остатки и контроль минимального запаса.' })]), storeAllowsCatalogWrite() ? el('div', { class: 'page-header-actions' }, [el('button', { class: 'btn btn-primary', type: 'button', onclick: () => edit(null) }, [icon('plus', { size: 16 }), isService ? 'Добавить услугу' : 'Добавить деталь'])]) : null]),
        el('section', { class: 'card' }, [el('div', { class: 'table-toolbar' }, [el('div', { class: 'search-field' }, [icon('search', { size: 16 }), search]), meta]), el('div', { class: 'table-wrap' }, [el('table', { class: 'table workers-table catalog-table' }, [el('thead', {}, [el('tr', {}, ['ID', isService ? 'Услуга' : 'Деталь', isService ? 'Код' : 'Артикул', 'Цена', isService ? 'Длительность' : 'Остаток', 'Статус', 'Действия'].map(text => el('th', { text })))]), body])])]),
    ]);
    mount(container, page);
    renderTable();
    await reload();
    return () => { state.rows = []; };
}

function requestForm(clients, cars, onSubmit) {
    const client = selectField('Клиент', [{ value: '', label: '— выберите клиента —' }, ...clients.map(row => ({ value: row.id, label: `${row.full_name} · ${row.phone}` }))]);
    const car = selectField('Автомобиль', [{ value: '', label: '— выберите автомобиль —' }, ...cars.filter(row => row.client_id).map(row => ({ value: row.id, label: `${row.brand} ${row.model} · ${row.plate || 'без номера'} · ${row.client_name || ''}` }))]);
    const complaint = areaField('Что беспокоит клиента');
    const mileage = inputField('Пробег, км', '', 'number');
    const error = errorNode();
    return el('form', { class: 'worker-form', onsubmit: async (event) => { event.preventDefault(); error.textContent = ''; if (!client.node.value || !car.node.value || !complaint.node.value.trim()) { error.textContent = 'Выберите клиента, автомобиль и опишите неисправность'; return; } try { await onSubmit({ client_id: Number(client.node.value), car_id: Number(car.node.value), complaint: complaint.node.value.trim(), mileage: mileage.node.value ? Number(mileage.node.value) : null }); } catch (errorValue) { error.textContent = errorValue.message; } } }, [el('div', { class: 'field-row' }, [client.wrap, car.wrap]), complaint.wrap, mileage.wrap, error, modalFooter('Создать заявку')]);
}

function requestRow(row, actions) {
    return el('tr', {}, [
        el('td', { class: 'cell-id', text: `#${row.id}` }),
        el('td', {}, [el('div', { class: 'person-info' }, [el('div', { class: 'person-name', text: row.client_name }), el('div', { class: 'person-sub', text: row.complaint || 'Без описания' })])]),
        el('td', { class: 'cell-strong', text: row.car_label }),
        el('td', {}, [statusBadge(row.status)]),
        el('td', { text: money(row.estimate) }),
        el('td', { class: 'cell-hide-sm', text: row.works_count ? `${row.works_count} ${plural(row.works_count, ['работа', 'работы', 'работ'])}` : '—' }),
        el('td', { class: 'col-actions' }, [el('div', { class: 'actions-cell' }, [el('button', { class: 'btn-icon', type: 'button', title: 'Открыть карточку', 'aria-label': `Открыть заявку ${row.id}`, onclick: () => actions.open(row) }, [icon('request', { size: 16 })]), storeAllowsRequestEdit() ? el('button', { class: 'btn-icon is-danger', type: 'button', title: 'Удалить', 'aria-label': `Удалить заявку ${row.id}`, onclick: () => actions.remove(row) }, [icon('trash', { size: 16 })]) : null])]),
    ]);
}

async function openRequest(row, refresh) {
    const modal = openModal({
        title: `Заявка #${row.id}`,
        subtitle: `${row.client_name} · ${row.car_label}`,
        size: 'lg',
        body: el('div', { class: 'loading-state', text: 'Загрузка карточки…' }),
    });
    try {
        const [data, services, details, workers] = await Promise.all([
            workflowApi.requestDetails(row.id),
            workflowApi.services(),
            workflowApi.details(),
            workersApi.list(),
        ]);
        const status = selectField('Статус заявки', Object.entries(REQUEST_STATUSES).map(([value, [label]]) => ({ value, label })), data.request.status);
        const diagnosis = areaField('Диагноз и комментарий мастера', data.request.diagnosis || '');
        const error = errorNode();
        const save = el('button', { class: 'btn btn-primary', type: 'button', text: 'Сохранить изменения', onclick: async () => {
            try {
                save.disabled = true;
                await workflowApi.updateRequest(row.id, { status: status.node.value, diagnosis: diagnosis.node.value.trim() });
                notify.success('Заявка обновлена');
                closeModal();
                await refresh();
            } catch (errorValue) { error.textContent = errorValue.message; save.disabled = false; }
        } });
        const itemRows = (items, empty) => items.length
            ? items.map(item => el('div', { class: 'detail-list-row' }, [el('span', { text: `${item.name} × ${item.quantity}` }), el('strong', { text: money(item.total) })]))
            : [el('p', { class: 'muted', text: empty })];
        const workRows = data.works.length
            ? data.works.map(item => el('div', { class: 'detail-list-row' }, [el('span', { text: `${item.description}${item.mechanic_name ? ` · ${item.mechanic_name}` : ''}` }), el('strong', { text: `${item.hours} ч · ${money(item.price)}` })]))
            : [el('p', { class: 'muted', text: 'Работы ещё не добавлены' })];
        const serviceSelect = selectField('Добавить услугу', [{ value: '', label: '— не добавлять услугу —' }, ...services.filter(item => item.is_active).map(item => ({ value: item.id, label: `${item.name} · ${money(item.price)}` }))]);
        const detailSelect = selectField('Добавить деталь', [{ value: '', label: '— не добавлять деталь —' }, ...details.filter(item => item.is_active && item.stock_quantity > 0).map(item => ({ value: item.id, label: `${item.name} · ${item.stock_quantity} шт.` }))]);
        const quantity = inputField('Количество', 1, 'number');
        const itemError = errorNode();
        const addItem = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Добавить позицию', onclick: async () => {
            try {
                if (Boolean(serviceSelect.node.value) === Boolean(detailSelect.node.value)) throw new Error('Выберите одну услугу или одну деталь');
                addItem.disabled = true;
                await workflowApi.addItem(row.id, { service_id: serviceSelect.node.value ? Number(serviceSelect.node.value) : null, detail_id: detailSelect.node.value ? Number(detailSelect.node.value) : null, quantity: Number(quantity.node.value) });
                notify.success('Позиция добавлена');
                closeModal();
                await openRequest(row, refresh);
            } catch (errorValue) { itemError.textContent = errorValue.message; addItem.disabled = false; }
        } });
        const workDescription = inputField('Выполненная работа');
        const workHours = inputField('Часы', 1, 'number');
        const workPrice = inputField('Стоимость, ₽', 0, 'number');
        const mechanic = selectField('Механик', [{ value: '', label: '— не назначен —' }, ...workers.filter(item => item.access_level === 'mechanic' || item.role === 'mechanic').map(item => ({ value: item.id, label: item.name }))]);
        const workError = errorNode();
        const addWork = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Добавить работу', onclick: async () => {
            try {
                if (!workDescription.node.value.trim()) throw new Error('Опишите выполненную работу');
                addWork.disabled = true;
                await workflowApi.addWork(row.id, { mechanic_id: mechanic.node.value ? Number(mechanic.node.value) : null, description: workDescription.node.value.trim(), hours: Number(workHours.node.value), price: Number(workPrice.node.value), status: 'done' });
                notify.success('Работа добавлена');
                closeModal();
                await openRequest(row, refresh);
            } catch (errorValue) { workError.textContent = errorValue.message; addWork.disabled = false; }
        } });
        mount(modal.body, [
            el('div', { class: 'request-summary' }, [
                el('div', {}, [el('span', { class: 'summary-label', text: 'Клиент' }), el('strong', { text: data.request.client_name })]),
                el('div', {}, [el('span', { class: 'summary-label', text: 'Автомобиль' }), el('strong', { text: data.request.car_label })]),
                el('div', {}, [el('span', { class: 'summary-label', text: 'Смета' }), el('strong', { class: 'summary-total', text: money(data.request.estimate) })]),
            ]),
            el('div', { class: 'request-grid' }, [
                el('div', { class: 'request-column' }, [el('h4', { class: 'section-title', text: 'Состояние заявки' }), status.wrap, diagnosis.wrap, error, save]),
                el('div', { class: 'request-column' }, [el('h4', { class: 'section-title', text: 'Услуги' }), el('div', { class: 'detail-list' }, itemRows(data.services, 'Услуги ещё не добавлены')), el('h4', { class: 'section-title', text: 'Детали' }), el('div', { class: 'detail-list' }, itemRows(data.details, 'Детали ещё не добавлены')), el('h4', { class: 'section-title', text: 'История работ' }), el('div', { class: 'detail-list' }, workRows)]),
            ]),
            storeAllowsRequestEdit() ? el('div', { class: 'request-actions-grid' }, [
                el('section', { class: 'request-action-card' }, [el('h4', { class: 'section-title', text: 'Добавить позицию в смету' }), el('div', { class: 'field-row' }, [serviceSelect.wrap, detailSelect.wrap]), quantity.wrap, itemError, addItem]),
                el('section', { class: 'request-action-card' }, [el('h4', { class: 'section-title', text: 'Зафиксировать работу' }), workDescription.wrap, el('div', { class: 'field-row' }, [workHours.wrap, workPrice.wrap]), mechanic.wrap, workError, addWork]),
            ]) : null,
        ]);
    } catch (error) {
        mount(modal.body, el('div', { class: 'empty-state' }, [icon('shield', { size: 40 }), el('h4', { text: 'Не удалось открыть заявку' }), el('p', { text: error.message })]));
    }
}

export async function renderRequests({ container, params }) {
    const state = { rows: [], query: params?.get('q') || '', status: '' };
    const body = el('tbody'); const meta = el('span', { class: 'table-meta' });
    const search = el('input', { class: 'input', type: 'search', placeholder: 'Поиск по клиенту, авто или номеру заявки…', value: state.query, 'aria-label': 'Поиск заявок' });
    const filter = selectField('Фильтр', [{ value: '', label: 'Все статусы' }, ...Object.entries(REQUEST_STATUSES).map(([value, [label]]) => ({ value, label }))]);
    const renderTable = () => { meta.textContent = `${state.rows.length} ${plural(state.rows.length, ['заявка', 'заявки', 'заявок'])}`; mount(body, state.rows.length ? state.rows.map(row => requestRow(row, { open: item => openRequest(item, reload), remove: remove })) : [el('tr', {}, [el('td', { colspan: 7 }, [el('div', { class: 'empty-state' }, [icon('request', { size: 40 }), el('h4', { text: 'Заявок пока нет' }), el('p', { text: 'Создайте первую заявку через кнопку выше.' })])])])]); };
    const reload = async () => { try { state.rows = await workflowApi.requests({ search: state.query, status: state.status }); renderTable(); } catch (error) { mount(body, el('tr', {}, [el('td', { colspan: 7 }, [el('div', { class: 'empty-state' }, [el('h4', { text: 'Не удалось загрузить заявки' }), el('p', { text: error.message })])]) ])); } };
    const remove = async (row) => { if (!await confirmDialog({ title: 'Удалить заявку?', message: `Заявка #${row.id} будет удалена вместе с историей работ.`, confirmText: 'Удалить', danger: true })) return; try { await workflowApi.removeRequest(row.id); notify.success('Заявка удалена'); await reload(); } catch (error) { notify.error(error.message); } };
    search.addEventListener('input', debounce(() => { state.query = search.value.trim(); reload(); }, 250));
    filter.node.addEventListener('change', () => { state.status = filter.node.value; reload(); });
    const create = async () => { try { const [clients, cars] = await Promise.all([clientsApi.list(), carsApi.list()]); openModal({ title: 'Новая заявка', subtitle: 'Свяжите клиента с его автомобилем', body: requestForm(clients, cars, async payload => { await workflowApi.createRequest(payload); closeModal(); notify.success('Заявка создана'); await reload(); }) }); } catch (error) { notify.error(error.message); } };
    const page = el('div', { class: 'workers-page' }, [el('div', { class: 'page-header' }, [el('div', { class: 'page-header-text' }, [el('h1', { class: 'page-title', text: 'Заявки' }), el('p', { class: 'page-description', text: 'Приём автомобилей, согласование работ, статусы и история обслуживания.' })]), storeAllowsRequestEdit() ? el('div', { class: 'page-header-actions' }, [el('button', { class: 'btn btn-primary', type: 'button', onclick: create }, [icon('plus', { size: 16 }), 'Новая заявка'])]) : null]), el('section', { class: 'card' }, [el('div', { class: 'table-toolbar request-toolbar' }, [el('div', { class: 'search-field' }, [icon('search', { size: 16 }), search]), filter.node, meta]), el('div', { class: 'table-wrap' }, [el('table', { class: 'table workers-table requests-table' }, [el('thead', {}, [el('tr', {}, ['ID', 'Клиент', 'Автомобиль', 'Статус', 'Смета', 'Работы', 'Действия'].map(text => el('th', { text })))]), body])])])]);
    mount(container, page); renderTable(); await reload(); return () => { state.rows = []; };
}

export const renderServices = (ctx) => renderCatalog({ ...ctx, kind: 'services' });
export const renderDetails = (ctx) => renderCatalog({ ...ctx, kind: 'details' });
