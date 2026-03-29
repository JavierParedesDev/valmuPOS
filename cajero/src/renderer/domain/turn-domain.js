import { cashSessionState, turnSummaryState } from '../state/store.js';
import { formatCurrency } from '../utils/formatters.js';

export function getExpectedCashAmount() {
    return cashSessionState.openingAmount + turnSummaryState.totalCash;
}

export function getTurnSalesTotal() {
    return turnSummaryState.totalCash
        + turnSummaryState.totalCard
        + turnSummaryState.totalTransfer;
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
