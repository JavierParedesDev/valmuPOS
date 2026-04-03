export function hydrateAuditLogState(auditLogState, rawLog) {
    if (!rawLog) {
        auditLogState.entries = [];
        return false;
    }

    try {
        const parsed = JSON.parse(rawLog);
        auditLogState.entries = Array.isArray(parsed) ? parsed : [];
        return true;
    } catch (_error) {
        auditLogState.entries = [];
        return false;
    }
}

export function buildAuditEntry({ type, title, detail }) {
    return {
        id: `audit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        type: type || 'info',
        title: title || 'Evento',
        detail: detail || '',
        createdAt: new Date().toISOString()
    };
}

export function appendAuditEntry(auditLogState, entry, limit = 80) {
    auditLogState.entries.unshift(entry);
    auditLogState.entries = auditLogState.entries.slice(0, limit);
}
