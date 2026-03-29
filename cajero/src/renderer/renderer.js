import {
    SESSION_KEYS,
    fallbackProducts,
    catalogState,
    saleState,
    cashSessionState,
    weightedProductState,
    turnHistoryState,
    turnSummaryState,
    salesHistoryState,
    invoiceClientState,
    saleActionState,
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
    showAppViewLayout,
    showLoginScreenView,
    showCashierAppView,
    setLoginStatusView,
    hydrateVersionView
} from './ui/app-view.js';
import { renderBranchSelectView } from './ui/branch-view.js';
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
import {
    getSettingsSnapshot,
    savePrinterSettingsSnapshot,
    saveUpdateSettingsSnapshot
} from './services/settings-service.js';
import {
    getSessionValue,
    setSessionValue,
    getJsonSessionValue,
    setJsonSessionValue,
    removeSessionValues
} from './services/session-service.js';

document.addEventListener('DOMContentLoaded', () => {
    hydrateTurnHistory();
    hydrateTurnSummary();
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
    bindSaleActionModal();
    bindBranchSelection();
    bindSalesHistoryTabs();

    if (getAuthToken() && getCurrentUser()) {
        enterCashierMode();
        return;
    }

    showLoginScreen();
});

function hydrateVersion() {
    hydrateVersionView(window.cajeroAPI?.version);
}

function hydrateLoginForm() {
    const apiBaseUrlInput = document.getElementById('api-base-url-input');
    if (apiBaseUrlInput) {
        apiBaseUrlInput.value = getApiBaseUrl();
    }

    hydrateSettingsForm();
}

function bindLogin() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) {
        return;
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const apiBaseUrlInput = document.getElementById('api-base-url-input');
        const usernameInput = document.getElementById('login-username-input');
        const passwordInput = document.getElementById('login-password-input');
        const submitButton = document.getElementById('login-submit-btn');

        const apiBaseUrl = apiBaseUrlInput?.value || '';
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

            await enterCashierMode();
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
        showLoginScreen();
    });
}

function bindNavigation() {
    const saleButton = document.getElementById('nav-sale-btn');
    const cashButton = document.getElementById('nav-cash-btn');
    const settingsButton = document.getElementById('nav-settings-btn');

    saleButton?.addEventListener('click', () => showAppView('sale'));
    cashButton?.addEventListener('click', () => showAppView('cash'));
    settingsButton?.addEventListener('click', () => showAppView('settings'));
}

function bindSettings() {
    document.getElementById('save-printer-settings-btn')?.addEventListener('click', savePrinterSettings);
    document.getElementById('save-update-settings-btn')?.addEventListener('click', saveUpdateSettings);
    document.getElementById('check-updates-btn')?.addEventListener('click', checkGithubUpdates);
}

function bindBranchSelection() {
    document.getElementById('branch-select')?.addEventListener('change', handleBranchSelectionChange);
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
    document.getElementById('charge-sale-btn')?.addEventListener('click', () => openPaymentModal('Boleta'));
    document.getElementById('charge-invoice-btn')?.addEventListener('click', openInvoiceClientFlow);
    document.getElementById('charge-internal-btn')?.addEventListener('click', () => openPaymentModal('Vale interno'));
    document.getElementById('clear-sale-btn')?.addEventListener('click', clearCurrentSale);
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
    renderDocumentType();
    renderCustomerSummary();
    renderCart();
    renderTurnSummary();
    renderTurnHistory();
    renderSalesHistory();
    await connectCatalogToBackend();
    await loadSalesHistory();
    await verificarEstadoCaja();
}

function showAppView(view) {
    showAppViewLayout(view);
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
            hasStoredSelection: Boolean(getSessionValue(SESSION_KEYS.selectedBranch)),
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
    saleState.documentType = 'Boleta';
    saleState.customer = null;
    renderCustomerSummary();
    renderDocumentType();
    renderSearchResults([]);
    renderCart();
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
    return getSessionValue(SESSION_KEYS.selectedBranch);
}

function saveSelectedBranchId(branchId) {
    setSessionValue(SESSION_KEYS.selectedBranch, branchId);
}

function renderSelectedBranch() {
    renderSelectedBranchView({
        branches: catalogState.branches,
        selectedBranchId: getSelectedBranchId()
    });
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
}

function showCashierApp() {
    showCashierAppView();
}

function resetCashierRuntimeState() {
    clearSession();
    cashSessionState.isOpen = false;
    cashSessionState.openingAmount = 0;
    cashSessionState.openedAt = null;
    saleState.cart = [];
    saleState.documentType = 'Boleta';
    saleState.customer = null;
    catalogState.products = fallbackProducts.slice();
    catalogState.source = 'demo';
    catalogState.status = 'Modo demo activo';
    turnHistoryState.entries = [];
    salesHistoryState.items = [];
    salesHistoryState.cancelledItems = [];
    salesHistoryState.currentTab = 'active';
    resetTurnSummary();
    persistTurnHistory();
    renderCatalogStatus();
    renderSearchResults([]);
    renderCart();
    renderTurnHistory();
    renderSalesHistory();
    renderTurnSummary();
    renderDocumentType();
    renderCustomerSummary();
    renderCashSessionState();
}

