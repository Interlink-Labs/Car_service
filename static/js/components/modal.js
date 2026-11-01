/**
 * components/modal.js — модальное окно и диалог подтверждения.
 *
 * openModal({ title, subtitle, body, footer, size, onMount })
 *   → { close(), element, body }
 *
 * confirmDialog({ title, message, confirmText, danger }) → Promise<boolean>
 */

import { el, mount } from '../core/dom.js';

let activeModal = null;

function layer() {
    return document.getElementById('modal-root');
}

export function closeModal() {
    if (activeModal) activeModal.close();
}

export function openModal({
    title,
    subtitle = '',
    body = null,
    footer = null,
    size = 'md',
    closable = true,
    onMount = null,
}) {
    // Вторую модалку не открываем — сначала закрываем предыдущую
    closeModal();

    const root = layer();
    if (!root) return null;

    const bodyNode = el('div', { class: 'modal-body' });
    mount(bodyNode, body ?? []);
    if (typeof body === 'string') bodyNode.textContent = body;

    const head = el('div', { class: 'modal-head' }, [
        el('div', { class: 'modal-head-text' }, [
            el('h3', { class: 'modal-title', text: title }),
            subtitle ? el('p', { class: 'modal-subtitle', text: subtitle }) : null,
        ]),
        closable
            ? el('button', {
                class: 'modal-close',
                type: 'button',
                'aria-label': 'Закрыть',
                text: '×',
                onclick: () => close(),
            })
            : null,
    ]);

    const backdrop = el('div', {
        class: 'modal-backdrop',
        onclick: () => closable && close(),
    });

    const dialog = el(
        'div',
        { class: `modal-card modal-${size}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        [head, bodyNode, footer ? el('div', { class: 'modal-foot' }, footer) : null],
    );

    root.append(backdrop, dialog);
    root.classList.add('is-open');
    root.setAttribute('aria-hidden', 'false');

    // Esc закрывает окно
    const onKeyDown = (event) => {
        if (event.key === 'Escape' && closable) close();
    };
    document.addEventListener('keydown', onKeyDown);

    // Возврат фокуса на элемент, который открыл окно
    const previousFocus = document.activeElement;

    function close() {
        document.removeEventListener('keydown', onKeyDown);
        root.classList.remove('is-open');
        root.setAttribute('aria-hidden', 'true');
        mount(root, []);
        activeModal = null;
        if (previousFocus instanceof HTMLElement) previousFocus.focus();
    }

    activeModal = { close, element: dialog, body: bodyNode };

    // Фокус на первое поле ввода или на кнопку закрытия
    requestAnimationFrame(() => {
        const focusable =
            dialog.querySelector('input:not([type="hidden"]), select, textarea') ||
            dialog.querySelector('.modal-foot .btn-primary') ||
            dialog.querySelector('.modal-close');
        focusable?.focus();
    });

    if (typeof onMount === 'function') onMount({ body: bodyNode, dialog, close });

    return activeModal;
}

/** Кнопки футера: [{ label, variant, onClick, close }] */
export function modalFooter(buttons) {
    return buttons.map(({ label, variant = 'ghost', onClick, type = 'button', close = true, id }) =>
        el('button', {
            id,
            class: `btn btn-${variant}`,
            type,
            text: label,
            onclick: (event) => {
                const proceed = onClick ? onClick(event) : true;
                if (close && proceed !== false) closeModal();
            },
        }),
    );
}

/** Диалог подтверждения — возвращает промис с true/false. */
export function confirmDialog({
    title = 'Подтверждение',
    message = '',
    confirmText = 'Подтвердить',
    cancelText = 'Отмена',
    danger = false,
}) {
    return new Promise((resolve) => {
        let resolved = false;
        const finish = (value) => {
            if (resolved) return;
            resolved = true;
            resolve(value);
        };

        openModal({
            title,
            size: 'sm',
            body: el('p', { class: 'modal-message', text: message }),
            footer: [
                el('button', {
                    class: 'btn btn-ghost',
                    type: 'button',
                    text: cancelText,
                    onclick: () => {
                        finish(false);
                        closeModal();
                    },
                }),
                el('button', {
                    class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`,
                    type: 'button',
                    text: confirmText,
                    onclick: () => {
                        finish(true);
                        closeModal();
                    },
                }),
            ],
            onMount: ({ dialog }) => {
                // Закрытие крестиком/по Esc/фоном = отмена
                const observer = new MutationObserver(() => {
                    if (!dialog.isConnected) {
                        observer.disconnect();
                        finish(false);
                    }
                });
                observer.observe(dialog.parentNode, { childList: true });
            },
        });
    });
}