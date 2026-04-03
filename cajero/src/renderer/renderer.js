import {
    SESSION_KEYS,
    fallbackProducts,
    catalogState,
    saleState,
    cashSessionState,
    weightedProductState,
    turnHistoryState,
    auditLogState,
    turnSummaryState,
    salesHistoryState,
    saleReceiptState,
    dispatchReceiptState,
    invoiceClientState,
    saleActionState,
    dispatchState,
    DOCUMENT_TYPE_IDS,
    PAYMENT_METHOD_MAP
} from './state/store.js';
import {
    formatCurrency,
    formatQuantity,
    formatDateTime,
    capitalizePaymentMethod,
    normalizeApiBaseUrl,
    escapeHtml
} from './utils/formatters.js';
import {
    roundWeightedQuantity,
    getFamilyQuantityMap,
    getPricingForProduct,
    normalizeBackendProduct
} from './domain/pricing.js';
import {
    getExpectedCashAmount,
    getTurnSalesTotal,
    formatDifferenceLabel
} from './domain/turn-domain.js';
import {
    hydrateTurnSummaryState,
    resetTurnSummaryState,
    hydrateTurnHistoryState,
    buildTurnHistoryEntry
} from './domain/turn-state-domain.js';
import {
    hydrateAuditLogState,
    buildAuditEntry,
    appendAuditEntry
} from './domain/audit-domain.js';
import {
    normalizeCustomerList,
    filterCustomers,
    buildSaleCustomer
} from './domain/customer-domain.js';
import {
    normalizeSalesHistory,
    applyCancelledSaleToSummary,
    moveSaleToCancelled
} from './domain/sales-history-domain.js';
import {
    openWeightedState,
    closeWeightedState,
    resolveWeightedEditState,
    parseWeightedQuantity
} from './domain/weighted-domain.js';
import {
    findProductById,
    findCartItemByProductId,
    addUnitToCart,
    addWeightedQuantityToCart,
    setWeightedCartQuantity,
    updateCartItemQuantityValue,
    removeCartItemByProductId
} from './domain/cart-domain.js';
import {
    filterDispatchProducts,
    addProductToDispatchCart,
    updateDispatchCartQuantity,
    removeDispatchCartItem,
    buildDispatchSnapshot,
    buildDispatchPayload,
    buildDispatchRecord,
    decreaseLocalStockFromDispatchCart,
    normalizeDispatchCarrierList,
    normalizeDispatchHistory
} from './domain/dispatch-domain.js';
import {
    normalizeCatalogText,
    findCatalogProducts,
    getSelectedBranchNameFromList,
    buildNoStockMessage
} from './domain/catalog-domain.js';
import {
    getCartSnapshot as getCartSnapshotDomain,
    validateCartStock as validateCartStockDomain,
    buildSalePayload as buildSalePayloadDomain,
    decreaseLocalStockFromCart as decreaseLocalStockFromCartDomain
} from './domain/sale-domain.js';
import {
    renderSelectedBranchView,
    renderDocumentTypeView,
    renderCustomerSummaryView,
    renderSearchResultsView,
    renderCartView,
    renderCatalogStatusView
} from './ui/sale-view.js';
import {
    renderDispatchCarrierOptions,
    renderDispatchCarrierSummary,
    renderDispatchSearchResults,
    renderDispatchCart,
    renderDispatchRecords
} from './ui/dispatch-view.js';
import {
    showAppViewLayout,
    showLoginScreenView,
    showCashierAppView,
    setLoginStatusView,
    hydrateVersionView
} from './ui/app-view.js';
import { renderBranchSelectView } from './ui/branch-view.js';
import { renderAuditLogView } from './ui/audit-view.js';
import {
    renderCashSessionView,
    renderTurnSummaryView,
    renderTurnHistoryView,
    renderSalesHistoryView,
    renderCloseCashDifferenceView,
    setBackendStatusView
} from './ui/cash-view.js';
import {
    openInfoModalView,
    closeInfoModalView,
    openSaleCancellationModalView,
    closeSaleCancellationModalView,
    setSaleActionStatusView,
    openCashSessionModalView,
    closeCashSessionModalView,
    openInvoiceClientModalView,
    closeInvoiceClientModalView,
    setInvoiceClientStatusView,
    renderInvoiceClientOptionsView,
    openCloseCashModalView,
    closeCloseCashModalView,
    openWeightedModalView,
    closeWeightedModalView
} from './ui/modal-view.js';
import {
    openPaymentModalView,
    closePaymentModalView as closePaymentModalViewOnly,
    renderPaymentMethodView,
    renderPaymentChangeView
} from './ui/payment-view.js';
import { fetchBranches, fetchCategories, fetchInventory } from './services/catalog-service.js';
import {
    resolveBranchState,
    resolveCategoryState,
    resolveCatalogInventory,
    resolveOtherBranchStock
} from './services/catalog-runtime-service.js';
import { fetchCashStatus, openCashTurn, closeCashTurn } from './services/cash-service.js';
import { fetchSalesHistory, cancelSaleRequest, submitSaleRequest } from './services/sales-service.js';
import { fetchClients, createQuickCustomer } from './services/clientes-service.js';
import { loginCashier } from './services/auth-service.js';
import { printReceiptRecord } from './services/print-service.js';
import {
    fetchDispatchCarriers,
    fetchDispatchHistory,
    createDispatchCarrier,
    generateDispatchRequest
} from './services/dispatch-service.js';
import {
    getSettingsSnapshot,
    savePrinterSettingsSnapshot,
    saveCustomerDisplaySettingsSnapshot,
    saveUpdateSettingsSnapshot
} from './services/settings-service.js';
import {
    getSessionValue,
    setSessionValue,
    getJsonSessionValue,
    setJsonSessionValue,
    removeSessionValues
} from './services/session-service.js';

let activeOperationMode = 'sale';

document.addEventListener('DOMContentLoaded', async () => {
    hydrateVersion();
    hydrateLoginForm();
    bindLogin();
    bindLogout();
    bindSettings();
    bindNavigation();
    bindWeightedModal();
    bindCashSessionModal();
    bindPaymentModal();
    bindCloseCashModal();
    bindInvoiceClientModal();
    bindInfoModal();
    bindReceiptModal();
    bindDispatchReceiptModal();
    bindDispatchHistoryModal();
    bindDispatchCarrierModal();
    bindSaleActionModal();
    bindBranchSelection();
    bindSalesHistoryTabs();
    bindDispatchView();
    bindGlobalRuntimeGuards();

    if (getAuthToken() && getCurrentUser()) {
        await bootAuthenticatedSession();
        return;
    }

    showLoginScreen();
});

function bindGlobalRuntimeGuards() {
    window.addEventListener('error', (event) => {
        const detail = event?.error?.message || event?.message || 'Error inesperado en la interfaz.';
        handleRuntimeFailure({
            title: 'Error de interfaz',
            detail
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        const detail = event?.reason?.message || String(event?.reason || 'Promesa rechazada sin manejo.');
        handleRuntimeFailure({
            title: 'Error no controlado',
            detail
        });
    });
}

async function bootAuthenticatedSession() {
    try {
        await enterCashierMode();
    } catch (error) {
        console.error('Cashier bootstrap error:', error);
        handleRuntimeFailure({
            title: 'Error al iniciar cajero',
            detail: error?.message || 'No se pudo cargar el cajero con la sesion actual.'
        });
        resetCashierRuntimeState();
        showLoginScreen();
    }
}

function handleRuntimeFailure({ title, detail }) {
    setBackendStatus(detail);

    if (getAuthToken() && getCurrentUser()) {
        addAuditEntry({
            type: 'error',
            title,
            detail
        });
    } else {
        setLoginStatus(detail);
    }
}

function hydrateVersion() {
    hydrateVersionView(window.cajeroAPI?.version);
}

function hydrateLoginForm() {
    hydrateSettingsForm();
}

function bindLogin() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) {
        return;
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const usernameInput = document.getElementById('login-username-input');
        const passwordInput = document.getElementById('login-password-input');
        const submitButton = document.getElementById('login-submit-btn');

        const apiBaseUrl = normalizeApiBaseUrl(
            window.cajeroAPI?.apiBaseUrl || getApiBaseUrl()
        );
        const username = String(usernameInput?.value || '').trim();
        const password = String(passwordInput?.value || '').trim();

        submitButton.disabled = true;
        submitButton.textContent = 'Ingresando...';
        setLoginStatus('Validando credenciales...');

        try {
            const session = await loginCashier({
                apiBaseUrl,
                username,
                password
            });

            saveApiBaseUrl(session.apiBaseUrl);
            saveSession({
                token: session.token,
                user: session.user
            });
            addAuditEntry({
                type: 'success',
                title: 'Sesion iniciada',
                detail: `Ingreso correcto de ${session.user?.nombreCompleto || session.user?.nombreUsuario || 'cajero'}.`
            });

            await bootAuthenticatedSession();
        } catch (error) {
            console.error('Cashier login error:', error);
            setLoginStatus(error?.message || 'Ocurrio un error al iniciar sesion.');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Ingresar';
        }
    });
}

function bindLogout() {
    const logoutButton = document.getElementById('logout-btn');
    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener('click', () => {
        resetCashierRuntimeState();
        closeCustomerDisplayWindow();
        showLoginScreen();
    });
}

function bindNavigation() {
    const saleButton = document.getElementById('nav-sale-btn');
    const dispatchButton = document.getElementById('nav-dispatch-btn');
    const cashButton = document.getElementById('nav-cash-btn');
    const settingsButton = document.getElementById('nav-settings-btn');
    const headerCloseCashButton = document.getElementById('header-close-cash-btn');
    const headerCashButton = document.getElementById('header-cash-btn');
    const headerSettingsButton = document.getElementById('header-settings-btn');
    const saleDispatchButton = document.getElementById('sale-footer-dispatch-btn');
    const saleHistoryButton = document.getElementById('sale-footer-history-btn');

    saleButton?.addEventListener('click', () => showAppView('sale'));
    dispatchButton?.addEventListener('click', () => showAppView('dispatch'));
    cashButton?.addEventListener('click', () => showAppView('cash'));
    settingsButton?.addEventListener('click', () => showAppView('settings'));
    headerCloseCashButton?.addEventListener('click', openCloseCashModal);
    headerCashButton?.addEventListener('click', () => showAppView('cash'));
    headerSettingsButton?.addEventListener('click', () => showAppView('settings'));
    saleDispatchButton?.addEventListener('click', () => showAppView('dispatch'));
    saleHistoryButton?.addEventListener('click', () => {
        if (isDispatchMode()) {
            openDispatchHistoryModal();
            return;
        }
        showAppView('cash');
    });
}

function bindSettings() {
    document.getElementById('save-printer-settings-btn')?.addEventListener('click', savePrinterSettings);
    document.getElementById('save-customer-display-settings-btn')?.addEventListener('click', saveCustomerDisplaySettings);
    document.getElementById('open-customer-display-btn')?.addEventListener('click', openCustomerDisplayWindow);
    document.getElementById('close-customer-display-btn')?.addEventListener('click', closeCustomerDisplayWindow);
    document.getElementById('save-update-settings-btn')?.addEventListener('click', saveUpdateSettings);
    document.getElementById('check-updates-btn')?.addEventListener('click', checkGithubUpdates);
}

function bindBranchSelection() {
    document.getElementById('branch-select')?.addEventListener('change', handleBranchSelectionChange);
}

function bindDispatchView() {
    document.getElementById('dispatch-carrier-select')?.addEventListener('change', handleDispatchCarrierChange);
    document.getElementById('dispatch-inline-carrier-select')?.addEventListener('change', handleDispatchCarrierChange);
    const dispatchSearchInput = document.getElementById('dispatch-search-input');
    dispatchSearchInput?.addEventListener('input', handleDispatchSearchInput);
    dispatchSearchInput?.addEventListener('blur', () => {
        window.setTimeout(() => renderDispatchSearchResults([]), 120);
    });
    document.getElementById('dispatch-clear-btn')?.addEventListener('click', clearDispatchDraft);
    document.getElementById('dispatch-generate-btn')?.addEventListener('click', generateDispatchRecord);
    document.getElementById('dispatch-add-carrier-btn')?.addEventListener('click', openDispatchCarrierModal);
    document.getElementById('dispatch-inline-add-carrier-btn')?.addEventListener('click', openDispatchCarrierModal);
    document.getElementById('dispatch-footer-sale-btn')?.addEventListener('click', () => showAppView('sale'));
    document.getElementById('dispatch-footer-cash-btn')?.addEventListener('click', () => showAppView('cash'));
    document.getElementById('dispatch-footer-dispatch-btn')?.addEventListener('click', () => showAppView('dispatch'));
    document.getElementById('dispatch-footer-history-btn')?.addEventListener('click', openDispatchHistoryModal);
    document.getElementById('dispatch-open-history-btn')?.addEventListener('click', openDispatchHistoryModal);
    document.getElementById('dispatch-inline-history-btn')?.addEventListener('click', openDispatchHistoryModal);
}