function legacyRenderCashSessionState() {
    renderCashSessionView({ cashSessionState });

    const badge = document.getElementById('cash-session-badge');
    const title = document.getElementById('cash-session-title');
    const copy = document.getElementById('cash-session-copy');
    const button = document.getElementById('open-cash-session-btn');
    const closeButton = document.getElementById('close-cash-session-btn');
    const cashViewStatus = document.getElementById('cash-view-status-label');
    const cashViewOpening = document.getElementById('cash-view-opening-label');
    const cashViewOpenedAt = document.getElementById('cash-view-opened-at-label');
    const overlay = document.getElementById('sale-lock-overlay');
    const searchInput = document.getElementById('product-search-input');

    if (badge) {
        badge.textContent = cashSessionState.isOpen ? 'Caja abierta' : 'Caja cerrada';
    }

    if (title) {
        title.textContent = cashSessionState.isOpen
            ? `Turno activo · Fondo $${formatCurrency(cashSessionState.openingAmount)}`
            : 'Caja cerrada';
    }

    if (copy) {
        copy.textContent = cashSessionState.isOpen
            ? `Turno iniciado ${formatDateTime(cashSessionState.openedAt)}`
            : 'Debes abrir caja para empezar a vender.';
    }

    if (button) {
        button.disabled = cashSessionState.isOpen;
        button.textContent = cashSessionState.isOpen ? 'Caja abierta' : 'Abrir caja';
    }

    closeButton?.classList.toggle('hidden', !cashSessionState.isOpen);

    if (cashViewStatus) {
        cashViewStatus.textContent = cashSessionState.isOpen ? 'Caja abierta' : 'Caja cerrada';
    }

    if (cashViewOpening) {
        cashViewOpening.textContent = `$${formatCurrency(cashSessionState.openingAmount)}`;
    }

    if (cashViewOpenedAt) {
        cashViewOpenedAt.textContent = cashSessionState.isOpen
            ? formatDateTime(cashSessionState.openedAt)
            : 'Sin turno';
    }

    overlay?.classList.toggle('hidden', cashSessionState.isOpen);

    if (searchInput) {
        searchInput.disabled = !cashSessionState.isOpen;
        if (cashSessionState.isOpen) {
            searchInput.focus();
        } else {
            searchInput.blur();
        }
    }
}

function hydrateTurnSummary() {
    const hydrated = hydrateTurnSummaryState(
        turnSummaryState,
        getSessionValue(SESSION_KEYS.turnSummary)
    );

    if (!hydrated) {
        resetTurnSummary();
    }
}

function renderCashSessionState() {
    renderCashSessionView({ cashSessionState });
}

function persistTurnSummary() {
    setJsonSessionValue(SESSION_KEYS.turnSummary, turnSummaryState);
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
}

function renderCustomerSummary() {
    renderCustomerSummaryView(saleState.customer);
}

function hydrateTurnHistory() {
    const hydrated = hydrateTurnHistoryState(
        turnHistoryState,
        getSessionValue(SESSION_KEYS.cashHistory)
    );

    if (!hydrated) {
        turnHistoryState.entries = [];
    }
}

