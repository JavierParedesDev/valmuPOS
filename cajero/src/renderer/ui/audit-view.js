import { formatDateTime, escapeHtml } from '../utils/formatters.js';

export function renderAuditLogView(entries) {
    const list = document.getElementById('audit-log-list');
    const count = document.getElementById('audit-log-count');

    if (!list || !count) {
        return;
    }

    count.textContent = String(entries.length);

    if (!entries.length) {
        list.innerHTML = '<div class="turn-history-empty">Sin eventos de auditoria aun.</div>';
        return;
    }

    list.innerHTML = entries.map((entry) => `
        <article class="turn-history-item audit-log-item audit-${escapeHtml(entry.type || 'info')}">
            <div class="turn-history-meta">
                <strong>${escapeHtml(entry.title)}</strong>
                <span>${formatDateTime(entry.createdAt)}</span>
            </div>
            <div class="turn-history-detail">${escapeHtml(entry.detail)}</div>
        </article>
    `).join('');
}
