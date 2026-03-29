export function hydrateTurnSummaryState(turnSummaryState, rawSummary) {
    if (!rawSummary) {
        turnSummaryState.salesCount = 0;
        turnSummaryState.totalCash = 0;
        turnSummaryState.totalCard = 0;
        turnSummaryState.totalTransfer = 0;
        turnSummaryState.totalInternal = 0;
        return false;
    }

    try {
        const parsed = JSON.parse(rawSummary);
        turnSummaryState.salesCount = Number(parsed?.salesCount || 0);
        turnSummaryState.totalCash = Number(parsed?.totalCash || 0);
        turnSummaryState.totalCard = Number(parsed?.totalCard || 0);
        turnSummaryState.totalTransfer = Number(parsed?.totalTransfer || 0);
        turnSummaryState.totalInternal = Number(parsed?.totalInternal || 0);
        return true;
    } catch (_error) {
        turnSummaryState.salesCount = 0;
        turnSummaryState.totalCash = 0;
        turnSummaryState.totalCard = 0;
        turnSummaryState.totalTransfer = 0;
        turnSummaryState.totalInternal = 0;
        return false;
    }
}

export function resetTurnSummaryState(turnSummaryState) {
    turnSummaryState.salesCount = 0;
    turnSummaryState.totalCash = 0;
    turnSummaryState.totalCard = 0;
    turnSummaryState.totalTransfer = 0;
    turnSummaryState.totalInternal = 0;
}

export function hydrateTurnHistoryState(turnHistoryState, rawHistory) {
    if (!rawHistory) {
        turnHistoryState.entries = [];
        return false;
    }

    try {
        const parsed = JSON.parse(rawHistory);
        turnHistoryState.entries = Array.isArray(parsed) ? parsed : [];
        return true;
    } catch (_error) {
        turnHistoryState.entries = [];
        return false;
    }
}

export function buildTurnHistoryEntry({ title, detail }) {
    return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        title: String(title || 'Movimiento'),
        detail: String(detail || ''),
        createdAt: new Date().toISOString()
    };
}