function bindDispatchHistoryModal() {
    document.getElementById('dispatch-history-close-btn')?.addEventListener('click', closeDispatchHistoryModal);
    document.getElementById('dispatch-history-go-cash-btn')?.addEventListener('click', () => {
        closeDispatchHistoryModal();
        showAppView('cash');
    });
    document.getElementById('dispatch-history-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'dispatch-history-modal-backdrop') {
            closeDispatchHistoryModal();
        }
    });
}

function bindDispatchCarrierModal() {
    document.getElementById('dispatch-carrier-cancel-btn')?.addEventListener('click', closeDispatchCarrierModal);
    document.getElementById('dispatch-carrier-confirm-btn')?.addEventListener('click', confirmDispatchCarrier);
    document.getElementById('dispatch-carrier-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'dispatch-carrier-modal-backdrop') {
            closeDispatchCarrierModal();
        }
    });
}

function bindSalesHistoryTabs() {
    document.getElementById('sales-tab-active-btn')?.addEventListener('click', () => {
        salesHistoryState.currentTab = 'active';
        renderSalesHistory();
    });

    document.getElementById('sales-tab-cancelled-btn')?.addEventListener('click', () => {
        salesHistoryState.currentTab = 'cancelled';
        renderSalesHistory();
    });
}

function bindPaymentModal() {
    document.getElementById('charge-main-btn')?.addEventListener('click', handleMainChargeAction);
    document.getElementById('doc-boleta-toggle')?.addEventListener('click', () => {
        if (isDispatchMode()) {
            showAppView('sale');
            return;
        }
        saleState.documentType = 'Boleta';
        renderDocumentType();
    });
    document.getElementById('doc-factura-toggle')?.addEventListener('click', () => {
        if (isDispatchMode()) {
            showAppView('cash');
            return;
        }
        saleState.documentType = 'Factura';
        renderDocumentType();
    });
    document.getElementById('clear-sale-btn')?.addEventListener('click', clearCurrentSale);
    document.getElementById('sale-add-item-btn')?.addEventListener('click', () => {
        if (isDispatchMode()) {
            openDispatchCarrierModal();
            return;
        }
        document.getElementById('product-search-input')?.focus();
    });
    document.getElementById('sale-remove-item-btn')?.addEventListener('click', () => {
        if (isDispatchMode()) {
            openDispatchHistoryModal();
            return;
        }
        const lastItem = saleState.cart[saleState.cart.length - 1];
        if (!lastItem) {
            return;
        }
        removeCartItem(lastItem.productId);
    });
    document.getElementById('manage-invoice-customer-btn')?.addEventListener('click', openInvoiceClientFlow);
    document.getElementById('clear-invoice-customer-btn')?.addEventListener('click', clearInvoiceCustomer);
    document.getElementById('payment-cancel-btn')?.addEventListener('click', closePaymentModal);
    document.getElementById('payment-confirm-btn')?.addEventListener('click', confirmPaymentFlow);
    document.getElementById('payment-method-select')?.addEventListener('change', handlePaymentMethodChange);
    document.getElementById('payment-received-input')?.addEventListener('input', renderPaymentChange);
    document.getElementById('payment-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'payment-modal-backdrop') {
            closePaymentModal();
        }
    });
}

function handleMainChargeAction() {
    if (isDispatchMode()) {
        generateDispatchRecord();
        return;
    }

    if (!saleState.cart.length) {
        setBackendStatus('El carrito vacio. Escanea productos primero.');
        return;
    }
    if (saleState.documentType === 'Factura') {
        openInvoiceClientFlow();
    } else {
        openPaymentModal(saleState.documentType);
    }
}

function bindInvoiceClientModal() {
    document.getElementById('invoice-client-cancel-btn')?.addEventListener('click', closeInvoiceClientModal);
    document.getElementById('invoice-client-confirm-btn')?.addEventListener('click', confirmInvoiceClient);
    document.getElementById('invoice-client-use-existing-btn')?.addEventListener('click', useSelectedInvoiceClient);
    document.getElementById('invoice-client-search-input')?.addEventListener('input', handleInvoiceClientSearch);
    document.getElementById('invoice-client-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'invoice-client-modal-backdrop') {
            closeInvoiceClientModal();
        }
    });
}

function bindInfoModal() {
    document.getElementById('info-modal-confirm-btn')?.addEventListener('click', closeInfoModal);
    document.getElementById('info-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'info-modal-backdrop') {
            closeInfoModal();
        }
    });
}

function bindReceiptModal() {
    document.getElementById('receipt-close-btn')?.addEventListener('click', closeReceiptModal);
    document.getElementById('receipt-reprint-btn')?.addEventListener('click', prepareReceiptReprint);
    document.getElementById('receipt-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'receipt-modal-backdrop') {
            closeReceiptModal();
        }
    });
}

function bindDispatchReceiptModal() {
    document.getElementById('dispatch-receipt-close-btn')?.addEventListener('click', closeDispatchReceiptModal);
    document.getElementById('dispatch-receipt-print-btn')?.addEventListener('click', prepareDispatchReceiptPrint);
    document.getElementById('dispatch-receipt-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'dispatch-receipt-modal-backdrop') {
            closeDispatchReceiptModal();
        }
    });
}

function bindSaleActionModal() {
    document.getElementById('sale-action-cancel-btn')?.addEventListener('click', closeSaleActionModal);
    document.getElementById('sale-action-confirm-btn')?.addEventListener('click', confirmSaleCancellation);
    document.getElementById('sale-action-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'sale-action-modal-backdrop') {
            closeSaleActionModal();
        }
    });
}

function clearCurrentSale() {
    if (isDispatchMode()) {
        clearDispatchDraft();
        return;
    }

    if (!saleState.cart.length) {
        return;
    }

    saleState.cart = [];
    saleState.documentType = 'Boleta';
    saleState.customer = null;
    renderCustomerSummary();
    renderDocumentType();
    renderSearchResults([]);
    renderCart();
    setBackendStatus('Venta actual vaciada. Puedes comenzar una nueva.');
}

function bindCloseCashModal() {
    document.getElementById('close-cash-session-btn')?.addEventListener('click', openCloseCashModal);
    document.getElementById('close-cash-cancel-btn')?.addEventListener('click', closeCloseCashModal);
    document.getElementById('close-cash-confirm-btn')?.addEventListener('click', confirmCloseCashSession);
    document.getElementById('close-counted-cash-input')?.addEventListener('input', renderCloseCashDifference);
    document.getElementById('close-counted-card-input')?.addEventListener('input', renderCloseCashDifference);
    document.getElementById('close-counted-transfer-input')?.addEventListener('input', renderCloseCashDifference);
    document.getElementById('close-cash-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'close-cash-modal-backdrop') {
            closeCloseCashModal();
        }
    });
}

async function enterCashierMode() {
    showCashierApp();
    showAppView('sale');
    hydrateCashierUser();
    bindSaleEvents();
    await loadBranchOptions();
    await loadCategoryOptions();
    await loadPrinterOptions();
    renderCatalogStatus();
    renderSelectedBranch();
    renderSearchResults([]);
    renderDispatchSection();
    renderDocumentType();
    renderCustomerSummary();
    renderCart();
    renderTurnSummary();
    renderTurnHistory();
    renderAuditLog();
    renderSalesHistory();
    if (isCustomerDisplayEnabled()) {
        await openCustomerDisplayWindow();
    } else {
        await syncCustomerDisplay();
    }
    await connectCatalogToBackend();
    await loadSalesHistory();
    await loadDispatchData();
    await verificarEstadoCaja();

    if (saleState.cart.length) {
        setBackendStatus(`Venta en curso recuperada con ${formatQuantity(getCartSnapshot().items, false)} item(s).`);
        addAuditEntry({
            type: 'warning',
            title: 'Venta recuperada',
            detail: `Se restauro una venta en curso con ${formatQuantity(getCartSnapshot().items, false)} item(s).`
        });
    }
}

function isDispatchMode() {
    return activeOperationMode === 'dispatch';
}

function setFooterButtonContent(button, icon, label, active = false) {
    if (!button) {
        return;
    }

    button.innerHTML = `<i class="bi ${icon}"></i><span>${label}</span>`;
    button.classList.toggle('active', active);
}

function setToolbarButtonContent(button, icon, label) {
    if (!button) {
        return;
    }

    button.innerHTML = `<i class="bi ${icon}"></i><span>${label}</span>`;
}

function renderOperationMode() {
    const dispatchMode = isDispatchMode();
    const searchInput = document.getElementById('product-search-input');
    const saleCustomerCard = document.getElementById('sale-customer-card');
    const dispatchInlinePanel = document.getElementById('dispatch-inline-panel');
    const saleKeypadShell = document.getElementById('sale-keypad-shell');
    const saleBreakdownBox = document.getElementById('sale-breakdown-box');
    const dispatchInlineShell = document.getElementById('dispatch-inline-shell');
    const totalCardLabel = document.querySelector('.retail-total-card .summary-label');
    const chargeButton = document.getElementById('charge-main-btn');
    const clearButton = document.getElementById('clear-sale-btn');
    const addButton = document.getElementById('sale-add-item-btn');
    const removeButton = document.getElementById('sale-remove-item-btn');
    const boletaButton = document.getElementById('doc-boleta-toggle');
    const facturaButton = document.getElementById('doc-factura-toggle');
    const dispatchButton = document.getElementById('sale-footer-dispatch-btn');
    const historyButton = document.getElementById('sale-footer-history-btn');

    saleCustomerCard?.classList.toggle('hidden', dispatchMode);
    dispatchInlinePanel?.classList.toggle('hidden', !dispatchMode);
    saleKeypadShell?.classList.toggle('hidden', dispatchMode);
    saleBreakdownBox?.classList.toggle('hidden', dispatchMode);
    dispatchInlineShell?.classList.toggle('hidden', !dispatchMode);

    if (searchInput) {
        searchInput.placeholder = dispatchMode
            ? 'Buscar producto para despacho'
            : 'Buscar producto por codigo o descripcion';
    }

    if (totalCardLabel) {
        totalCardLabel.textContent = dispatchMode ? 'Total referencial' : 'Total a pagar';
    }

    if (chargeButton) {
        chargeButton.textContent = dispatchMode ? 'Emitir vale de despacho' : 'Cobrar';
    }

    if (clearButton) {
        clearButton.textContent = dispatchMode ? 'Vaciar carga' : 'Vaciar venta';
    }

    if (dispatchMode) {
        setToolbarButtonContent(addButton, 'bi-truck', 'Registrar transportista');
        setToolbarButtonContent(removeButton, 'bi-clock-history', 'Ver historial');
        setFooterButtonContent(boletaButton, 'bi-upc-scan', 'Vender', false);
        setFooterButtonContent(facturaButton, 'bi-cash-coin', 'Caja', false);
        setFooterButtonContent(dispatchButton, 'bi-truck', 'Despacho', true);
        setFooterButtonContent(historyButton, 'bi-clock-history', 'Historial', false);
    } else {
        setToolbarButtonContent(addButton, 'bi-plus-circle-fill', 'Agregar item');
        setToolbarButtonContent(removeButton, 'bi-trash3', 'Eliminar item');
        setFooterButtonContent(boletaButton, 'bi-receipt-cutoff', 'Boleta', saleState.documentType === 'Boleta');
        setFooterButtonContent(facturaButton, 'bi-file-earmark-text', 'Factura', saleState.documentType === 'Factura');
        setFooterButtonContent(dispatchButton, 'bi-truck', 'Despacho', false);
        setFooterButtonContent(historyButton, 'bi-clock-history', 'Historial de ventas', false);
    }
}

function showAppView(view) {
    if (view === 'sale' || view === 'dispatch') {
        activeOperationMode = view;
    }

    showAppViewLayout(view);
    renderOperationMode();
    renderSearchResults([]);
    renderCart();
}

function bindSaleEvents() {
    const searchInput = document.getElementById('product-search-input');
    if (!searchInput || searchInput.dataset.bound === 'true') {
        return;
    }

    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keydown', handleSearchKeydown);
    searchInput.addEventListener('blur', () => {
        window.setTimeout(() => renderSearchResults([]), 120);
    });
    searchInput.dataset.bound = 'true';
    if (cashSessionState.isOpen) {
        searchInput.focus();
    }
}

function bindWeightedModal() {
    document.getElementById('weighted-cancel-btn')?.addEventListener('click', closeWeightedModal);
    document.getElementById('weighted-confirm-btn')?.addEventListener('click', confirmWeightedProduct);
    document.getElementById('weighted-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'weighted-modal-backdrop') {
            closeWeightedModal();
        }
    });
}

function bindCashSessionModal() {
    document.getElementById('open-cash-session-btn')?.addEventListener('click', openCashSessionModal);
    document.getElementById('open-cash-session-overlay-btn')?.addEventListener('click', openCashSessionModal);
    document.getElementById('cash-session-cancel-btn')?.addEventListener('click', closeCashSessionModal);
    document.getElementById('cash-session-confirm-btn')?.addEventListener('click', confirmCashSession);
    document.getElementById('cash-session-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'cash-session-modal-backdrop') {
            closeCashSessionModal();
        }
    });
}

