import { el, mount } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { workflowApi } from '../core/api.js';
import { createStatCard } from '../components/stat-card.js';

const money = value => `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
const statusLabels = { new: 'Новые', diagnostics: 'Диагностика', approved: 'Согласованы', in_progress: 'В работе', waiting_parts: 'Ожидают деталей', completed: 'Завершены', cancelled: 'Отменены' };

export async function renderReports({ container }) {
    mount(container, el('div', { class: 'loading-state', text: 'Собираем отчёт…' }));
    try {
        const report = await workflowApi.reports();
        const o = report.overview;
        const stats = el('div', { class: 'stat-grid report-stat-grid' }, [
            createStatCard({ label: 'Всего заявок', value: o.total_requests, icon: 'request', hint: `${o.active_requests} активных`, tone: 'info' }),
            createStatCard({ label: 'Завершено', value: o.completed_requests, icon: 'shield', hint: `${o.cancelled_requests} отменено`, tone: 'success' }),
            createStatCard({ label: 'Выручка', value: money(o.revenue), icon: 'report', hint: 'по завершённым заявкам', tone: 'accent' }),
            createStatCard({ label: 'Смета', value: money(o.total_estimate), icon: 'service', hint: 'по всем заявкам', tone: 'warning' }),
        ]);
        const statuses = report.statuses.length ? report.statuses.map(row => el('div', { class: 'report-bar-row' }, [el('div', { class: 'report-bar-label' }, [el('span', { text: statusLabels[row.status] || row.status }), el('strong', { text: row.count })]), el('div', { class: 'report-bar-track' }, [el('div', { class: 'report-bar-fill', style: { width: `${Math.max(8, row.count / Math.max(...report.statuses.map(x => x.count)) * 100)}%` } })])])) : [el('p', { class: 'muted', text: 'Данных по заявкам пока нет.' })];
        const services = report.top_services.length ? report.top_services.map(row => el('tr', {}, [el('td', { class: 'cell-strong', text: row.name }), el('td', { text: row.code }), el('td', { text: `${row.quantity} шт.` }), el('td', { text: money(row.revenue) })])) : [el('tr', {}, [el('td', { colspan: 4 }, [el('div', { class: 'empty-state' }, [el('p', { text: 'Услуги ещё не добавлялись в заявки.' })])])])];
        const stock = report.low_stock.length ? report.low_stock.map(row => el('tr', {}, [el('td', { class: 'cell-strong', text: row.name }), el('td', { text: row.article }), el('td', { text: `${row.stock_quantity} шт.` }), el('td', { text: `${row.min_stock} шт.` }), el('td', {}, [el('span', { class: 'badge badge-warning', text: 'Низкий остаток' })])])) : [el('tr', {}, [el('td', { colspan: 5 }, [el('div', { class: 'empty-state' }, [icon('shield', { size: 32 }), el('p', { text: 'Все остатки в норме.' })])])])];
        const page = el('div', { class: 'workers-page reports-page' }, [
            el('div', { class: 'page-header' }, [el('div', { class: 'page-header-text' }, [el('h1', { class: 'page-title', text: 'Отчёты' }), el('p', { class: 'page-description', text: 'Оперативные показатели сервиса, заявки, выручка и состояние склада.' })]), el('div', { class: 'page-header-actions' }, [el('button', { class: 'btn btn-ghost', type: 'button', text: 'Обновить', onclick: () => renderReports({ container }) }, [icon('clock', { size: 16 })])])]),
            stats,
            el('div', { class: 'report-grid' }, [
                el('section', { class: 'card report-card' }, [el('div', { class: 'card-header' }, [el('div', {}, [el('div', { class: 'card-title', text: 'Заявки по статусам' }), el('div', { class: 'card-subtitle', text: 'Текущее распределение' })])]), el('div', { class: 'report-bars' }, statuses)]),
                el('section', { class: 'card report-card' }, [el('div', { class: 'card-header' }, [el('div', {}, [el('div', { class: 'card-title', text: 'Популярные услуги' }), el('div', { class: 'card-subtitle', text: 'Количество и оборот' })])]), el('div', { class: 'table-wrap' }, [el('table', { class: 'table' }, [el('thead', {}, [el('tr', {}, ['Услуга', 'Код', 'Количество', 'Оборот'].map(x => el('th', { text: x })))]), el('tbody', {}, services)])])]),
            ]),
            el('section', { class: 'card report-card' }, [el('div', { class: 'card-header' }, [el('div', {}, [el('div', { class: 'card-title', text: 'Контроль склада' }), el('div', { class: 'card-subtitle', text: 'Детали, которые нужно пополнить' })])]), el('div', { class: 'table-wrap' }, [el('table', { class: 'table' }, [el('thead', {}, [el('tr', {}, ['Деталь', 'Артикул', 'Остаток', 'Минимум', 'Статус'].map(x => el('th', { text: x })))]), el('tbody', {}, stock)])])]),
        ]);
        mount(container, page);
    } catch (error) {
        mount(container, el('div', { class: 'card empty-state' }, [icon('report', { size: 44 }), el('h4', { text: 'Не удалось сформировать отчёт' }), el('p', { text: error.message })]));
    }
}