function persistTurnHistory() {
    setJsonSessionValue(SESSION_KEYS.cashHistory, turnHistoryState.entries);
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

function legacyRenderSalesHistory() {
    renderSalesHistoryView({
        salesHistoryState,
        openSaleCancellationModal
    });

    const list = document.getElementById('sales-history-list');
    const count = document.getElementById('sales-history-count');
    const activeTabButton = document.getElementById('sales-tab-active-btn');
    const cancelledTabButton = document.getElementById('sales-tab-cancelled-btn');

    if (!list || !count || !activeTabButton || !cancelledTabButton) {
        return;
    }

    const isCancelledTab = salesHistoryState.currentTab === 'cancelled';
    const selectedItems = isCancelledTab ? salesHistoryState.cancelledItems : salesHistoryState.items;
    activeTabButton.classList.toggle('active', !isCancelledTab);
    cancelledTabButton.classList.toggle('active', isCancelledTab);
    count.textContent = String(selectedItems.length);

    if (!selectedItems.length) {
        list.innerHTML = `<div class="turn-history-empty">${isCancelledTab ? 'Sin ventas anuladas aun.' : 'Sin ventas registradas aun.'}</div>`;
        return;
    }

    list.innerHTML = selectedItems.map((sale) => {
        const detail = `${sale.document} · ${sale.paymentMethod} · $${formatCurrency(sale.total)}`;
        const actionBlock = isCancelledTab
            ? `<div class="turn-history-detail">Motivo: ${escapeHtml(sale.cancellationReason || 'Sin motivo registrado')}</div>`
            : `<div class="product-actions-cell" style="justify-content:flex-start; margin-top:0.35rem;">
                <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="openSaleCancellationModal(${sale.id}, '${escapeHtml(sale.document)}', ${sale.total})">Anular</button>
            </div>`;

        return `
            <article class="turn-history-item">
                <div class="turn-history-meta">
                    <strong>Venta #${escapeHtml(sale.id)}</strong>
                    <span>${escapeHtml(sale.dateLabel)}</span>
                </div>
                <div class="turn-history-detail">${escapeHtml(detail)}</div>
                ${actionBlock}
            </article>
        `;
    }).join('');
    return;

    list.innerHTML = selectedItems.map((sale) => `
        <article class="turn-history-item">
            <div class="turn-history-meta">
                <strong>Venta #${escapeHtml(sale.id)}</strong>
                <span>${escapeHtml(sale.dateLabel)}</span>
            </div>
            <div class="turn-history-detail">${escapeHtml(`${sale.document} · ${sale.paymentMethod} · $${formatCurrency(sale.total)}`)}</div>
            <div class="product-actions-cell" style="justify-content:flex-start; margin-top:0.35rem;">
                <button class="btn btn-ghost btn-sm product-action-btn" type="button" onclick="openSaleCancellationModal(${sale.id}, '${escapeHtml(sale.document)}', ${sale.total})">Anular</button>
            </div>
        </article>
    `).join('');
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
        openSaleCancellationModal
    });
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
        cashSessionState.openingAmount = 0;
        cashSessionState.openedAt = null;
        resetTurnSummary(false);
        turnHistoryState.entries = [];
        setSessionValue('cajaAbierta', 'false');
        persistTurnHistory();
        renderCashSessionState();
        renderTurnHistory();
        renderTurnSummary();
        return;
    }

    try {
        const data = await fetchCashStatus({ apiBaseUrl, token });

        if (data?.abierta) {
            cashSessionState.isOpen = true;
            cashSessionState.openingAmount = Number(data?.caja?.montoInicial || data?.caja?.montoApertura || 0);
            cashSessionState.openedAt = data?.caja?.horaApertura || data?.caja?.fechaApertura || new Date().toISOString();
            setSessionValue('cajaAbierta', 'true');
            closeCashSessionModal();
            if (!turnHistoryState.entries.length) {
                addTurnHistoryEntry({
                    title: 'Caja abierta',
                    detail: `Turno recuperado con fondo inicial de $${formatCurrency(cashSessionState.openingAmount)}`
                });
            }
        } else {
            cashSessionState.isOpen = false;
            cashSessionState.openingAmount = 0;
            cashSessionState.openedAt = null;
            resetTurnSummary();
            turnHistoryState.entries = [];
            setSessionValue('cajaAbierta', 'false');
            persistTurnHistory();
            renderTurnHistory();
            window.setTimeout(() => openCashSessionModal(), 50);
        }
    } catch (error) {
        console.error('Cash state error:', error);
        cashSessionState.isOpen = false;
        cashSessionState.openingAmount = 0;
        cashSessionState.openedAt = null;
        setSessionValue('cajaAbierta', 'false');
        setBackendStatus(error?.message || 'No se pudo verificar el estado de la caja.');
    }

    renderCashSessionState();
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
        cashSessionState.openingAmount = Math.round(openingAmount);
        cashSessionState.openedAt = data?.caja?.horaApertura || new Date().toISOString();
        setSessionValue('cajaAbierta', 'true');
        resetTurnSummary();
        turnHistoryState.entries = [];
        addTurnHistoryEntry({
            title: 'Turno iniciado',
            detail: `Fondo de caja declarado: $${formatCurrency(cashSessionState.openingAmount)}`
        });
        renderCashSessionState();
        renderTurnSummary();
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
        total: snapshot.total
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
    openInvoiceClientModalView();
    loadInvoiceClients();
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

    try {
        const result = await submitSaleToBackend({
            method,
            snapshot,
            received
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
    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Confirmar cobro';
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
        saleId: result?.id_venta || 0
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

        closeCloseCashModal();
        resetCashierRuntimeState();
        setLoginStatus(`Turno cerrado. Diferencia total: ${formatDifferenceLabel(totalDifference)}. Ingresa de nuevo para iniciar otra caja.`);
        showLoginScreen();
    } catch (error) {
        console.error('Cash close error:', error);
        setBackendStatus(error?.message || 'No se pudo cerrar la caja.');
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
    const releaseRepoInput = document.getElementById('release-repo-input');

    if (printerSelect) {
        printerSelect.value = settings.printerName;
    }

    if (printerPaperSelect) {
        printerPaperSelect.value = settings.printerPaper;
    }

    if (releaseRepoInput) {
        releaseRepoInput.value = settings.releaseRepo;
    }
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
    const firstMatch = exactCodeMatch || findProducts(term)[0];

    if (firstMatch) {
        selectProductForSale(firstMatch.id);
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
    renderSearchResultsView(products);
}

function renderCart() {
    renderCartView({
        cart: saleState.cart,
        products: catalogState.products
    });
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
        SESSION_KEYS.turnSummary,
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
window.updateCartItemQuantity = updateCartItemQuantity;
window.removeCartItem = removeCartItem;
window.openWeightedEditModal = openWeightedEditModal;
window.openSaleCancellationModal = openSaleCancellationModal;