function hydrateCashierUser() {
    const userLabel = document.getElementById('cashier-user-label');
    const user = getCurrentUser();

    if (!userLabel) {
        return;
    }

    userLabel.textContent = user?.nombreCompleto || user?.nombreUsuario || 'Cajero';
}

async function loadBranchOptions() {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();
    const user = getCurrentUser();

    if (!document.getElementById('branch-select')) {
        return;
    }

    if (!apiBaseUrl || !token) {
        renderBranchSelectView({
            branches: [],
            selectedBranchId: '',
            unavailable: true
        });
        renderSelectedBranch();
        return;
    }

    try {
        const branchState = await resolveBranchState({
            apiBaseUrl,
            token,
            user,
            selectedBranchId: getSelectedBranchId(),
            hasStoredSelection: Boolean(getSelectedBranchId()),
            fetchBranches
        });

        catalogState.branches = branchState.branches;

        if (branchState.shouldPersistSelection && branchState.resolvedSelectedBranchId) {
            saveSelectedBranchId(branchState.resolvedSelectedBranchId);
        }

        if (!getSelectedBranchId() && branchState.resolvedSelectedBranchId) {
            saveSelectedBranchId(branchState.resolvedSelectedBranchId);
        }

        renderBranchSelectView({
            branches: branchState.branches,
            selectedBranchId: getSelectedBranchId() || branchState.resolvedSelectedBranchId,
            fallbackBranchId: user?.id_sucursal || ''
        });
    } catch (error) {
        console.error('Branch load error:', error);
        renderBranchSelectView({
            branches: [],
            selectedBranchId: String(user?.id_sucursal || ''),
            fallbackBranchId: user?.id_sucursal || ''
        });
        if (user?.id_sucursal) {
            saveSelectedBranchId(String(user.id_sucursal));
        }
    }

    renderSelectedBranch();
}

async function handleBranchSelectionChange(event) {
    const branchId = String(event.target?.value || '').trim();
    if (!branchId) {
        return;
    }

    saveSelectedBranchId(branchId);
    renderSelectedBranch();
    saleState.cart = [];
    dispatchState.cart = [];
    dispatchState.searchQuery = '';
    saleState.documentType = 'Boleta';
    saleState.customer = null;
    renderCustomerSummary();
    renderDocumentType();
    renderSearchResults([]);
    renderCart();
    renderDispatchSection();
    await connectCatalogToBackend();
    await loadSalesHistory();
    const userBranchId = String(getCurrentUser()?.id_sucursal || '');
    if (userBranchId && userBranchId !== branchId) {
        setBackendStatus('Sucursal cambiada para inventario. Ojo: las ventas siguen registrandose con la sucursal del token.');
        return;
    }

    setBackendStatus('Sucursal cambiada. Se actualizo el inventario del cajero.');
}

function getSelectedBranchId() {
    return String(getScopedSessionData(SESSION_KEYS.selectedBranch, getCurrentUserScope()) || '');
}

function saveSelectedBranchId(branchId) {
    setScopedSessionData(
        SESSION_KEYS.selectedBranch,
        getCurrentUserScope(),
        String(branchId || '').trim() || null
    );
}

function renderSelectedBranch() {
    renderSelectedBranchView({
        branches: catalogState.branches,
        selectedBranchId: getSelectedBranchId()
    });
    renderDispatchSection();
    syncCustomerDisplay();
}

async function loadDispatchData() {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();

    if (!apiBaseUrl || !token) {
        renderDispatchSection();
        return;
    }

    try {
        const [carriers, history] = await Promise.all([
            fetchDispatchCarriers({ apiBaseUrl, token }),
            fetchDispatchHistory({ apiBaseUrl, token })
        ]);

        const normalizedCarriers = normalizeDispatchCarrierList(carriers);
        if (normalizedCarriers.length) {
            dispatchState.carriers = normalizedCarriers;
        }

        dispatchState.records = normalizeDispatchHistory(history, formatDateTime);
    } catch (error) {
        console.error('Dispatch data load error:', error);
        setBackendStatus(error?.message || 'No se pudieron cargar los datos de despachos.');
    }

    renderDispatchSection();
}

function getSelectedBranchName() {
    return getSelectedBranchNameFromList(catalogState.branches, getSelectedBranchId());
}

async function findOtherBranchStock(product) {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();

    return resolveOtherBranchStock({
        apiBaseUrl,
        token,
        selectedBranchId: getSelectedBranchId(),
        branches: catalogState.branches,
        productId: product.id,
        fetchInventory
    });
}

async function notifyNoStockInBranch(product) {
    const currentBranchName = getSelectedBranchName();
    const branchStock = await findOtherBranchStock(product);
    const message = buildNoStockMessage({
        product,
        currentBranchName,
        branchStock,
        formatQuantity
    });

    setBackendStatus(message);
    openInfoModal('Stock no disponible', message);
}

function openInfoModal(title, message) {
    openInfoModalView({ title, message });
}

function closeInfoModal() {
    closeInfoModalView();
}

async function loadCategoryOptions() {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();

    try {
        catalogState.categories = await resolveCategoryState({
            apiBaseUrl,
            token,
            fetchCategories
        });
    } catch (error) {
        console.error('Category load error:', error);
        catalogState.categories = [];
    }
}

function showLoginScreen() {
    showLoginScreenView();
    syncCustomerDisplay();
}

function showCashierApp() {
    showCashierAppView();
    syncCustomerDisplay();
}

function resetCashierRuntimeState() {
    clearSession();
    cashSessionState.isOpen = false;
    cashSessionState.turnId = null;
    cashSessionState.openingAmount = 0;
    cashSessionState.openedAt = null;
    saleState.cart = [];
    saleState.documentType = 'Boleta';
    saleState.customer = null;
    catalogState.products = fallbackProducts.slice();
    catalogState.source = 'demo';
    catalogState.status = 'Modo demo activo';
    turnHistoryState.entries = [];
    auditLogState.entries = [];
    salesHistoryState.items = [];
    salesHistoryState.cancelledItems = [];
    salesHistoryState.currentTab = 'active';
    saleReceiptState.records = {};
    saleReceiptState.saleId = null;
    dispatchReceiptState.records = {};
    dispatchReceiptState.dispatchId = null;
    dispatchState.selectedCarrierId = null;
    dispatchState.searchQuery = '';
    dispatchState.cart = [];
    dispatchState.records = [];
    resetTurnSummary();
    persistTurnHistory();
    renderCatalogStatus();
    renderSearchResults([]);
    renderCart();
    renderTurnHistory();
    renderAuditLog();
    renderSalesHistory();
    renderTurnSummary();
    renderDocumentType();
    renderCustomerSummary();
    renderCashSessionState();
    renderDispatchSection();
    syncCustomerDisplay();
}

function legacyRenderCashSessionState() {
    return;
}

function getCurrentUserId() {
    const user = getCurrentUser();
    return String(
        user?.id_usuario ||
        user?.idUsuario ||
        user?.id ||
        user?.nombreUsuario ||
        ''
    ).trim();
}

function getCurrentUserScope() {
    const userId = getCurrentUserId();
    return userId ? `user:${userId}` : '';
}

function getCurrentTurnScope() {
    const userScope = getCurrentUserScope();
    const turnId = String(cashSessionState.turnId || '').trim();
    return userScope && turnId ? `${userScope}:turn:${turnId}` : '';
}

function getScopedSessionData(key, scope) {
    if (!scope) {
        return null;
    }

    const payload = getJsonSessionValue(key);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return null;
    }

    if (payload.scope !== scope) {
        return null;
    }

    return payload.data ?? null;
}

function setScopedSessionData(key, scope, data) {
    if (!scope || data === null || data === undefined) {
        setJsonSessionValue(key, null);
        return;
    }

    setJsonSessionValue(key, {
        scope,
        data
    });
}

function resetTurnScopedRuntimeState(shouldPersist = true) {
    turnHistoryState.entries = [];
    auditLogState.entries = [];
    saleReceiptState.records = {};
    saleReceiptState.saleId = null;
    dispatchReceiptState.records = {};
    dispatchReceiptState.dispatchId = null;
    saleState.cart = [];
    saleState.documentType = 'Boleta';
    saleState.customer = null;
    resetTurnSummaryState(turnSummaryState);

    if (shouldPersist) {
        const turnScope = getCurrentTurnScope();
        setScopedSessionData(SESSION_KEYS.cashHistory, turnScope, null);
        setScopedSessionData(SESSION_KEYS.auditLog, turnScope, null);
        setScopedSessionData(SESSION_KEYS.turnSummary, turnScope, null);
        setScopedSessionData(SESSION_KEYS.saleReceipts, turnScope, null);
        setScopedSessionData(SESSION_KEYS.dispatchReceipts, turnScope, null);
        setScopedSessionData(SESSION_KEYS.saleDraft, turnScope, null);
    }
}

function hydrateTurnScopedRuntimeState() {
    const turnScope = getCurrentTurnScope();

    if (!turnScope) {
        resetTurnScopedRuntimeState(false);
        return;
    }

    const rawSummary = getScopedSessionData(SESSION_KEYS.turnSummary, turnScope);
    const rawHistory = getScopedSessionData(SESSION_KEYS.cashHistory, turnScope);
    const rawAuditLog = getScopedSessionData(SESSION_KEYS.auditLog, turnScope);
    const draft = getScopedSessionData(SESSION_KEYS.saleDraft, turnScope);
    const receipts = getScopedSessionData(SESSION_KEYS.saleReceipts, turnScope);
    const dispatchReceipts = getScopedSessionData(SESSION_KEYS.dispatchReceipts, turnScope);

    const summaryHydrated = hydrateTurnSummaryState(
        turnSummaryState,
        rawSummary ? JSON.stringify(rawSummary) : ''
    );
    const historyHydrated = hydrateTurnHistoryState(
        turnHistoryState,
        rawHistory ? JSON.stringify(rawHistory) : ''
    );
    const auditHydrated = hydrateAuditLogState(
        auditLogState,
        rawAuditLog ? JSON.stringify(rawAuditLog) : ''
    );

    if (!summaryHydrated) {
        resetTurnSummaryState(turnSummaryState);
    }

    if (!historyHydrated) {
        turnHistoryState.entries = [];
    }

    if (!auditHydrated) {
        auditLogState.entries = [];
    }

    if (draft && typeof draft === 'object') {
        saleState.cart = Array.isArray(draft.cart) ? draft.cart : [];
        saleState.documentType = typeof draft.documentType === 'string' && draft.documentType
            ? draft.documentType
            : 'Boleta';
        saleState.customer = draft.customer && typeof draft.customer === 'object'
            ? draft.customer
            : null;
    } else {
        saleState.cart = [];
        saleState.documentType = 'Boleta';
        saleState.customer = null;
    }

    saleReceiptState.records = receipts && typeof receipts === 'object' ? receipts : {};
    saleReceiptState.saleId = null;
    dispatchReceiptState.records = dispatchReceipts && typeof dispatchReceipts === 'object' ? dispatchReceipts : {};
    dispatchReceiptState.dispatchId = null;
}

function hydrateTurnSummary() {
    const rawSummary = getScopedSessionData(SESSION_KEYS.turnSummary, getCurrentTurnScope());
    const hydrated = hydrateTurnSummaryState(
        turnSummaryState,
        rawSummary ? JSON.stringify(rawSummary) : ''
    );

    if (!hydrated) {
        resetTurnSummary();
    }
}

function hydrateAuditLog() {
    const rawAuditLog = getScopedSessionData(SESSION_KEYS.auditLog, getCurrentTurnScope());
    hydrateAuditLogState(auditLogState, rawAuditLog ? JSON.stringify(rawAuditLog) : '');
}

function persistAuditLog() {
    setScopedSessionData(SESSION_KEYS.auditLog, getCurrentTurnScope(), auditLogState.entries);
}

function addAuditEntry({ type = 'info', title, detail }) {
    appendAuditEntry(auditLogState, buildAuditEntry({ type, title, detail }));
    persistAuditLog();
    renderAuditLog();
}

function hydrateSaleDraft() {
    const draft = getScopedSessionData(SESSION_KEYS.saleDraft, getCurrentTurnScope());

    if (!draft || typeof draft !== 'object') {
        saleState.cart = [];
        saleState.documentType = 'Boleta';
        saleState.customer = null;
        return;
    }

    saleState.cart = Array.isArray(draft.cart) ? draft.cart : [];
    saleState.documentType = typeof draft.documentType === 'string' && draft.documentType
        ? draft.documentType
        : 'Boleta';
    saleState.customer = draft.customer && typeof draft.customer === 'object'
        ? draft.customer
        : null;
}

function persistSaleDraft() {
    const hasDraft = saleState.cart.length > 0 || saleState.documentType !== 'Boleta' || Boolean(saleState.customer?.id);

    if (!hasDraft) {
        setScopedSessionData(SESSION_KEYS.saleDraft, getCurrentTurnScope(), null);
        return;
    }

    setScopedSessionData(SESSION_KEYS.saleDraft, getCurrentTurnScope(), {
        cart: saleState.cart,
        documentType: saleState.documentType,
        customer: saleState.customer
    });
}

