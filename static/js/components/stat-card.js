/**
 * components/stat-card.js — KPI-карточка главного экрана.
 *
 * createStatCard({ label, value, icon, hint, tone })
 * setStatValue(card, value) — обновление числа без перерисовки.
 */

import { el } from '../core/dom.js';
import { icon as makeIcon } from '../core/icons.js';

export function createStatCard({ label, value = '—', icon = 'report', hint = '', tone = 'accent' }) {
    const toneClass = tone === 'accent' ? '' : ` is-${tone}`;

    const valueNode = el('div', {
        class: `stat-value${value === '—' ? ' is-loading' : ''}`,
        text: String(value),
    });

    const hintNode = el('div', { class: 'stat-foot' }, [
        el('span', { class: 'text-xs', text: hint }),
    ]);

    const card = el('div', { class: `stat-card${toneClass}` }, [
        el('div', { class: 'stat-head' }, [
            el('div', { class: 'stat-icon' }, [makeIcon(icon, { size: 18 })]),
            el('span', { class: 'stat-label', text: label }),
        ]),
        valueNode,
        hintNode,
    ]);

    return card;
}

export function setStatValue(card, value, hint) {
    const valueNode = card.querySelector('.stat-value');
    if (valueNode) {
        valueNode.textContent = String(value);
        valueNode.classList.toggle('is-loading', value === '—');
    }

    if (hint !== undefined) {
        const hintNode = card.querySelector('.stat-foot');
        if (hintNode) hintNode.replaceChildren(el('span', { class: 'text-xs', text: hint }));
    }
}