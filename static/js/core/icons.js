/**
 * core/icons.js — инлайновые SVG-иконки (24×24, stroke).
 * Инлайн вместо спрайта: не нужен дополнительный запрос, цвет наследуется от currentColor.
 */

const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    users: '<path d="M16 20v-1.5a4.5 4.5 0 0 0-4.5-4.5h-3A4.5 4.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3.5"/><path d="M20 20v-1.5a4.5 4.5 0 0 0-3.2-4.3M15.5 4.6a3.5 3.5 0 0 1 0 6.8"/>',
    car: '<path d="M5 16.5h14M4.5 12l1.6-4.2A2 2 0 0 1 8 6.5h8a2 2 0 0 1 1.9 1.3L19.5 12v4.5a1 1 0 0 1-1 1h-1.5a1 1 0 0 1-1-1V16"/><path d="M4.5 12h15v4.5"/><circle cx="7.5" cy="16.2" r="1.4"/><circle cx="16.5" cy="16.2" r="1.4"/>',
    client: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/>',
    detail: '<path d="M14.5 4.5l5 5-9 9H5.5v-5z"/><path d="M12.5 6.5l5 5"/>',
    service: '<path d="M14.5 6.5a3.5 3.5 0 0 0-4.9 4.2l-6 6a1.6 1.6 0 0 0 2.2 2.2l6-6a3.5 3.5 0 0 0 4.2-4.9l-2.1 2.1-2.1-2.1z"/>',
    request: '<path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1-1.5z"/><path d="M13.5 3.6V8h4.4M9 12h6M9 15.5h4"/>',
    report: '<path d="M4 20V9M10 20V4M16 20v-7M22 20H2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M9 7V4.5h6V7M6 7l1 13h10l1-13"/><path d="M10 11v5M14 11v5"/>',
    logout: '<path d="M15 17l5-5-5-5M20 12H9"/><path d="M12 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8.3 8.3 0 1 0 10.5 10.5z"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    wrench: '<path d="M15 4.5a4 4 0 0 0-5.2 5.2L4.5 15v4.5H9l5.3-5.3A4 4 0 0 0 19.5 9z"/>',
    inbox: '<path d="M3 13h4l2 3h6l2-3h4"/><path d="M5.5 5h13l2.5 8v5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-5z"/>',
    shield: '<path d="M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
};

/**
 * @param {keyof typeof paths} name
 * @param {{size?: number, class?: string}} [options]
 * @returns {SVGElement}
 */
export function icon(name, { size = 20, class: className = '' } = {}) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    if (className) svg.setAttribute('class', className);
    svg.innerHTML = paths[name] || paths.inbox;
    return svg;
}