function hydrateSaleReceipts() {
    const parsed = getScopedSessionData(SESSION_KEYS.saleReceipts, getCurrentTurnScope());
    saleReceiptState.records = parsed && typeof parsed === 'object' ? parsed : {};
}

function persistSaleReceipts() {
    setScopedSessionData(SESSION_KEYS.saleReceipts, getCurrentTurnScope(), saleReceiptState.records);
}

function persistDispatchReceipts() {
    setScopedSessionData(SESSION_KEYS.dispatchReceipts, getCurrentTurnScope(), dispatchReceiptState.records);
}

function renderCashSessionState() {
    renderCashSessionView({ cashSessionState });
}

function persistTurnSummary() {
    setScopedSessionData(SESSION_KEYS.turnSummary, getCurrentTurnScope(), turnSummaryState);
}

function resetTurnSummary(shouldPersist = true) {
    resetTurnSummaryState(turnSummaryState);

    if (shouldPersist) {
        persistTurnSummary();
    }
}

function renderTurnSummary() {
    renderTurnSummaryView({ turnSummaryState });
}

function renderDocumentType() {
    renderDocumentTypeView(saleState.documentType);
    renderOperationMode();
    persistSaleDraft();
    syncCustomerDisplay();
}

function renderCustomerSummary() {
    renderCustomerSummaryView(saleState.customer);
    persistSaleDraft();
    syncCustomerDisplay();
}

function hydrateTurnHistory() {
    const rawHistory = getScopedSessionData(SESSION_KEYS.cashHistory, getCurrentTurnScope());
    const hydrated = hydrateTurnHistoryState(
        turnHistoryState,
        rawHistory ? JSON.stringify(rawHistory) : ''
    );

    if (!hydrated) {
        turnHistoryState.entries = [];
    }
}

function persistTurnHistory() {
    setScopedSessionData(SESSION_KEYS.cashHistory, getCurrentTurnScope(), turnHistoryState.entries);
}

function addTurnHistoryEntry({ title, detail }) {
    turnHistoryState.entries.unshift(buildTurnHistoryEntry({ title, detail }));

    turnHistoryState.entries = turnHistoryState.entries.slice(0, 30);
    persistTurnHistory();
    renderTurnHistory();
}

function renderTurnHistory() {
    renderTurnHistoryView(turnHistoryState.entries);
}

function renderAuditLog() {
    renderAuditLogView(auditLogState.entries);
}

function legacyRenderSalesHistory() {
    return;
}

async function loadSalesHistory() {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();

    if (!apiBaseUrl || !token) {
        salesHistoryState.items = [];
        salesHistoryState.cancelledItems = [];
        salesHistoryState.currentTab = 'active';
        renderSalesHistory();
        return;
    }

    try {
        const payload = await fetchSalesHistory({ apiBaseUrl, token });
        salesHistoryState.items = normalizeSalesHistory(payload, formatDateTime);
    } catch (error) {
        console.error('Sales history error:', error);
        salesHistoryState.items = [];
        salesHistoryState.cancelledItems = [];
        setBackendStatus(error?.message || 'No se pudo cargar el historial de ventas.');
    }

    renderSalesHistory();
}

function renderSalesHistory() {
    renderSalesHistoryView({
        salesHistoryState,
        openSaleCancellationModal,
        openSaleReceiptModal
    });
}

function buildReceiptRecord({ saleId, payload, snapshot, method, customer, documentType, cart }) {
    const saleDate = new Date().toISOString();
    const normalizedCustomer = customer?.name
        ? `${customer.name}${customer.rut ? ` · ${customer.rut}` : ''}`
        : 'General';
    const lineItems = Array.isArray(cart)
        ? cart.map((item) => {
            const product = findProductById(catalogState.products, item.productId);
            const pricing = product ? getPricingForProduct(product, item.quantity, cart) : null;
            const quantityLabel = product
                ? formatQuantity(item.quantity, Boolean(product.isWeighted))
                : formatQuantity(item.quantity, false);

            return {
                name: product?.name || `Producto ${item.productId}`,
                quantityLabel,
                unitPrice: Number(pricing?.unitPrice || 0),
                subtotal: Math.round((pricing?.unitPrice || 0) * Number(item.quantity || 0))
            };
        })
        : [];
    const previewLines = [
        'VALMU CAJERO',
        documentType === 'Vale interno' ? 'COMPROBANTE INTERNO REFERENCIAL' : 'BOLETA REFERENCIAL',
        `Venta #${saleId}`,
        `Fecha: ${formatDateTime(saleDate)}`,
        `Cliente: ${normalizedCustomer}`,
        `Pago: ${capitalizePaymentMethod(method)}`,
        '--------------------------------',
        'DETALLE'
    ];

    lineItems.forEach((item) => {
        previewLines.push(item.name);
        previewLines.push(`${item.quantityLabel} x $${formatCurrency(item.unitPrice)} = $${formatCurrency(item.subtotal)}`);
    });

    previewLines.push(
        '--------------------------------',
        `Items: ${formatQuantity(snapshot.items, false)}`,
        `Subtotal: $${formatCurrency(payload.subtotal)}`,
        `IVA: $${formatCurrency(payload.iva)}`,
        `Total: $${formatCurrency(payload.total)}`,
        documentType === 'Vale interno' ? 'Documento no fiscal.' : 'Documento referencial, pendiente integracion fiscal.'
    );

    return {
        saleId,
        date: saleDate,
        dateLabel: formatDateTime(saleDate),
        documentType,
        isFiscal: documentType !== 'Vale interno',
        customerLabel: normalizedCustomer,
        paymentMethod: capitalizePaymentMethod(method),
        subtotal: Number(payload.subtotal || 0),
        iva: Number(payload.iva || 0),
        total: Number(payload.total || 0),
        items: Number(snapshot.items || 0),
        lineItems,
        preview: previewLines.join('\n')
    };
}

function saveReceiptRecord(record) {
    if (!record?.saleId) {
        return;
    }

    saleReceiptState.records[String(record.saleId)] = record;
    persistSaleReceipts();
}

function getReceiptRecord(saleId) {
    return saleReceiptState.records[String(saleId)] || null;
}

function buildFallbackReceiptRecord(sale) {
    if (!sale) {
        return null;
    }

    const saleDate = sale.rawDate || sale.dateLabel || new Date().toISOString();
    const previewLines = [
        'VALMU CAJERO',
        `Venta #${sale.id}`,
        `Fecha: ${sale.dateLabel || formatDateTime(saleDate)}`,
        `Documento: ${sale.document}`,
        `Tipo: ${sale.isFiscal ? 'Fiscal' : 'No fiscal'}`,
        `Pago: ${sale.paymentMethod}`,
        `Total: $${formatCurrency(sale.total)}`,
        '',
        'Detalle extendido no disponible en esta sesion.',
        'La base de reimpresion completa se genera al cobrar desde esta caja.'
    ];

    return {
        saleId: sale.id,
        date: saleDate,
        documentType: sale.document,
        isFiscal: Boolean(sale.isFiscal),
        customerLabel: 'No disponible',
        paymentMethod: sale.paymentMethod,
        subtotal: Math.round(Number(sale.total || 0) / 1.19),
        iva: Number(sale.total || 0) - Math.round(Number(sale.total || 0) / 1.19),
        total: Number(sale.total || 0),
        items: 0,
        preview: previewLines.join('\n')
    };
}

function openSaleReceiptModal(saleId) {
    const activeSale = salesHistoryState.items.find((sale) => sale.id === Number(saleId));
    const cancelledSale = salesHistoryState.cancelledItems.find((sale) => sale.id === Number(saleId));
    const sale = activeSale || cancelledSale || null;
    const record = getReceiptRecord(saleId) || buildFallbackReceiptRecord(sale);

    if (!record) {
        setBackendStatus('No se pudo cargar el comprobante de la venta seleccionada.');
        return;
    }

    saleReceiptState.saleId = Number(saleId);
    document.getElementById('receipt-modal-title').textContent = `Comprobante venta #${record.saleId}`;
    document.getElementById('receipt-modal-copy').textContent = record.isFiscal
        ? 'Resumen listo para revision o futura reimpresion fiscal.'
        : 'Resumen de documento no fiscal listo para revision interna.';
    document.getElementById('receipt-sale-id-label').textContent = `#${record.saleId}`;
    document.getElementById('receipt-document-label').textContent = record.documentType;
    document.getElementById('receipt-customer-label').textContent = record.customerLabel;
    document.getElementById('receipt-payment-label').textContent = record.paymentMethod;
    document.getElementById('receipt-subtotal-label').textContent = `$${formatCurrency(record.subtotal)}`;
    document.getElementById('receipt-iva-label').textContent = `$${formatCurrency(record.iva)}`;
    document.getElementById('receipt-total-label').textContent = `$${formatCurrency(record.total)}`;
    document.getElementById('receipt-preview-output').value = record.preview;
    const status = document.getElementById('receipt-status');
    if (status) {
        status.textContent = '';
        status.classList.add('hidden');
    }
    document.getElementById('receipt-modal-backdrop')?.classList.remove('hidden');
}

function closeReceiptModal() {
    saleReceiptState.saleId = null;
    document.getElementById('receipt-modal-backdrop')?.classList.add('hidden');
}

async function prepareReceiptReprint() {
    const saleId = saleReceiptState.saleId;
    const record = getReceiptRecord(saleId) || buildFallbackReceiptRecord(
        salesHistoryState.items.find((sale) => sale.id === Number(saleId))
        || salesHistoryState.cancelledItems.find((sale) => sale.id === Number(saleId))
    );
    const status = document.getElementById('receipt-status');

    if (!record || !status) {
        return;
    }

    const printerName = getSessionValue(SESSION_KEYS.printerName) || 'Predeterminada del sistema';
    const printerPaper = getSessionValue(SESSION_KEYS.printerPaper) || '80mm';
    status.textContent = 'Enviando comprobante a impresion...';
    status.classList.remove('hidden');

    try {
        await printReceiptRecord({
            record,
            printerName,
            printerPaper,
            printReceipt: window.cajeroAPI?.printReceipt
        });

        status.textContent = `Comprobante enviado a ${printerName} en formato ${printerPaper}.`;
        document.getElementById('receipt-preview-output').value = record.preview;
    } catch (error) {
        console.error('Receipt print error:', error);
        status.textContent = error?.message || 'No se pudo imprimir el comprobante.';
    }
}

function buildDispatchReceiptRecord({ dispatchId, saleId, carrier, snapshot, branchName }) {
    const createdAt = new Date().toISOString();
    const lineItems = snapshot.lines.map((line) => ({
        name: line.productName,
        quantityLabel: formatQuantity(line.quantity, line.isWeighted),
        unitPrice: Number(line.unitPrice || 0),
        subtotal: Number(line.lineTotal || 0)
    }));

    const subtotal = Math.round(Number(snapshot.total || 0) / 1.19);
    const iva = Number(snapshot.total || 0) - subtotal;
    const previewLines = [
        'VALMU CAJERO',
        'VALE DE DESPACHO REFERENCIAL',
        `Despacho #DSP-${dispatchId}`,
        `Venta en ruta #${saleId}`,
        `Fecha: ${formatDateTime(createdAt)}`,
        `Sucursal: ${branchName}`,
        `Transportista: ${carrier.name} · ${carrier.plate}`,
        '--------------------------------',
        'DETALLE DE CARGA'
    ];

    lineItems.forEach((item) => {
        previewLines.push(item.name);
        previewLines.push(`${item.quantityLabel} x $${formatCurrency(item.unitPrice)} = $${formatCurrency(item.subtotal)}`);
    });

    previewLines.push(
        '--------------------------------',
        `Items: ${formatQuantity(snapshot.items, false)}`,
        `Subtotal: $${formatCurrency(subtotal)}`,
        `IVA: $${formatCurrency(iva)}`,
        `Total referencial: $${formatCurrency(snapshot.total)}`,
        'Mercaderia cargada a ruta. La rendicion se revisa con administracion.'
    );

    return {
        dispatchId: String(dispatchId),
        saleId: Number(saleId || 0),
        date: createdAt,
        dateLabel: formatDateTime(createdAt),
        documentType: 'Vale de despacho',
        isFiscal: false,
        customerLabel: `${carrier.name} · ${carrier.plate}`,
        paymentMethod: 'En ruta',
        subtotal,
        iva,
        total: Number(snapshot.total || 0),
        items: Number(snapshot.items || 0),
        lineItems,
        preview: previewLines.join('\n'),
        branchName
    };
}

function saveDispatchReceiptRecord(record) {
    if (!record?.dispatchId) {
        return;
    }

    dispatchReceiptState.records[String(record.dispatchId)] = record;
    persistDispatchReceipts();
}

function getDispatchReceiptRecord(dispatchId) {
    return dispatchReceiptState.records[String(dispatchId)] || null;
}

