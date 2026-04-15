import { cashSessionState, turnSummaryState } from '../state/store.js';
import { formatCurrency } from '../utils/formatters.js';

export function getExpectedCashAmount() {
    return Math.max(0, cashSessionState.openingAmount + turnSummaryState.totalCash - Number(turnSummaryState.totalWithdrawals || 0));
}

export function getTurnSalesTotal() {
    return turnSummaryState.totalCash
        + turnSummaryState.totalCard
        + turnSummaryState.totalTransfer
        + turnSummaryState.totalInternal;
}

export function formatDifferenceLabel(value) {
    if (value > 0) {
        return `+$${formatCurrency(value)}`;
    }

    if (value < 0) {
        return `-$${formatCurrency(Math.abs(value))}`;
    }

    return '$0';
}