function buildFallbackDispatchReceiptRecord(record) {
    if (!record) {
        return null;
    }

    const saleDate = record.rawDate || record.dateLabel || new Date().toISOString();
    const previewLines = [
        'VALMU CAJERO',
        'VALE DE DESPACHO REFERENCIAL',
        `Despacho #DSP-${record.id}`,
        `Fecha: ${record.createdAtLabel || formatDateTime(saleDate)}`,
        `Transportista: ${record.carrierName}`,
        `Estado: ${record.status || 'EN_RUTA'}`,
        record.total ? `Total referencial: $${formatCurrency(record.total)}` : 'Total referencial no disponible',
        '',
        'Detalle completo no disponible en esta sesion.',
        'La base completa se conserva cuando el vale se genera desde esta caja.'
    ];

    return {
        dispatchId: String(record.id),
        saleId: 0,
        date: saleDate,
        documentType: 'Vale de despacho',
        isFiscal: false,
        customerLabel: record.carrierName || 'Transportista',
        paymentMethod: 'En ruta',
        subtotal: Math.round(Number(record.total || 0) / 1.19),
        iva: Number(record.total || 0) - Math.round(Number(record.total || 0) / 1.19),
        total: Number(record.total || 0),
        items: Number(record.items || 0),
        preview: previewLines.join('\n'),
        branchName: record.branchName || 'Sucursal'
    };
}

function openDispatchReceiptModal(dispatchId) {
    const historyRecord = dispatchState.records.find((record) => String(record.id) === String(dispatchId));
    const record = getDispatchReceiptRecord(dispatchId) || buildFallbackDispatchReceiptRecord(historyRecord);

    if (!record) {
        setBackendStatus('No se pudo cargar el vale del despacho seleccionado.');
        return;
    }

    dispatchReceiptState.dispatchId = String(dispatchId);
    document.getElementById('dispatch-receipt-modal-title').textContent = `Vale despacho #DSP-${record.dispatchId}`;
    document.getElementById('dispatch-receipt-id-label').textContent = `#DSP-${record.dispatchId}`;
    document.getElementById('dispatch-receipt-carrier-label').textContent = record.customerLabel;
    document.getElementById('dispatch-receipt-branch-label').textContent = record.branchName || 'Sucursal';
    document.getElementById('dispatch-receipt-document-label').textContent = record.documentType;
    document.getElementById('dispatch-receipt-total-label').textContent = `$${formatCurrency(record.total)}`;
    document.getElementById('dispatch-receipt-preview-output').value = record.preview;
    const status = document.getElementById('dispatch-receipt-status');
    if (status) {
        status.textContent = '';
        status.classList.add('hidden');
    }
    document.getElementById('dispatch-receipt-modal-backdrop')?.classList.remove('hidden');
}

function closeDispatchReceiptModal() {
    dispatchReceiptState.dispatchId = null;
    document.getElementById('dispatch-receipt-modal-backdrop')?.classList.add('hidden');
}

function openDispatchHistoryModal() {
    document.getElementById('dispatch-history-modal-backdrop')?.classList.remove('hidden');
}

function closeDispatchHistoryModal() {
    document.getElementById('dispatch-history-modal-backdrop')?.classList.add('hidden');
}

function openDispatchCarrierModal() {
    const nameInput = document.getElementById('dispatch-carrier-name-input');
    const plateInput = document.getElementById('dispatch-carrier-plate-input');
    const status = document.getElementById('dispatch-carrier-status');

    if (nameInput) nameInput.value = '';
    if (plateInput) plateInput.value = '';
    if (status) {
        status.textContent = '';
        status.classList.add('hidden');
    }

    document.getElementById('dispatch-carrier-modal-backdrop')?.classList.remove('hidden');
    nameInput?.focus();
}

function closeDispatchCarrierModal() {
    document.getElementById('dispatch-carrier-modal-backdrop')?.classList.add('hidden');
}

function setDispatchCarrierStatus(message) {
    const status = document.getElementById('dispatch-carrier-status');
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.toggle('hidden', !message);
}

async function confirmDispatchCarrier() {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();
    const nameInput = document.getElementById('dispatch-carrier-name-input');
    const plateInput = document.getElementById('dispatch-carrier-plate-input');
    const confirmButton = document.getElementById('dispatch-carrier-confirm-btn');
    const name = String(nameInput?.value || '').trim();
    const plate = String(plateInput?.value || '').trim().toUpperCase();

    if (!name || !plate) {
        setDispatchCarrierStatus('Completa nombre y patente para registrar el transportista.');
        return;
    }

    if (!apiBaseUrl || !token) {
        setDispatchCarrierStatus('No hay conexion activa con la API.');
        return;
    }

    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Guardando...';
    }

    try {
        const result = await createDispatchCarrier({
            apiBaseUrl,
            token,
            carrier: {
                name,
                plate
            }
        });

        await loadDispatchData();
        const createdCarrierId = Number(result?.id_transporte || 0);
        if (createdCarrierId) {
            dispatchState.selectedCarrierId = String(createdCarrierId);
        }
        renderDispatchSection();
        closeDispatchCarrierModal();
        setBackendStatus(`Transportista ${name} registrado correctamente.`);
    } catch (error) {
        console.error('Dispatch carrier create error:', error);
        setDispatchCarrierStatus(error?.message || 'No se pudo registrar el transportista.');
    } finally {
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Guardar transportista';
        }
    }
}

async function prepareDispatchReceiptPrint() {
    const dispatchId = dispatchReceiptState.dispatchId;
    const historyRecord = dispatchState.records.find((record) => String(record.id) === String(dispatchId));
    const record = getDispatchReceiptRecord(dispatchId) || buildFallbackDispatchReceiptRecord(historyRecord);
    const status = document.getElementById('dispatch-receipt-status');

    if (!record || !status) {
        return;
    }

    const printerName = getSessionValue(SESSION_KEYS.printerName) || 'Predeterminada del sistema';
    const printerPaper = getSessionValue(SESSION_KEYS.printerPaper) || '80mm';
    status.textContent = 'Enviando vale a impresion...';
    status.classList.remove('hidden');

    try {
        await printReceiptRecord({
            record,
            printerName,
            printerPaper,
            printReceipt: window.cajeroAPI?.printReceipt
        });

        status.textContent = `Vale enviado a ${printerName} en formato ${printerPaper}.`;
    } catch (error) {
        console.error('Dispatch receipt print error:', error);
        status.textContent = error?.message || 'No se pudo imprimir el vale.';
    }
}

function openSaleCancellationModal(saleId, documentLabel, total) {
    saleActionState.saleId = Number(saleId || 0);
    openSaleCancellationModalView({ saleId, documentLabel, total });
    setSaleActionStatus('');
}

function closeSaleActionModal() {
    saleActionState.saleId = null;
    setSaleActionStatus('');
    closeSaleCancellationModalView();
}

function setSaleActionStatus(message) {
    setSaleActionStatusView(message);
}

function applyCancelledSaleToTurnSummary(sale) {
    applyCancelledSaleToSummary({
        sale,
        turnSummaryState,
        persistTurnSummary,
        renderTurnSummary
    });
}

async function confirmSaleCancellation() {
    const saleId = saleActionState.saleId;
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();
    const confirmButton = document.getElementById('sale-action-confirm-btn');
    const cancelledSale = salesHistoryState.items.find((sale) => sale.id === saleId) || null;
    const reason = String(document.getElementById('sale-action-reason-input')?.value || '').trim();

    if (!saleId || !apiBaseUrl || !token) {
        closeSaleActionModal();
        return;
    }

    if (!reason) {
        setSaleActionStatus('Debes indicar el motivo de anulacion.');
        document.getElementById('sale-action-reason-input')?.focus();
        return;
    }

    confirmButton.disabled = true;
    confirmButton.textContent = 'Anulando...';

    try {
        await cancelSaleRequest({ apiBaseUrl, token, saleId });

        addTurnHistoryEntry({
            title: 'Venta anulada',
            detail: `Se anulo la venta #${saleId}. Motivo: ${reason}`
        });
        addAuditEntry({
            type: 'warning',
            title: 'Venta anulada',
            detail: `Venta #${saleId} anulada. Motivo: ${reason}.`
        });

        if (cancelledSale) {
            applyCancelledSaleToTurnSummary(cancelledSale);
            moveSaleToCancelled({
                salesHistoryState,
                cancelledSale,
                reason,
                formatDateTime
            });
            renderSalesHistory();
        }

        closeSaleActionModal();
        await connectCatalogToBackend();
        setBackendStatus(`Venta #${saleId} anulada correctamente.`);
    } catch (error) {
        console.error('Sale cancel error:', error);
        setBackendStatus(error?.message || 'No se pudo anular la venta.');
    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Confirmar';
    }
}

async function verificarEstadoCaja() {
    const token = getAuthToken();
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());

    if (!token || !apiBaseUrl) {
        cashSessionState.isOpen = false;
        cashSessionState.turnId = null;
        cashSessionState.openingAmount = 0;
        cashSessionState.openedAt = null;
        resetTurnScopedRuntimeState(false);
        setSessionValue('cajaAbierta', 'false');
        renderDocumentType();
        renderCustomerSummary();
        renderCart();
        renderCashSessionState();
        renderTurnHistory();
        renderAuditLog();
        renderTurnSummary();
        return;
    }

    try {
        const data = await fetchCashStatus({ apiBaseUrl, token });

        if (data?.abierta) {
            cashSessionState.isOpen = true;
            cashSessionState.turnId = data?.caja?.id_cajaTurno || data?.id_cajaTurno || null;
            cashSessionState.openingAmount = Number(data?.caja?.montoInicial || data?.caja?.montoApertura || 0);
            cashSessionState.openedAt = data?.caja?.horaApertura || data?.caja?.fechaApertura || new Date().toISOString();
            setSessionValue('cajaAbierta', 'true');
            closeCashSessionModal();
            hydrateTurnScopedRuntimeState();
            if (!turnHistoryState.entries.length) {
                addTurnHistoryEntry({
                    title: 'Caja abierta',
                    detail: `Turno recuperado con fondo inicial de $${formatCurrency(cashSessionState.openingAmount)}`
                });
            }
        } else {
            cashSessionState.isOpen = false;
            cashSessionState.turnId = null;
            cashSessionState.openingAmount = 0;
            cashSessionState.openedAt = null;
            resetTurnScopedRuntimeState(false);
            setSessionValue('cajaAbierta', 'false');
            renderDocumentType();
            renderCustomerSummary();
            renderCart();
            renderTurnHistory();
            renderAuditLog();
            window.setTimeout(() => openCashSessionModal(), 50);
        }
    } catch (error) {
        console.error('Cash state error:', error);
        cashSessionState.isOpen = false;
        cashSessionState.turnId = null;
        cashSessionState.openingAmount = 0;
        cashSessionState.openedAt = null;
        resetTurnScopedRuntimeState(false);
        setSessionValue('cajaAbierta', 'false');
        setBackendStatus(error?.message || 'No se pudo verificar el estado de la caja.');
    }

    renderCashSessionState();
    renderDocumentType();
    renderCustomerSummary();
    renderCart();
    renderTurnHistory();
    renderAuditLog();
    renderTurnSummary();
}

function openCashSessionModal() {
    openCashSessionModalView(cashSessionState.openingAmount);
}

function closeCashSessionModal() {
    closeCashSessionModalView();
}

async function confirmCashSession() {
    const amountInput = document.getElementById('cash-opening-amount-input');
    const openingAmount = Number(amountInput?.value || 0);
    const token = getAuthToken();
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());

    if (!Number.isFinite(openingAmount) || openingAmount < 0) {
        amountInput?.focus();
        return;
    }

    if (!token || !apiBaseUrl) {
        amountInput?.focus();
        return;
    }

    try {
        const data = await openCashTurn({ apiBaseUrl, token, openingAmount });

        cashSessionState.isOpen = true;
        cashSessionState.turnId = data?.caja?.id_cajaTurno || data?.id_cajaTurno || `local-${Date.now()}`;
        cashSessionState.openingAmount = Math.round(openingAmount);
        cashSessionState.openedAt = data?.caja?.horaApertura || new Date().toISOString();
        setSessionValue('cajaAbierta', 'true');
        resetTurnScopedRuntimeState(true);
        addTurnHistoryEntry({
            title: 'Turno iniciado',
            detail: `Fondo de caja declarado: $${formatCurrency(cashSessionState.openingAmount)}`
        });
        renderCashSessionState();
        renderTurnSummary();
        renderAuditLog();
        closeCashSessionModal();
        setBackendStatus(`Caja abierta con fondo inicial de $${formatCurrency(cashSessionState.openingAmount)}.`);
    } catch (error) {
        console.error('Cash open error:', error);
        setBackendStatus(error?.message || 'No se pudo abrir la caja.');
        amountInput?.focus();
    }
}

function getCartSnapshot() {
    return getCartSnapshotDomain({
        cart: saleState.cart,
        products: catalogState.products,
        getPricingForProduct
    });
}

function getCartItemPricing(product, quantity, cart = saleState.cart) {
    return getPricingForProduct(product, quantity, cart);
}

function openPaymentModal(documentType = 'Boleta') {
    if (!cashSessionState.isOpen || !saleState.cart.length) {
        return;
    }

    if (documentType === 'Factura' && !saleState.customer?.id) {
        openInvoiceClientFlow();
        return;
    }

    if (documentType !== 'Factura') {
        saleState.customer = null;
        renderCustomerSummary();
    }

    saleState.documentType = documentType;
    renderDocumentType();

    const snapshot = getCartSnapshot();
    openPaymentModalView({
        documentType: saleState.documentType,
        total: snapshot.total,
        customer: saleState.customer
    });
    handlePaymentMethodChange();
    renderPaymentChange();
}

function openInvoiceClientFlow() {
    if (!cashSessionState.isOpen || !saleState.cart.length) {
        return;
    }

    if (saleState.customer?.id) {
        openPaymentModal('Factura');
        return;
    }

    invoiceClientState.pendingDocumentType = 'Factura';
    setInvoiceClientStatus('');
    openInvoiceClientModalView(saleState.customer);
    loadInvoiceClients();
}

function clearInvoiceCustomer() {
    saleState.customer = null;
    if (saleState.documentType === 'Factura') {
        saleState.documentType = 'Boleta';
        renderDocumentType();
    }

    renderCustomerSummary();
    setBackendStatus('Cliente de factura limpiado. Puedes seleccionar otro cuando quieras.');
}

function closeInvoiceClientModal() {
    invoiceClientState.pendingDocumentType = null;
    closeInvoiceClientModalView();
}

function setInvoiceClientStatus(message) {
    setInvoiceClientStatusView(message);
}

async function loadInvoiceClients() {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();

    if (!apiBaseUrl || !token) {
        invoiceClientState.customers = [];
        renderInvoiceClientOptions();
        return;
    }

    try {
        const payload = await fetchClients({ apiBaseUrl, token });

        invoiceClientState.customers = normalizeCustomerList(payload);
        renderInvoiceClientOptions();
    } catch (error) {
        console.error('Invoice customers error:', error);
        invoiceClientState.customers = [];
        renderInvoiceClientOptions();
        setInvoiceClientStatus(error?.message || 'No se pudieron cargar los clientes.');
    }
}

function renderInvoiceClientOptions(filterTerm = '') {
    const customers = filterCustomers(invoiceClientState.customers, filterTerm);

    renderInvoiceClientOptionsView(customers);
}

function handleInvoiceClientSearch(event) {
    renderInvoiceClientOptions(event.target?.value || '');
}

function useSelectedInvoiceClient() {
    const selectedId = Number(document.getElementById('invoice-client-select')?.value || 0);
    if (!selectedId) {
        setInvoiceClientStatus('Selecciona un cliente para continuar con la factura.');
        return;
    }

    const selectedCustomer = invoiceClientState.customers.find((customer) => customer.id === selectedId);
    if (!selectedCustomer) {
        setInvoiceClientStatus('No se pudo cargar el cliente seleccionado.');
        return;
    }

    saleState.customer = buildSaleCustomer(selectedCustomer);

    renderCustomerSummary();
    const pendingDocumentType = invoiceClientState.pendingDocumentType || 'Factura';
    closeInvoiceClientModal();
    openPaymentModal(pendingDocumentType);
}

async function confirmInvoiceClient() {
    const rut = String(document.getElementById('invoice-rut-input')?.value || '').trim();
    const name = String(document.getElementById('invoice-name-input')?.value || '').trim();
    const business = String(document.getElementById('invoice-business-input')?.value || '').trim();

    if (!rut || !name || !business) {
        setInvoiceClientStatus('Completa RUT, nombre y giro para emitir factura.');
        return;
    }

    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();

    if (!apiBaseUrl || !token) {
        setInvoiceClientStatus('No hay conexion activa con la API.');
        return;
    }

    setInvoiceClientStatus('Guardando cliente...');

    try {
        const payload = await createQuickCustomer({
            apiBaseUrl,
            token,
            customer: {
                rut,
                name,
                business
            }
        });

        const customerId = payload?.id_cliente || payload?.cliente?.id_cliente;
        if (!customerId) {
            throw new Error('La API no devolvio id_cliente.');
        }

        saleState.customer = buildSaleCustomer({
            id: Number(customerId),
            name,
            rut
        });

        invoiceClientState.customers.unshift({
            id: Number(customerId),
            rut,
            name,
            business
        });

        renderCustomerSummary();
        const pendingDocumentType = invoiceClientState.pendingDocumentType || 'Factura';
        closeInvoiceClientModal();
        openPaymentModal(pendingDocumentType);
    } catch (error) {
        console.error('Invoice client error:', error);
        setInvoiceClientStatus(error?.message || 'No se pudo guardar el cliente.');
    }
}

function closePaymentModal() {
    closePaymentModalViewOnly();
}

function handlePaymentMethodChange() {
    const methodSelect = document.getElementById('payment-method-select');
    const isCash = (methodSelect?.value || 'efectivo') === 'efectivo';
    const snapshot = getCartSnapshot();

    renderPaymentMethodView({
        isCash,
        total: snapshot.total
    });

    renderPaymentChange();
}

function renderPaymentChange() {
    const method = document.getElementById('payment-method-select')?.value || 'efectivo';
    const snapshot = getCartSnapshot();
    const received = Number(document.getElementById('payment-received-input')?.value || 0);

    renderPaymentChangeView({
        method,
        total: snapshot.total,
        received
    });
}

function confirmPayment() {
    if (!cashSessionState.isOpen || !saleState.cart.length) {
        closePaymentModal();
        return;
    }

    const method = document.getElementById('payment-method-select')?.value || 'efectivo';
    const snapshot = getCartSnapshot();
    const received = Number(document.getElementById('payment-received-input')?.value || 0);

    if (method === 'efectivo' && received < snapshot.total) {
        document.getElementById('payment-received-input')?.focus();
        return;
    }

    if (method === 'efectivo') {
        turnSummaryState.totalCash += snapshot.total;
    } else if (method === 'tarjeta') {
        turnSummaryState.totalCard += snapshot.total;
    } else if (method === 'transferencia') {
        turnSummaryState.totalTransfer += snapshot.total;
    }

    if (saleState.documentType === 'Vale interno') {
        turnSummaryState.totalInternal += snapshot.total;
    }

    turnSummaryState.salesCount += 1;
    persistTurnSummary();
    renderTurnSummary();

    addTurnHistoryEntry({
        title: `Venta cobrada · ${saleState.documentType}`,
        detail: `${formatQuantity(snapshot.items, false)} item(s) · ${capitalizePaymentMethod(method)} · $${formatCurrency(snapshot.total)}`
    });

    saleState.cart = [];
    saleState.documentType = 'Boleta';
    renderDocumentType();
    renderSearchResults([]);
    renderCart();
    closePaymentModal();
}

async function confirmPaymentFlow() {
    if (!cashSessionState.isOpen || !saleState.cart.length) {
        closePaymentModal();
        return;
    }

    const method = document.getElementById('payment-method-select')?.value || 'efectivo';
    const snapshot = getCartSnapshot();
    const received = Number(document.getElementById('payment-received-input')?.value || 0);
    const confirmButton = document.getElementById('payment-confirm-btn');

    if (method === 'efectivo' && received < snapshot.total) {
        document.getElementById('payment-received-input')?.focus();
        return;
    }

    const stockValidation = validateCartStock();
    if (!stockValidation.ok) {
        setBackendStatus(stockValidation.message || 'No hay stock suficiente para completar la venta.');
        closePaymentModal();
        return;
    }

    confirmButton.disabled = true;
    confirmButton.textContent = 'Procesando...';
    document.getElementById('payment-cancel-btn')?.setAttribute('disabled', 'disabled');

    try {
        const result = await submitSaleToBackend({
            method,
            snapshot,
            received
        });
        const receiptRecord = buildReceiptRecord({
            saleId: result.saleId,
            payload: result.payload,
            snapshot,
            method,
            customer: saleState.customer,
            documentType: saleState.documentType,
            cart: saleState.cart
        });

        if (method === 'efectivo') {
            turnSummaryState.totalCash += snapshot.total;
        } else if (method === 'tarjeta') {
            turnSummaryState.totalCard += snapshot.total;
        } else if (method === 'transferencia') {
            turnSummaryState.totalTransfer += snapshot.total;
        }

        if (saleState.documentType === 'Vale interno') {
            turnSummaryState.totalInternal += snapshot.total;
        }

        turnSummaryState.salesCount += 1;
        persistTurnSummary();
        renderTurnSummary();
        decreaseLocalStockFromCart();

        addTurnHistoryEntry({
            title: `Venta cobrada · ${saleState.documentType}`,
            detail: `${formatQuantity(snapshot.items, false)} item(s) · ${capitalizePaymentMethod(method)} · $${formatCurrency(snapshot.total)} · Venta #${result.saleId}`
        });

        addAuditEntry({
            type: 'success',
            title: 'Venta registrada',
            detail: `Venta #${result.saleId} registrada como ${saleState.documentType} por $${formatCurrency(snapshot.total)}.`
        });
        saveReceiptRecord(receiptRecord);
        try {
            await printReceiptRecord({
                record: receiptRecord,
                printerName: getSessionValue(SESSION_KEYS.printerName) || 'Predeterminada del sistema',
                printerPaper: getSessionValue(SESSION_KEYS.printerPaper) || '80mm',
                printReceipt: window.cajeroAPI?.printReceipt
            });
        } catch (printError) {
            console.error('Auto print error:', printError);
            addAuditEntry({
                type: 'warning',
                title: 'Impresion pendiente',
                detail: printError?.message || `La venta #${result.saleId} se registro, pero no se pudo imprimir.`
            });
        }
        saleState.cart = [];
        saleState.documentType = 'Boleta';
        saleState.customer = null;
        renderCustomerSummary();
        renderDocumentType();
        renderSearchResults([]);
        renderCart();
        closePaymentModal();
        await loadSalesHistory();
        setBackendStatus(`Venta #${result.saleId} registrada correctamente.`);
    } catch (error) {
        console.error('Sale submit error:', error);
        setBackendStatus(error?.message || 'No se pudo registrar la venta.');
        addAuditEntry({
            type: 'error',
            title: 'Error de venta',
            detail: error?.message || 'No se pudo registrar la venta.'
        });
    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Confirmar cobro';
        document.getElementById('payment-cancel-btn')?.removeAttribute('disabled');
    }
}

function validateCartStock() {
    return validateCartStockDomain({
        cart: saleState.cart,
        products: catalogState.products,
        formatQuantity
    });
}

function buildSalePayload(method, received) {
    return buildSalePayloadDomain({
        cart: saleState.cart,
        products: catalogState.products,
        documentType: saleState.documentType,
        customer: saleState.customer,
        method,
        received,
        documentTypeIds: DOCUMENT_TYPE_IDS,
        paymentMethodMap: PAYMENT_METHOD_MAP,
        getPricingForProduct
    });
}

async function submitSaleToBackend({ method, received }) {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();

    if (!apiBaseUrl || !token) {
        throw new Error('No hay conexion activa con la API.');
    }

    const payload = buildSalePayload(method, received);
    const result = await submitSaleRequest({ apiBaseUrl, token, payload });

    return {
        saleId: result?.id_venta || 0,
        payload
    };
}

function decreaseLocalStockFromCart() {
    decreaseLocalStockFromCartDomain({
        cart: saleState.cart,
        products: catalogState.products
    });
}

function setBackendStatus(message) {
    setBackendStatusView(message);
}

function openCloseCashModal() {
    if (!cashSessionState.isOpen) {
        return;
    }

    openCloseCashModalView({
        openingAmount: cashSessionState.openingAmount,
        totalCash: turnSummaryState.totalCash,
        totalCard: turnSummaryState.totalCard,
        totalTransfer: turnSummaryState.totalTransfer,
        totalInternal: turnSummaryState.totalInternal,
        totalSales: getTurnSalesTotal(),
        expectedCash: getExpectedCashAmount()
    });
    renderCloseCashDifference();
}

function closeCloseCashModal() {
    closeCloseCashModalView();
}

function renderCloseCashDifference() {
    renderCloseCashDifferenceView({
        turnSummaryState,
        countedCash: Number(document.getElementById('close-counted-cash-input')?.value || 0),
        countedCard: Number(document.getElementById('close-counted-card-input')?.value || 0),
        countedTransfer: Number(document.getElementById('close-counted-transfer-input')?.value || 0),
        formatDifferenceLabel
    });
}

async function confirmCloseCashSession() {
    if (!cashSessionState.isOpen) {
        closeCloseCashModal();
        return;
    }

    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();
    const confirmButton = document.getElementById('close-cash-confirm-btn');
    const countedCash = Number(document.getElementById('close-counted-cash-input')?.value || 0);
    const expectedCash = getExpectedCashAmount();
    const countedCard = Number(document.getElementById('close-counted-card-input')?.value || 0);
    const countedTransfer = Number(document.getElementById('close-counted-transfer-input')?.value || 0);
    const cashDifference = countedCash - expectedCash;
    const cardDifference = countedCard - Number(turnSummaryState.totalCard || 0);
    const transferDifference = countedTransfer - Number(turnSummaryState.totalTransfer || 0);
    const totalDifference = cashDifference + cardDifference + transferDifference;

    if (!apiBaseUrl || !token) {
        setBackendStatus('No hay conexion activa para cerrar la caja.');
        return;
    }

    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Cerrando...';
    }

    try {
        await closeCashTurn({
            apiBaseUrl,
            token,
            totals: {
                cash: countedCash,
                card: countedCard,
                transfer: countedTransfer
            }
        });

        addTurnHistoryEntry({
            title: 'Turno cerrado',
            detail: `Efectivo contado $${formatCurrency(countedCash)} (${formatDifferenceLabel(cashDifference)}), tarjeta $${formatCurrency(countedCard)} (${formatDifferenceLabel(cardDifference)}), transferencias $${formatCurrency(countedTransfer)} (${formatDifferenceLabel(transferDifference)}). Diferencia total ${formatDifferenceLabel(totalDifference)}.`
        });
        addAuditEntry({
            type: totalDifference === 0 ? 'success' : 'warning',
            title: 'Caja cerrada',
            detail: `Turno cerrado con diferencia total ${formatDifferenceLabel(totalDifference)}.`
        });

        closeCloseCashModal();
        resetCashierRuntimeState();
        closeCustomerDisplayWindow();
        setLoginStatus(`Turno cerrado. Diferencia total: ${formatDifferenceLabel(totalDifference)}. Ingresa de nuevo para iniciar otra caja.`);
        showLoginScreen();
    } catch (error) {
        console.error('Cash close error:', error);
        setBackendStatus(error?.message || 'No se pudo cerrar la caja.');
        addAuditEntry({
            type: 'error',
            title: 'Error al cerrar caja',
            detail: error?.message || 'No se pudo cerrar la caja.'
        });
    } finally {
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Cerrar turno';
        }
    }
}

function setLoginStatus(message) {
    setLoginStatusView(message);
}

function hydrateSettingsForm() {
    const settings = getSettingsSnapshot({
        getSessionValue,
        sessionKeys: SESSION_KEYS
    });
    const printerSelect = document.getElementById('printer-select');
    const printerPaperSelect = document.getElementById('printer-paper-select');
    const customerDisplayEnabledInput = document.getElementById('customer-display-enabled-input');
    const releaseRepoInput = document.getElementById('release-repo-input');

    if (printerSelect) {
        printerSelect.value = settings.printerName;
    }

    if (printerPaperSelect) {
        printerPaperSelect.value = settings.printerPaper;
    }

    if (customerDisplayEnabledInput) {
        customerDisplayEnabledInput.checked = settings.customerDisplayEnabled;
    }

    if (releaseRepoInput) {
        releaseRepoInput.value = settings.releaseRepo;
    }

    updateCustomerDisplayStatusLabel(settings.customerDisplayEnabled ? 'Activacion automatica lista' : 'Desactivada');
}

async function loadPrinterOptions() {
    const printerSelect = document.getElementById('printer-select');
    if (!printerSelect || typeof window.cajeroAPI?.getPrinters !== 'function') {
        return;
    }

    try {
        const printers = await window.cajeroAPI.getPrinters();
        const savedPrinter = getSessionValue(SESSION_KEYS.printerName);

        if (!Array.isArray(printers) || !printers.length) {
            printerSelect.innerHTML = '<option>Predeterminada del sistema</option>';
            return;
        }

        printerSelect.innerHTML = printers.map((printer) => `
            <option value="${escapeHtml(printer.name)}" ${savedPrinter === printer.name ? 'selected' : ''}>
                ${printer.isDefault ? '[Predeterminada] ' : ''}${escapeHtml(printer.displayName || printer.name)}
            </option>
        `).join('');
    } catch (error) {
        console.error('Printer load error:', error);
    }
}

function savePrinterSettings() {
    const printerSelect = document.getElementById('printer-select');
    const printerPaperSelect = document.getElementById('printer-paper-select');
    const statusLabel = document.getElementById('backend-status');
    const settings = savePrinterSettingsSnapshot({
        printerName: printerSelect?.value,
        printerPaper: printerPaperSelect?.value,
        setSessionValue,
        sessionKeys: SESSION_KEYS
    });

    if (statusLabel) {
        statusLabel.textContent = `Impresora guardada: ${settings.printerName}`;
    }
}

function updateCustomerDisplayStatusLabel(message) {
    const statusLabel = document.getElementById('customer-display-status');
    if (statusLabel) {
        statusLabel.textContent = message;
    }
}

function isCustomerDisplayEnabled() {
    return getSessionValue(SESSION_KEYS.customerDisplayEnabled) === 'true';
}

async function openCustomerDisplayWindow() {
    if (typeof window.cajeroAPI?.openCustomerDisplay !== 'function') {
        updateCustomerDisplayStatusLabel('No disponible en este equipo');
        return;
    }

    try {
        await window.cajeroAPI.openCustomerDisplay();
        updateCustomerDisplayStatusLabel('Pantalla cliente abierta');
        await syncCustomerDisplay();
    } catch (error) {
        console.error('Customer display open error:', error);
        updateCustomerDisplayStatusLabel(error?.message || 'No se pudo abrir la pantalla cliente');
    }
}

async function closeCustomerDisplayWindow() {
    if (typeof window.cajeroAPI?.closeCustomerDisplay !== 'function') {
        updateCustomerDisplayStatusLabel('No disponible en este equipo');
        return;
    }

    try {
        await window.cajeroAPI.closeCustomerDisplay();
        updateCustomerDisplayStatusLabel('Pantalla cliente cerrada');
    } catch (error) {
        console.error('Customer display close error:', error);
        updateCustomerDisplayStatusLabel(error?.message || 'No se pudo cerrar la pantalla cliente');
    }
}

async function saveCustomerDisplaySettings() {
    const customerDisplayEnabledInput = document.getElementById('customer-display-enabled-input');
    const settings = saveCustomerDisplaySettingsSnapshot({
        customerDisplayEnabled: customerDisplayEnabledInput?.checked,
        setSessionValue,
        sessionKeys: SESSION_KEYS
    });

    if (settings.customerDisplayEnabled) {
        updateCustomerDisplayStatusLabel('Activando pantalla cliente...');
        await openCustomerDisplayWindow();
        return;
    }

    updateCustomerDisplayStatusLabel('Desactivando pantalla cliente...');
    await closeCustomerDisplayWindow();
}

function buildCustomerDisplayPayload() {
    const dispatchMode = isDispatchMode();
    const activeCart = dispatchMode ? dispatchState.cart : saleState.cart;
    const snapshot = dispatchMode
        ? buildDispatchSnapshot(dispatchState.cart, catalogState.products, getPricingForProduct)
        : getCartSnapshot();
    const currentUser = getCurrentUser();

    return {
        mode: !cashSessionState.isOpen
            ? 'locked'
            : activeCart.length
                ? 'sale'
                : 'idle',
        branchName: getSelectedBranchName(),
        cashierName: currentUser?.nombreCompleto || currentUser?.nombreUsuario || 'Cajero',
        documentType: dispatchMode ? 'Despacho' : saleState.documentType,
        customerLabel: dispatchMode
            ? (getSelectedDispatchCarrier()?.name || 'Transportista sin asignar')
            : saleState.customer?.rut
            ? `${saleState.customer.name} · ${saleState.customer.rut}`
            : 'Cliente general',
        itemsCount: snapshot.items,
        totalLabel: `$${formatCurrency(snapshot.total)}`,
        statusLabel: !cashSessionState.isOpen
            ? 'Caja cerrada'
            : dispatchMode
                ? (activeCart.length ? 'Carga en preparacion' : 'Seleccione productos para ruta')
                : activeCart.length
                    ? 'Revise su compra'
                    : 'Escanee sus productos',
        cart: activeCart.map((item) => {
            const product = findProductById(catalogState.products, item.productId);

            if (!product) {
                return null;
            }

            const pricing = getPricingForProduct(product, item.quantity, activeCart);
            const lineTotal = pricing.unitPrice * item.quantity;

            return {
                id: product.id,
                name: product.name,
                meta: product.category || product.code || '',
                quantityLabel: formatQuantity(item.quantity, product.isWeighted),
                unitPriceLabel: `$${formatCurrency(pricing.unitPrice)}`,
                lineTotalLabel: `$${formatCurrency(lineTotal)}`
            };
        }).filter(Boolean)
    };
}

async function syncCustomerDisplay() {
    if (typeof window.cajeroAPI?.updateCustomerDisplay !== 'function') {
        return;
    }

    try {
        await window.cajeroAPI.updateCustomerDisplay(buildCustomerDisplayPayload());
    } catch (error) {
        console.error('Customer display sync error:', error);
    }
}

function saveUpdateSettings() {
    const releaseRepoInput = document.getElementById('release-repo-input');
    const updateStatusLabel = document.getElementById('settings-update-status');
    const repo = saveUpdateSettingsSnapshot({
        releaseRepo: releaseRepoInput?.value,
        setSessionValue,
        sessionKeys: SESSION_KEYS
    });

    if (updateStatusLabel) {
        updateStatusLabel.textContent = `Repo configurado: ${repo}`;
    }
}

async function checkGithubUpdates() {
    const updateStatusLabel = document.getElementById('settings-update-status');
    const repo = getSessionValue(SESSION_KEYS.releaseRepo) || 'JavierParedesDev/valmuPOS';

    if (!updateStatusLabel) {
        return;
    }

    updateStatusLabel.textContent = 'Buscando actualizaciones...';

    if (typeof window.cajeroAPI?.checkGithubRelease !== 'function') {
        updateStatusLabel.textContent = 'La consulta de releases no esta disponible.';
        return;
    }

    try {
        const result = await window.cajeroAPI.checkGithubRelease(repo);

        if (!result?.ok) {
            updateStatusLabel.textContent = result?.error || 'No se pudo consultar la ultima release.';
            return;
        }

        if (result.hasUpdate) {
            updateStatusLabel.textContent = `Nueva version disponible: ${result.latestVersion}`;
            return;
        }

        updateStatusLabel.textContent = `Sin actualizaciones. Version actual: ${result.currentVersion}`;
    } catch (error) {
        updateStatusLabel.textContent = error?.message || 'No se pudo consultar GitHub Releases.';
    }
}

function handleSearchInput(event) {
    if (!cashSessionState.isOpen) {
        return;
    }

    const term = String(event.target.value || '').trim();

    if (!term) {
        renderSearchResults([]);
        return;
    }

    if (isDispatchMode()) {
        dispatchState.searchQuery = term;
        renderSearchResults(filterDispatchProducts(catalogState.products, term, normalizeCatalogText).slice(0, 6));
        return;
    }

    renderSearchResults(findProducts(term).slice(0, 6));
}

function handleSearchKeydown(event) {
    if (!cashSessionState.isOpen) {
        return;
    }

    if (event.key !== 'Enter') {
        return;
    }

    event.preventDefault();
    const term = String(event.target.value || '').trim();
    if (!term) {
        return;
    }

    const exactCodeMatch = catalogState.products.find((product) => product.code === term);
    const firstMatch = isDispatchMode()
        ? exactCodeMatch || filterDispatchProducts(catalogState.products, term, normalizeCatalogText)[0]
        : exactCodeMatch || findProducts(term)[0];

    if (firstMatch) {
        if (isDispatchMode()) {
            selectProductForDispatch(firstMatch.id);
        } else {
            selectProductForSale(firstMatch.id);
        }
        event.target.value = '';
        renderSearchResults([]);
    }
}

function findProducts(term) {
    return findCatalogProducts(catalogState.products, term);
}

function addProductToCart(productId) {
    const product = findProductById(catalogState.products, productId);
    if (!product) {
        return;
    }

    if (Number(product.stockActual || 0) <= 0) {
        notifyNoStockInBranch(product);
        return;
    }

    const result = addUnitToCart({
        cart: saleState.cart,
        product,
        roundWeightedQuantity
    });

    if (!result.ok && result.reason === 'stock_max') {
        setBackendStatus(`Stock maximo alcanzado para ${product.name}.`);
        return;
    }

    renderCart();
}

function addWeightedProductToCart(productId, quantity) {
    const product = findProductById(catalogState.products, productId);
    if (!product) {
        return;
    }

    if (Number(product.stockActual || 0) <= 0) {
        notifyNoStockInBranch(product);
        return;
    }

    const result = addWeightedQuantityToCart({
        cart: saleState.cart,
        product,
        quantity,
        roundWeightedQuantity
    });

    if (!result.ok && result.reason === 'invalid_quantity') {
        return;
    }

    if (!result.ok && result.reason === 'stock_insufficient') {
        setBackendStatus(`Stock insuficiente para ${product.name}. Quedan ${formatQuantity(product.stockActual || 0, true)}.`);
        return;
    }

    renderCart();
}

function setWeightedProductQuantity(productId, quantity) {
    const product = findProductById(catalogState.products, productId);
    if (!product) {
        return;
    }

    const result = setWeightedCartQuantity({
        cart: saleState.cart,
        product,
        quantity,
        roundWeightedQuantity
    });

    if (!result.ok && result.reason === 'invalid_quantity') {
        return;
    }

    if (!result.ok && result.reason === 'stock_insufficient') {
        setBackendStatus(`Stock insuficiente para ${product.name}. Quedan ${formatQuantity(product.stockActual || 0, true)}.`);
        return;
    }

    if (!result.ok && result.reason === 'missing_cart_item') {
        addWeightedProductToCart(productId, quantity);
        return;
    }

    renderCart();
}

function selectProductForSale(productId) {
    const product = findProductById(catalogState.products, productId);
    if (!product) {
        return;
    }

    if (product.isWeighted) {
        openWeightedModal(product, 'add');
        return;
    }

    addProductToCart(productId);
}

function updateCartItemQuantity(productId, delta) {
    const product = findProductById(catalogState.products, productId);

    if (!product) {
        return;
    }

    const result = updateCartItemQuantityValue({
        cart: saleState.cart,
        product,
        delta,
        roundWeightedQuantity
    });

    if (!result.ok && result.reason === 'missing_cart_item') {
        return;
    }

    if (!result.ok && result.reason === 'stock_max') {
        setBackendStatus(`Stock maximo alcanzado para ${product.name}.`);
        return;
    }

    if (result.remove) {
        saleState.cart = removeCartItemByProductId(saleState.cart, productId);
    }

    renderCart();
}

function removeCartItem(productId) {
    saleState.cart = removeCartItemByProductId(saleState.cart, productId);
    renderCart();
}

function renderSearchResults(products) {
    if (isDispatchMode()) {
        renderDispatchSearchResults(products, {
            listId: 'product-search-results',
            overlayId: 'product-search-overlay',
            onSelectFunction: 'selectProductForDispatch'
        });
        return;
    }

    renderSearchResultsView(products);
}

function renderCart() {
    if (isDispatchMode()) {
        renderDispatchCart({
            cart: dispatchState.cart,
            products: catalogState.products,
            listId: 'cart-list',
            totalLabelId: 'sale-total',
            itemsLabelId: 'dispatch-inline-items-label',
            quantityUpdateFunction: 'updateDispatchItemQuantity',
            removeFunction: 'removeDispatchItem'
        });

        const snapshot = buildDispatchSnapshot(dispatchState.cart, catalogState.products, getPricingForProduct);
        const saleTotal = document.getElementById('sale-total');
        if (saleTotal) {
            saleTotal.textContent = `$${formatCurrency(snapshot.total)}`;
        }
    } else {
        renderCartView({
            cart: saleState.cart,
            products: catalogState.products
        });
        persistSaleDraft();
    }

    syncCustomerDisplay();
}

function getSelectedDispatchCarrier() {
    return dispatchState.carriers.find((carrier) => String(carrier.id) === String(dispatchState.selectedCarrierId)) || null;
}

function renderDispatchSection() {
    renderDispatchCarrierOptions({
        carriers: dispatchState.carriers,
        selectedCarrierId: dispatchState.selectedCarrierId
    });
    renderDispatchCarrierOptions({
        carriers: dispatchState.carriers,
        selectedCarrierId: dispatchState.selectedCarrierId,
        selectId: 'dispatch-inline-carrier-select'
    });
    renderDispatchCarrierSummary(getSelectedDispatchCarrier());
    renderDispatchCarrierSummary(getSelectedDispatchCarrier(), 'dispatch-inline-carrier-summary');
    renderDispatchSearchResults(
        filterDispatchProducts(catalogState.products, dispatchState.searchQuery, normalizeCatalogText)
    );
    renderDispatchCart({
        cart: dispatchState.cart,
        products: catalogState.products
    });
    if (isDispatchMode()) {
        renderCart();
    }
    renderDispatchRecords(dispatchState.records, openDispatchReceiptModal);
}

function handleDispatchCarrierChange(event) {
    dispatchState.selectedCarrierId = String(event.target?.value || '').trim() || null;
    renderDispatchSection();
}

function handleDispatchSearchInput(event) {
    dispatchState.searchQuery = String(event.target?.value || '').trim();
    renderDispatchSection();
}

function clearDispatchDraft() {
    dispatchState.cart = [];
    dispatchState.searchQuery = '';
    const dispatchSearchInput = document.getElementById('dispatch-search-input');
    if (dispatchSearchInput) {
        dispatchSearchInput.value = '';
    }
    const saleSearchInput = document.getElementById('product-search-input');
    if (saleSearchInput) {
        saleSearchInput.value = '';
    }
    renderSearchResults([]);
    renderDispatchSection();
    setBackendStatus('Carga de despacho vaciada.');
}

function selectProductForDispatch(productId) {
    const result = addProductToDispatchCart(dispatchState.cart, productId, catalogState.products);
    dispatchState.cart = result.cart;
    if (result.error) {
        setBackendStatus(result.error);
    }
    dispatchState.searchQuery = '';
    const dispatchSearchInput = document.getElementById('dispatch-search-input');
    if (dispatchSearchInput) {
        dispatchSearchInput.value = '';
    }
    const saleSearchInput = document.getElementById('product-search-input');
    if (saleSearchInput) {
        saleSearchInput.value = '';
    }
    renderSearchResults([]);
    renderDispatchSection();
}

function updateDispatchItemQuantity(productId, delta) {
    const result = updateDispatchCartQuantity(dispatchState.cart, productId, delta, catalogState.products);
    dispatchState.cart = result.cart;
    if (result.error) {
        setBackendStatus(result.error);
    }
    renderDispatchSection();
}

function removeDispatchItem(productId) {
    dispatchState.cart = removeDispatchCartItem(dispatchState.cart, productId);
    renderDispatchSection();
}

async function generateDispatchRecord() {
    const carrier = getSelectedDispatchCarrier();
    if (!carrier) {
        setBackendStatus('Selecciona un transportista antes de emitir el vale de despacho.');
        return;
    }

    if (!dispatchState.cart.length) {
        setBackendStatus('Agrega productos al carrito de despacho antes de emitir el vale.');
        return;
    }

    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();
    if (!apiBaseUrl || !token) {
        setBackendStatus('No hay conexion activa con la API para generar el despacho.');
        return;
    }

    const confirmButton = document.getElementById('dispatch-generate-btn');
    const snapshot = buildDispatchSnapshot(dispatchState.cart, catalogState.products, getPricingForProduct);
    const payload = buildDispatchPayload({
        snapshot,
        carrierId: carrier.id,
        documentTypeId: DOCUMENT_TYPE_IDS['Vale interno']
    });

    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Generando vale...';
    }

    try {
        const result = await generateDispatchRequest({
            apiBaseUrl,
            token,
            payload
        });

        const record = buildDispatchRecord({
            carrier,
            branchName: getSelectedBranchName(),
            snapshot,
            formatDateTime
        });

        record.id = String(result.id_despacho || record.id);
        record.saleReference = `Venta en ruta ${result.id_venta || ''}`.trim();
        const receiptRecord = buildDispatchReceiptRecord({
            dispatchId: record.id,
            saleId: result.id_venta,
            carrier,
            snapshot,
            branchName: getSelectedBranchName()
        });

        dispatchState.records.unshift(record);
        dispatchState.records = dispatchState.records.slice(0, 20);
        catalogState.products = decreaseLocalStockFromDispatchCart(catalogState.products, dispatchState.cart);
        dispatchState.cart = [];
        dispatchState.searchQuery = '';
        saveDispatchReceiptRecord(receiptRecord);

        const searchInput = document.getElementById('dispatch-search-input');
        if (searchInput) {
            searchInput.value = '';
        }

        addAuditEntry({
            type: 'success',
            title: 'Despacho generado',
            detail: `DSP-${record.id} generado para ${carrier.name}. La venta quedo en ruta sin afectar la caja del cajero.`
        });
        addTurnHistoryEntry({
            title: 'Despacho preparado',
            detail: `${record.id} · ${carrier.name} · ${formatQuantity(record.items, false)} item(s) cargados a ruta.`
        });

        await connectCatalogToBackend();
        await loadDispatchData();
        renderDispatchSection();
        renderSearchResults([]);
        renderCart();
        openDispatchReceiptModal(record.id);
        try {
            await printReceiptRecord({
                record: receiptRecord,
                printerName: getSessionValue(SESSION_KEYS.printerName) || 'Predeterminada del sistema',
                printerPaper: getSessionValue(SESSION_KEYS.printerPaper) || '80mm',
                printReceipt: window.cajeroAPI?.printReceipt
            });
        } catch (printError) {
            console.error('Dispatch auto print error:', printError);
            addAuditEntry({
                type: 'warning',
                title: 'Vale pendiente de impresion',
                detail: printError?.message || `El despacho DSP-${record.id} se genero, pero no se pudo imprimir el vale.`
            });
        }
        setBackendStatus(`Despacho DSP-${record.id} generado correctamente. Stock descontado y ruta asignada.`);
    } catch (error) {
        console.error('Dispatch generate error:', error);
        setBackendStatus(error?.message || 'No se pudo generar el despacho.');
        addAuditEntry({
            type: 'error',
            title: 'Error en despacho',
            detail: error?.message || 'No se pudo generar el despacho.'
        });
    } finally {
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Emitir vale de despacho';
        }
    }
}

function getAuthToken() {
    return getSessionValue(SESSION_KEYS.token);
}

function getCurrentUser() {
    return getJsonSessionValue(SESSION_KEYS.user);
}

function saveSession({ token, user }) {
    setSessionValue(SESSION_KEYS.token, token);
    setJsonSessionValue(SESSION_KEYS.user, user);
}

function clearSession() {
    removeSessionValues([
        SESSION_KEYS.token,
        SESSION_KEYS.user,
        SESSION_KEYS.selectedBranch,
        SESSION_KEYS.cashHistory,
        SESSION_KEYS.auditLog,
        SESSION_KEYS.turnSummary,
        SESSION_KEYS.saleReceipts,
        SESSION_KEYS.dispatchReceipts,
        SESSION_KEYS.saleDraft,
        'cajaAbierta'
    ]);
}

function getApiBaseUrl() {
    return getSessionValue(SESSION_KEYS.apiBaseUrl) || window.cajeroAPI?.apiBaseUrl || '';
}

function saveApiBaseUrl(url) {
    setSessionValue(SESSION_KEYS.apiBaseUrl, url);
}

async function connectCatalogToBackend() {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();
    const selectedBranchId = getSelectedBranchId();

    try {
        const inventoryState = await resolveCatalogInventory({
            apiBaseUrl,
            token,
            selectedBranchId,
            categories: catalogState.categories,
            fetchInventory,
            normalizeBackendProduct,
            fallbackProducts
        });
        catalogState.products = inventoryState.products;
        catalogState.source = inventoryState.source;
        catalogState.status = inventoryState.status;
    } catch (error) {
        console.error('Catalog load error:', error);
        catalogState.products = fallbackProducts.slice();
        catalogState.source = 'demo';
        catalogState.status = error?.message || 'No se pudo conectar al backend';
    }

    renderCatalogStatus();
    renderSearchResults([]);
    renderCart();
    renderDispatchSection();
}

function renderCatalogStatus() {
    renderCatalogStatusView(catalogState);
}

function openWeightedModal(product, mode = 'add', currentQuantity = 1) {
    openWeightedState(weightedProductState, product, mode);
    openWeightedModalView({
        productName: product.name,
        mode,
        currentQuantity
    });
}

function closeWeightedModal() {
    closeWeightedState(weightedProductState);
    closeWeightedModalView();
}

function confirmWeightedProduct() {
    const quantityInput = document.getElementById('weighted-quantity-input');
    const quantity = parseWeightedQuantity(quantityInput?.value || 0);

    if (!weightedProductState.productId || quantity === null) {
        quantityInput?.focus();
        return;
    }

    if (weightedProductState.mode === 'edit') {
        setWeightedProductQuantity(weightedProductState.productId, quantity);
    } else {
        addWeightedProductToCart(weightedProductState.productId, quantity);
    }
    closeWeightedModal();
}

function openWeightedEditModal(productId) {
    const weightedEditState = resolveWeightedEditState({
        products: catalogState.products,
        cart: saleState.cart,
        productId,
        findProductById,
        findCartItemByProductId
    });

    if (!weightedEditState) {
        return;
    }

    openWeightedModal(weightedEditState.product, 'edit', weightedEditState.quantity);
}

window.selectProductForSale = selectProductForSale;
window.selectProductForDispatch = selectProductForDispatch;
window.updateCartItemQuantity = updateCartItemQuantity;
window.updateDispatchItemQuantity = updateDispatchItemQuantity;
window.removeCartItem = removeCartItem;
window.removeDispatchItem = removeDispatchItem;
window.openWeightedEditModal = openWeightedEditModal;
window.openSaleCancellationModal = openSaleCancellationModal;
window.openDispatchReceiptModal = openDispatchReceiptModal;

