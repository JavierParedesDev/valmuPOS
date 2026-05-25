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
    setCartItemQuantity,
    updateCartItemQuantityValue,
    removeCartItemByProductId
} from './domain/cart-domain.js';
import {
    filterDispatchProducts,
    addProductToDispatchCart,
    addWeightedQuantityToDispatchCart,
    setDispatchCartItemQuantity,
    updateDispatchCartQuantity,
    removeDispatchCartItem,
    buildDispatchSnapshot,
    buildDispatchPayload,
    buildDispatchRecord,
    buildDispatchStockPlan,
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
    renderDispatchRecords,
    renderCarrierSelectionList,
    updateCarrierTiles,
    updateDispatchCustomerTile,
    updateDispatchDocumentTypeUI,
    updateDispatchAddressVisibility
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
    closeWeightedModalView,
    showCustomerModalStepView,
    openConfirmModalView,
    closeConfirmModalView
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
    resolveOtherBranchStock,
    resolveDispatchPriorityInventory,
    applyDispatchPriorityStock
} from './services/catalog-runtime-service.js';
import { fetchCashStatus, openCashTurn, closeCashTurn, registerCashWithdrawal, fetchCashWithdrawals } from './services/cash-service.js';
import { fetchSalesHistory, cancelSaleRequest, submitSaleRequest, fetchSaleDetail } from './services/sales-service.js';
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
    saveCustomerDisplaySettingsSnapshot
} from './services/settings-service.js';
import {
    getSessionValue,
    setSessionValue,
    getJsonSessionValue,
    setJsonSessionValue,
    removeSessionValues
} from './services/session-service.js';

let activeOperationMode = 'sale';
let saleHistoryClickTimer = null;
let updateStateCleanup = null;
let latestUpdateState = null;
let lastUpdatePromptStatus = null;
let boletaEnvelopeMode = 'both'; // 'both', 'time', 'count'
let boletaEnvelopeWindowMs = 60 * 60 * 1000;
let boletaEnvelopeLimit = 50;
const LIVE_CATALOG_REFRESH_MS = 5000;
const boletaEnvelopeState = {
    startedAt: null,
    items: []
};
let boletaEnvelopeFlushTimer = null;
let boletaEnvelopeSendInFlight = false;
let lastCatalogSyncAt = 0;
let catalogRefreshPromise = null;
let customerDisplayScrollSyncTimer = null;
let customerDisplaySyncThrottleTimer = null;
let customerDisplayPendingSync = false;
let customerDisplayKnownOpen = false;
let customerDisplayLastPayloadKey = '';
let autoScanTimer = null;

async function initSiiEnvelopeParams() {
    if (typeof window.cajeroAPI?.getSiiConfig === 'function') {
        try {
            const config = await window.cajeroAPI.getSiiConfig();
            boletaEnvelopeMode = config?.boletaEnvMode || 'both';
            boletaEnvelopeWindowMs = Number(config?.boletaEnvMinutes !== undefined ? config.boletaEnvMinutes : 60) * 60 * 1000;
            boletaEnvelopeLimit = Number(config?.boletaEnvLimit !== undefined ? config.boletaEnvLimit : 50);
        } catch (e) {
            console.error('Error loading SII envelope config on start:', e);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // Custom Titlebar Controls
    document.getElementById('titlebar-minimize')?.addEventListener('click', () => window.cajeroAPI?.windowMinimize?.());
    document.getElementById('titlebar-maximize')?.addEventListener('click', () => window.cajeroAPI?.windowMaximize?.());
    document.getElementById('titlebar-close')?.addEventListener('click', () => window.cajeroAPI?.windowClose?.());
    
    window.cajeroAPI?.onFullscreenChange?.((isFullscreen) => {
        if (isFullscreen) {
            document.body.classList.add('is-fullscreen');
        } else {
            document.body.classList.remove('is-fullscreen');
        }
    });
    // Set initial fullscreen state if possible
    document.body.classList.add('is-fullscreen');

    hydrateVersion();
    hydrateLoginForm();
    await initSiiEnvelopeParams();
    hydratePendingBoletaEnvelopeState();
    bindLogin();
    bindLogout();
    bindSettings();
    bindNavigation();
    bindWeightedModal();
    bindCashSessionModal();
    bindCashWithdrawalModal();
    bindPaymentModal();
    bindCloseCashModal();
    bindInvoiceClientModal();
    bindInfoModal();
    bindReceiptModal();
    bindDispatchReceiptModal();
    bindDispatchHistoryModal();
    bindDispatchCarrierModal();
    bindSaleActionModal();
    bindConfirmModal();
    bindUpdateRuntime();
    bindBranchSelection();
    bindSalesHistoryTabs();
    bindDispatchView();
    bindGlobalRuntimeGuards();
    bindDteQueueSettings();
    startDteQueueWorker();

    await restoreSessionOnStartup();
});

async function restoreSessionOnStartup() {
    showLoginScreen();

    if (!hasStoredSession()) {
        clearIncompleteStoredSession();
        setLoginStatus('Completa tus credenciales para entrar.');
        focusLoginUsername();
        return;
    }

    setLoginStatus('Recuperando sesion guardada...');

    try {
        const cashStatus = await validateStoredSession();
        await bootAuthenticatedSession({ cashStatus });
    } catch (error) {
        console.error('Stored session restore error:', error);
        resetCashierRuntimeState();
        showLoginScreen();
        setLoginStatus(error?.message || 'No se pudo recuperar la sesion guardada. Ingresa nuevamente.');
        focusLoginUsername();
    }
}

function hasStoredSession() {
    return Boolean(
        normalizeApiBaseUrl(getApiBaseUrl()) &&
        getAuthToken() &&
        getCurrentUserId()
    );
}

function clearIncompleteStoredSession() {
    if (!getAuthToken() && !getCurrentUser() && !getSessionValue('cajaAbierta')) {
        return;
    }

    clearSession();
}

async function validateStoredSession() {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();

    if (!apiBaseUrl || !token || !getCurrentUserId()) {
        throw new Error('No hay una sesion guardada valida. Ingresa nuevamente.');
    }

    return fetchCashStatus({ apiBaseUrl, token });
}

function focusLoginUsername() {
    window.setTimeout(() => {
        document.getElementById('login-username-input')?.focus();
    }, 0);
}

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

async function bootAuthenticatedSession(options = {}) {
    try {
        await enterCashierMode(options);
    } catch (error) {
        const detail = error?.message || 'No se pudo cargar el cajero con la sesion actual.';
        console.error('Cashier bootstrap error:', error);
        resetCashierRuntimeState();
        showLoginScreen();
        handleRuntimeFailure({
            title: 'Error al iniciar cajero',
            detail
        });
        focusLoginUsername();
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
            setLoginStatus('Cargando cajero...');
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
    const headerCashWithdrawalButton = document.getElementById('header-cash-withdrawal-btn');
    const headerCashButton = document.getElementById('header-cash-btn');
    const headerSettingsButton = document.getElementById('header-settings-btn');
    const headerFullscreenButton = document.getElementById('header-fullscreen-btn');
    const settingsBackButton = document.getElementById('settings-back-btn');
    const saleDispatchButton = document.getElementById('sale-footer-dispatch-btn');
    const saleHistoryButton = document.getElementById('sale-footer-history-btn');

    saleButton?.addEventListener('click', () => showAppView('sale'));
    dispatchButton?.addEventListener('click', () => showAppView('dispatch'));
    cashButton?.addEventListener('click', () => showAppView('cash'));
    settingsButton?.addEventListener('click', () => showAppView('settings'));
    headerCloseCashButton?.addEventListener('click', openCloseCashModal);
    headerCashWithdrawalButton?.addEventListener('click', openCashWithdrawalModal);
    headerCashButton?.addEventListener('click', () => showAppView('cash'));
    headerSettingsButton?.addEventListener('click', () => showAppView('settings'));

    const headerSyncButton = document.getElementById('header-sync-btn');
    headerSyncButton?.addEventListener('click', async () => {
        const icon = headerSyncButton.querySelector('i');
        const text = headerSyncButton.querySelector('span');

        headerSyncButton.disabled = true;
        if (icon) icon.className = 'bi bi-arrow-clockwise spin-animation';
        if (text) text.textContent = ' Sincronizando...';

        try {
            const success = await ensureFreshCatalogForSearch({ force: true });
            if (success) {
                renderCatalogStatus();
                renderSearchResults([]);
                renderCart();
                renderDispatchSection();
                openInfoModal('Catálogo Sincronizado', 'El catálogo de productos se ha sincronizado correctamente.');
            } else {
                openInfoModal('Catálogo Sincronizado', 'El catálogo ya estaba actualizado o no se realizaron cambios.');
            }
        } catch (error) {
            console.error('Error al sincronizar catálogo:', error);
            openInfoModal('Error de Sincronización', 'No se pudo conectar con el servidor para sincronizar: ' + (error?.message || error));
        } finally {
            headerSyncButton.disabled = false;
            if (icon) icon.className = 'bi bi-arrow-clockwise';
            if (text) text.textContent = ' Sincronizar';
        }
    });

    headerFullscreenButton?.addEventListener('click', async () => {
        if (window.cajeroAPI && window.cajeroAPI.toggleFullscreen) {
            await window.cajeroAPI.toggleFullscreen();
        }
    });

    settingsBackButton?.addEventListener('click', () => {
        showAppView('sale');
    });

    saleDispatchButton?.addEventListener('click', () => showAppView('dispatch'));
    saleHistoryButton?.addEventListener('click', () => {
        if (saleHistoryClickTimer) {
            window.clearTimeout(saleHistoryClickTimer);
            saleHistoryClickTimer = null;
        }

        saleHistoryClickTimer = window.setTimeout(() => {
            saleHistoryClickTimer = null;

            if (isDispatchMode()) {
                openDispatchHistoryModal();
                return;
            }

            salesHistoryState.showAllDocuments = false;
            persistSalesHistoryState();
            renderDocumentType();
            openSaleHistoryModal();
        }, 220);
    });
    saleHistoryButton?.addEventListener('dblclick', () => {
        if (saleHistoryClickTimer) {
            window.clearTimeout(saleHistoryClickTimer);
            saleHistoryClickTimer = null;
        }

        if (isDispatchMode()) {
            return;
        }
        salesHistoryState.showAllDocuments = true;
        persistSalesHistoryState();
        renderDocumentType();
        openSaleHistoryModal();
    });
}

function bindSettings() {
    document.getElementById('save-printer-settings-btn')?.addEventListener('click', savePrinterSettings);
    document.getElementById('test-printer-btn')?.addEventListener('click', testPrinter);
    document.getElementById('save-customer-display-settings-btn')?.addEventListener('click', saveCustomerDisplaySettings);
    document.getElementById('open-customer-display-btn')?.addEventListener('click', openCustomerDisplayWindow);
    document.getElementById('close-customer-display-btn')?.addEventListener('click', closeCustomerDisplayWindow);
    document.getElementById('check-updates-btn')?.addEventListener('click', checkForAppUpdates);
    document.getElementById('download-update-btn')?.addEventListener('click', handleUpdatePrimaryAction);
    document.getElementById('upload-cert-btn')?.addEventListener('click', () => uploadSiiSupportFile({ kind: 'cert' }));
    document.getElementById('save-cert-password-btn')?.addEventListener('click', saveCertificatePassword);
    document.getElementById('save-sii-credentials-btn')?.addEventListener('click', saveSiiCredentials);
    document.getElementById('save-boleta-env-settings-btn')?.addEventListener('click', saveBoletaEnvelopeSettings);
    document.getElementById('upload-caf39-btn')?.addEventListener('click', () => uploadCafFile({ type: 39 }));
    document.getElementById('upload-caf33-btn')?.addEventListener('click', () => uploadCafFile({ type: 33 }));
    document.getElementById('force-boleta-envelope-btn')?.addEventListener('click', async () => {
        if (!boletaEnvelopeState.items.length) {
            setSiiSettingsStatus('No hay boletas pendientes para enviar.');
            return;
        }

        try {
            await forceSendPendingBoletaEnvelope({
                reason: 'Envio forzado desde ajustes',
                notifyUser: true
            });
        } catch (_error) {
            // El mensaje ya se reporta dentro del flujo de envio.
        }
    });

    bindSettingsTabs();
}

function bindUpdateRuntime() {
    if (typeof window.cajeroAPI?.onUpdateStateChanged === 'function') {
        updateStateCleanup?.();
        updateStateCleanup = window.cajeroAPI.onUpdateStateChanged((state) => {
            applyUpdateState(state);
        });
    }

    void hydrateUpdateState();
}

async function hydrateUpdateState() {
    try {
        if (typeof window.cajeroAPI?.getAppVersion === 'function') {
            const version = await window.cajeroAPI.getAppVersion();
            const versionLabel = document.getElementById('settings-version-label');
            if (versionLabel) {
                versionLabel.textContent = `v${version}`;
            }
        }

        if (typeof window.cajeroAPI?.getUpdateState === 'function') {
            const state = await window.cajeroAPI.getUpdateState();
            applyUpdateState(state);
        }
    } catch (error) {
        console.error('Update state hydrate error:', error);
    }
}

function getUpdatePrimaryActionLabel(state) {
    if (!state) {
        return 'Buscar actualización';
    }

    if (state.downloadReady) {
        return 'Instalar ahora';
    }

    if (state.status === 'available') {
        return 'Descargar actualización';
    }

    if (state.status === 'downloading') {
        return 'Descargando...';
    }

    if (state.status === 'checking') {
        return 'Buscando...';
    }

    return 'Buscar actualización';
}

function updateSettingsUpdateCard(state) {
    const statusLabel = document.getElementById('settings-update-status');
    const latestVersionLabel = document.getElementById('settings-latest-version-label');
    const checkedAtLabel = document.getElementById('settings-update-checked-at');
    const actionButton = document.getElementById('download-update-btn');
    const errorRow = document.getElementById('settings-update-error-row');
    const errorLabel = document.getElementById('settings-update-error');

    if (statusLabel) {
        statusLabel.textContent = state?.statusMessage || 'Aun no se ha comprobado si hay actualizaciones.';
    }

    if (latestVersionLabel) {
        latestVersionLabel.textContent = state?.latestVersion ? `v${state.latestVersion}` : 'Sin registro';
    }

    if (checkedAtLabel) {
        checkedAtLabel.textContent = state?.checkedAt ? formatDateTime(state.checkedAt) : 'Aun sin revision';
    }

    if (errorRow) {
        const hasError = Boolean(state?.errorMessage);
        errorRow.style.display = hasError ? '' : 'none';
        if (hasError && errorLabel) {
            errorLabel.textContent = state.errorMessage;
        }
    }

    if (actionButton) {
        actionButton.textContent = getUpdatePrimaryActionLabel(state);
        actionButton.disabled = state?.status === 'checking' || state?.status === 'downloading';
    }
}

function applyUpdateState(state) {
    latestUpdateState = state || null;
    updateSettingsUpdateCard(latestUpdateState);
    maybePromptForUpdate(latestUpdateState);
}

function maybePromptForUpdate(state) {
    const status = state?.status || null;

    if (!status || status === lastUpdatePromptStatus) {
        return;
    }

    lastUpdatePromptStatus = status;

    if (status === 'available') {
        void promptToDownloadUpdate(state);
        return;
    }

    if (status === 'downloaded') {
        void promptToInstallUpdate(state);
    }
}

async function promptToDownloadUpdate(state) {
    const shouldDownload = await openConfirm({
        title: 'Nueva actualización disponible',
        message: `Se encontró la versión ${state?.latestVersion || 'nueva'} de Valmu Cajero. ¿Quieres descargarla ahora?`
    });

    if (!shouldDownload) {
        return;
    }

    await downloadAppUpdate();
}

async function promptToInstallUpdate(state) {
    const shouldInstall = await openConfirm({
        title: 'Actualización lista',
        message: `La versión ${state?.latestVersion || 'nueva'} ya terminó de descargarse. ¿Quieres instalarla ahora?`
    });

    if (!shouldInstall) {
        return;
    }

    await installAppUpdate();
}

async function checkForAppUpdates() {
    try {
        const state = await window.cajeroAPI?.checkForUpdates?.();
        applyUpdateState(state);
    } catch (error) {
        updateSettingsUpdateCard({
            ...latestUpdateState,
            statusMessage: error?.message || 'No se pudo buscar actualizaciones.'
        });
    }
}

async function downloadAppUpdate() {
    try {
        const state = await window.cajeroAPI?.downloadUpdate?.();
        applyUpdateState(state);
    } catch (error) {
        updateSettingsUpdateCard({
            ...latestUpdateState,
            statusMessage: error?.message || 'No se pudo descargar la actualización.'
        });
    }
}

async function installAppUpdate() {
    try {
        await window.cajeroAPI?.installUpdate?.();
    } catch (error) {
        updateSettingsUpdateCard({
            ...latestUpdateState,
            statusMessage: error?.message || 'No se pudo instalar la actualización.'
        });
    }
}

async function handleUpdatePrimaryAction() {
    if (latestUpdateState?.downloadReady) {
        await installAppUpdate();
        return;
    }

    if (latestUpdateState?.status === 'available') {
        await downloadAppUpdate();
        return;
    }

    await checkForAppUpdates();
}

function bindSettingsTabs() {
    const navItems = document.querySelectorAll('.settings-nav-item');
    const tabContents = document.querySelectorAll('.settings-tab-content');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');

            // Update Nav Items
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Update Tab Contents
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `settings-tab-${targetTab}`) {
                    content.classList.add('active');
                }
            });

            if (targetTab === 'pending-dtes') {
                renderDteQueueView();
                checkSimpleApiStatus();
            }
        });
    });
}

function bindBranchSelection() {
    document.getElementById('branch-select')?.addEventListener('change', handleBranchSelectionChange);
}

function bindDispatchView() {
    document.getElementById('dispatch-customer-tile')?.addEventListener('click', openDispatchCustomerModal);
    document.getElementById('dispatch-carrier-tile')?.addEventListener('click', openCarrierSelectionModal);
    document.getElementById('dispatch-manage-customer-btn')?.addEventListener('click', openDispatchCustomerModal);
    document.getElementById('dispatch-clear-customer-btn')?.addEventListener('click', clearDispatchCustomer);

    document.querySelectorAll('.doc-chip').forEach(chip => {
        chip.addEventListener('click', handleDispatchDocumentTypeChange);
    });

    document.getElementById('carrier-selection-close-btn')?.addEventListener('click', closeCarrierSelectionModal);
    document.getElementById('carrier-selection-add-new-btn')?.addEventListener('click', () => {
        closeCarrierSelectionModal();
        openDispatchCarrierModal();
    });

    const carrierSearchInput = document.getElementById('carrier-selection-search-input');
    carrierSearchInput?.addEventListener('input', (event) => {
        const query = event.target.value.toLowerCase();
        const filtered = dispatchState.carriers.filter(c =>
            c.name.toLowerCase().includes(query) || c.plate.toLowerCase().includes(query)
        );
        renderCarrierSelectionList(filtered, dispatchState.selectedCarrierId);
    });

    const dispatchSearchInput = document.getElementById('dispatch-search-input');
    dispatchSearchInput?.addEventListener('input', handleDispatchSearchInput);
    dispatchSearchInput?.addEventListener('keydown', handleSearchKeydown);
    dispatchSearchInput?.addEventListener('blur', () => {
        window.setTimeout(() => renderDispatchSearchResults([]), 120);
    });
    dispatchSearchInput?.addEventListener('focus', () => {
        void ensureFreshCatalogForSearch().then((refreshed) => {
            if (!refreshed) {
                return;
            }

            const currentTerm = String(dispatchSearchInput.value || '').trim();
            if (!currentTerm) {
                renderCatalogStatus();
                renderCart();
                return;
            }

            renderDispatchSearchResults(filterDispatchProducts(catalogState.products, currentTerm, normalizeCatalogText).slice(0, 6));
            renderCart();
            renderCatalogStatus();
        });
    });
    document.getElementById('dispatch-address-input')?.addEventListener('input', (event) => {
        dispatchState.manualAddress = String(event.target?.value || '').trim();
        persistDispatchDraft();
    });
    document.getElementById('dispatch-payment-input')?.addEventListener('change', (event) => {
        dispatchState.manualPayment = event.target?.value || 'en_ruta';
        persistDispatchDraft();
    });
    document.getElementById('dispatch-add-manual-btn')?.addEventListener('click', addFirstDispatchSearchResult);
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
        showAppView('sale');
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
    document.getElementById('sale-history-close-btn')?.addEventListener('click', () => {
        document.getElementById('sale-history-modal-backdrop')?.classList.add('hidden');
    });

    const historyHeader = document.getElementById('sale-history-header');
    historyHeader?.addEventListener('dblclick', async () => {
        salesHistoryState.showAllDocuments = !salesHistoryState.showAllDocuments;
        persistSalesHistoryState();
        renderDocumentType();
        await loadSalesHistory();
    });

    document.getElementById('sales-tab-active-btn')?.addEventListener('click', () => {
        salesHistoryState.currentTab = 'active';
        persistSalesHistoryState();
        renderSalesHistory();
    });

    document.getElementById('sales-tab-cancelled-btn')?.addEventListener('click', () => {
        salesHistoryState.currentTab = 'cancelled';
        persistSalesHistoryState();
        renderSalesHistory();
    });
}

function bindPaymentModal() {
    document.getElementById('charge-main-btn')?.addEventListener('click', handleMainChargeAction);
    document.getElementById('sale-total-card')?.addEventListener('dblclick', () => {
        if (isDispatchMode()) {
            return;
        }

        if (saleState.documentType === 'Vale interno') {
            saleState.documentType = 'Boleta';
        } else {
            saleState.documentType = 'Vale interno';
            saleState.customer = null;
            renderCustomerSummary();
        }

        renderDocumentType();
        renderCart();
        setBackendStatus(
            saleState.documentType === 'Vale interno'
                ? 'Modo vale interno activado. Esta venta no se enviara al SII.'
                : 'Modo fiscal restaurado. La venta vuelve a boleta.'
        );
    });
    document.getElementById('doc-boleta-toggle')?.addEventListener('click', () => {
        if (isDispatchMode()) {
            showAppView('sale');
            return;
        }
        saleState.documentType = 'Boleta';
        saleState.customer = null;
        renderCustomerSummary();
        renderDocumentType();
    });
    document.getElementById('doc-factura-toggle')?.addEventListener('click', () => {
        if (isDispatchMode()) {
            showAppView('sale');
            return;
        }
        saleState.documentType = 'Factura';
        renderDocumentType();
    });
    document.getElementById('collaborator-discount-btn')?.addEventListener('click', toggleCollaboratorDiscount);
    document.getElementById('extra-charge-btn')?.addEventListener('click', toggleExtraCharge);
    document.getElementById('clear-sale-btn')?.addEventListener('click', clearCurrentSale);
    document.getElementById('manage-invoice-customer-btn')?.addEventListener('click', openInvoiceClientFlow);
    document.getElementById('clear-invoice-customer-btn')?.addEventListener('click', clearInvoiceCustomer);
    document.getElementById('payment-cancel-btn')?.addEventListener('click', closePaymentModal);
    document.getElementById('payment-confirm-btn')?.addEventListener('click', confirmPaymentFlow);
    document.getElementById('payment-method-select')?.addEventListener('change', handlePaymentMethodChange);
    document.getElementById('payment-received-input')?.addEventListener('input', renderPaymentChange);
    document.getElementById('payment-mixed-cash')?.addEventListener('input', renderPaymentChange);
    document.getElementById('payment-mixed-card')?.addEventListener('input', renderPaymentChange);
    document.getElementById('payment-mixed-transfer')?.addEventListener('input', renderPaymentChange);
    document.getElementById('invoice-client-clear-btn')?.addEventListener('click', clearInvoiceCustomer);
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
        if (!saleState.customer?.id) {
            openInvoiceClientFlow();
            return;
        }

        openPaymentModal(saleState.documentType);
    } else {
        openPaymentModal(saleState.documentType);
    }
}

function bindInvoiceClientModal() {
    document.getElementById('invoice-client-cancel-btn')?.addEventListener('click', closeInvoiceClientModal);
    document.getElementById('invoice-client-confirm-btn')?.addEventListener('click', confirmInvoiceClient);
    document.getElementById('invoice-client-use-existing-btn')?.addEventListener('click', useSelectedInvoiceClient);
    document.getElementById('invoice-client-search-input')?.addEventListener('input', handleInvoiceClientSearch);
    document.getElementById('invoice-rut-input')?.addEventListener('input', handleInvoiceRutInput);
    document.getElementById('invoice-rut-input')?.addEventListener('blur', handleInvoiceRutInput);

    // Custom list selection
    document.getElementById('invoice-client-select-list')?.addEventListener('click', (event) => {
        const item = event.target.closest('.selection-item');
        if (!item) return;

        // Reset previous
        document.querySelectorAll('.selection-item').forEach(el => el.classList.remove('selected'));

        // Select new
        item.classList.add('selected');
        selectedClientId = Number(item.dataset.id);
    });

    // New step buttons
    document.getElementById('btn-select-search-step')?.addEventListener('click', () => showCustomerModalStepView('search'));
    document.getElementById('btn-select-register-step')?.addEventListener('click', () => showCustomerModalStepView('register'));
    document.getElementById('btn-back-to-selection-search')?.addEventListener('click', () => showCustomerModalStepView('selection'));
    document.getElementById('btn-back-to-selection-register')?.addEventListener('click', () => showCustomerModalStepView('selection'));

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
    document.getElementById('local-audit-close-btn')?.addEventListener('click', closeLocalAuditSummaryModal);
    document.getElementById('local-audit-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'local-audit-modal-backdrop') {
            closeLocalAuditSummaryModal();
        }
    });
}

let currentConfirmResolve = null;

function bindConfirmModal() {
    document.getElementById('confirm-modal-confirm-btn')?.addEventListener('click', () => {
        if (currentConfirmResolve) {
            currentConfirmResolve(true);
            currentConfirmResolve = null;
        }
        closeConfirmModalView();
    });

    document.getElementById('confirm-modal-cancel-btn')?.addEventListener('click', () => {
        if (currentConfirmResolve) {
            currentConfirmResolve(false);
            currentConfirmResolve = null;
        }
        closeConfirmModalView();
    });

    document.getElementById('confirm-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'confirm-modal-backdrop') {
            if (currentConfirmResolve) {
                currentConfirmResolve(false);
                currentConfirmResolve = null;
            }
            closeConfirmModalView();
        }
    });
}

function openConfirm({ title, message }) {
    openConfirmModalView({ title, message });
    return new Promise((resolve) => {
        currentConfirmResolve = resolve;
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
    saleState.collaboratorDiscountEnabled = false;
    saleState.extraChargeEnabled = false;
    renderCustomerSummary();
    renderDocumentType();
    renderSearchResults([]);
    renderCart();
    setBackendStatus('Venta actual vaciada. Puedes comenzar una nueva.');
}

function bindCloseCashModal() {
    document.getElementById('close-cash-session-btn')?.addEventListener('click', openCloseCashModal);
    document.getElementById('close-cash-cancel-btn')?.addEventListener('click', closeCloseCashModal);
    document.getElementById('close-cash-local-btn')?.addEventListener('click', openLocalAuditSummaryModal);
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

function bindCashWithdrawalModal() {
    document.getElementById('cash-withdrawal-cancel-btn')?.addEventListener('click', closeCashWithdrawalModal);
    document.getElementById('cash-withdrawal-confirm-btn')?.addEventListener('click', confirmCashWithdrawal);
    document.getElementById('cash-withdrawal-modal-backdrop')?.addEventListener('click', (event) => {
        if (event.target.id === 'cash-withdrawal-modal-backdrop') {
            closeCashWithdrawalModal();
        }
    });
}

async function enterCashierMode({ cashStatus = null } = {}) {
    hydrateCashierUser();
    await verificarEstadoCaja({
        cashStatus,
        throwOnError: true
    });
    showCashierApp();
    showAppView('sale');
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

    if (saleState.cart.length) {
        setBackendStatus(`Venta en curso recuperada con ${formatQuantity(getCartSnapshot().items, false)} item(s).`);
        addAuditEntry({
            type: 'warning',
            title: 'Venta recuperada',
            detail: `Se restauro una venta en curso con ${formatQuantity(getCartSnapshot().items, false)} item(s).`
        });
    }

    setTimeout(processDteQueueBackground, 3000);
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
    const boletaButton = document.getElementById('doc-boleta-toggle');
    const facturaButton = document.getElementById('doc-factura-toggle');
    const dispatchButton = document.getElementById('sale-footer-dispatch-btn');
    const historyButton = document.getElementById('sale-footer-history-btn');
    const collaboratorDiscountButton = document.getElementById('collaborator-discount-btn');

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
        totalCardLabel.textContent = dispatchMode
            ? 'Total referencial'
            : saleState.documentType === 'Vale interno'
                ? 'Vale interno activo'
                : 'Total a pagar';
    }

    if (chargeButton) {
        chargeButton.textContent = dispatchMode ? 'Emitir vale de despacho' : 'Cobrar';
    }

    if (clearButton) {
        clearButton.textContent = dispatchMode ? 'Vaciar carga' : 'Vaciar venta';
    }

    if (historyButton) {
        historyButton.classList.toggle('is-history-all', !dispatchMode && salesHistoryState.showAllDocuments);
        historyButton.title = dispatchMode
            ? 'Historial de despachos'
            : salesHistoryState.showAllDocuments
                ? 'Modo completo activo · doble click para ver fiscales e internas'
                : 'Modo fiscal activo · doble click para ver todas las ventas del turno';
        const historyLabel = historyButton.querySelector('span');
        if (historyLabel) {
            historyLabel.textContent = dispatchMode
                ? 'Historial de ventas'
                : salesHistoryState.showAllDocuments
                    ? 'Historial completo'
                    : 'Historial fiscal';
        }
    }

    if (dispatchMode) {
        setFooterButtonContent(boletaButton, 'bi-upc-scan', 'Vender', false);
        facturaButton?.classList.add('hidden');
        collaboratorDiscountButton?.classList.add('hidden');
        setFooterButtonContent(dispatchButton, 'bi-truck', 'Despacho', true);
        setFooterButtonContent(historyButton, 'bi-clock-history', 'Historial', false);
        document.getElementById('manage-invoice-customer-btn')?.classList.add('hidden');
        document.getElementById('clear-invoice-customer-btn')?.classList.add('hidden');
    } else {
        setFooterButtonContent(boletaButton, 'bi-receipt-cutoff', 'Boleta', saleState.documentType === 'Boleta');
        facturaButton?.classList.remove('hidden');
        collaboratorDiscountButton?.classList.remove('hidden');
        collaboratorDiscountButton?.classList.toggle('active', saleState.collaboratorDiscountEnabled);
        setFooterButtonContent(facturaButton, 'bi-file-earmark-text', 'Factura', saleState.documentType === 'Factura');
        setFooterButtonContent(dispatchButton, 'bi-truck', 'Despacho', false);
        setFooterButtonContent(historyButton, 'bi-clock-history', 'Historial de ventas', false);
        document.getElementById('manage-invoice-customer-btn')?.classList.remove('hidden');
        document.getElementById('clear-invoice-customer-btn')?.classList.toggle('hidden', !saleState.customer?.id);
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
    const saleCartList = document.getElementById('cart-list');
    const dispatchCartList = document.getElementById('dispatch-cart-list');
    if (!searchInput || searchInput.dataset.bound === 'true') {
        return;
    }

    searchInput.addEventListener('input', handleSearchInput);
    searchInput.addEventListener('keydown', handleSearchKeydown);
    searchInput.addEventListener('focus', () => {
        void ensureFreshCatalogForSearch().then((refreshed) => {
            if (!refreshed) {
                return;
            }

            const currentTerm = String(searchInput.value || '').trim();
            if (!currentTerm) {
                renderCatalogStatus();
                renderCart();
                return;
            }

            renderSearchResults(findProducts(currentTerm).slice(0, 6));
            renderCart();
            renderCatalogStatus();
        });
    });
    searchInput.addEventListener('blur', () => {
        clearAutoScanTimer();
        window.setTimeout(() => renderSearchResults([]), 120);
    });

    if (saleCartList && saleCartList.dataset.customerScrollBound !== 'true') {
        saleCartList.addEventListener('scroll', scheduleCustomerDisplayScrollSync, { passive: true });
        saleCartList.dataset.customerScrollBound = 'true';
    }

    if (dispatchCartList && dispatchCartList.dataset.customerScrollBound !== 'true') {
        dispatchCartList.addEventListener('scroll', scheduleCustomerDisplayScrollSync, { passive: true });
        dispatchCartList.dataset.customerScrollBound = 'true';
    }

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
    saleState.collaboratorDiscountEnabled = false;
    saleState.extraChargeEnabled = false;
    renderCustomerSummary();
    renderDocumentType();
    renderSearchResults([]);
    renderCart();
    renderDispatchSection();
    await connectCatalogToBackend();
    await loadSalesHistory();
    const userBranchId = String(getCurrentUser()?.id_sucursal || '');
    if (userBranchId && userBranchId !== branchId) {
        setBackendStatus('Sucursal cambiada. Las ventas se registraran en la nueva sucursal.');
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

        const allDispatches = normalizeDispatchHistory(history, formatDateTime);

        if (cashSessionState.isOpen && cashSessionState.openedAt) {
            const openedAtDate = new Date(cashSessionState.openedAt);
            dispatchState.records = allDispatches.filter((dispatch) => {
                const dispatchDate = new Date(dispatch.rawDate || new Date().toISOString());
                return dispatchDate.getTime() >= (openedAtDate.getTime() - 5000);
            });
        } else {
            dispatchState.records = allDispatches;
        }
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

function toggleCollaboratorDiscount() {
    if (isDispatchMode()) {
        showAppView('sale');
        return;
    }

    if (!cashSessionState.isOpen) {
        setBackendStatus('Debes abrir caja para aplicar descuentos.');
        return;
    }

    saleState.collaboratorDiscountEnabled = !saleState.collaboratorDiscountEnabled;
    renderCart();
    setBackendStatus(
        saleState.collaboratorDiscountEnabled
            ? 'Descuento colaboradores activado. Se aplicara 10% al total de la compra.'
            : 'Descuento colaboradores desactivado.'
    );
}

function toggleExtraCharge() {
    if (isDispatchMode()) {
        showAppView('sale');
        return;
    }

    if (!cashSessionState.isOpen) {
        setBackendStatus('Debes abrir caja para aplicar recargos.');
        return;
    }

    saleState.extraChargeEnabled = !saleState.extraChargeEnabled;
    renderCart();
    setBackendStatus(
        saleState.extraChargeEnabled
            ? 'Recargo 2% activado. Se aplicara 2% al total de la compra.'
            : 'Recargo 2% desactivado.'
    );
}

const LOCAL_AUDIT_STORAGE_KEY = 'valmu-local-sales-audit';

function buildDefaultSalesHistoryState() {
    return {
        items: [],
        cancelledItems: [],
        currentTab: 'active',
        showAllDocuments: false
    };
}

function buildDefaultLocalAuditState() {
    return {
        turnId: null,
        openedAt: null,
        resetAt: new Date().toISOString(),
        updatedAt: null,
        openingCash: 0,
        salesCount: 0,
        totals: {
            cash: 0,
            card: 0,
            transfer: 0
        },
        entries: []
    };
}

function isMissingLocalAuditHandlerError(error) {
    const message = String(error?.message || error || '');
    return message.includes("No handler registered for 'local-audit:");
}

function readLocalAuditFallback() {
    try {
        const raw = window.localStorage.getItem(LOCAL_AUDIT_STORAGE_KEY);
        if (!raw) {
            return buildDefaultLocalAuditState();
        }

        const parsed = JSON.parse(raw);
        return {
            ...buildDefaultLocalAuditState(),
            ...parsed,
            totals: {
                ...buildDefaultLocalAuditState().totals,
                ...(parsed?.totals || {})
            },
            entries: Array.isArray(parsed?.entries) ? parsed.entries : []
        };
    } catch (error) {
        console.error('Local audit fallback read error:', error);
        return buildDefaultLocalAuditState();
    }
}

function writeLocalAuditFallback(data) {
    try {
        const nextData = {
            ...buildDefaultLocalAuditState(),
            ...(data || {}),
            totals: {
                ...buildDefaultLocalAuditState().totals,
                ...(data?.totals || {})
            },
            entries: Array.isArray(data?.entries) ? data.entries : []
        };
        window.localStorage.setItem(LOCAL_AUDIT_STORAGE_KEY, JSON.stringify(nextData));
        return nextData;
    } catch (error) {
        console.error('Local audit fallback write error:', error);
        return buildDefaultLocalAuditState();
    }
}

function dedupeSalesHistoryItems(items) {
    const seenIds = new Set();
    return (Array.isArray(items) ? items : []).filter((sale) => {
        const saleId = Number(sale?.id || 0);
        if (saleId <= 0 || seenIds.has(saleId)) {
            return false;
        }
        seenIds.add(saleId);
        return true;
    });
}

function filterVisibleSalesHistoryItems(items, showAllDocuments = false) {
    const dedupedItems = dedupeSalesHistoryItems(items);
    return showAllDocuments
        ? dedupedItems
        : dedupedItems.filter((sale) => Boolean(sale?.isFiscal));
}

function hydrateSalesHistoryState() {
    const rawState = getScopedSessionData(SESSION_KEYS.salesHistory, getCurrentTurnScope());
    const nextState = {
        ...buildDefaultSalesHistoryState(),
        ...(rawState && typeof rawState === 'object' ? rawState : {})
    };

    salesHistoryState.currentTab = nextState.currentTab === 'cancelled' ? 'cancelled' : 'active';
    salesHistoryState.showAllDocuments = Boolean(nextState.showAllDocuments);
    salesHistoryState.items = filterVisibleSalesHistoryItems(nextState.items, salesHistoryState.showAllDocuments);
    salesHistoryState.cancelledItems = filterVisibleSalesHistoryItems(nextState.cancelledItems, salesHistoryState.showAllDocuments);
}

function persistSalesHistoryState() {
    setScopedSessionData(SESSION_KEYS.salesHistory, getCurrentTurnScope(), {
        items: dedupeSalesHistoryItems(salesHistoryState.items),
        cancelledItems: dedupeSalesHistoryItems(salesHistoryState.cancelledItems),
        currentTab: salesHistoryState.currentTab === 'cancelled' ? 'cancelled' : 'active',
        showAllDocuments: Boolean(salesHistoryState.showAllDocuments)
    });
}

function buildSalesHistoryItemsFromLocalAudit(entries = []) {
    return entries.map((entry) => {
        const saleId = Number(entry?.id || 0);
        if (saleId <= 0) {
            return null;
        }

        const documentType = String(entry?.documentType || 'Venta');
        const normalizedDocumentType = documentType.toLowerCase();
        return {
            id: saleId,
            total: Number(entry?.total || 0),
            document: documentType,
            paymentMethod: String(entry?.paymentMethod || 'Sin pago'),
            origin: String(entry?.origin || 'CAJA').toUpperCase(),
            paymentCash: Number(entry?.cash || 0),
            paymentCard: Number(entry?.card || 0),
            paymentTransfer: Number(entry?.transfer || 0),
            isFiscal: normalizedDocumentType.includes('boleta') || normalizedDocumentType.includes('factura'),
            folioDocumento: null,
            tipoDte: null,
            rutReceptor: null,
            customerRut: null,
            estadoSii: null,
            trackId: null,
            fechaDte: entry?.createdAt ? String(entry.createdAt).slice(0, 10) : null,
            rawDate: entry?.createdAt || null,
            dateLabel: entry?.createdAt ? formatDateTime(entry.createdAt) : 'Sin fecha',
            userId: Number(getCurrentUser()?.id_usuario || getCurrentUser()?.idUsuario || getCurrentUser()?.id || 0)
        };
    }).filter(Boolean);
}

function mergeSalesHistorySources(...sources) {
    return dedupeSalesHistoryItems(
        sources
            .flat()
            .filter(Boolean)
            .sort((left, right) => {
                const rightTime = new Date(right?.rawDate || 0).getTime();
                const leftTime = new Date(left?.rawDate || 0).getTime();
                return rightTime - leftTime;
            })
    );
}

async function resetLocalAuditFallbackForTurn() {
    const openingCash = Number(cashSessionState.openingAmount || 0);
    const nextData = {
        ...buildDefaultLocalAuditState(),
        turnId: cashSessionState.turnId,
        openedAt: cashSessionState.openedAt,
        resetAt: new Date().toISOString(),
        openingCash,
        totals: {
            cash: openingCash,
            card: 0,
            transfer: 0
        }
    };

    return {
        success: true,
        path: 'Respaldo local del navegador',
        source: 'fallback',
        data: writeLocalAuditFallback(nextData)
    };
}

async function appendLocalAuditFallbackEntry({ saleId, paymentMethod, total, cash, card, transfer, documentType }) {
    const currentData = readLocalAuditFallback();
    const entry = {
        id: String(saleId || `local-${Date.now()}`),
        createdAt: new Date().toISOString(),
        paymentMethod: String(paymentMethod || 'EFECTIVO').toUpperCase(),
        total: Number(total || 0),
        cash: Number(cash || 0),
        card: Number(card || 0),
        transfer: Number(transfer || 0),
        documentType: String(documentType || 'Venta'),
        origin: 'CAJA'
    };

    const nextData = {
        ...currentData,
        salesCount: Number(currentData.salesCount || 0) + 1,
        updatedAt: new Date().toISOString(),
        totals: {
            cash: Number(currentData?.totals?.cash || 0) + Number(entry.cash || 0),
            card: Number(currentData?.totals?.card || 0) + Number(entry.card || 0),
            transfer: Number(currentData?.totals?.transfer || 0) + Number(entry.transfer || 0)
        },
        entries: [entry, ...(Array.isArray(currentData.entries) ? currentData.entries : [])].slice(0, 500)
    };

    return {
        success: true,
        path: 'Respaldo local del navegador',
        source: 'fallback',
        data: writeLocalAuditFallback(nextData)
    };
}

async function resetLocalSalesAuditForTurn() {
    if (typeof window.cajeroAPI?.resetLocalAudit !== 'function') {
        return resetLocalAuditFallbackForTurn();
    }

    try {
        return await window.cajeroAPI.resetLocalAudit({
            turnId: cashSessionState.turnId,
            openedAt: cashSessionState.openedAt,
            openingCash: Number(cashSessionState.openingAmount || 0)
        });
    } catch (error) {
        if (isMissingLocalAuditHandlerError(error)) {
            return resetLocalAuditFallbackForTurn();
        }
        console.error('Local audit reset error:', error);
        return null;
    }
}

async function appendLocalSalesAuditEntry({ saleId, method, total, mixedData, documentType }) {
    if (typeof window.cajeroAPI?.appendLocalAuditSale !== 'function') {
        return appendLocalAuditFallbackEntry({
            saleId,
            paymentMethod: method,
            total,
            cash: 0,
            card: 0,
            transfer: 0,
            documentType
        });
    }

    const normalizedMethod = String(method || '').toLowerCase();
    const cash = normalizedMethod === 'mixto'
        ? Number(mixedData?.cash || 0)
        : normalizedMethod === 'efectivo'
            ? Number(total || 0)
            : 0;
    const card = normalizedMethod === 'mixto'
        ? Number(mixedData?.card || 0)
        : normalizedMethod === 'tarjeta'
            ? Number(total || 0)
            : 0;
    const transfer = normalizedMethod === 'mixto'
        ? Number(mixedData?.transfer || 0)
        : normalizedMethod === 'transferencia'
            ? Number(total || 0)
            : 0;

    try {
        return await window.cajeroAPI.appendLocalAuditSale({
            saleId,
            paymentMethod: normalizedMethod === 'mixto' ? 'MIXTO' : capitalizePaymentMethod(normalizedMethod).toUpperCase(),
            total: Number(total || 0),
            cash,
            card,
            transfer,
            documentType,
            origin: 'CAJA'
        });
    } catch (error) {
        if (isMissingLocalAuditHandlerError(error)) {
            return appendLocalAuditFallbackEntry({
                saleId,
                paymentMethod: normalizedMethod === 'mixto' ? 'MIXTO' : capitalizePaymentMethod(normalizedMethod).toUpperCase(),
                total: Number(total || 0),
                cash,
                card,
                transfer,
                documentType
            });
        }
        console.error('Local audit append error:', error);
        return null;
    }
}

async function openLocalAuditSummaryModal() {
    if (typeof window.cajeroAPI?.getLocalAudit !== 'function') {
        const fallbackResult = {
            success: true,
            path: 'Respaldo local del navegador',
            source: 'fallback',
            data: readLocalAuditFallback()
        };
        renderLocalAuditSummaryModal(fallbackResult);
        return;
    }

    try {
        const result = await window.cajeroAPI.getLocalAudit();
        if (!result?.success) {
            throw new Error(result?.error || 'No se pudo leer el auditor local.');
        }
        renderLocalAuditSummaryModal(result);
    } catch (error) {
        if (isMissingLocalAuditHandlerError(error)) {
            renderLocalAuditSummaryModal({
                success: true,
                path: 'Respaldo local del navegador',
                source: 'fallback',
                data: readLocalAuditFallback()
            });
            return;
        }

        openInfoModal('Auditor local', error?.message || 'No se pudo leer el auditor local.');
    }
}

function renderLocalAuditSummaryModal(result) {
    const data = result?.data || {};
    const totals = data?.totals || {};
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    const openingCash = Number(data?.openingCash || 0);
    const cashTotal = document.getElementById('local-audit-cash-total');
    const cardTotal = document.getElementById('local-audit-card-total');
    const transferTotal = document.getElementById('local-audit-transfer-total');
    const turnLabel = document.getElementById('local-audit-turn-label');
    const salesCountLabel = document.getElementById('local-audit-sales-count');
    const updatedAtLabel = document.getElementById('local-audit-updated-at');
    const pathLabel = document.getElementById('local-audit-path');
    const listCountLabel = document.getElementById('local-audit-list-count');
    const list = document.getElementById('local-audit-list');

    if (cashTotal) {
        cashTotal.textContent = `$${formatCurrency(Number(totals.cash || 0))}`;
        cashTotal.title = `Incluye fondo inicial de $${formatCurrency(openingCash)}`;
    }
    if (cardTotal) {
        cardTotal.textContent = `$${formatCurrency(Number(totals.card || 0))}`;
    }
    if (transferTotal) {
        transferTotal.textContent = `$${formatCurrency(Number(totals.transfer || 0))}`;
    }
    if (turnLabel) {
        turnLabel.textContent = String(data?.turnId || 'Sin turno');
    }
    if (salesCountLabel) {
        salesCountLabel.textContent = String(Number(data?.salesCount || 0));
    }
    if (updatedAtLabel) {
        updatedAtLabel.textContent = data?.updatedAt
            ? formatDateTime(data.updatedAt)
            : (data?.resetAt ? formatDateTime(data.resetAt) : 'Sin datos');
    }
    if (pathLabel) {
        pathLabel.textContent = `Archivo: ${result?.path || 'no disponible'}`;
    }
    if (listCountLabel) {
        listCountLabel.textContent = `${entries.length} registro${entries.length === 1 ? '' : 's'}`;
    }
    if (list) {
        list.innerHTML = entries.length
            ? entries.map((entry) => `
                <article class="turn-history-item">
                    <div class="turn-history-meta">
                        <strong>Venta #${escapeHtml(entry?.id || 'sin id')}</strong>
                        <span>${entry?.createdAt ? formatDateTime(entry.createdAt) : 'Sin fecha'}</span>
                    </div>
                    <div class="sale-history-badges">
                        <span class="sale-history-badge is-payment">${escapeHtml(entry?.paymentMethod || 'Sin pago')}</span>
                        <span class="sale-history-badge ${String(entry?.documentType || '').toLowerCase().includes('factura') || String(entry?.documentType || '').toLowerCase().includes('boleta') ? 'is-fiscal' : 'is-internal'}">${escapeHtml(entry?.documentType || 'Venta')}</span>
                    </div>
                    <div class="turn-history-detail">
                        Total $${formatCurrency(Number(entry?.total || 0))} | Efectivo $${formatCurrency(Number(entry?.cash || 0))} | Tarjeta $${formatCurrency(Number(entry?.card || 0))} | Transferencia $${formatCurrency(Number(entry?.transfer || 0))}
                    </div>
                </article>
            `).join('')
            : '<div class="turn-history-empty">Aun no hay ventas registradas en el auditor local.</div>';
    }

    document.getElementById('local-audit-modal-backdrop')?.classList.remove('hidden');
}

function closeLocalAuditSummaryModal() {
    document.getElementById('local-audit-modal-backdrop')?.classList.add('hidden');
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
    saleState.collaboratorDiscountEnabled = false;
    saleState.extraChargeEnabled = false;
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
    salesHistoryState.items = [];
    salesHistoryState.cancelledItems = [];
    salesHistoryState.currentTab = 'active';
    salesHistoryState.showAllDocuments = false;
    saleReceiptState.records = {};
    saleReceiptState.saleId = null;
    dispatchReceiptState.records = {};
    dispatchReceiptState.dispatchId = null;
    saleState.cart = [];
    saleState.documentType = 'Boleta';
    saleState.customer = null;
    saleState.collaboratorDiscountEnabled = false;
    saleState.extraChargeEnabled = false;
    dispatchState.cart = [];
    dispatchState.selectedCarrierId = null;
    dispatchState.selectedCustomerId = null;
    dispatchState.manualAddress = '';
    dispatchState.manualPayment = 'en_ruta';
    dispatchState.selectedDocumentTypeId = 3;
    resetTurnSummaryState(turnSummaryState);

    if (shouldPersist) {
        const turnScope = getCurrentTurnScope();
        setScopedSessionData(SESSION_KEYS.cashHistory, turnScope, null);
        setScopedSessionData(SESSION_KEYS.salesHistory, turnScope, null);
        setScopedSessionData(SESSION_KEYS.auditLog, turnScope, null);
        setScopedSessionData(SESSION_KEYS.turnSummary, turnScope, null);
        setScopedSessionData(SESSION_KEYS.saleReceipts, turnScope, null);
        setScopedSessionData(SESSION_KEYS.dispatchReceipts, turnScope, null);
        setScopedSessionData(SESSION_KEYS.saleDraft, turnScope, null);
        setScopedSessionData(SESSION_KEYS.dispatchDraft, turnScope, null);
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
    const rawSalesHistory = getScopedSessionData(SESSION_KEYS.salesHistory, turnScope);
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

    if (rawSalesHistory && typeof rawSalesHistory === 'object') {
        hydrateSalesHistoryState();
    } else {
        salesHistoryState.items = [];
        salesHistoryState.cancelledItems = [];
        salesHistoryState.currentTab = 'active';
        salesHistoryState.showAllDocuments = false;
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
        saleState.collaboratorDiscountEnabled = Boolean(draft.collaboratorDiscountEnabled);
        saleState.extraChargeEnabled = Boolean(draft.extraChargeEnabled);
    } else {
        saleState.cart = [];
        saleState.documentType = 'Boleta';
        saleState.customer = null;
        saleState.collaboratorDiscountEnabled = false;
        saleState.extraChargeEnabled = false;
    }

    hydrateDispatchDraft();

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
        saleState.collaboratorDiscountEnabled = false;
        saleState.extraChargeEnabled = false;
        return;
    }

    saleState.cart = Array.isArray(draft.cart) ? draft.cart : [];
    saleState.documentType = typeof draft.documentType === 'string' && draft.documentType
        ? draft.documentType
        : 'Boleta';
    saleState.customer = draft.customer && typeof draft.customer === 'object'
        ? draft.customer
        : null;
    saleState.collaboratorDiscountEnabled = Boolean(draft.collaboratorDiscountEnabled);
    saleState.extraChargeEnabled = Boolean(draft.extraChargeEnabled);
}

function persistSaleDraft() {
    const hasDraft = saleState.cart.length > 0
        || saleState.documentType !== 'Boleta'
        || Boolean(saleState.customer?.id)
        || saleState.collaboratorDiscountEnabled
        || saleState.extraChargeEnabled;

    if (!hasDraft) {
        setScopedSessionData(SESSION_KEYS.saleDraft, getCurrentTurnScope(), null);
        return;
    }

    setScopedSessionData(SESSION_KEYS.saleDraft, getCurrentTurnScope(), {
        cart: saleState.cart,
        documentType: saleState.documentType,
        customer: saleState.customer,
        collaboratorDiscountEnabled: saleState.collaboratorDiscountEnabled,
        extraChargeEnabled: saleState.extraChargeEnabled
    });
}

function hydrateDispatchDraft() {
    const draft = getScopedSessionData(SESSION_KEYS.dispatchDraft, getCurrentTurnScope());

    if (!draft || typeof draft !== 'object') {
        dispatchState.cart = [];
        dispatchState.selectedCarrierId = null;
        dispatchState.selectedCustomerId = null;
        dispatchState.manualAddress = '';
        dispatchState.manualPayment = 'en_ruta';
        dispatchState.selectedDocumentTypeId = 3;
        return;
    }

    dispatchState.cart = Array.isArray(draft.cart) ? draft.cart : [];
    dispatchState.selectedCarrierId = draft.selectedCarrierId !== undefined ? draft.selectedCarrierId : null;
    dispatchState.selectedCustomerId = draft.selectedCustomerId !== undefined ? draft.selectedCustomerId : null;
    dispatchState.manualAddress = typeof draft.manualAddress === 'string' ? draft.manualAddress : '';
    dispatchState.manualPayment = typeof draft.manualPayment === 'string' ? draft.manualPayment : 'en_ruta';
    dispatchState.selectedDocumentTypeId = typeof draft.selectedDocumentTypeId === 'number' ? draft.selectedDocumentTypeId : 3;
}

function persistDispatchDraft() {
    const hasDraft = dispatchState.cart.length > 0
        || dispatchState.selectedCarrierId !== null
        || dispatchState.selectedCustomerId !== null
        || dispatchState.manualAddress !== ''
        || dispatchState.manualPayment !== 'en_ruta'
        || dispatchState.selectedDocumentTypeId !== 3;

    if (!hasDraft) {
        setScopedSessionData(SESSION_KEYS.dispatchDraft, getCurrentTurnScope(), null);
        return;
    }

    setScopedSessionData(SESSION_KEYS.dispatchDraft, getCurrentTurnScope(), {
        cart: dispatchState.cart,
        selectedCarrierId: dispatchState.selectedCarrierId,
        selectedCustomerId: dispatchState.selectedCustomerId,
        manualAddress: dispatchState.manualAddress,
        manualPayment: dispatchState.manualPayment,
        selectedDocumentTypeId: dispatchState.selectedDocumentTypeId
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

function hydratePendingBoletaEnvelopeState() {
    const saved = getJsonSessionValue(SESSION_KEYS.pendingBoletaEnvelope);
    boletaEnvelopeState.startedAt = typeof saved?.startedAt === 'string' ? saved.startedAt : null;
    boletaEnvelopeState.items = Array.isArray(saved?.items) ? saved.items : [];
    updateBoletaEnvelopeStatusUI();
    schedulePendingBoletaEnvelopeFlush();
}

function persistPendingBoletaEnvelopeState() {
    if (!boletaEnvelopeState.items.length) {
        setJsonSessionValue(SESSION_KEYS.pendingBoletaEnvelope, null);
    } else {
        setJsonSessionValue(SESSION_KEYS.pendingBoletaEnvelope, {
            startedAt: boletaEnvelopeState.startedAt,
            items: boletaEnvelopeState.items
        });
    }

    updateBoletaEnvelopeStatusUI();
    schedulePendingBoletaEnvelopeFlush();
}

function getPendingBoletaEnvelopeAgeMs() {
    if (!boletaEnvelopeState.startedAt) {
        return 0;
    }

    const startedAt = new Date(boletaEnvelopeState.startedAt).getTime();
    if (!Number.isFinite(startedAt)) {
        return 0;
    }

    return Math.max(0, Date.now() - startedAt);
}

function updateBoletaEnvelopeStatusUI() {
    const badge = document.getElementById('boleta-envelope-status');
    const countLabel = document.getElementById('boleta-envelope-count-label');
    const forceButton = document.getElementById('force-boleta-envelope-btn');
    const pendingCount = boletaEnvelopeState.items.length;

    if (countLabel) {
        if (!pendingCount) {
            countLabel.textContent = '0 boletas';
        } else {
            const minutes = Math.floor(getPendingBoletaEnvelopeAgeMs() / 60000);
            countLabel.textContent = `${pendingCount} boleta${pendingCount === 1 ? '' : 's'} · ${minutes} min en cola`;
        }
    }

    if (badge) {
        badge.textContent = pendingCount ? 'Pendiente' : 'Sin pendientes';
        badge.classList.toggle('is-ready', !pendingCount);
    }

    if (forceButton) {
        forceButton.disabled = pendingCount === 0 || boletaEnvelopeSendInFlight;
        forceButton.textContent = boletaEnvelopeSendInFlight
            ? 'Enviando sobre...'
            : 'Forzar envio del sobre';
    }
}

function schedulePendingBoletaEnvelopeFlush() {
    if (boletaEnvelopeFlushTimer) {
        window.clearTimeout(boletaEnvelopeFlushTimer);
        boletaEnvelopeFlushTimer = null;
    }

    if (boletaEnvelopeMode === 'count') {
        return;
    }

    if (!boletaEnvelopeState.items.length || !boletaEnvelopeState.startedAt) {
        return;
    }

    const elapsed = getPendingBoletaEnvelopeAgeMs();
    const remaining = Math.max(0, boletaEnvelopeWindowMs - elapsed);

    boletaEnvelopeFlushTimer = window.setTimeout(() => {
        void forceSendPendingBoletaEnvelope({
            reason: `Ventana automatica de ${Math.round(boletaEnvelopeWindowMs / 60000)} minutos`,
            notifyUser: false
        });
    }, remaining);
}

function appendBoletaToPendingEnvelope({ folio, tipoDte, xmlContent }) {
    if (!boletaEnvelopeState.items.length) {
        boletaEnvelopeState.startedAt = new Date().toISOString();
    }

    boletaEnvelopeState.items.push({
        folio: Number(folio),
        tipoDte: Number(tipoDte),
        xmlContent: String(xmlContent || ''),
        queuedAt: new Date().toISOString()
    });
    persistPendingBoletaEnvelopeState();

    if ((boletaEnvelopeMode === 'both' || boletaEnvelopeMode === 'count') &&
        boletaEnvelopeState.items.length >= boletaEnvelopeLimit) {
        void forceSendPendingBoletaEnvelope({
            reason: `Limite de ${boletaEnvelopeLimit} boletas alcanzado`,
            notifyUser: false
        });
    }
}

function takePendingBoletaEnvelopeSnapshot() {
    if (!boletaEnvelopeState.items.length) {
        return null;
    }

    const snapshot = {
        startedAt: boletaEnvelopeState.startedAt,
        items: boletaEnvelopeState.items.slice()
    };

    boletaEnvelopeState.startedAt = null;
    boletaEnvelopeState.items = [];
    persistPendingBoletaEnvelopeState();
    return snapshot;
}

function restorePendingBoletaEnvelopeSnapshot(snapshot) {
    if (!snapshot?.items?.length) {
        return;
    }

    boletaEnvelopeState.startedAt = snapshot.startedAt || snapshot.items[0]?.queuedAt || new Date().toISOString();
    boletaEnvelopeState.items = [...snapshot.items, ...boletaEnvelopeState.items];
    persistPendingBoletaEnvelopeState();
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

async function legacyLoadSalesHistory() {
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
        const allSales = normalizeSalesHistory(payload, formatDateTime);
        const visibleSales = salesHistoryState.showAllDocuments
            ? allSales
            : allSales.filter((sale) => sale.isFiscal);

        const currentUser = getCurrentUser();
        const currentUserId = Number(currentUser?.id_usuario || currentUser?.idUsuario || currentUser?.id || 0);

        // Filter ONLY by current user and current day (ventas del dia), limit to 100 elements to prevent UI lag.
        const todayTzStr = new Date().toLocaleDateString('es-CL');

        salesHistoryState.items = visibleSales.filter(sale => {
            if (sale.userId !== currentUserId) return false;
            if (!sale.rawDate) return true;

            try {
                const saleTzStr = new Date(sale.rawDate).toLocaleDateString('es-CL');
                return todayTzStr === saleTzStr;
            } catch (e) {
                // Si la fecha es inválida, se devuelve true temporalmente para que no se oculte.
                return true;
            }
        }).slice(0, 150);
    } catch (error) {
        console.error('Sales history error:', error);
        salesHistoryState.items = [];
        salesHistoryState.cancelledItems = [];
        setBackendStatus(error?.message || 'No se pudo cargar el historial de ventas.');
    }

    renderSalesHistory();
}

function getDispatchRelatedSaleIds() {
    return new Set(
        Object.values(dispatchReceiptState.records || {})
            .map((record) => Number(record?.saleId || 0))
            .filter((saleId) => saleId > 0)
    );
}

async function loadSalesHistory() {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();
    const localAuditEntries = filterVisibleSalesHistoryItems(
        buildSalesHistoryItemsFromLocalAudit(readLocalAuditFallback().entries || []),
        salesHistoryState.showAllDocuments
    );

    if (!apiBaseUrl || !token) {
        salesHistoryState.items = mergeSalesHistorySources(
            filterVisibleSalesHistoryItems(salesHistoryState.items, salesHistoryState.showAllDocuments),
            localAuditEntries
        ).slice(0, 150);
        salesHistoryState.cancelledItems = [];
        salesHistoryState.currentTab = 'active';
        persistSalesHistoryState();
        renderSalesHistory();
        return;
    }

    try {
        const payload = await fetchSalesHistory({ apiBaseUrl, token });
        const allSales = normalizeSalesHistory(payload, formatDateTime);
        const currentUser = getCurrentUser();
        const currentUserId = Number(currentUser?.id_usuario || currentUser?.idUsuario || currentUser?.id || 0);
        const dispatchSaleIds = getDispatchRelatedSaleIds();
        const turnScopedSales = allSales.filter((sale) => isSaleInsideCurrentTurn(sale, {
            currentUserId,
            dispatchSaleIds,
            turnOpenedAt: cashSessionState.openedAt
        }));
        const visibleSales = salesHistoryState.showAllDocuments
            ? turnScopedSales
            : turnScopedSales.filter((sale) => sale.isFiscal);

        salesHistoryState.items = mergeSalesHistorySources(
            visibleSales,
            filterVisibleSalesHistoryItems(salesHistoryState.items, salesHistoryState.showAllDocuments),
            localAuditEntries
        ).slice(0, 150);
        syncTurnSummaryFromSales(turnScopedSales);
        persistSalesHistoryState();
    } catch (error) {
        console.error('Sales history error:', error);
        salesHistoryState.items = mergeSalesHistorySources(
            filterVisibleSalesHistoryItems(salesHistoryState.items, salesHistoryState.showAllDocuments),
            localAuditEntries
        ).slice(0, 150);
        setBackendStatus(error?.message || 'No se pudo cargar el historial de ventas.');
        persistSalesHistoryState();
    }

    renderSalesHistory();
}

function isSaleInsideCurrentTurn(sale, { currentUserId, dispatchSaleIds, turnOpenedAt }) {
    const saleOrigin = String(sale?.origin || '').toUpperCase();

    if (!sale) {
        return false;
    }

    if (saleOrigin === 'DESPACHO' || dispatchSaleIds.has(Number(sale.id || 0))) {
        return false;
    }

    if (currentUserId > 0 && Number(sale.userId || 0) !== currentUserId) {
        return false;
    }

    if (!sale.rawDate) {
        return true;
    }

    const saleTimestamp = new Date(sale.rawDate).getTime();
    if (!Number.isFinite(saleTimestamp)) {
        return true;
    }

    if (turnOpenedAt) {
        const turnTimestamp = new Date(turnOpenedAt).getTime();
        if (Number.isFinite(turnTimestamp)) {
            return saleTimestamp >= turnTimestamp;
        }
    }

    const todayTzStr = new Date().toLocaleDateString('es-CL');
    return new Date(sale.rawDate).toLocaleDateString('es-CL') === todayTzStr;
}

function buildTurnSummaryFromSales(sales) {
    return (Array.isArray(sales) ? sales : []).reduce((summary, sale) => {
        const paymentMethod = String(sale.paymentMethod || '').toUpperCase();
        const total = Number(sale.total || 0);
        const paymentCash = Number(sale.paymentCash || 0);
        const paymentCard = Number(sale.paymentCard || 0);
        const paymentTransfer = Number(sale.paymentTransfer || 0);

        summary.salesCount += 1;

        if (paymentMethod === 'MIXTO') {
            summary.totalCash += paymentCash;
            summary.totalCard += paymentCard;
            summary.totalTransfer += paymentTransfer;
        } else if (paymentMethod === 'EFECTIVO') {
            summary.totalCash += total;
        } else if (paymentMethod === 'TARJETA') {
            summary.totalCard += total;
        } else if (paymentMethod === 'TRANSFERENCIA') {
            summary.totalTransfer += total;
        }

        if (sale.document === 'Vale interno') {
            summary.totalInternal += total;
        }

        return summary;
    }, {
        salesCount: 0,
        totalCash: 0,
        totalCard: 0,
        totalTransfer: 0,
        totalInternal: 0
    });
}

function syncTurnSummaryFromSales(sales) {
    if (!cashSessionState.isOpen) {
        return;
    }

    const preservedWithdrawals = Number(turnSummaryState.totalWithdrawals || 0);
    const rebuilt = buildTurnSummaryFromSales(sales);

    turnSummaryState.salesCount = rebuilt.salesCount;
    turnSummaryState.totalCash = rebuilt.totalCash;
    turnSummaryState.totalCard = rebuilt.totalCard;
    turnSummaryState.totalTransfer = rebuilt.totalTransfer;
    turnSummaryState.totalInternal = rebuilt.totalInternal;
    turnSummaryState.totalWithdrawals = preservedWithdrawals;

    persistTurnSummary();
    renderTurnSummary();
}

function renderSalesHistory() {
    renderSalesHistoryView({
        salesHistoryState,
        openSaleCancellationModal,
        openSaleReceiptModal
    });
}

function openSaleHistoryModal() {
    document.getElementById('sale-history-modal-backdrop')?.classList.remove('hidden');
    loadSalesHistory();
}



function buildReceiptRecord({
    saleId,
    payload,
    snapshot,
    method,
    customer,
    documentType,
    cart,
    dteMetadata = null,
    referenceLabel = null,
    paymentLabel = null,
    customerLabel = null,
    footerMessage = null,
    addressLabel = null,
    paymentCash = null,
    paymentCard = null,
    paymentTransfer = null,
    origin = 'sale'
}) {
    const saleDate = new Date().toISOString();
    const folioDocumento = payload?.folioDocumento || null;
    const tipoDte = Number(dteMetadata?.tipoDte || (documentType === 'Factura' ? 33 : documentType === 'Boleta' ? 39 : 0)) || null;
    const fechaDte = String(dteMetadata?.fechaDte || saleDate.slice(0, 10));
    const rutReceptor = String(
        dteMetadata?.rutReceptor
        || (documentType === 'Factura' ? customer?.rut : '66666666-6')
        || ''
    ).trim() || null;
    const normalizedCustomer = customer?.name
        ? `${customer.name}${customer.rut ? ` · ${customer.rut}` : ''}`
        : 'General';
    const resolvedCustomerLabel = customerLabel || normalizedCustomer;
    const resolvedPaymentLabel = paymentLabel || capitalizePaymentMethod(method);
    const resolvedReferenceLabel = referenceLabel || `Venta #${saleId}`;
    const resolvedFooterMessage = footerMessage || (
        documentType === 'Vale interno'
            ? 'Documento no fiscal.'
            : documentType === 'Boleta'
                ? ''
                : folioDocumento
                    ? 'Documento tributario emitido y respaldado para reimpresion.'
                    : 'Documento fiscal sin folio sincronizado en esta sesion.'
    );
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
        documentType === 'Vale interno'
            ? 'COMPROBANTE INTERNO REFERENCIAL'
            : `${documentType.toUpperCase()}${folioDocumento ? ` ELECTRONICA ${folioDocumento}` : ' ELECTRONICA'}`,
        resolvedReferenceLabel,
        `Fecha: ${formatDateTime(saleDate)}`,
        `Cliente: ${resolvedCustomerLabel}`,
        `Pago: ${resolvedPaymentLabel}`,
    ];

    if (String(resolvedPaymentLabel).toUpperCase() === 'MIXTO') {
        if (Number(paymentCash || 0) > 0) previewLines.push(` > EFECTIVO: $${formatCurrency(paymentCash)}`);
        if (Number(paymentCard || 0) > 0) previewLines.push(` > TARJETA: $${formatCurrency(paymentCard)}`);
        if (Number(paymentTransfer || 0) > 0) previewLines.push(` > TRANSF: $${formatCurrency(paymentTransfer)}`);
    }

    previewLines.push(
        ...(addressLabel ? [`Dirección: ${addressLabel}`] : []),
        '--------------------------------',
        'DETALLE'
    );

    const emisor = dteMetadata?.emisor || null;

    if (folioDocumento) {
        previewLines.splice(3, 0, `Folio: ${folioDocumento}`);
    }

    lineItems.forEach((item) => {
        previewLines.push(item.name);
        previewLines.push(`${item.quantityLabel} x $${formatCurrency(item.unitPrice)} = $${formatCurrency(item.subtotal)}`);
    });

    previewLines.push(
        '--------------------------------',
        `Items: ${formatQuantity(snapshot.items, false)}`,
        `Neto: $${formatCurrency(payload.subtotal)}`
    );
    if (payload.descuento > 0) {
        previewLines.push(`Descuento: -$${formatCurrency(payload.descuento)}`);
    }
    if (snapshot.extraCharge > 0) {
        previewLines.push(`Recargo (2%): +$${formatCurrency(snapshot.extraCharge)}`);
    }
    if (dteMetadata?.trackId) {
        previewLines.push(`Track ID SII: ${dteMetadata.trackId}`);
    }
    previewLines.push(
        `IVA: $${formatCurrency(payload.iva)}`,
        `Total: $${formatCurrency(payload.total)}`,
        resolvedFooterMessage
    );

    let ted = null;
    if (dteMetadata?.xmlContent) {
        const match = dteMetadata.xmlContent.match(/<TED[\s\S]*?<\/TED>/);
        if (match) ted = match[0];
    }

    return {
        saleId,
        folioDocumento,
        tipoDte,
        fechaDte,
        rutReceptor,
        customerRut: customer?.rut || null,
        estadoSii: dteMetadata?.estadoSii || null,
        trackId: dteMetadata?.trackId || null,
        date: saleDate,
        dateLabel: formatDateTime(saleDate),
        referenceLabel: resolvedReferenceLabel,
        documentType,
        isFiscal: documentType !== 'Vale interno',
        customerLabel: resolvedCustomerLabel,
        paymentMethod: resolvedPaymentLabel,
        subtotal: Number(payload.subtotal || 0),
        descuento: Number(payload.descuento || 0),
        extraCharge: Number(snapshot.extraCharge || 0),
        iva: Number(payload.iva || 0),
        total: Number(payload.total || 0),
        items: Number(snapshot.items || 0),
        lineItems,
        preview: previewLines.join('\n'),
        footerMessage: resolvedFooterMessage,
        addressLabel,
        paymentCash,
        paymentCard,
        paymentTransfer,
        origin,
        emisor: dteMetadata?.emisor || null,
        xmlContent: dteMetadata?.xmlContent || null,
        ted: ted
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
    const folioDocumento = sale.folioDocumento || sale.folio || null;
    const resolvedPaymentLabel = sale.paymentMethod || 'No disponible';
    const previewLines = [
        'VALMU CAJERO',
        sale.document === 'Vale interno'
            ? 'COMPROBANTE INTERNO REFERENCIAL'
            : `${(sale.document || 'Venta').toUpperCase()}${folioDocumento ? ` ELECTRONICA ${folioDocumento}` : ' ELECTRONICA'}`,
        `Venta #${sale.id}`,
        `Fecha: ${sale.dateLabel || formatDateTime(saleDate)}`,
        `Cliente: ${sale.customerLabel || 'No disponible'}`,
        `Pago: ${resolvedPaymentLabel}`,
    ];

    if (String(resolvedPaymentLabel).toUpperCase() === 'MIXTO') {
        if (Number(sale.paymentCash || 0) > 0) previewLines.push(` > EFECTIVO: $${formatCurrency(sale.paymentCash)}`);
        if (Number(sale.paymentCard || 0) > 0) previewLines.push(` > TARJETA: $${formatCurrency(sale.paymentCard)}`);
        if (Number(sale.paymentTransfer || 0) > 0) previewLines.push(` > TRANSF: $${formatCurrency(sale.paymentTransfer)}`);
    }

    previewLines.push('--------------------------------');

    const hasItems = Array.isArray(sale.lineItems) && sale.lineItems.length > 0;

    if (hasItems) {
        previewLines.push('DETALLE');
        sale.lineItems.forEach((item) => {
            previewLines.push(item.name);
            previewLines.push(`${item.quantityLabel || item.quantity} x $${formatCurrency(item.unitPrice)} = $${formatCurrency(item.subtotal)}`);
        });
    } else {
        previewLines.push(
            'DETALLE',
            'Detalle extendido no disponible en esta sesion.',
            'La base de reimpresion completa se genera al cobrar desde esta caja.'
        );
    }

    previewLines.push('--------------------------------');
    if (hasItems) {
        previewLines.push(`Items: ${sale.lineItems.length}`);
    }
    const subtotal = Math.round(Number(sale.total || 0) / 1.19);
    const iva = Number(sale.total || 0) - subtotal;
    previewLines.push(
        `Neto: $${formatCurrency(subtotal)}`,
        `IVA: $${formatCurrency(iva)}`,
        `Total: $${formatCurrency(sale.total)}`
    );

    return {
        saleId: sale.id,
        folioDocumento,
        tipoDte: Number(sale.tipoDte || (sale.document === 'Factura' ? 33 : sale.document === 'Boleta' ? 39 : 0)) || null,
        fechaDte: sale.fechaDte || String(saleDate).slice(0, 10),
        rutReceptor: sale.rutReceptor || (sale.document === 'Boleta' ? '66666666-6' : sale.customerRut || null),
        customerRut: sale.customerRut || null,
        estadoSii: sale.estadoSii || null,
        trackId: sale.trackId || null,
        date: saleDate,
        documentType: sale.document,
        isFiscal: Boolean(sale.isFiscal),
        customerLabel: sale.customerLabel || 'No disponible',
        paymentMethod: sale.paymentMethod,
        paymentCash: Number(sale.paymentCash || 0),
        paymentCard: Number(sale.paymentCard || 0),
        paymentTransfer: Number(sale.paymentTransfer || 0),
        subtotal,
        iva,
        total: Number(sale.total || 0),
        items: hasItems ? sale.lineItems.length : 0,
        lineItems: sale.lineItems || [],
        preview: previewLines.join('\n')
    };
}

async function openSaleReceiptModal(saleId) {
    const activeSale = salesHistoryState.items.find((sale) => sale.id === Number(saleId));
    const cancelledSale = salesHistoryState.cancelledItems.find((sale) => sale.id === Number(saleId));
    const sale = activeSale || cancelledSale || null;
    let record = getReceiptRecord(saleId) || buildFallbackReceiptRecord(sale);

    if (!record) {
        setBackendStatus('No se pudo cargar el comprobante de la venta seleccionada.');
        return;
    }

    saleReceiptState.saleId = Number(saleId);

    // Si no tiene items detallados, intentamos pedirlos al servidor
    if (!record.lineItems || record.lineItems.length === 0) {
        const itemsBody = document.getElementById('receipt-items-body');
        if (itemsBody) itemsBody.innerHTML = '<div style="text-align: center; color: #999; padding: 1rem;">Buscando productos en el servidor...</div>';

        try {
            const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
            const token = getAuthToken();
            const detail = await fetchSaleDetail({ apiBaseUrl, token, saleId });

            if (detail && detail.productos) {
                // Mapeamos los productos del servidor al formato que espera el recibo del Cajero
                record.lineItems = detail.productos.map(item => ({
                    name: item.nombreProducto,
                    quantity: Number(item.cantidadVenta || item.cantidad),
                    quantityLabel: formatQuantity(item.cantidadVenta || item.cantidad, false),
                    unitPrice: Number(item.precioVenta),
                    subtotal: Number(item.subtotalLinea || (item.cantidad * item.precioVenta))
                }));

                const updatedFallback = buildFallbackReceiptRecord({
                    ...sale,
                    lineItems: record.lineItems
                });
                if (updatedFallback) {
                    record.preview = updatedFallback.preview;
                }

                // Actualizamos el cache local del Cajero para futuras vistas
                saveReceiptRecord(record);
            }
        } catch (error) {
            console.warn('No se pudo obtener detalle del servidor:', error);
        }
    }

    // Visual Receipt Metadata
    const visualFolio = document.getElementById('visual-receipt-folio');
    if (visualFolio) {
        visualFolio.textContent = record.folioDocumento ? `FOLIO: ${record.folioDocumento}` : (record.isFiscal ? 'S/F' : 'VALE INTERNO');
    }

    const visualDate = document.getElementById('visual-receipt-date');
    if (visualDate) {
        visualDate.textContent = `Fecha: ${formatDateTime(record.date || record.saleDate || new Date().toISOString())}`;
    }

    const visualCustomer = document.getElementById('visual-receipt-customer');
    if (visualCustomer) {
        visualCustomer.textContent = `Cliente: ${record.customerLabel}`;
    }

    const visualPayment = document.getElementById('visual-receipt-payment');
    if (visualPayment) {
        visualPayment.textContent = `Pago: ${record.paymentMethod}`;
    }
    document.getElementById('receipt-preview-output').value = record.preview;

    const itemsBody = document.getElementById('receipt-items-body');
    if (itemsBody) {
        if (record.lineItems && record.lineItems.length > 0) {
            itemsBody.innerHTML = record.lineItems.map(item => `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 0.2rem 0;">
                    <div style="max-width: 70%;">
                        <div style="font-weight: 600;">${item.name}</div>
                        <div style="font-size: 0.75rem; color: #666;">${item.quantityLabel} x $${formatCurrency(item.unitPrice)}</div>
                    </div>
                    <strong>$${formatCurrency(item.subtotal)}</strong>
                </div>
            `).join('');
        } else {
            itemsBody.innerHTML = '<div style="text-align: center; color: #999; padding: 1rem;">No hay detalles de productos disponibles</div>';
        }
    }

    const visualType = document.getElementById('visual-receipt-type');
    if (visualType) visualType.textContent = record.documentType;

    const visualTotal = document.getElementById('visual-receipt-total');
    if (visualTotal) visualTotal.textContent = `$${formatCurrency(record.total)}`;
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

function buildDispatchReceiptRecord({ dispatchId, saleId, carrier, snapshot, branchName, addressLabel = '', paymentLabel = 'En ruta', stockPlan = null }) {
    const createdAt = new Date().toISOString();
    const lineItems = snapshot.lines.map((line) => ({
        name: line.productName,
        quantityLabel: formatQuantity(line.quantity, line.isWeighted),
        unitPrice: Number(line.unitPrice || 0),
        subtotal: Number(line.lineTotal || 0)
    }));

    const stockGroups = [];
    if (stockPlan && Array.isArray(stockPlan.allocations)) {
        const primaryLines = [];
        const secondaryLines = [];
        
        for (const line of snapshot.lines) {
            const allocation = stockPlan.allocations.find((alloc) => String(alloc.id_producto) === String(line.productId));
            const primaryQty = allocation?.origenPrincipal?.cantidad || 0;
            const secondaryQty = allocation?.origenSecundario?.cantidad || 0;
            
            if (primaryQty > 0) {
                primaryLines.push({
                    name: line.productName,
                    quantityLabel: formatQuantity(primaryQty, line.isWeighted)
                });
            }
            if (secondaryQty > 0) {
                secondaryLines.push({
                    name: line.productName,
                    quantityLabel: formatQuantity(secondaryQty, line.isWeighted)
                });
            }
        }
        
        if (primaryLines.length > 0) {
            stockGroups.push({
                name: 'Casa Matriz',
                lines: primaryLines
            });
        }
        if (secondaryLines.length > 0) {
            stockGroups.push({
                name: 'Bodega',
                lines: secondaryLines
            });
        }
    }

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
        ...(addressLabel ? [`Direccion: ${addressLabel}`] : []),
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
        `Neto: $${formatCurrency(subtotal)}`
    );
    if (snapshot.discount > 0) {
        previewLines.push(`Descuento: -$${formatCurrency(snapshot.discount)}`);
    }
    previewLines.push(
        `IVA: $${formatCurrency(iva)}`,
        `Total referencial: $${formatCurrency(snapshot.total)}`,
        'Mercaderia cargada a ruta. La rendicion se revisa con administracion.'
    );

    return {
        dispatchId: String(dispatchId),
        saleId: Number(saleId || 0),
        date: createdAt,
        dateLabel: formatDateTime(createdAt),
        referenceLabel: `Despacho #DSP-${dispatchId}`,
        documentType: 'Vale de despacho',
        isFiscal: false,
        customerLabel: `${carrier.name} · ${carrier.plate}`,
        paymentMethod: paymentLabel,
        subtotal,
        iva,
        total: Number(snapshot.total || 0),
        items: Number(snapshot.items || 0),
        lineItems,
        stockGroups,
        preview: previewLines.join('\n'),
        footerMessage: 'Mercaderia cargada a ruta. La rendicion se revisa fuera del arqueo de caja.',
        branchName,
        addressLabel
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
    const normalizedLineItems = Array.isArray(record.lineItems) ? record.lineItems.map((item) => ({
        name: item.name || item.productName || 'Producto',
        quantityLabel: item.quantityLabel || formatQuantity(item.quantity || 0, Boolean(item.isWeighted)),
        unitPrice: Number(item.unitPrice || 0),
        subtotal: Number(item.subtotal || item.lineTotal || 0)
    })) : [];
    const subtotal = Number(record.subtotal || Math.round(Number(record.total || 0) / 1.19));
    const iva = Number(record.iva || (Number(record.total || 0) - subtotal));
    const previewLines = [
        'VALMU CAJERO',
        String(record.documentType || 'VALE DE DESPACHO').toUpperCase(),
        `Despacho #DSP-${record.id}`,
        `Fecha: ${record.createdAtLabel || formatDateTime(saleDate)}`,
        `Sucursal: ${record.branchName || 'Sucursal'}`,
        `Transportista: ${record.carrierName || 'Transportista'}${record.plate ? ` · ${record.plate}` : ''}`,
        ...(record.customerLabel ? [`Cliente: ${record.customerLabel}`] : []),
        `Estado: ${record.status || 'EN_RUTA'}`
    ];

    if (normalizedLineItems.length) {
        previewLines.push('--------------------------------', 'DETALLE DE CARGA');
        normalizedLineItems.forEach((item) => {
            previewLines.push(item.name);
            previewLines.push(`${item.quantityLabel} x $${formatCurrency(item.unitPrice)} = $${formatCurrency(item.subtotal)}`);
        });
        previewLines.push(
            '--------------------------------',
            `Items: ${formatQuantity(record.items || normalizedLineItems.length, false)}`,
            `Neto: $${formatCurrency(subtotal)}`,
            `IVA: $${formatCurrency(iva)}`,
            `Total referencial: $${formatCurrency(record.total || 0)}`
        );
    } else {
        previewLines.push(
            record.total ? `Total referencial: $${formatCurrency(record.total)}` : 'Total referencial no disponible',
            '',
            'Detalle completo no disponible en esta sesion.',
            'La base completa se conserva cuando el vale se genera desde esta caja.'
        );
    }

    return {
        dispatchId: String(record.id),
        saleId: Number(record.id_venta || 0),
        date: saleDate,
        referenceLabel: `Despacho #DSP-${record.id}`,
        documentType: record.documentType || 'Vale de despacho',
        isFiscal: false,
        customerLabel: record.customerLabel || `${record.carrierName || 'Transportista'}${record.plate ? ` · ${record.plate}` : ''}`,
        paymentMethod: 'En ruta',
        subtotal,
        iva,
        total: Number(record.total || 0),
        items: Number(record.items || normalizedLineItems.length || 0),
        lineItems: normalizedLineItems,
        preview: previewLines.join('\n'),
        footerMessage: 'Mercaderia cargada a ruta. La rendicion se revisa fuera del arqueo de caja.',
        branchName: record.branchName || 'Sucursal'
    };
}

async function openDispatchReceiptModal(dispatchId) {
    const historyRecord = dispatchState.records.find((record) => String(record.id) === String(dispatchId));
    let record = getDispatchReceiptRecord(dispatchId) || buildFallbackDispatchReceiptRecord(historyRecord);

    if (!record) {
        setBackendStatus('No se pudo cargar el vale del despacho seleccionado.');
        return;
    }

    dispatchReceiptState.dispatchId = String(dispatchId);

    const updateModalUI = (rec) => {
        document.getElementById('dispatch-receipt-id-label').textContent = `#DSP-${rec.dispatchId}`;
        document.getElementById('dispatch-receipt-document-label').textContent = rec.documentType;
        document.getElementById('dispatch-receipt-date-label').textContent = `Fecha: ${formatDateTime(rec.date || new Date().toISOString())}`;
        document.getElementById('dispatch-receipt-carrier-label').textContent = `Transportista: ${rec.customerLabel || 'Transportista'}`;
        document.getElementById('dispatch-receipt-branch-label').textContent = `Sucursal: ${rec.branchName || 'Sucursal'}`;
        document.getElementById('dispatch-receipt-total-label').textContent = `$${formatCurrency(rec.total)}`;
        document.getElementById('dispatch-receipt-preview-output').value = rec.preview;

        const itemsBody = document.getElementById('dispatch-receipt-items-body');
        if (itemsBody) {
            if (rec.lineItems && rec.lineItems.length > 0) {
                itemsBody.innerHTML = rec.lineItems.map(item => `
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; padding: 0.2rem 0;">
                        <div style="max-width: 70%;">
                            <div style="font-weight: 600;">${item.name}</div>
                            <div style="font-size: 0.75rem; color: #666;">${item.quantityLabel} x $${formatCurrency(item.unitPrice)}</div>
                        </div>
                        <strong>$${formatCurrency(item.subtotal)}</strong>
                    </div>
                `).join('');
            } else {
                itemsBody.innerHTML = '<div style="text-align: center; color: #999; padding: 1rem;">No hay detalles de productos disponibles</div>';
            }
        }
    };

    updateModalUI(record);

    const status = document.getElementById('dispatch-receipt-status');
    if (status) {
        status.textContent = '';
        status.classList.add('hidden');
    }
    document.getElementById('dispatch-receipt-modal-backdrop')?.classList.remove('hidden');

    // If it has no line items, try to fetch them from the server using the saleId
    if ((!record.lineItems || record.lineItems.length === 0) && record.saleId) {
        const itemsBody = document.getElementById('dispatch-receipt-items-body');
        if (itemsBody) {
            itemsBody.innerHTML = '<div style="text-align: center; color: #999; padding: 1rem;">Buscando productos en el servidor...</div>';
        }

        try {
            const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
            const token = getAuthToken();
            const detail = await fetchSaleDetail({ apiBaseUrl, token, saleId: record.saleId });

            if (detail && detail.productos) {
                // Map products to the format expected by the receipt
                record.lineItems = detail.productos.map(item => ({
                    name: item.nombreProducto,
                    quantity: Number(item.cantidadVenta || item.cantidad),
                    quantityLabel: formatQuantity(item.cantidadVenta || item.cantidad, false),
                    unitPrice: Number(item.precioVenta),
                    subtotal: Number(item.subtotalLinea || (item.cantidad * item.precioVenta))
                }));

                const updatedFallback = buildFallbackDispatchReceiptRecord({
                    ...historyRecord,
                    lineItems: record.lineItems
                });
                if (updatedFallback) {
                    record = updatedFallback;
                }

                // Update local cache
                saveDispatchReceiptRecord(record);

                // Update UI again with loaded data
                updateModalUI(record);
            }
        } catch (error) {
            console.warn('No se pudo obtener el detalle del despacho desde el servidor:', error);
            if (itemsBody) {
                itemsBody.innerHTML = '<div style="text-align: center; color: #f43f5e; padding: 1rem;">Error al cargar detalles del servidor</div>';
            }
        }
    }
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

function buildStockPickingPreviewText(dispatchId, carrierLabel, stockGroups) {
    const previewLines = [
        'VALMU CAJERO',
        'DETALLE DE STOCK DESPACHO',
        `Despacho #DSP-${dispatchId}`,
        `Transportista: ${carrierLabel}`,
        '--------------------------------'
    ];
    
    for (const group of stockGroups) {
        previewLines.push(group.name);
        for (const line of group.lines) {
            previewLines.push(`- ${line.quantityLabel} ${line.name}`);
        }
        previewLines.push('');
    }
    
    previewLines.push('NO HACER TRASLADO EN ADMIN');
    return previewLines.join('\n');
}

function buildStockPickingRecordFromPlan({ dispatchId, carrier, snapshot, stockPlan }) {
    const stockGroups = [];
    if (stockPlan && Array.isArray(stockPlan.allocations)) {
        const primaryLines = [];
        const secondaryLines = [];
        
        for (const line of snapshot.lines) {
            const allocation = stockPlan.allocations.find((alloc) => String(alloc.id_producto) === String(line.productId));
            const primaryQty = allocation?.origenPrincipal?.cantidad || 0;
            const secondaryQty = allocation?.origenSecundario?.cantidad || 0;
            
            if (primaryQty > 0) {
                primaryLines.push({
                    name: line.productName,
                    quantityLabel: formatQuantity(primaryQty, line.isWeighted)
                });
            }
            if (secondaryQty > 0) {
                secondaryLines.push({
                    name: line.productName,
                    quantityLabel: formatQuantity(secondaryQty, line.isWeighted)
                });
            }
        }
        
        if (primaryLines.length > 0) {
            stockGroups.push({
                name: 'Casa Matriz',
                lines: primaryLines
            });
        }
        if (secondaryLines.length > 0) {
            stockGroups.push({
                name: 'Bodega',
                lines: secondaryLines
            });
        }
    }
    
    const carrierLabel = `${carrier.name} · ${carrier.plate}`;
    return {
        saleId: null,
        dispatchId: String(dispatchId),
        isStockPicking: true,
        stockGroups,
        preview: buildStockPickingPreviewText(dispatchId, carrierLabel, stockGroups),
        documentType: 'Detalle de stock despacho'
    };
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

        if (record.stockGroups && record.stockGroups.length > 0) {
            const stockPickingRecord = {
                saleId: null,
                dispatchId: String(dispatchId),
                isStockPicking: true,
                stockGroups: record.stockGroups,
                preview: buildStockPickingPreviewText(dispatchId, record.customerLabel, record.stockGroups),
                documentType: 'Detalle de stock despacho'
            };
            
            try {
                await printReceiptRecord({
                    record: stockPickingRecord,
                    printerName,
                    printerPaper,
                    printReceipt: window.cajeroAPI?.printReceipt
                });
            } catch (pickingError) {
                console.error('Stock picking reprint error:', pickingError);
            }
        }

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
            persistSalesHistoryState();
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

async function verificarEstadoCaja({ cashStatus = null, throwOnError = false } = {}) {
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
        const data = cashStatus || await fetchCashStatus({ apiBaseUrl, token });

        if (data?.abierta) {
            cashSessionState.isOpen = true;
            cashSessionState.turnId = data?.caja?.id_cajaTurno || data?.id_cajaTurno || null;
            cashSessionState.openingAmount = Number(data?.caja?.montoInicial || data?.caja?.montoApertura || 0);
            cashSessionState.openedAt = data?.caja?.horaApertura || data?.caja?.fechaApertura || new Date().toISOString();
            setSessionValue('cajaAbierta', 'true');
            closeCashSessionModal();
            hydrateTurnScopedRuntimeState();
            await syncCashWithdrawalsFromBackend();
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

        if (throwOnError) {
            throw error;
        }
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
        const data = await openCashTurn({ apiBaseUrl, token, branchId: getSelectedBranchId(), openingAmount });

        cashSessionState.isOpen = true;
        cashSessionState.turnId = data?.caja?.id_cajaTurno || data?.id_cajaTurno || `local-${Date.now()}`;
        cashSessionState.openingAmount = Math.round(openingAmount);
        cashSessionState.openedAt = data?.caja?.horaApertura || new Date().toISOString();
        setSessionValue('cajaAbierta', 'true');
        resetTurnScopedRuntimeState(true);
        await resetLocalSalesAuditForTurn();
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
        getPricingForProduct,
        collaboratorDiscountEnabled: saleState.collaboratorDiscountEnabled
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
    if (!cashSessionState.isOpen) {
        return;
    }

    selectedClientId = null;
    invoiceClientState.pendingDocumentType = 'Factura';
    setInvoiceClientStatus('');
    openInvoiceClientModalView(saleState.customer);
    loadInvoiceClients();
}

function clearInvoiceCustomer() {
    if (isDispatchMode()) {
        dispatchState.selectedCustomerId = null;
        renderDispatchSection();
    } else {
        saleState.customer = null;
        if (saleState.documentType === 'Factura') {
            saleState.documentType = 'Boleta';
            renderDocumentType();
        }
        renderCustomerSummary();
    }

    closeInvoiceClientModal();
    setBackendStatus('Cliente desasignado correctamente.');
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

function formatRutInputValue(rawValue) {
    const cleaned = String(rawValue || '')
        .replace(/[^0-9kK]/g, '')
        .toUpperCase();

    if (!cleaned) {
        return '';
    }

    if (cleaned.length === 1) {
        return cleaned;
    }

    const body = cleaned.slice(0, -1);
    const verifier = cleaned.slice(-1);
    return `${body}-${verifier}`;
}

function handleInvoiceRutInput(event) {
    const input = event?.target;
    if (!input) {
        return;
    }

    input.value = formatRutInputValue(input.value);
}

let selectedClientId = null;

function useSelectedInvoiceClient() {
    const selectedId = selectedClientId;
    if (!selectedId) {
        setInvoiceClientStatus('Selecciona un cliente para continuar.');
        return;
    }

    const selectedCustomer = invoiceClientState.customers.find((customer) => customer.id === selectedId);
    if (!selectedCustomer) {
        setInvoiceClientStatus('No se pudo cargar el cliente seleccionado.');
        return;
    }

    if (isDispatchMode()) {
        dispatchState.selectedCustomerId = selectedCustomer.id;
        renderDispatchSection();
        closeInvoiceClientModal();
        return;
    }

    saleState.customer = buildSaleCustomer(selectedCustomer);

    renderCustomerSummary();
    const pendingDocumentType = invoiceClientState.pendingDocumentType || 'Factura';
    closeInvoiceClientModal();
    openPaymentModal(pendingDocumentType);
}

async function confirmInvoiceClient() {
    const rut = formatRutInputValue(document.getElementById('invoice-rut-input')?.value || '');
    const name = String(document.getElementById('invoice-name-input')?.value || '').trim();
    const business = String(document.getElementById('invoice-business-input')?.value || '').trim();
    const address = String(document.getElementById('invoice-address-input')?.value || '').trim();
    const comuna = String(document.getElementById('invoice-comuna-input')?.value || '').trim();
    const phone = String(document.getElementById('invoice-phone-input')?.value || '').trim();
    const email = String(document.getElementById('invoice-email-input')?.value || '').trim();

    if (!rut || !name || !business || !address || !comuna) {
        setInvoiceClientStatus('Completa RUT, nombre, giro, direccion y comuna para factura.');
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
                business,
                address,
                comuna,
                city: comuna, // Default city to comuna if not provided
                phone,
                email
            }
        });

        const customerId = payload?.id_cliente || payload?.cliente?.id_cliente;
        if (!customerId) {
            throw new Error('La API no devolvio id_cliente.');
        }

        const customerData = {
            id: Number(customerId),
            name,
            rut,
            business,
            address,
            comuna,
            city: comuna,
            phone,
            email
        };

        if (isDispatchMode()) {
            dispatchState.selectedCustomerId = Number(customerId);
        } else {
            saleState.customer = buildSaleCustomer(customerData);
        }

        invoiceClientState.customers.unshift({
            id: Number(customerId),
            rut,
            name,
            business,
            address,
            comuna,
            city: comuna,
            phone,
            email
        });

        if (isDispatchMode()) {
            renderDispatchSection();
            closeInvoiceClientModal();
        } else {
            renderCustomerSummary();
            const pendingDocType = invoiceClientState.pendingDocumentType || 'Factura';
            closeInvoiceClientModal();
            openPaymentModal(pendingDocType);
        }
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
    const method = methodSelect?.value || 'efectivo';
    const isCash = method === 'efectivo';
    const isMixed = method === 'mixto';
    const snapshot = getCartSnapshot();
    const paymentTotal = roundPaymentAmount(snapshot.total);

    renderPaymentMethodView({
        isCash,
        total: paymentTotal
    });

    document.getElementById('payment-mixed-group')?.classList.toggle('hidden', !isMixed);

    if (isMixed) {
        // Inicializar con efectivo el total restante para facilitar el flujo
        document.getElementById('payment-mixed-cash').value = paymentTotal;
        document.getElementById('payment-mixed-card').value = '';
        document.getElementById('payment-mixed-transfer').value = '';

        // Enfocar el primer campo para empezar a repartir el pago
        setTimeout(() => {
            const mixedCash = document.getElementById('payment-mixed-cash');
            mixedCash?.focus();
            mixedCash?.select();
        }, 50);
    }

    renderPaymentChange();
}

function roundPaymentAmount(value) {
    return Math.round(Number(value || 0));
}

function renderPaymentChange() {
    const method = document.getElementById('payment-method-select')?.value || 'efectivo';
    const snapshot = getCartSnapshot();
    const paymentTotal = roundPaymentAmount(snapshot.total);
    let received = 0;

    if (method === 'mixto') {
        const cash = roundPaymentAmount(document.getElementById('payment-mixed-cash')?.value || 0);
        const card = roundPaymentAmount(document.getElementById('payment-mixed-card')?.value || 0);
        const transfer = roundPaymentAmount(document.getElementById('payment-mixed-transfer')?.value || 0);
        received = cash + card + transfer;
    } else {
        received = roundPaymentAmount(document.getElementById('payment-received-input')?.value || 0);
    }

    renderPaymentChangeView({
        method,
        total: paymentTotal,
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

    if (method === 'efectivo' && !Number.isFinite(received)) {
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
    saleState.collaboratorDiscountEnabled = false;
    saleState.extraChargeEnabled = false;
    renderDocumentType();
    renderSearchResults([]);
    renderCart();
    closePaymentModal();
}

async function confirmPaymentFlow() {
    const confirmButton = document.getElementById('payment-confirm-btn');
    const cancelBtn = document.getElementById('payment-cancel-btn');

    try {
        if (!cashSessionState.isOpen || !saleState.cart.length) {
            closePaymentModal();
            return;
        }

        const method = document.getElementById('payment-method-select')?.value || 'efectivo';
        const snapshot = getCartSnapshot();
        const paymentTotal = roundPaymentAmount(snapshot.total);
        const isMixed = method === 'mixto';

        let receivedValue = 0;
        let mixedData = null;

        if (isMixed) {
            mixedData = {
                cash: roundPaymentAmount(document.getElementById('payment-mixed-cash')?.value || 0),
                card: roundPaymentAmount(document.getElementById('payment-mixed-card')?.value || 0),
                transfer: roundPaymentAmount(document.getElementById('payment-mixed-transfer')?.value || 0)
            };
            receivedValue = mixedData.cash + mixedData.card + mixedData.transfer;
        } else {
            receivedValue = roundPaymentAmount(document.getElementById('payment-received-input')?.value || 0);
        }

        const effectiveReceived = method === 'efectivo'
            ? paymentTotal
            : (isMixed ? receivedValue : (receivedValue || paymentTotal));

        // En efectivo no se bloquea por diferencias del monto ingresado; se registra el total de la venta.
        // Para mixto/tarjeta/transferencia mantenemos la validacion de cobertura del total.
        if (method !== 'efectivo' && effectiveReceived < paymentTotal) {
            openInfoModal(
                'Monto insuficiente',
                `El monto total de pago ($${formatCurrency(effectiveReceived)}) es menor al total de la venta ($${formatCurrency(paymentTotal)}).`
            );
            if (isMixed) {
                document.getElementById('payment-mixed-cash')?.focus();
            } else {
                document.getElementById('payment-received-input')?.focus();
            }
            return;
        }

        const stockValidation = validateCartStock();
        if (!stockValidation.ok) {
            openInfoModal('Problema de Stock', stockValidation.message || 'No hay stock suficiente.');
            return;
        }

        confirmButton.disabled = true;
        confirmButton.textContent = 'Procesando...';
        cancelBtn?.setAttribute('disabled', 'disabled');

        let dteResult = null;
        if (saleState.documentType === 'Boleta' || saleState.documentType === 'Factura') {
            setBackendStatus(`Emitiendo ${saleState.documentType.toLowerCase()} al SII...`);
            dteResult = await generateAndSendDte({
                cart: saleState.cart,
                customer: saleState.customer,
                documentType: saleState.documentType,
                snapshot: getCartSnapshot()
            });
        }

        const result = await submitSaleToBackend({
            method,
            snapshot,
            received: isMixed ? mixedData : effectiveReceived,
            folioDocumento: dteResult?.folio || null
        });

        if (dteResult?.xmlContent) {
            try {
                await requestBackendJson({
                    endpoint: '/dte/guardar',
                    method: 'POST',
                    body: {
                        id_venta: result.saleId,
                        tipoDte: Number(dteResult.tipoDte),
                        folio: Number(dteResult.folio),
                        xmlContenido: dteResult.xmlContent,
                        trackId: dteResult.trackId || null,
                        estadoSii: dteResult.estadoSii || 'GENERADO'
                    }
                });
            } catch (dteSaveError) {
                console.error('DTE backup error:', dteSaveError);
                addAuditEntry({
                    type: 'warning',
                    title: 'Respaldo DTE pendiente',
                    detail: dteSaveError?.message || 'No se pudo guardar el XML del DTE en backend.'
                });
            }
        } else if (dteResult?.isOffline && dteResult.queuePayload) {
            queuePendingDte({
                ...dteResult.queuePayload,
                saleId: result.saleId
            });
        }

        const receiptRecord = buildReceiptRecord({
            saleId: result.saleId,
            payload: {
                ...result.payload,
                folioDocumento: dteResult?.folio || result.payload?.folioDocumento || null
            },
            snapshot,
            method,
            customer: saleState.customer,
            documentType: saleState.documentType,
            cart: saleState.cart,
            dteMetadata: dteResult,
            paymentCash: mixedData?.cash || null,
            paymentCard: mixedData?.card || null,
            paymentTransfer: mixedData?.transfer || null
        });

        // Actualizar totales de turno
        if (method === 'efectivo') {
            turnSummaryState.totalCash += snapshot.total;
        } else if (method === 'tarjeta') {
            turnSummaryState.totalCard += snapshot.total;
        } else if (method === 'transferencia') {
            turnSummaryState.totalTransfer += snapshot.total;
        } else if (method === 'mixto') {
            turnSummaryState.totalCash += Number(mixedData.cash || 0);
            turnSummaryState.totalCard += Number(mixedData.card || 0);
            turnSummaryState.totalTransfer += Number(mixedData.transfer || 0);
        }

        if (saleState.documentType === 'Vale interno') {
            turnSummaryState.totalInternal += snapshot.total;
        }

        turnSummaryState.salesCount += 1;
        persistTurnSummary();
        renderTurnSummary();
        await appendLocalSalesAuditEntry({
            saleId: result.saleId,
            method,
            total: snapshot.total,
            mixedData,
            documentType: saleState.documentType
        });
        decreaseLocalStockFromCart();

        addTurnHistoryEntry({
            title: `Venta cobrada · ${saleState.documentType}`,
            detail: `${formatQuantity(snapshot.items, false)} item(s) · ${capitalizePaymentMethod(method)} · $${formatCurrency(snapshot.total)} · Venta #${result.saleId}`
        });

        addAuditEntry({
            type: 'success',
            title: 'Venta registrada',
            detail: `Venta #${result.saleId} registrada como ${saleState.documentType} por $${formatCurrency(snapshot.total)}.${dteResult?.folio ? ` Folio ${dteResult.folio}.` : ''}`
        });

        saveReceiptRecord(receiptRecord);

        const skipPrint = document.getElementById('payment-no-print-checkbox')?.checked;
        if (!skipPrint) {
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
        } else {
            addTurnHistoryEntry({
                title: 'Impresión omitida',
                detail: `Se omitió la impresión del comprobante para la venta #${result.saleId}.`
            });
        }

        saleState.cart = [];
        saleState.customer = null;
        saleState.collaboratorDiscountEnabled = false;
        saleState.extraChargeEnabled = false;
        renderCustomerSummary();
        renderCart();
        closePaymentModal();
        await loadSalesHistory();

        setBackendStatus(dteResult?.folio
            ? `Venta #${result.saleId} registrada. Folio ${dteResult.folio}.`
            : `Venta #${result.saleId} registrada correctamente.`);

    } catch (error) {
        console.error('Fatal confirmation error:', error);
        openInfoModal('Error al procesar venta', error?.message || 'Ha ocurrido un error inesperado.');
        setBackendStatus(error?.message || 'Error en el proceso de venta.');
    } finally {
        confirmButton.disabled = false;
        confirmButton.textContent = 'Confirmar cobro';
        cancelBtn?.removeAttribute('disabled');
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
        folioDocumento: null,
        documentTypeIds: DOCUMENT_TYPE_IDS,
        paymentMethodMap: PAYMENT_METHOD_MAP,
        getPricingForProduct,
        collaboratorDiscountEnabled: saleState.collaboratorDiscountEnabled,
        extraChargeEnabled: saleState.extraChargeEnabled
    });
}

async function submitSaleToBackend({ method, received, folioDocumento = null }) {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();

    if (!apiBaseUrl || !token) {
        throw new Error('No hay conexion activa con la API.');
    }

    const payload = buildSalePayloadDomain({
        cart: saleState.cart,
        products: catalogState.products,
        documentType: saleState.documentType,
        customer: saleState.customer,
        method,
        received,
        folioDocumento,
        documentTypeIds: DOCUMENT_TYPE_IDS,
        paymentMethodMap: PAYMENT_METHOD_MAP,
        getPricingForProduct,
        branchId: getSelectedBranchId(),
        collaboratorDiscountEnabled: saleState.collaboratorDiscountEnabled,
        extraChargeEnabled: saleState.extraChargeEnabled
    });
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

function setCashWithdrawalStatus(message = '') {
    const status = document.getElementById('cash-withdrawal-status');
    if (!status) {
        return;
    }

    status.textContent = message;
    status.classList.toggle('hidden', !message);
}

function openCashWithdrawalModal() {
    if (!cashSessionState.isOpen) {
        setBackendStatus('Debes tener una caja abierta para registrar un retiro.');
        return;
    }

    const availableCash = getExpectedCashAmount();
    const amountInput = document.getElementById('cash-withdrawal-amount-input');
    const reasonInput = document.getElementById('cash-withdrawal-reason-input');
    const availableLabel = document.getElementById('cash-withdrawal-available-label');
    const totalLabel = document.getElementById('cash-withdrawal-total-label');

    if (availableLabel) {
        availableLabel.textContent = `$${formatCurrency(availableCash)}`;
    }

    if (totalLabel) {
        totalLabel.textContent = `$${formatCurrency(turnSummaryState.totalWithdrawals || 0)}`;
    }

    if (amountInput) {
        amountInput.value = '';
    }

    if (reasonInput) {
        reasonInput.value = '';
    }

    setCashWithdrawalStatus('');
    document.getElementById('cash-withdrawal-modal-backdrop')?.classList.remove('hidden');
    amountInput?.focus();
}

function closeCashWithdrawalModal() {
    document.getElementById('cash-withdrawal-modal-backdrop')?.classList.add('hidden');
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
        totalWithdrawals: turnSummaryState.totalWithdrawals,
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

async function syncCashWithdrawalsFromBackend() {
    const token = getAuthToken();
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());

    if (!cashSessionState.isOpen || !token || !apiBaseUrl) {
        return;
    }

    try {
        const payload = await fetchCashWithdrawals({ apiBaseUrl, token });
        turnSummaryState.totalWithdrawals = Number(payload?.totalRetirado || 0);
        persistTurnSummary();
    } catch (error) {
        console.warn('Cash withdrawals sync warning:', error);
    }
}

async function printCashWithdrawalReceipt({ amount, reason, beforeCash, afterCash, withdrawalId }) {
    const printerName = getSessionValue(SESSION_KEYS.printerName);
    const printerPaper = getSessionValue(SESSION_KEYS.printerPaper) || '80mm';
    const userObject = getCurrentUser();
    const cashierName = userObject?.nombreCompleto || userObject?.nombreUsuario || 'Cajero';
    const now = new Date();

    if (typeof window.cajeroAPI?.printReceipt !== 'function') {
        return;
    }

    const preview = `
RETIRO DE CAJA - VALMU POS
================================
Retiro: ${withdrawalId ? `#${withdrawalId}` : 'SIN ID'}
Fecha:  ${now.toLocaleDateString()}
Hora:   ${now.toLocaleTimeString()}
Cajero: ${cashierName}
Turno:  ${cashSessionState.turnId || '-'}
================================
Disponible antes: $${formatCurrency(beforeCash)}
Monto retirado:   $${formatCurrency(amount)}
Disponible luego: $${formatCurrency(afterCash)}
--------------------------------
Motivo:
${reason}
================================
Firma: ________________________
    `.trim();

    await window.cajeroAPI.printReceipt({
        printerName,
        printerPaper,
        receipt: {
            preview,
            documentType: 'RETIRO DE CAJA',
            saleId: `R-${withdrawalId || Date.now()}`,
            withdrawalAmount: amount,
            withdrawalReason: reason,
            cashierName: cashierName,
            beforeCash: beforeCash,
            afterCash: afterCash,
            dateLabel: now.toLocaleDateString(),
            timeLabel: now.toLocaleTimeString()
        }
    });
}

async function confirmCashWithdrawal() {
    if (!cashSessionState.isOpen) {
        closeCashWithdrawalModal();
        return;
    }

    const amountInput = document.getElementById('cash-withdrawal-amount-input');
    const reasonInput = document.getElementById('cash-withdrawal-reason-input');
    const confirmButton = document.getElementById('cash-withdrawal-confirm-btn');
    const amount = Number(amountInput?.value || 0);
    const reason = String(reasonInput?.value || '').trim();
    const availableCash = getExpectedCashAmount();
    const token = getAuthToken();
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());

    if (!Number.isFinite(amount) || amount <= 0) {
        setCashWithdrawalStatus('Ingresa un monto valido para el retiro.');
        amountInput?.focus();
        return;
    }

    if (!reason) {
        setCashWithdrawalStatus('Debes indicar el motivo del retiro.');
        reasonInput?.focus();
        return;
    }

    if (amount > availableCash) {
        setCashWithdrawalStatus(`No puedes retirar mas de lo disponible en caja ($${formatCurrency(availableCash)}).`);
        amountInput?.focus();
        return;
    }

    if (!token || !apiBaseUrl) {
        setCashWithdrawalStatus('No hay conexion activa para registrar el retiro.');
        return;
    }

    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Registrando...';
    }

    try {
        const result = await registerCashWithdrawal({
            apiBaseUrl,
            token,
            amount,
            reason
        });
        const beforeCash = availableCash;
        turnSummaryState.totalWithdrawals += amount;
        persistTurnSummary();
        renderTurnSummary();
        const afterCash = getExpectedCashAmount();

        addTurnHistoryEntry({
            title: 'Retiro de caja',
            detail: `$${formatCurrency(amount)} retirados. Motivo: ${reason}`
        });
        addAuditEntry({
            type: 'warning',
            title: 'Retiro registrado',
            detail: `Retiro ${result?.id_retiro ? `#${result.id_retiro} ` : ''}por $${formatCurrency(amount)}. Motivo: ${reason}`
        });

        try {
            await printCashWithdrawalReceipt({
                amount,
                reason,
                beforeCash,
                afterCash,
                withdrawalId: result?.id_retiro || null
            });
        } catch (printError) {
            console.error('Cash withdrawal print error:', printError);
            addAuditEntry({
                type: 'warning',
                title: 'Ticket de retiro pendiente',
                detail: printError?.message || 'No se pudo imprimir el ticket del retiro.'
            });
        }

        closeCashWithdrawalModal();
        setBackendStatus(`Retiro por $${formatCurrency(amount)} registrado correctamente.`);
    } catch (error) {
        console.error('Cash withdrawal error:', error);
        setCashWithdrawalStatus(error?.message || 'No se pudo registrar el retiro.');
        addAuditEntry({
            type: 'error',
            title: 'Error en retiro de caja',
            detail: error?.message || 'No se pudo registrar el retiro.'
        });
    } finally {
        if (confirmButton) {
            confirmButton.disabled = false;
            confirmButton.textContent = 'Registrar retiro';
        }
    }
}

async function confirmCloseCashSession() {
    if (!cashSessionState.isOpen) {
        closeCloseCashModal();
        return;
    }

    const confirmButton = document.getElementById('close-cash-confirm-btn');
    const countedCash = Number(document.getElementById('close-counted-cash-input')?.value || 0);
    const countedCard = Number(document.getElementById('close-counted-card-input')?.value || 0);
    const countedTransfer = Number(document.getElementById('close-counted-transfer-input')?.value || 0);

    // Confirmación para evitar cierres accidentales
    const isConfirmed = await openConfirm({
        title: 'Cerrar Turno',
        message: '¿Estás seguro que deseas cerrar el turno y finalizar la jornada? Esta acción no se puede deshacer.'
    });
    if (!isConfirmed) return;

    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();

    if (!apiBaseUrl || !token) {
        setBackendStatus('No hay conexion activa para cerrar la caja.');
        return;
    }

    await loadSalesHistory();
    await syncCashWithdrawalsFromBackend();

    const countedCardInput = document.getElementById('close-counted-card-input');
    const countedTransferInput = document.getElementById('close-counted-transfer-input');
    const autoCard = Number(turnSummaryState.totalCard || 0);
    const autoTransfer = Number(turnSummaryState.totalTransfer || 0);

    if (countedCardInput) {
        countedCardInput.value = String(Math.round(autoCard));
    }
    if (countedTransferInput) {
        countedTransferInput.value = String(Math.round(autoTransfer));
    }

    const expectedCash = getExpectedCashAmount();
    const cashDifference = countedCash - expectedCash;
    const cardDifference = 0;
    const transferDifference = 0;
    const totalDifference = cashDifference;

    const pendingQueue = getDteQueue();
    if (pendingQueue.length) {
        const shouldProcessQueue = await openConfirm({
            title: 'DTEs Offline Pendientes',
            message: `Hay ${pendingQueue.length} documento${pendingQueue.length === 1 ? '' : 's'} en la cola offline que no se pudieron enviar al SII. ¿Deseas reintentar enviarlos antes de cerrar caja?`
        });

        if (shouldProcessQueue) {
            try {
                await processDteQueueBackground();
            } catch (err) {
                console.error('Error processing DTE queue before close:', err);
            }
        }
    }

    if (boletaEnvelopeState.items.length) {
        const shouldForceSend = await openConfirm({
            title: 'Boletas pendientes',
            message: `Hay ${boletaEnvelopeState.items.length} boleta${boletaEnvelopeState.items.length === 1 ? '' : 's'} pendiente${boletaEnvelopeState.items.length === 1 ? '' : 's'} de envio en el sobre SII. Quieres forzar el envio antes de cerrar caja?`
        });

        if (shouldForceSend) {
            try {
                await forceSendPendingBoletaEnvelope({
                    reason: 'Envio forzado antes del cierre de caja',
                    notifyUser: false
                });
            } catch (error) {
                setBackendStatus(error?.message || 'No se pudo enviar el sobre de boletas pendiente.');
                return;
            }
        }
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
                card: autoCard,
                transfer: autoTransfer,
                internal: Number(turnSummaryState.totalInternal || 0)
            },
            differences: {
                cash: cashDifference,
                card: cardDifference,
                transfer: transferDifference
            },
            observation: ''
        });

        addTurnHistoryEntry({
            title: 'Turno cerrado',
            detail: `Efectivo contado $${formatCurrency(countedCash)} (${formatDifferenceLabel(cashDifference)}), tarjeta $${formatCurrency(autoCard)} (${formatDifferenceLabel(cardDifference)}), transferencias $${formatCurrency(autoTransfer)} (${formatDifferenceLabel(transferDifference)}), retiros $${formatCurrency(turnSummaryState.totalWithdrawals || 0)}. Diferencia total ${formatDifferenceLabel(totalDifference)}.`
        });
        addAuditEntry({
            type: totalDifference === 0 ? 'success' : 'warning',
            title: 'Caja cerrada',
            detail: `Turno cerrado con diferencia total ${formatDifferenceLabel(totalDifference)}.`
        });

        // Impresión automática del resumen de cierre
        try {
            await printTurnSummaryReceipt({
                totals: {
                    cash: countedCash,
                    card: autoCard,
                    transfer: autoTransfer
                },
                expected: {
                    cash: expectedCash,
                    card: Number(turnSummaryState.totalCard || 0),
                    transfer: Number(turnSummaryState.totalTransfer || 0),
                    internal: Number(turnSummaryState.totalInternal || 0),
                    withdrawals: Number(turnSummaryState.totalWithdrawals || 0)
                },
                differences: {
                    cash: cashDifference,
                    card: cardDifference,
                    transfer: transferDifference,
                    total: totalDifference
                }
            });
        } catch (printError) {
            console.error('Error al imprimir resumen:', printError);
        }

        closeCloseCashModal();
        await resetLocalSalesAuditForTurn();
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

async function printTurnSummaryReceipt({ totals, expected, differences }) {
    const printerName = getSessionValue(SESSION_KEYS.printerName);
    const printerPaper = getSessionValue(SESSION_KEYS.printerPaper) || '80mm';
    const userObject = getCurrentUser();
    const cashierName = userObject?.nombreCompleto || userObject?.nombreUsuario || 'Cajero';
    const now = new Date();

    if (typeof window.cajeroAPI?.printReceipt !== 'function') return;

    const summaryText = `
CIERRE DE CAJA - VALMU POS
================================
Fecha:  ${now.toLocaleDateString()}
Hora:   ${now.toLocaleTimeString()}
Cajero: ${cashierName}
================================

RESUMEN ESPERADO:
Fondo Inicial: $${formatCurrency(cashSessionState.openingAmount)}
Efectivo:      $${formatCurrency(expected.cash)}
Tarjeta:       $${formatCurrency(expected.card)}
Transferencia: $${formatCurrency(expected.transfer)}
Retiros:       $${formatCurrency(expected.withdrawals || 0)}
Vale Interno:  $${formatCurrency(expected.internal)}
--------------------------------
TOTAL ESPERADO: $${formatCurrency(expected.cash + expected.card + expected.transfer)}

DETALLE CONTADO:
Efectivo:      $${formatCurrency(totals.cash)}
Vouchers:      $${formatCurrency(totals.card)}
Conf. Transf:  $${formatCurrency(totals.transfer)}
--------------------------------
TOTAL CONTADO:  $${formatCurrency(totals.cash + totals.card + totals.transfer)}

DIFERENCIAS:
Efectivo:      ${formatDifferenceLabel(differences.cash)}
Tarjeta:       ${formatDifferenceLabel(differences.card)}
Transferencia: ${formatDifferenceLabel(differences.transfer)}
================================
DIFERENCIA TOTAL: ${formatDifferenceLabel(differences.total)}
================================

Firma Cajero: __________________
    `.trim();

    await window.cajeroAPI.printReceipt({
        printerName,
        printerPaper,
        receipt: {
            preview: summaryText,
            documentType: 'CIERRE DE CAJA',
            saleId: `C-${Date.now()}`
        }
    });
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

    if (printerSelect) {
        printerSelect.value = settings.printerName;
    }

    if (printerPaperSelect) {
        printerPaperSelect.value = settings.printerPaper;
    }

    if (customerDisplayEnabledInput) {
        customerDisplayEnabledInput.checked = settings.customerDisplayEnabled;
    }

    void hydrateCustomerDisplayTargets(settings.customerDisplayTarget);
    updateCustomerDisplayStatusLabel(settings.customerDisplayEnabled ? 'Activacion automatica lista' : 'Desactivada');
    void hydrateSiiSettingsCard();
    void hydrateUpdateState();
}

const DEFAULT_SII_EMISOR = {
    rutEmisor: '77292701-0',
    rutEnvia: '17445030-7',
    razonSocial: 'DISTRIBUIDORA Y COMERCIAL EDUARDO VALDEBENITO MORALES SPA',
    direccion: 'YOBILO LT 1 MZ 1 1001 FRANK MARDONES NULL CORONEL',
    comuna: 'CORONEL',
    ciudad: 'CORONEL',
    giro: 'COMERCIALIZACION Y DISTRIBUCION POR MAYOR Y MENOR DE PRODUCTOS VARIOS',
    acteco: 463019,
    email: 'contacto@valmu.cl',
    resolucionNumero: 80,
    resolucionFecha: '2014-08-22',
    indicadorServicio: '3',
    siiAmbiente: '2'
};

function setSiiSettingsStatus(message) {
    const statusLabel = document.getElementById('sii-settings-status');
    if (statusLabel) {
        statusLabel.textContent = message;
    }
}

function updateSiiCredentialsStatus(config = {}) {
    const badge = document.getElementById('sii-credentials-status');
    if (!badge) {
        return;
    }

    const isReady = Boolean(
        String(config.apiKey || '').trim()
        && String(config.rutEmisor || '').trim()
        && String(config.rutEnvia || '').trim()
    );

    badge.textContent = isReady ? 'Listo' : 'Pendiente';
    badge.classList.toggle('is-ready', isReady);
}

async function hydrateSiiSettingsCard() {
    if (typeof window.cajeroAPI?.getSiiConfig !== 'function') {
        setSiiSettingsStatus('Configuracion SII no disponible en este equipo.');
        return;
    }

    try {
        const config = await window.cajeroAPI.getSiiConfig();
        updateSupportFileCard({
            prefix: 'cert',
            filename: config?.certFilename || ''
        });
        updateCafCard({
            type: 39,
            filename: config?.caf_39_filename || ''
        });
        updateCafCard({
            type: 33,
            filename: config?.caf_33_filename || ''
        });
        const certPasswordInput = document.getElementById('cert-password-input');
        if (certPasswordInput) {
            certPasswordInput.value = config?.certPassword || '';
        }
        const apiKeyInput = document.getElementById('sii-api-key-input');
        if (apiKeyInput) {
            apiKeyInput.value = config?.apiKey || '';
        }
        const rutEmisorInput = document.getElementById('sii-rut-emisor-input');
        if (rutEmisorInput) {
            rutEmisorInput.value = config?.rutEmisor || DEFAULT_SII_EMISOR.rutEmisor;
        }
        const rutEnviaInput = document.getElementById('sii-rut-envia-input');
        if (rutEnviaInput) {
            rutEnviaInput.value = config?.rutEnvia || DEFAULT_SII_EMISOR.rutEnvia;
        }

        const boletaEnvModeSelect = document.getElementById('sii-boleta-env-mode');
        if (boletaEnvModeSelect) {
            boletaEnvModeSelect.value = config?.boletaEnvMode || 'both';
        }
        const boletaEnvMinutesInput = document.getElementById('sii-boleta-env-minutes');
        if (boletaEnvMinutesInput) {
            boletaEnvMinutesInput.value = config?.boletaEnvMinutes !== undefined ? config.boletaEnvMinutes : 60;
        }
        const boletaEnvLimitInput = document.getElementById('sii-boleta-env-limit');
        if (boletaEnvLimitInput) {
            boletaEnvLimitInput.value = config?.boletaEnvLimit !== undefined ? config.boletaEnvLimit : 50;
        }

        // Update the global variables as well
        boletaEnvelopeMode = config?.boletaEnvMode || 'both';
        boletaEnvelopeWindowMs = Number(config?.boletaEnvMinutes !== undefined ? config.boletaEnvMinutes : 60) * 60 * 1000;
        boletaEnvelopeLimit = Number(config?.boletaEnvLimit !== undefined ? config.boletaEnvLimit : 50);

        updateSiiCredentialsStatus(config);
        setSiiSettingsStatus('Archivos SII listos para boleta y factura.');

        try {
            const token = getAuthToken();
            if (!token) return;

            const response = await fetch(`${normalizeApiBaseUrl(getApiBaseUrl())}/folios`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const folios = await parseJsonResponse(response);
                if (Array.isArray(folios)) {
                    const boletaFolio = folios.find(f => Number(f.tipoDte) === 39 || Number(f.id_tipoDoc) === 1);
                    const facturaFolio = folios.find(f => Number(f.tipoDte) === 33 || Number(f.id_tipoDoc) === 2);
                    
                    if (boletaFolio) {
                        const nextFolio = Number(boletaFolio.ultimoFolioUsado) + 1;
                        document.getElementById('caf39-folio-info').style.display = 'flex';
                        document.getElementById('caf39-next-folio').textContent = nextFolio;
                        document.getElementById('caf39-remaining-info').style.display = 'flex';
                        document.getElementById('caf39-remaining-folios').textContent = boletaFolio.foliosRestantes;
                    }
                    if (facturaFolio) {
                        const nextFolio = Number(facturaFolio.ultimoFolioUsado) + 1;
                        document.getElementById('caf33-folio-info').style.display = 'flex';
                        document.getElementById('caf33-next-folio').textContent = nextFolio;
                        document.getElementById('caf33-remaining-info').style.display = 'flex';
                        document.getElementById('caf33-remaining-folios').textContent = facturaFolio.foliosRestantes;
                    }
                }
            }
        } catch (e) {
            console.warn('No se pudo cargar el estado de los folios', e);
        }

    } catch (error) {
        console.error('SII settings hydrate error:', error);
        setSiiSettingsStatus(error?.message || 'No se pudo leer la configuracion SII local.');
    }
}

function updateSupportFileCard({ prefix, filename }) {
    const safeFilename = String(filename || '').trim();
    const filenameLabel = document.getElementById(`${prefix}-filename`);
    const statusBadge = document.getElementById(`${prefix}-status`);

    if (filenameLabel) {
        filenameLabel.textContent = safeFilename || 'No cargado';
    }

    if (statusBadge) {
        statusBadge.textContent = safeFilename ? 'Instalado' : 'Sin archivo';
        statusBadge.classList.toggle('is-ready', Boolean(safeFilename));
    }
}

function updateCafCard({ type, filename }) {
    updateSupportFileCard({
        prefix: `caf${type}`,
        filename
    });
}

async function saveCertificatePassword() {
    if (typeof window.cajeroAPI?.getSiiConfig !== 'function' || typeof window.cajeroAPI?.saveSiiConfig !== 'function') {
        setSiiSettingsStatus('No se pudo guardar la contrasena del certificado.');
        return;
    }

    try {
        const currentConfig = await window.cajeroAPI.getSiiConfig();
        const nextConfig = {
            ...(currentConfig || {}),
            certPassword: String(document.getElementById('cert-password-input')?.value || '').trim()
        };

        const saveResult = await window.cajeroAPI.saveSiiConfig(nextConfig);
        if (!saveResult?.success) {
            throw new Error(saveResult?.error || 'No se pudo guardar la contrasena.');
        }

        setSiiSettingsStatus('Contrasena del certificado guardada.');
    } catch (error) {
        console.error('Certificate password save error:', error);
        setSiiSettingsStatus(error?.message || 'No se pudo guardar la contrasena del certificado.');
    }
}

async function saveSiiCredentials() {
    if (typeof window.cajeroAPI?.getSiiConfig !== 'function' || typeof window.cajeroAPI?.saveSiiConfig !== 'function') {
        setSiiSettingsStatus('No se pudieron guardar las credenciales SII.');
        return;
    }

    try {
        const currentConfig = await window.cajeroAPI.getSiiConfig();
        const nextConfig = {
            ...(currentConfig || {}),
            apiKey: String(document.getElementById('sii-api-key-input')?.value || '').trim(),
            rutEmisor: String(document.getElementById('sii-rut-emisor-input')?.value || '').trim() || DEFAULT_SII_EMISOR.rutEmisor,
            rutEnvia: String(document.getElementById('sii-rut-envia-input')?.value || '').trim() || DEFAULT_SII_EMISOR.rutEnvia,
            numeroResolucion: DEFAULT_SII_EMISOR.resolucionNumero,
            fechaResolucion: DEFAULT_SII_EMISOR.resolucionFecha,
            indicadorServicio: DEFAULT_SII_EMISOR.indicadorServicio,
            siiAmbiente: DEFAULT_SII_EMISOR.siiAmbiente
        };

        const saveResult = await window.cajeroAPI.saveSiiConfig(nextConfig);
        if (!saveResult?.success) {
            throw new Error(saveResult?.error || 'No se pudieron guardar las credenciales.');
        }

        updateSiiCredentialsStatus(nextConfig);
        setSiiSettingsStatus('Credenciales SII guardadas.');
    } catch (error) {
        console.error('SII credentials save error:', error);
        setSiiSettingsStatus(error?.message || 'No se pudieron guardar las credenciales SII.');
    }
}

async function saveBoletaEnvelopeSettings() {
    if (typeof window.cajeroAPI?.getSiiConfig !== 'function' || typeof window.cajeroAPI?.saveSiiConfig !== 'function') {
        setSiiSettingsStatus('No se pudo guardar la configuración del sobre.');
        return;
    }

    try {
        const currentConfig = await window.cajeroAPI.getSiiConfig();
        const mode = document.getElementById('sii-boleta-env-mode')?.value || 'both';
        const minutes = Number(document.getElementById('sii-boleta-env-minutes')?.value || 60);
        const limit = Number(document.getElementById('sii-boleta-env-limit')?.value || 50);

        const nextConfig = {
            ...(currentConfig || {}),
            boletaEnvMode: mode,
            boletaEnvMinutes: minutes,
            boletaEnvLimit: limit
        };

        const saveResult = await window.cajeroAPI.saveSiiConfig(nextConfig);
        if (!saveResult?.success) {
            throw new Error(saveResult?.error || 'No se pudo guardar la configuración.');
        }

        // Update global variables
        boletaEnvelopeMode = mode;
        boletaEnvelopeWindowMs = minutes * 60 * 1000;
        boletaEnvelopeLimit = limit;

        // Reschedule flush using new window
        schedulePendingBoletaEnvelopeFlush();

        setSiiSettingsStatus('Configuración del sobre de boletas guardada.');
        openInfoModal('Configuración Guardada', 'La configuración del sobre de boletas se ha guardado correctamente.');
    } catch (error) {
        console.error('Boleta envelope settings save error:', error);
        setSiiSettingsStatus(error?.message || 'No se pudo guardar la configuración del sobre.');
        openInfoModal('Error al Guardar', error?.message || 'No se pudo guardar la configuración del sobre de boletas.');
    }
}

async function uploadSiiSupportFile({ kind, type = null }) {
    if (typeof window.cajeroAPI?.uploadSiiFile !== 'function' || typeof window.cajeroAPI?.getSiiConfig !== 'function') {
        setSiiSettingsStatus('La carga SII no esta disponible en este equipo.');
        return;
    }

    const isCert = kind === 'cert';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = isCert ? '.p12,.pfx' : '.xml';

    input.onchange = async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        const buttonId = isCert ? 'upload-cert-btn' : `upload-caf${type}-btn`;
        const button = document.getElementById(buttonId);
        const originalText = button?.textContent || '';
        if (button) {
            button.disabled = true;
            button.textContent = 'Cargando...';
        }

        try {
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
                reader.readAsDataURL(file);
            });

            const filename = isCert ? 'certificado.pfx' : `CAF_${type}.xml`;
            const uploadResult = await window.cajeroAPI.uploadSiiFile({ filename, base64Data });
            if (!uploadResult?.success) {
                throw new Error(uploadResult?.error || 'No se pudo guardar el archivo SII.');
            }

            const currentConfig = await window.cajeroAPI.getSiiConfig();
            const nextConfig = { ...(currentConfig || {}) };

            if (isCert) {
                nextConfig.certFilename = filename;
            } else {
                nextConfig[`caf_${type}_filename`] = filename;
            }

            const saveResult = await window.cajeroAPI.saveSiiConfig(nextConfig);
            if (!saveResult?.success) {
                throw new Error(saveResult?.error || 'No se pudo actualizar la configuracion SII.');
            }

            if (isCert) {
                updateSupportFileCard({ prefix: 'cert', filename });
                setSiiSettingsStatus('Certificado cargado correctamente.');
            } else {
                updateCafCard({ type, filename });
                setSiiSettingsStatus(`CAF ${type} cargado correctamente.`);
            }
        } catch (error) {
            console.error(`SII ${isCert ? 'certificate' : `CAF ${type}`} upload error:`, error);
            setSiiSettingsStatus(error?.message || 'No se pudo cargar el archivo SII.');
        } finally {
            if (button) {
                button.disabled = false;
                button.textContent = originalText;
            }
        }
    };

    input.click();
}

async function uploadCafFile({ type }) {
    return uploadSiiSupportFile({ kind: 'caf', type });
}

function normalizeSiiString(str) {
    if (!str) return '';

    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9\s\.\,\-]/g, '')
        .trim();
}

function b64toBlob(base64, type = 'application/octet-stream') {
    const raw = window.atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) {
        bytes[index] = raw.charCodeAt(index);
    }
    return new Blob([bytes], { type });
}

async function parseJsonResponse(response) {
    const rawText = await response.text();
    if (!rawText) {
        return {};
    }

    try {
        return JSON.parse(rawText);
    } catch (_error) {
        return { message: rawText };
    }
}

async function requestBackendJson({ endpoint, method = 'GET', body, token = getAuthToken() }) {
    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    if (!apiBaseUrl || !token) {
        throw new Error('No hay conexion activa con la API.');
    }

    const response = await fetchWithTimeout(`${apiBaseUrl}${endpoint}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: body ? JSON.stringify(body) : undefined,
        timeout: 15000
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok) {
        throw new Error(payload?.error || payload?.message || `Error ${response.status} en ${endpoint}`);
    }

    return payload;
}

function resolveTipoDteFromControlRow(row = {}) {
    const label = String(row.tipoDoc || row.tipo_doc || row.nombre || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
    const idTipoDoc = Number(row.id_tipoDoc || row.idTipoDoc || row.id || 0);

    if (label.includes('boleta') || idTipoDoc === 1) return 39;
    if (label.includes('factura') || idTipoDoc === 2) return 33;
    return null;
}

async function requestNextDteFolio(tipoDte) {
    const controls = await requestBackendJson({ endpoint: '/folios' });
    const control = (Array.isArray(controls) ? controls : []).find((row) => Number(resolveTipoDteFromControlRow(row)) === Number(tipoDte));

    if (!control) {
        throw new Error(`No existe configuracion de CONTROL_FOLIO para DTE ${tipoDte}.`);
    }

    const payload = await requestBackendJson({
        endpoint: '/folios/solicitar',
        method: 'POST',
        body: {
            id_tipoDoc: Number(control.id_tipoDoc || control.idTipoDoc || control.id || 0)
        }
    });

    return Number(payload?.folio || 0);
}

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 15000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('La peticion al servicio externo ha excedido el tiempo limite (15s).');
        }
        throw error;
    }
}

async function getSimpleApiToken(apiKey) {
    const response = await fetchWithTimeout('https://api.simpleapi.cl/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: apiKey })
    });

    if (!response.ok) {
        throw new Error(`No se pudo obtener token SimpleAPI (${response.status}).`);
    }

    return response.text();
}

async function sendBoletaEnvelopeBatch({ batch, config, reason = 'manual' }) {
    if (!batch?.items?.length) {
        return null;
    }

    if (!config.certFilename) throw new Error('Falta certificado digital en Ajustes > SII.');
    if (!config.certPassword) throw new Error('Falta contrasena del certificado en Ajustes > SII.');
    if (!config.rutEmisor) throw new Error('Falta RUT emisor en Ajustes > SII.');

    const result = await window.cajeroAPI.directSendBoletaEnvelope({
        dtes: batch.items,
        config
    });

    if (!result || !result.success) {
        throw new Error(result?.error || 'Error enviando sobre de boletas directo al SII.');
    }

    const sendPayload = {
        TrackId: result.trackId,
        status: result.status,
        responseText: result.responseText
    };

    addAuditEntry({
        type: 'success',
        title: 'Sobre de boletas enviado',
        detail: `${batch.items.length} boleta${batch.items.length === 1 ? '' : 's'} enviadas al SII${sendPayload.TrackId ? ` · Track ID ${sendPayload.TrackId}` : ''}${reason ? ` · ${reason}` : ''}.`
    });

    return sendPayload;
}

async function forceSendPendingBoletaEnvelope({ reason = 'manual', notifyUser = true } = {}) {
    if (boletaEnvelopeSendInFlight || !boletaEnvelopeState.items.length) {
        return null;
    }

    boletaEnvelopeSendInFlight = true;
    updateBoletaEnvelopeStatusUI();
    const snapshot = takePendingBoletaEnvelopeSnapshot();

    try {
        const config = {
            ...DEFAULT_SII_EMISOR,
            ...(await window.cajeroAPI.getSiiConfig())
        };
        const payload = await sendBoletaEnvelopeBatch({ batch: snapshot, config, reason });
        lastSimpleApiSuccess = true;
        void checkSimpleApiStatus();

        // Limpiar estado local persistente tras envío exitoso
        boletaEnvelopeState.items = [];
        boletaEnvelopeState.startedAt = null;
        persistPendingBoletaEnvelopeState();

        if (payload?.TrackId || payload?.trackId) {
            const finalTrackId = payload.TrackId || payload.trackId;
            for (const item of snapshot.items) {
                try {
                    // Update trackId in backend
                    await requestBackendJson({
                        endpoint: `/dte/${item.folio}/estado`,
                        method: 'PUT',
                        body: {
                            estadoSii: 'ENVIADO_SII',
                            trackId: finalTrackId,
                            tipoDte: item.tipoDte
                        }
                    });
                } catch (err) {
                    console.error('Error auto-updating boleta trackId in backend:', err);
                }
            }
        }

        if (notifyUser) {
            setSiiSettingsStatus(`Sobre de boletas enviado correctamente${payload?.TrackId || payload?.trackId ? ` · Track ID ${payload.TrackId || payload.trackId}` : ''}.`);
        }
        return payload;
    } catch (error) {
        lastSimpleApiSuccess = false;
        void checkSimpleApiStatus();
        restorePendingBoletaEnvelopeSnapshot(snapshot);
        console.error('Boleta envelope send error:', error);
        addAuditEntry({
            type: 'error',
            title: 'Error al enviar sobre de boletas',
            detail: error?.message || 'No se pudo enviar el sobre de boletas pendientes.'
        });
        if (notifyUser) {
            setSiiSettingsStatus(error?.message || 'No se pudo enviar el sobre de boletas pendientes.');
        }
        throw error;
    } finally {
        boletaEnvelopeSendInFlight = false;
        updateBoletaEnvelopeStatusUI();
    }
}

function findFirstValueDeep(source, keys = []) {
    if (!source || typeof source !== 'object') {
        return null;
    }

    const normalizedKeys = keys.map((key) => String(key).toLowerCase());

    const visit = (node) => {
        if (Array.isArray(node)) {
            for (const item of node) {
                const found = visit(item);
                if (found !== null && found !== undefined && found !== '') {
                    return found;
                }
            }
            return null;
        }

        if (!node || typeof node !== 'object') {
            return null;
        }

        for (const [key, value] of Object.entries(node)) {
            if (normalizedKeys.includes(String(key).toLowerCase())) {
                if (value !== null && value !== undefined && value !== '') {
                    return value;
                }
            }

            if (value && typeof value === 'object') {
                const found = visit(value);
                if (found !== null && found !== undefined && found !== '') {
                    return found;
                }
            }
        }

        return null;
    };

    return visit(source);
}

function normalizeDetailedDteStatus(payload = {}) {
    const estado = String(
        findFirstValueDeep(payload, ['Estado', 'estado', 'EstadoDTE', 'estadoDte', 'Resultado', 'resultado']) || ''
    ).trim();
    const detalle = String(
        findFirstValueDeep(payload, ['Glosa', 'glosa', 'Detalle', 'detalle', 'Mensaje', 'message', 'Descripcion', 'descripcion']) || ''
    ).trim();
    const reparos = String(
        findFirstValueDeep(payload, ['Reparo', 'reparo', 'Reparos', 'reparos', 'Observaciones', 'observaciones']) || ''
    ).trim();
    const trackId = String(
        findFirstValueDeep(payload, ['TrackId', 'trackId', 'track_id']) || ''
    ).trim();

    const upperEstado = estado.toUpperCase();
    let estadoSii = 'ENVIADO_SII';

    if (upperEstado.includes('ACEPT')) {
        estadoSii = 'ACEPTADO';
    } else if (upperEstado.includes('RECHAZ')) {
        estadoSii = 'RECHAZADO';
    } else if (reparos || upperEstado === 'EPR') {
        estadoSii = 'REPARO';
    }

    return {
        trackId: trackId || null,
        estado: estado || null,
        detalle: detalle || null,
        reparos: reparos || null,
        estadoSii
    };
}

function buildDteItems(cart, { isBoleta = false } = {}) {
    return cart.map((item) => {
        const product = findProductById(catalogState.products, item.productId);
        if (!product) {
            return null;
        }

        const pricing = getPricingForProduct(product, item.quantity, cart);
        const grossUnitPrice = Number(pricing.unitPrice);
        const unitPrice = isBoleta
            ? grossUnitPrice
            : Number((grossUnitPrice / 1.19).toFixed(4));
        const lineTotal = Math.round(unitPrice * item.quantity);

        return {
            name: normalizeSiiString(product.name || `ITEM ${product.id}`),
            quantity: Number(item.quantity),
            unitPrice,
            lineTotal
        };
    }).filter(Boolean);
}

function resolveReceiverForDte(tipoDte, config, customer = null) {
    if (Number(tipoDte) === 39) {
        return {
            rut: '66666666-6',
            razonSocial: 'CLIENTE',
            giro: 'PARTICULAR',
            direccion: normalizeSiiString(config.direccion || DEFAULT_SII_EMISOR.direccion),
            comuna: normalizeSiiString(config.comuna || DEFAULT_SII_EMISOR.comuna),
            ciudad: normalizeSiiString(config.ciudad || config.comuna || DEFAULT_SII_EMISOR.ciudad)
        };
    }

    if (!customer?.rut || !customer?.name) {
        throw new Error('La factura requiere un cliente valido.');
    }

    const address = String(customer.address || '').trim();
    const comuna = String(customer.comuna || '').trim();
    const city = String(customer.city || customer.comuna || '').trim();
    const business = String(customer.business || '').trim();

    if (!address || !comuna) {
        throw new Error('La factura requiere direccion y comuna del cliente.');
    }

    if (!city) {
        throw new Error('La factura requiere ciudad del cliente.');
    }

    return {
        rut: customer.rut,
        razonSocial: customer.name,
        direccion: address,
        comuna,
        ciudad: city,
        giro: business || 'COMERCIO'
    };
}

async function generateAndSendDte({ cart, customer, documentType, snapshot }) {
    const config = {
        ...DEFAULT_SII_EMISOR,
        ...(await window.cajeroAPI.getSiiConfig())
    };

    const isFactura = documentType === 'Factura' || Number(documentType) === 2;
    const tipoDte = isFactura ? 33 : 39;
    const cafFilename = tipoDte === 33 ? 'CAF_33.xml' : 'CAF_39.xml';

    if (!config.apiKey) throw new Error('Falta API Key en Ajustes > SII.');
    if (!config.certFilename) throw new Error('Falta certificado digital en Ajustes > SII.');
    if (!config.certPassword) throw new Error('Falta contrasena del certificado en Ajustes > SII.');
    if (!config.rutEmisor) throw new Error('Falta RUT emisor en Ajustes > SII.');
    if (!config.rutEnvia) throw new Error('Falta RUT firmante en Ajustes > SII.');

    const certBase64 = await window.cajeroAPI.readLocalCert(config.certFilename || 'certificado.pfx');
    if (!certBase64) throw new Error('No se pudo leer el certificado digital local.');

    const cafText = await window.cajeroAPI.readLocalText(cafFilename);
    if (!cafText) throw new Error(`No se encontro ${cafFilename} en Ajustes > SII.`);

    const folio = await requestNextDteFolio(tipoDte);
    if (!folio) {
        throw new Error('No se pudo reservar folio en CONTROL_FOLIO.');
    }

    const isBoleta = Number(tipoDte) === 39 || Number(tipoDte) === 41;
    const items = buildDteItems(cart, { isBoleta });
    if (!items.length) {
        throw new Error('No hay items validos para emitir.');
    }

    const subtotal = Math.round(snapshot.total / 1.19);
    const iva = snapshot.total - subtotal;
    const receiver = resolveReceiverForDte(tipoDte, config, customer);
    const certBlob = b64toBlob(certBase64, 'application/x-pkcs12');
    const cafBlob = new Blob([cafText], { type: 'text/xml' });

    const identificacionDte = {
        TipoDTE: tipoDte,
        Folio: folio,
        FechaEmision: new Date().toISOString().slice(0, 10),
        ...(isBoleta ? {
            IndicadorServicio: Number(config.indicadorServicio || DEFAULT_SII_EMISOR.indicadorServicio)
        } : {
            FormaPago: 1,
            FechaVencimiento: new Date().toISOString().slice(0, 10)
        })
    };

    const inputPayload = {
        Documento: {
            Encabezado: {
                IdentificacionDTE: identificacionDte,
                Emisor: {
                    Rut: config.rutEmisor,
                    ...(isBoleta ? {
                        RazonSocialBoleta: normalizeSiiString(config.razonSocial),
                        GiroBoleta: normalizeSiiString(config.giro).substring(0, 80)
                    } : {
                        RazonSocial: normalizeSiiString(config.razonSocial),
                        Giro: normalizeSiiString(config.giro).substring(0, 80),
                        ActividadEconomica: [Number(config.acteco || 0)]
                    }),
                    DireccionOrigen: normalizeSiiString(config.direccion),
                    ComunaOrigen: normalizeSiiString(config.comuna),
                    CiudadOrigen: normalizeSiiString(config.ciudad)
                },
                Receptor: {
                    Rut: receiver.rut,
                    RazonSocial: normalizeSiiString(receiver.razonSocial),
                    Direccion: normalizeSiiString(receiver.direccion),
                    Comuna: normalizeSiiString(receiver.comuna),
                    Ciudad: normalizeSiiString(receiver.ciudad || receiver.comuna),
                    ...(!isBoleta ? {
                        Giro: normalizeSiiString(receiver.giro || 'PARTICULAR').substring(0, 40)
                    } : {})
                },
                Totales: {
                    MontoNeto: subtotal,
                    ...(!isBoleta ? { TasaIVA: 19 } : {}),
                    IVA: iva,
                    MontoTotal: snapshot.total
                }
            },
            Detalles: items.map((item) => ({
                IndicadorExento: 0,
                Nombre: item.name,
                Descripcion: item.name,
                Cantidad: item.quantity,
                UnidadMedida: 'un',
                Precio: Number(item.unitPrice.toFixed(4)),
                Descuento: 0,
                Recargo: 0,
                MontoItem: item.lineTotal
            })),
            Referencias: [],
            DescuentosRecargos: []
        },
        Certificado: {
            Rut: config.rutEmisor,
            Password: config.certPassword
        },
        Ambiente: config.siiAmbiente === '2' ? 1 : 0,
        Tipo: 1
    };

    const formData = new FormData();
    formData.append('file', certBlob, 'certificado.pfx');
    formData.append('password', config.certPassword);
    formData.append('caf', cafBlob, cafFilename);
    formData.append('input', JSON.stringify(inputPayload));

    try {
        let xmlContentString;
        let bufferDte;
        if (isBoleta) {
            const emisor = {
                rut: config.rutEmisor,
                razonSocial: config.razonSocial,
                giro: config.giro,
                direccion: config.direccion,
                comuna: config.comuna,
                ciudad: config.ciudad
            };
            const mappedDetalles = items.map((item) => ({
                nombre: item.name,
                descripcion: item.name,
                quantity: item.quantity,
                unidadMedida: 'un',
                precio: Number(item.unitPrice.toFixed(4)),
                montoItem: item.lineTotal
            }));
            const directResult = await window.cajeroAPI.directGenerateBoletaXml({
                emisor,
                receptor: receiver,
                detalles: mappedDetalles,
                folio,
                fechaEmis: new Date().toISOString().slice(0, 10),
                config
            });
            if (!directResult || !directResult.success) {
                throw new Error(`Error generando boleta nativa: ${directResult?.error}`);
            }
            xmlContentString = directResult.xml;
        } else {
            const token = await getSimpleApiToken(config.apiKey);
            const generateResponse = await fetchWithTimeout('https://api.simpleapi.cl/api/v1/dte/generar', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
                timeout: 20000
            });

            const generateClone = generateResponse.clone();
            const generateText = await generateResponse.text();
            if (!generateResponse.ok) {
                throw new Error(`Error generando DTE (${generateResponse.status}): ${generateText}`);
            }

            bufferDte = await generateClone.arrayBuffer();
            xmlContentString = new TextDecoder('utf-8').decode(bufferDte);

            await window.cajeroAPI.saveXml({
                filename: `DTE_${tipoDte}_Folio_${folio}.xml`,
                data: xmlContentString,
                folder: tipoDte === 39 ? 'boletas' : 'facturas'
            });
        }

        if (isBoleta) {
            const shouldFlushPreviousBatch = boletaEnvelopeMode !== 'count'
                && boletaEnvelopeState.items.length
                && getPendingBoletaEnvelopeAgeMs() >= boletaEnvelopeWindowMs;

            if (shouldFlushPreviousBatch) {
                void forceSendPendingBoletaEnvelope({
                    reason: `Cierre automatico de ventana de ${Math.round(boletaEnvelopeWindowMs / 60000)} minutos`,
                    notifyUser: false
                });
            }

            appendBoletaToPendingEnvelope({
                folio,
                tipoDte,
                xmlContent: xmlContentString
            });

            addAuditEntry({
                type: 'info',
                title: 'Boleta pendiente de sobre',
                detail: `Boleta 39-${folio} agregada a la cola del sobre SII. Pendientes actuales: ${boletaEnvelopeState.items.length}.`
            });

            lastSimpleApiSuccess = true;
            void checkSimpleApiStatus();
            return {
                folio,
                tipoDte,
                fechaDte: new Date().toISOString().slice(0, 10),
                rutReceptor: receiver.rut,
                xmlContent: xmlContentString,
                trackId: null,
                estadoSii: 'PENDIENTE_SOBRE',
                estadoDetalle: 'Boleta agregada al sobre pendiente de envio.',
                reparos: null,
                emisor: {
                    rut: config.rutEmisor,
                    razonSocial: config.razonSocial,
                    giro: config.giro,
                    direccion: config.direccion,
                    comuna: config.comuna,
                    ciudad: config.ciudad,
                    acteco: config.acteco,
                    resolucionNumero: config.numeroResolucion || 80,
                    resolucionFecha: config.fechaResolucion || '2014-08-22'
                }
            };
        }

        const rutEnvia = config.rutEnvia || config.rutEmisor;
        const wrapPayload = {
            Certificado: {
                Rut: rutEnvia,
                Password: config.certPassword
            },
            Caratula: {
                RutEnvia: rutEnvia,
                RutEmisor: config.rutEmisor,
                RutReceptor: '60803000-K',
                NumeroResolucion: Number(config.resolucionNumero || DEFAULT_SII_EMISOR.resolucionNumero),
                FechaResolucion: config.resolucionFecha || DEFAULT_SII_EMISOR.resolucionFecha
            }
        };

        const wrapFormData = new FormData();
        wrapFormData.append('input', JSON.stringify(wrapPayload));
        wrapFormData.append('files', certBlob, 'certificado.pfx');
        wrapFormData.append('files', new Blob([bufferDte], { type: 'text/xml' }), 'dte.xml');

        const wrapResponse = await fetch('https://api.simpleapi.cl/api/v1/envio/generar', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: wrapFormData
        });

        const wrapBuffer = await wrapResponse.arrayBuffer();
        if (!wrapResponse.ok) {
            throw new Error(`Error generando sobre SII: ${new TextDecoder('utf-8').decode(wrapBuffer)}`);
        }

        try {
            await window.cajeroAPI.saveXml({
                filename: `DEBUG_ENVELOPE_FOLIO_${folio}.xml`,
                data: new TextDecoder('utf-8').decode(wrapBuffer),
                folder: 'boletas'
            });
        } catch (e) {
            console.log("Error saving debug", e);
        }

        const sendFormData = new FormData();
        sendFormData.append('input', JSON.stringify({
            Tipo: Number(tipoDte) === 39 || Number(tipoDte) === 41 ? 2 : 1,
            Ambiente: config.siiAmbiente === '2' ? 1 : 0,
            Certificado: {
                Rut: rutEnvia,
                Password: config.certPassword
            }
        }));
        sendFormData.append('files', certBlob, 'certificado.pfx');
        sendFormData.append('files', new Blob([wrapBuffer], { type: 'text/xml' }), 'envio.xml');

        const sendResponse = await fetch('https://api.simpleapi.cl/api/v1/envio/enviar', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: sendFormData
        });

        const sendText = await sendResponse.text();
        if (!sendResponse.ok) {
            throw new Error(`Error enviando al SII: ${sendText}`);
        }

        let sendPayload = null;
        try {
            sendPayload = JSON.parse(sendText);
        } catch (_) {
            sendPayload = null;
        }

        lastSimpleApiSuccess = true;
        void checkSimpleApiStatus();
        return {
            folio,
            tipoDte,
            fechaDte: new Date().toISOString().slice(0, 10),
            rutReceptor: receiver.rut,
            xmlContent: xmlContentString,
            trackId: sendPayload?.TrackId || sendPayload?.trackId || null,
            estadoSii: sendPayload?.TrackId || sendPayload?.trackId ? 'ENVIADO_SII' : 'GENERADO',
            estadoDetalle: sendPayload?.glosa || sendPayload?.GLOSA || null,
            reparos: null,
            emisor: {
                rut: config.rutEmisor,
                razonSocial: config.razonSocial,
                giro: config.giro,
                direccion: config.direccion,
                comuna: config.comuna,
                ciudad: config.ciudad,
                acteco: config.acteco,
                resolucionNumero: config.numeroResolucion || 80,
                resolucionFecha: config.fechaResolucion || '2014-08-22'
            }
        };

    } catch (apiError) {
        lastSimpleApiSuccess = false;
        void checkSimpleApiStatus();
        console.error('SII direct connection failed. Commuting to offline queue.', apiError);
        
        addAuditEntry({
            type: 'warning',
            title: `Conmutación Offline Folio ${folio}`,
            detail: `SII inaccesible. Boleta en cola para envío posterior. Error: ${apiError.message}`
        });

        return {
            folio,
            tipoDte,
            fechaDte: new Date().toISOString().slice(0, 10),
            rutReceptor: receiver.rut,
            xmlContent: null,
            isOffline: true,
            queuePayload: {
                tipoDte,
                folio,
                cart,
                customer,
                documentType,
                snapshot,
                items,
                receiver,
                subtotal,
                iva
            },
            emisor: {
                rut: config.rutEmisor,
                razonSocial: config.razonSocial,
                giro: config.giro,
                direccion: config.direccion,
                comuna: config.comuna,
                ciudad: config.ciudad,
                acteco: config.acteco,
                resolucionNumero: config.numeroResolucion || 80,
                resolucionFecha: config.fechaResolucion || '2014-08-22'
            }
        };
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

async function testPrinter() {
    if (typeof window.cajeroAPI?.printReceipt !== 'function') {
        setBackendStatus('El servicio de impresión no está disponible.');
        return;
    }

    const printerSelect = document.getElementById('printer-select');
    const paperSelect = document.getElementById('printer-paper-select');

    const payload = {
        printerName: printerSelect?.value || 'Predeterminada del sistema',
        printerPaper: paperSelect?.value || '80mm',
        receipt: {
            documentType: 'Ticket de Prueba',
            dateLabel: new Date().toLocaleString(),
            customerLabel: 'Cliente de Prueba',
            paymentMethod: 'Ninguno',
            lineItems: [
                {
                    name: 'PRODUCTO DE PRUEBA 1',
                    quantityLabel: '1.000',
                    unitPrice: 1000,
                    subtotal: 1000
                },
                {
                    name: 'PRODUCTO DE PRUEBA 2 (MAYORISTA)',
                    quantityLabel: '5.000',
                    unitPrice: 850,
                    subtotal: 4250
                }
            ],
            subtotal: 5250,
            iva: 0,
            total: 5250,
            footerMessage: 'PRUEBA DE IMPRESION EXITOSA - VALMU POS'
        }
    };

    setBackendStatus('Enviando ticket de prueba...');
    const result = await window.cajeroAPI.printReceipt(payload);
    if (result && result.ok) {
        setBackendStatus(`Prueba exitosa en ${result.printerName || 'impresora'}`);
    } else {
        setBackendStatus(`Error en prueba: ${result?.error || 'Desconocido'}`);
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

function getCustomerDisplayTargetId() {
    const selectedFromUi = document.getElementById('customer-display-target-select')?.value;
    return String(selectedFromUi || getSessionValue(SESSION_KEYS.customerDisplayTarget) || '').trim();
}

async function hydrateCustomerDisplayTargets(selectedTargetId = getCustomerDisplayTargetId()) {
    const select = document.getElementById('customer-display-target-select');
    if (!select || typeof window.cajeroAPI?.listCustomerDisplays !== 'function') {
        return;
    }

    try {
        const response = await window.cajeroAPI.listCustomerDisplays();
        const displays = Array.isArray(response?.displays) ? response.displays : [];
        const suggestedDisplay = displays.find((display) => display.isSuggested) || null;
        const allExternalOption = displays.length > 1
            ? '<option value="all-external">Todas las pantallas externas</option>'
            : '';
        select.innerHTML = `
            <option value="">Seleccionar pantalla</option>
            ${allExternalOption}
            ${displays.map((display) => `
                <option value="${escapeHtml(display.id)}">${escapeHtml(display.label)}</option>
            `).join('')}
        `;

        const hasSelected = displays.some((display) => String(display.id) === String(selectedTargetId))
            || String(selectedTargetId) === 'all-external';
        select.value = hasSelected ? String(selectedTargetId) : String(suggestedDisplay?.id || '');

        if (Number(response?.externalCount || 0) >= 2 && !hasSelected) {
            updateCustomerDisplayStatusLabel('Detectadas 2 pantallas externas; puedes usar una o todas');
        }
    } catch (error) {
        console.error('Customer display target list error:', error);
        select.innerHTML = '<option value="">Seleccionar pantalla</option>';
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
        const result = await window.cajeroAPI.openCustomerDisplay({
            targetDisplayId: getCustomerDisplayTargetId()
        });
        customerDisplayKnownOpen = Boolean(result?.isOpen);
        if (result?.isOpen) {
            updateCustomerDisplayStatusLabel('Pantalla cliente abierta');
        } else if (result?.reason === 'no-external-display') {
            updateCustomerDisplayStatusLabel('No se pudo abrir en la pantalla elegida');
        } else {
            updateCustomerDisplayStatusLabel('Pantalla cliente no disponible');
        }
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
        customerDisplayKnownOpen = false;
        customerDisplayLastPayloadKey = '';
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
        customerDisplayTarget: getCustomerDisplayTargetId(),
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
    const cartList = document.getElementById(dispatchMode ? 'dispatch-cart-list' : 'cart-list');
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
        scrollState: {
            top: Number(cartList?.scrollTop || 0),
            height: Number(cartList?.scrollHeight || 0),
            viewport: Number(cartList?.clientHeight || 0)
        },
        cart: [...activeCart].reverse().map((item) => {
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

async function syncCustomerDisplay(force = false) {
    if (typeof window.cajeroAPI?.updateCustomerDisplay !== 'function') {
        return;
    }

    if (!force && !isCustomerDisplayEnabled() && !customerDisplayKnownOpen) {
        return;
    }

    if (!force && customerDisplaySyncThrottleTimer) {
        customerDisplayPendingSync = true;
        return;
    }

    const payload = buildCustomerDisplayPayload();
    const payloadKey = JSON.stringify(payload);
    if (!force && payloadKey === customerDisplayLastPayloadKey) {
        customerDisplayPendingSync = false;
        return;
    }

    try {
        const result = await window.cajeroAPI.updateCustomerDisplay(payload);
        customerDisplayKnownOpen = Boolean(result?.isOpen);
        customerDisplayLastPayloadKey = payloadKey;
        customerDisplayPendingSync = false;
    } catch (error) {
        console.error('Customer display sync error:', error);
    } finally {
        if (!force) {
            customerDisplaySyncThrottleTimer = window.setTimeout(() => {
                customerDisplaySyncThrottleTimer = null;
                if (customerDisplayPendingSync) {
                    void syncCustomerDisplay();
                }
            }, 150); // Throttle frequency for low-end hardware (approx 6 FPS)
        }
    }
}

function scheduleCustomerDisplayScrollSync() {
    if (customerDisplayScrollSyncTimer) {
        window.clearTimeout(customerDisplayScrollSyncTimer);
    }

    customerDisplayScrollSyncTimer = window.setTimeout(() => {
        customerDisplayScrollSyncTimer = null;
        void syncCustomerDisplay();
    }, 100); // 10 FPS for scroll sync is plenty for a customer display
}

function clearAutoScanTimer() {
    if (!autoScanTimer) {
        return;
    }

    window.clearTimeout(autoScanTimer);
    autoScanTimer = null;
}

function findExactProductMatch(term) {
    const normalizedTerm = String(term || '').trim();
    if (!normalizedTerm) {
        return null;
    }

    return catalogState.products.find((product) => {
        if (!isDispatchMode() && product?.dispatchOnly) {
            return false;
        }

        return String(product.code || '').trim() === normalizedTerm;
    }) || null;
}

function completeAutoScan(term, inputElement = null) {
    const exactCodeMatch = findExactProductMatch(term);
    if (!exactCodeMatch) {
        return false;
    }

    if (isDispatchMode()) {
        selectProductForDispatch(exactCodeMatch.id);
    } else {
        selectProductForSale(exactCodeMatch.id);
    }

    const resolvedInput = inputElement || document.getElementById(isDispatchMode() ? 'dispatch-search-input' : 'product-search-input');
    if (resolvedInput) {
        resolvedInput.value = '';
    }

    if (isDispatchMode()) {
        dispatchState.searchQuery = '';
    }

    renderSearchResults([]);
    return true;
}

function scheduleAutoScan(term, inputElement = null) {
    clearAutoScanTimer();

    const normalizedTerm = String(term || '').trim();
    if (!normalizedTerm) {
        return;
    }

    autoScanTimer = window.setTimeout(async () => {
        autoScanTimer = null;
        await ensureFreshCatalogForSearch();

        const activeInput = inputElement || document.getElementById(isDispatchMode() ? 'dispatch-search-input' : 'product-search-input');
        const activeTerm = String(activeInput?.value || '').trim();
        if (activeTerm !== normalizedTerm) {
            return;
        }

        completeAutoScan(normalizedTerm, activeInput);
    }, 90);
}

function handleSearchInput(event) {
    if (!cashSessionState.isOpen) {
        return;
    }

    const inputElement = event.target;
    const term = String(event.target.value || '').trim();

    if (!term) {
        clearAutoScanTimer();
        renderSearchResults([]);
        return;
    }

    void ensureFreshCatalogForSearch().then((refreshed) => {
        if (!refreshed) {
            return;
        }

        const activeInput = document.getElementById('product-search-input');
        const activeTerm = String(activeInput?.value || '').trim();
        if (!activeTerm || activeTerm !== term) {
            return;
        }

        if (isDispatchMode()) {
            renderSearchResults(filterDispatchProducts(catalogState.products, activeTerm, normalizeCatalogText).slice(0, 6));
        } else {
            renderSearchResults(findProducts(activeTerm).slice(0, 6));
        }
        renderCart();
        renderCatalogStatus();
    });

    scheduleAutoScan(term, inputElement);

    if (isDispatchMode()) {
        dispatchState.searchQuery = term;
        renderSearchResults(filterDispatchProducts(catalogState.products, term, normalizeCatalogText).slice(0, 6));
        return;
    }

    renderSearchResults(findProducts(term).slice(0, 6));
}

async function handleSearchKeydown(event) {
    if (!cashSessionState.isOpen) {
        return;
    }

    if (event.key !== 'Enter') {
        return;
    }

    event.preventDefault();
    clearAutoScanTimer();
    const term = String(event.target.value || '').trim();
    if (!term) {
        return;
    }

    await ensureFreshCatalogForSearch();

    if (completeAutoScan(term, event.target)) {
        return;
    }

    const exactCodeMatch = catalogState.products.find((product) => {
        if (!isDispatchMode() && product?.dispatchOnly) {
            return false;
        }

        return product.code === term;
    });
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

function addUnitsProductToCart(productId, quantity) {
    const product = findProductById(catalogState.products, productId);
    if (!product) {
        return;
    }

    if (Number(product.stockActual || 0) <= 0) {
        notifyNoStockInBranch(product);
        return;
    }

    const normalizedQuantity = Number(quantity);
    if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0 || !Number.isInteger(normalizedQuantity)) {
        return;
    }

    const existingItem = findCartItemByProductId(saleState.cart, productId);
    const currentQuantity = Number(existingItem?.quantity || 0);
    const targetQuantity = currentQuantity + normalizedQuantity;

    if (targetQuantity > Number(product.stockActual || 0)) {
        setBackendStatus(`Stock insuficiente para ${product.name}. Quedan ${formatQuantity(product.stockActual || 0, false)}.`);
        return;
    }

    if (existingItem) {
        existingItem.quantity = targetQuantity;
    } else {
        saleState.cart.push({
            productId: product.id,
            quantity: normalizedQuantity
        });
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

function setCartProductQuantity(productId, quantity) {
    const product = findProductById(catalogState.products, productId);
    if (!product) {
        return;
    }

    const result = setCartItemQuantity({
        cart: saleState.cart,
        product,
        quantity,
        roundWeightedQuantity
    });

    if (!result.ok && result.reason === 'invalid_quantity') {
        setBackendStatus(product.isWeighted ? 'Ingresa un peso valido.' : 'Ingresa una cantidad entera valida.');
        return;
    }

    if (!result.ok && result.reason === 'stock_insufficient') {
        setBackendStatus(`Stock insuficiente para ${product.name}. Quedan ${formatQuantity(product.stockActual || 0, product.isWeighted)}.`);
        return;
    }

    renderCart();
}

function selectProductForSale(productId) {
    const product = findProductById(catalogState.products, productId);
    if (!product) {
        return;
    }

    const saleSearchInput = document.getElementById('product-search-input');
    if (saleSearchInput) {
        saleSearchInput.value = '';
    }
    renderSearchResults([]);

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

function toggleCartItemOffer(productId) {
    const item = saleState.cart.find((i) => String(i.productId) === String(productId));
    if (item) {
        item.applyOffer = !item.applyOffer;
        renderCart();
    }
}

// Redundant functions removed (using consolidated official definitions below)

function renderSearchResults(products) {
    if (isDispatchMode()) {
        renderDispatchSearchResults(products, {
            listId: 'dispatch-search-results',
            overlayId: 'dispatch-search-overlay',
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
            listId: 'dispatch-cart-list',
            totalLabelId: 'dispatch-total-label',
            itemsLabelId: 'dispatch-items-label',
            quantityUpdateFunction: 'updateDispatchItemQuantity',
            removeFunction: 'removeDispatchItem'
        });

        const snapshot = buildDispatchSnapshot(dispatchState.cart, catalogState.products, getPricingForProduct);
        const dispatchTotal = document.getElementById('dispatch-total-label');
        if (dispatchTotal) {
            dispatchTotal.textContent = `$${formatCurrency(snapshot.total)}`;
        }
        persistDispatchDraft();
    } else {
        renderCartView({
            cart: saleState.cart,
            products: catalogState.products,
            collaboratorDiscountEnabled: saleState.collaboratorDiscountEnabled,
            extraChargeEnabled: saleState.extraChargeEnabled
        });
        persistSaleDraft();
    }

    syncCustomerDisplay();
}

function getSelectedDispatchCarrier() {
    return dispatchState.carriers.find((carrier) => String(carrier.id) === String(dispatchState.selectedCarrierId)) || null;
}

function renderDispatchSection() {
    updateCarrierTiles(getSelectedDispatchCarrier());

    const customer = invoiceClientState.customers.find(c => String(c.id) === String(dispatchState.selectedCustomerId));
    updateDispatchCustomerTile(customer);
    updateDispatchDocumentTypeUI(dispatchState.selectedDocumentTypeId);
    updateDispatchAddressVisibility(dispatchState.selectedDocumentTypeId);

    const dispatchAddressInput = document.getElementById('dispatch-address-input');
    if (dispatchAddressInput && dispatchAddressInput.value !== dispatchState.manualAddress) {
        dispatchAddressInput.value = dispatchState.manualAddress || '';
    }
    const dispatchPaymentInput = document.getElementById('dispatch-payment-input');
    if (dispatchPaymentInput && dispatchPaymentInput.value !== dispatchState.manualPayment) {
        dispatchPaymentInput.value = dispatchState.manualPayment || 'en_ruta';
    }

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

function handleDispatchDocumentTypeChange(event) {
    const node = event.target.closest('.doc-chip');
    if (!node) return;

    const typeId = Number(node.getAttribute('data-type'));
    if (typeId) {
        dispatchState.selectedDocumentTypeId = typeId;
        renderDispatchSection();
    }
}


function openCarrierSelectionModal() {
    const backdrop = document.getElementById('carrier-selection-modal-backdrop');
    if (backdrop) {
        backdrop.classList.remove('hidden');
        renderCarrierSelectionList(dispatchState.carriers, dispatchState.selectedCarrierId);

        const searchInput = document.getElementById('carrier-selection-search-input');
        if (searchInput) {
            searchInput.value = '';
            searchInput.focus();
        }
    }
}

function openDispatchCustomerModal() {
    const customer = invoiceClientState.customers.find(c => String(c.id) === String(dispatchState.selectedCustomerId));
    selectedClientId = customer?.id || null;
    invoiceClientState.pendingDocumentType = null;
    setInvoiceClientStatus('');
    openInvoiceClientModalView(customer);
    showCustomerModalStepView('search');
    loadInvoiceClients();
}

function clearDispatchCustomer() {
    dispatchState.selectedCustomerId = null;
    renderDispatchSection();
}

function closeCarrierSelectionModal() {
    document.getElementById('carrier-selection-modal-backdrop')?.classList.add('hidden');
}

window.selectCarrierFromModal = function (carrierId) {
    dispatchState.selectedCarrierId = String(carrierId);
    renderDispatchSection();
    closeCarrierSelectionModal();
};


function handleDispatchCarrierChange(event) {
    dispatchState.selectedCarrierId = String(event.target?.value || '').trim() || null;
    renderDispatchSection();
}

function handleDispatchSearchInput(event) {
    dispatchState.searchQuery = String(event.target?.value || '').trim();
    renderDispatchSection();
}

function addFirstDispatchSearchResult() {
    const query = String(dispatchState.searchQuery || '').trim();
    if (!query) {
        setBackendStatus('Escribe un codigo o descripcion para agregar manualmente al despacho.');
        return;
    }

    const firstMatch = filterDispatchProducts(catalogState.products, query, normalizeCatalogText)[0];
    if (!firstMatch) {
        setBackendStatus('No se encontro un producto para agregar al despacho.');
        return;
    }

    selectProductForDispatch(firstMatch.id);
}

function clearDispatchDraft() {
    dispatchState.cart = [];
    dispatchState.searchQuery = '';
    dispatchState.manualAddress = '';
    dispatchState.selectedCarrierId = null;
    dispatchState.selectedCustomerId = null;
    dispatchState.manualPayment = 'en_ruta';
    dispatchState.selectedDocumentTypeId = 3;
    const dispatchSearchInput = document.getElementById('dispatch-search-input');
    if (dispatchSearchInput) {
        dispatchSearchInput.value = '';
    }
    const dispatchAddressInput = document.getElementById('dispatch-address-input');
    if (dispatchAddressInput) {
        dispatchAddressInput.value = '';
    }
    const saleSearchInput = document.getElementById('product-search-input');
    if (saleSearchInput) {
        saleSearchInput.value = '';
    }
    renderSearchResults([]);
    renderDispatchSection();
    persistDispatchDraft();
    setBackendStatus('Carga de despacho vaciada.');
}

function addWeightedProductToDispatch(productId, quantity) {
    const product = findProductById(catalogState.products, productId);
    if (!product) {
        return;
    }

    const result = addWeightedQuantityToDispatchCart(dispatchState.cart, product, quantity);
    dispatchState.cart = result.cart;
    if (result.error) {
        setBackendStatus(result.error);
        return;
    }

    renderDispatchSection();
}

function setDispatchProductQuantity(productId, quantity) {
    const product = findProductById(catalogState.products, productId);
    if (!product) {
        return;
    }

    const result = setDispatchCartItemQuantity(dispatchState.cart, product, quantity);
    dispatchState.cart = result.cart;
    if (result.error) {
        setBackendStatus(result.error);
        return;
    }

    renderDispatchSection();
}

function selectProductForDispatch(productId) {
    const product = findProductById(catalogState.products, productId);
    if (!product) {
        return;
    }

    if (product.isWeighted) {
        dispatchState.searchQuery = '';
        const dispatchSearchInput = document.getElementById('dispatch-search-input');
        if (dispatchSearchInput) {
            dispatchSearchInput.value = '';
        }
        renderSearchResults([]);
        openWeightedModal(product, 'add', 1, 'dispatch');
        return;
    }

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

function toggleDispatchItemOffer(productId) {
    const item = dispatchState.cart.find((i) => String(i.productId) === String(productId));
    if (item) {
        item.applyOffer = !item.applyOffer;
        renderDispatchSection();
    }
}

async function generateDispatchRecord() {
    const carrier = getSelectedDispatchCarrier();
    if (!carrier) {
        setBackendStatus('Selecciona un transportista antes de emitir el vale de despacho.');
        return;
    }

    const documentType = dispatchState.selectedDocumentTypeId;
    const customerId = dispatchState.selectedCustomerId;
    const dispatchAddress = String(dispatchState.manualAddress || '').trim();

    if (Number(documentType) === 2 && !customerId) {
        setBackendStatus('Debes seleccionar un cliente para emitir una Factura.');
        return;
    }

    if (Number(documentType) === 3 && !dispatchAddress) {
        setBackendStatus('Ingresa una direccion para emitir el vale de despacho.');
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
    const stockPlan = buildDispatchStockPlan(dispatchState.cart, catalogState.products);

    const docTypeLabel = Number(documentType) === 2 ? 'Factura' : (Number(documentType) === 1 ? 'Boleta' : 'Vale interno');
    const customer = (Number(documentType) === 1 || Number(documentType) === 2) ? (invoiceClientState.customers.find(c => String(c.id) === String(customerId)) || null) : null;

    if (!stockPlan.ok) {
        setBackendStatus(stockPlan.error || 'No se pudo validar el stock del despacho.');
        return;
    }

    if (confirmButton) {
        confirmButton.disabled = true;
        confirmButton.textContent = 'Generando vale...';
    }

    try {
        let dteResult = null;
        if (Number(documentType) === 1 || Number(documentType) === 2) {
            setBackendStatus(`Emitiendo ${docTypeLabel.toLowerCase()} al SII...`);
            dteResult = await generateAndSendDte({
                cart: dispatchState.cart,
                customer: customer,
                documentType: docTypeLabel,
                snapshot: snapshot
            });
        }

        const payload = buildDispatchPayload({
            snapshot,
            carrierId: carrier.id,
            documentTypeId: documentType,
            customerId: customerId,
            folioDocumento: dteResult?.folio || null,
            manualPayment: dispatchState.manualPayment,
            stockPlan,
            branchId: getSelectedBranchId()
        });

        const result = await generateDispatchRequest({
            apiBaseUrl,
            token,
            payload
        });

        if (dteResult?.xmlContent) {
            try {
                await requestBackendJson({
                    endpoint: '/dte/guardar',
                    method: 'POST',
                    body: {
                        id_venta: result.id_venta || null,
                        tipoDte: Number(dteResult.tipoDte),
                        folio: Number(dteResult.folio),
                        xmlContenido: dteResult.xmlContent,
                        trackId: dteResult.trackId || null,
                        estadoSii: dteResult.estadoSii || 'GENERADO'
                    }
                });
            } catch (dteSaveError) {
                console.error('DTE backup error:', dteSaveError);
                addAuditEntry({
                    type: 'warning',
                    title: 'Respaldo DTE pendiente',
                    detail: dteSaveError?.message || 'No se pudo guardar el XML del DTE en backend.'
                });
            }
        } else if (dteResult?.isOffline && dteResult.queuePayload) {
            queuePendingDte({
                ...dteResult.queuePayload,
                saleId: result.id_venta || null,
                dispatchId: result.id_despacho || null
            });
        }

        let saleReceiptRecord = null;
        if (dteResult && dteResult.folio) {
            saleReceiptRecord = buildReceiptRecord({
                saleId: result.id_venta,
                payload: {
                    subtotal: payload.subtotal,
                    descuento: snapshot.discount,
                    iva: payload.iva,
                    total: payload.total,
                    folioDocumento: dteResult.folio
                },
                snapshot,
                method: dispatchState.manualPayment === 'en_ruta' ? 'efectivo' : dispatchState.manualPayment,
                customer: docTypeLabel === 'Factura' ? customer : null,
                documentType: docTypeLabel,
                cart: dispatchState.cart,
                dteMetadata: dteResult,
                paymentLabel: dispatchState.manualPayment === 'en_ruta' ? 'En ruta' : capitalizePaymentMethod(dispatchState.manualPayment),
                footerMessage: 'Documento emitido para despacho en ruta. No se considera en el arqueo de caja.',
                addressLabel: dispatchAddress,
                origin: 'dispatch'
            });
            saveReceiptRecord(saleReceiptRecord);
        }

        const record = buildDispatchRecord({
            carrier,
            branchName: getSelectedBranchName(),
            snapshot,
            formatDateTime
        });

        record.id = String(result.id_despacho || record.id);
        record.saleReference = `Venta en ruta ${result.id_venta || ''}`.trim();
        const dispatchReceiptRecord = buildDispatchReceiptRecord({
            dispatchId: record.id,
            saleId: result.id_venta,
            carrier,
            snapshot,
            branchName: getSelectedBranchName(),
            addressLabel: dispatchAddress,
            paymentLabel: dispatchState.manualPayment === 'en_ruta' ? 'En ruta' : capitalizePaymentMethod(dispatchState.manualPayment),
            stockPlan
        });

        dispatchState.records.unshift(record);
        dispatchState.records = dispatchState.records.slice(0, 20);
        dispatchState.cart = [];
        dispatchState.searchQuery = '';
        dispatchState.manualAddress = '';
        dispatchState.manualPayment = 'en_ruta';
        saveDispatchReceiptRecord(dispatchReceiptRecord);

        const searchInput = document.getElementById('dispatch-search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        const dispatchAddressInput = document.getElementById('dispatch-address-input');
        if (dispatchAddressInput) {
            dispatchAddressInput.value = '';
        }

        addAuditEntry({
            type: 'success',
            title: 'Despacho generado',
            detail: `DSP-${record.id} generado para ${carrier.name}. ${stockPlan.usesFallback ? 'Se uso Bodega porque Casa Matriz no alcanzaba en parte del pedido.' : 'El stock se desconto desde Casa Matriz.'} La venta quedo en ruta sin afectar la caja del cajero.${dteResult?.estadoSii ? ` Estado SII: ${dteResult.estadoSii}.` : ''}${dteResult?.reparos ? ` Reparo: ${dteResult.reparos}.` : ''}`
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
        if (saleReceiptRecord) {
            try {
                await printReceiptRecord({
                    record: saleReceiptRecord,
                    printerName: getSessionValue(SESSION_KEYS.printerName) || 'Predeterminada del sistema',
                    printerPaper: getSessionValue(SESSION_KEYS.printerPaper) || '80mm',
                    printReceipt: window.cajeroAPI?.printReceipt
                });
            } catch (printError) {
                console.error('Sale DTE auto print error:', printError);
                openDispatchReceiptModal(record.id);
                addAuditEntry({
                    type: 'warning',
                    title: 'Boleta pendiente de impresion',
                    detail: printError?.message || `El documento ${docTypeLabel} se genero, pero no se pudo imprimir.`
                });
            }
        } else {
            try {
                await printReceiptRecord({
                    record: dispatchReceiptRecord,
                    printerName: getSessionValue(SESSION_KEYS.printerName) || 'Predeterminada del sistema',
                    printerPaper: getSessionValue(SESSION_KEYS.printerPaper) || '80mm',
                    printReceipt: window.cajeroAPI?.printReceipt
                });
            } catch (printError) {
                console.error('Dispatch auto print error:', printError);
                openDispatchReceiptModal(record.id);
                addAuditEntry({
                    type: 'warning',
                    title: 'Vale pendiente de impresion',
                    detail: printError?.message || `El despacho DSP-${record.id} se genero, pero no se pudo imprimir el vale.`
                });
            }
        }

        if (stockPlan) {
            const stockPickingRecord = buildStockPickingRecordFromPlan({
                dispatchId: record.id,
                carrier,
                snapshot,
                stockPlan
            });
            try {
                await printReceiptRecord({
                    record: stockPickingRecord,
                    printerName: getSessionValue(SESSION_KEYS.printerName) || 'Predeterminada del sistema',
                    printerPaper: getSessionValue(SESSION_KEYS.printerPaper) || '80mm',
                    printReceipt: window.cajeroAPI?.printReceipt
                });
            } catch (pickingError) {
                console.error('Stock picking auto print error:', pickingError);
                addAuditEntry({
                    type: 'warning',
                    title: 'Ticket stock pendiente de impresion',
                    detail: pickingError?.message || `El ticket de stock para DSP-${record.id} no se pudo imprimir.`
                });
            }
        }
        const stockMessage = result?.stockMensaje
            || result?.mensajeStock
            || (stockPlan.usesFallback
                ? `Despacho DSP-${record.id} generado correctamente. Se desconto stock desde Casa Matriz y, como no alcanzaba, se completo desde Bodega.`
                : `Despacho DSP-${record.id} generado correctamente. El stock se desconto desde Casa Matriz.`);
        setBackendStatus(`${stockMessage}${dteResult?.estadoSii === 'REPARO' ? ` DTE con reparo${dteResult.reparos ? `: ${dteResult.reparos}` : ''}.` : ''}`);
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
        SESSION_KEYS.salesHistory,
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
        const dispatchPriorityInventory = await resolveDispatchPriorityInventory({
            apiBaseUrl,
            token,
            branches: catalogState.branches,
            categories: catalogState.categories,
            fetchInventory,
            normalizeBackendProduct
        });
        catalogState.products = applyDispatchPriorityStock(inventoryState.products, dispatchPriorityInventory);
        catalogState.source = inventoryState.source;
        catalogState.status = inventoryState.status;
        lastCatalogSyncAt = Date.now();
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

function openDispatchQuantityEditModal(productId) {
    const weightedEditState = resolveWeightedEditState({
        products: catalogState.products,
        cart: dispatchState.cart,
        productId,
        findProductById,
        findCartItemByProductId
    });

    if (!weightedEditState) {
        return;
    }

    openWeightedModal(weightedEditState.product, 'edit', weightedEditState.quantity, 'dispatch');
}

async function refreshCatalogProductsLive() {
    if (catalogRefreshPromise) {
        return catalogRefreshPromise;
    }

    const apiBaseUrl = normalizeApiBaseUrl(getApiBaseUrl());
    const token = getAuthToken();
    const selectedBranchId = getSelectedBranchId();

    if (!apiBaseUrl || !token) {
        return false;
    }

    if (!selectedBranchId) {
        return false; // Skip inventory fetch if branch is not yet selected
    }

    catalogRefreshPromise = (async () => {
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

            const dispatchPriorityInventory = await resolveDispatchPriorityInventory({
                apiBaseUrl,
                token,
                branches: catalogState.branches,
                categories: catalogState.categories,
                fetchInventory,
                normalizeBackendProduct
            });

            catalogState.products = applyDispatchPriorityStock(inventoryState.products, dispatchPriorityInventory);
            catalogState.source = inventoryState.source;
            catalogState.status = inventoryState.status;
            lastCatalogSyncAt = Date.now();
            return true;
        } catch (error) {
            console.error('Live catalog refresh error:', error);
            return false;
        } finally {
            catalogRefreshPromise = null;
        }
    })();

    return catalogRefreshPromise;
}

async function ensureFreshCatalogForSearch({ force = false } = {}) {
    const catalogAge = Date.now() - lastCatalogSyncAt;
    if (!force && lastCatalogSyncAt && catalogAge < LIVE_CATALOG_REFRESH_MS) {
        return false;
    }

    return refreshCatalogProductsLive();
}

function renderCatalogStatus() {
    renderCatalogStatusView(catalogState);
}

function openWeightedModal(product, mode = 'add', currentQuantity = 1, target = 'sale') {
    openWeightedState(weightedProductState, product, mode, target);
    openWeightedModalView({
        productName: product.name,
        mode,
        currentQuantity,
        isWeighted: Boolean(product.isWeighted)
    });
}

function closeWeightedModal() {
    closeWeightedState(weightedProductState);
    closeWeightedModalView();
}

function confirmWeightedProduct() {
    const quantityInput = document.getElementById('weighted-quantity-input');
    const product = findProductById(catalogState.products, weightedProductState.productId);
    const quantity = product?.isWeighted
        ? parseWeightedQuantity(quantityInput?.value || 0)
        : Number(quantityInput?.value || 0);

    if (!weightedProductState.productId || !product || !Number.isFinite(quantity) || quantity <= 0 || (!product.isWeighted && !Number.isInteger(quantity))) {
        quantityInput?.focus();
        quantityInput?.select();
        return;
    }

    if (weightedProductState.mode === 'edit') {
        if (weightedProductState.target === 'dispatch') {
            setDispatchProductQuantity(weightedProductState.productId, quantity);
        } else {
            setCartProductQuantity(weightedProductState.productId, quantity);
        }
    } else {
        if (weightedProductState.target === 'dispatch') {
            addWeightedProductToDispatch(weightedProductState.productId, quantity);
        } else if (product.isWeighted) {
            addWeightedProductToCart(weightedProductState.productId, quantity);
        } else {
            addUnitsProductToCart(weightedProductState.productId, quantity);
        }
    }
    closeWeightedModal();
}

function openCartQuantityEditModal(productId) {
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
window.toggleCartItemOffer = toggleCartItemOffer;
window.toggleDispatchItemOffer = toggleDispatchItemOffer;
window.clearCurrentSale = clearCurrentSale;
window.openCartQuantityEditModal = openCartQuantityEditModal;
window.openDispatchQuantityEditModal = openDispatchQuantityEditModal;
window.openSaleCancellationModal = openSaleCancellationModal;
window.openDispatchReceiptModal = openDispatchReceiptModal;

// DTE Offline Queue Storage & Logic
let lastSimpleApiSuccess = true;

function showNotification({ type, message }) {
    const title = type === 'error' ? 'Error' : type === 'success' ? 'Éxito' : 'Información';
    openInfoModal(title, message);
}

function getDteQueue() {
    try {
        const queueStr = localStorage.getItem('cajero_dte_queue');
        return queueStr ? JSON.parse(queueStr) : [];
    } catch (e) {
        console.error('Error reading DTE queue:', e);
        return [];
    }
}

function saveDteQueue(queue) {
    try {
        localStorage.setItem('cajero_dte_queue', JSON.stringify(queue));
    } catch (e) {
        console.error('Error saving DTE queue:', e);
    }
}

function queuePendingDte(item) {
    const queue = getDteQueue();
    const queueItem = {
        id: 'dte_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        tipoDte: item.tipoDte,
        folio: item.folio,
        createdAt: new Date().toISOString(),
        saleId: item.saleId || null,
        dispatchId: item.dispatchId || null,
        payload: item
    };
    queue.push(queueItem);
    saveDteQueue(queue);
    
    if (document.getElementById('settings-tab-pending-dtes')?.classList.contains('active')) {
        renderDteQueueView();
    }
}

function removeDteFromQueue(id) {
    let queue = getDteQueue();
    queue = queue.filter(item => item.id !== id);
    saveDteQueue(queue);
    renderDteQueueView();
}

async function processQueuedDte(queueItem) {
    const config = {
        ...DEFAULT_SII_EMISOR,
        ...(await window.cajeroAPI.getSiiConfig())
    };

    const isBoleta = Number(queueItem.tipoDte) === 39 || Number(queueItem.tipoDte) === 41;
    const payload = queueItem.payload;
    const certBase64 = await window.cajeroAPI.readLocalCert(config.certFilename || 'certificado.pfx');
    const cafFilename = Number(queueItem.tipoDte) === 33 ? 'CAF_33.xml' : 'CAF_39.xml';
    const cafText = await window.cajeroAPI.readLocalText(cafFilename);

    if (!certBase64 || !cafText) {
        throw new Error('Certificado o CAF no encontrado para procesar en cola.');
    }

    let items = payload.items || buildDteItems(payload.cart || [], { isBoleta });
    if (!items || items.length === 0) {
        const totalVal = payload.snapshot?.total || 0;
        const grossUnitPrice = totalVal;
        const unitPrice = isBoleta
            ? grossUnitPrice
            : Number((grossUnitPrice / 1.19).toFixed(4));
        const lineTotal = Math.round(unitPrice * 1);
        
        items = [{
            name: 'VENTA GENERAL POS',
            quantity: 1,
            unitPrice: Number(unitPrice),
            lineTotal: Number(lineTotal)
        }];
    }

    const subtotal = payload.subtotal !== undefined ? payload.subtotal : Math.round(payload.snapshot.total / 1.19);
    const iva = payload.iva !== undefined ? payload.iva : (payload.snapshot.total - subtotal);
    const receiver = payload.receiver || resolveReceiverForDte(queueItem.tipoDte, config, payload.customer);
    const certBlob = b64toBlob(certBase64, 'application/x-pkcs12');
    const cafBlob = new Blob([cafText], { type: 'text/xml' });

    const identificacionDte = {
        TipoDTE: queueItem.tipoDte,
        Folio: queueItem.folio,
        FechaEmision: new Date(queueItem.createdAt).toISOString().slice(0, 10),
        ...(isBoleta ? {
            IndicadorServicio: Number(config.indicadorServicio || DEFAULT_SII_EMISOR.indicadorServicio)
        } : {
            FormaPago: 1,
            FechaVencimiento: new Date(queueItem.createdAt).toISOString().slice(0, 10)
        })
    };

    const inputPayload = {
        Documento: {
            Encabezado: {
                IdentificacionDTE: identificacionDte,
                Emisor: {
                    Rut: config.rutEmisor,
                    ...(isBoleta ? {
                        RazonSocialBoleta: normalizeSiiString(config.razonSocial),
                        GiroBoleta: normalizeSiiString(config.giro).substring(0, 80)
                    } : {
                        RazonSocial: normalizeSiiString(config.razonSocial),
                        Giro: normalizeSiiString(config.giro).substring(0, 80),
                        ActividadEconomica: [Number(config.acteco || 0)]
                    }),
                    DireccionOrigen: normalizeSiiString(config.direccion),
                    ComunaOrigen: normalizeSiiString(config.comuna),
                    CiudadOrigen: normalizeSiiString(config.ciudad)
                },
                Receptor: {
                    Rut: receiver.rut,
                    RazonSocial: normalizeSiiString(receiver.razonSocial),
                    Direccion: normalizeSiiString(receiver.direccion),
                    Comuna: normalizeSiiString(receiver.comuna),
                    Ciudad: normalizeSiiString(receiver.ciudad || receiver.comuna),
                    ...(!isBoleta ? {
                        Giro: normalizeSiiString(receiver.giro || 'PARTICULAR').substring(0, 40)
                    } : {})
                },
                Totales: {
                    MontoNeto: subtotal,
                    ...(!isBoleta ? { TasaIVA: 19 } : {}),
                    IVA: iva,
                    MontoTotal: payload.snapshot.total
                }
            },
            Detalles: items.map((item) => ({
                IndicadorExento: 0,
                Nombre: item.name,
                Descripcion: item.name,
                Cantidad: item.quantity,
                UnidadMedida: 'un',
                Precio: Number(item.unitPrice.toFixed(4)),
                Descuento: 0,
                Recargo: 0,
                MontoItem: item.lineTotal
            })),
            Referencias: [],
            DescuentosRecargos: []
        },
        Certificado: {
            Rut: config.rutEmisor,
            Password: config.certPassword
        },
        Ambiente: config.siiAmbiente === '2' ? 1 : 0,
        Tipo: 1
    };

    const formData = new FormData();
    formData.append('file', certBlob, 'certificado.pfx');
    formData.append('password', config.certPassword);
    formData.append('caf', cafBlob, cafFilename);
    formData.append('input', JSON.stringify(inputPayload));

    let xmlContentString;
    let bufferDte;
    if (isBoleta) {
        const emisor = {
            rut: config.rutEmisor,
            razonSocial: config.razonSocial,
            giro: config.giro,
            direccion: config.direccion,
            comuna: config.comuna,
            ciudad: config.ciudad
        };
        const mappedDetalles = items.map((item) => ({
            nombre: item.name,
            descripcion: item.name,
            quantity: item.quantity,
            unidadMedida: 'un',
            precio: Number(item.unitPrice.toFixed(4)),
            montoItem: item.lineTotal
        }));
        const directResult = await window.cajeroAPI.directGenerateBoletaXml({
            emisor,
            receptor: receiver,
            detalles: mappedDetalles,
            folio: queueItem.folio,
            fechaEmis: new Date(queueItem.createdAt).toISOString().slice(0, 10),
            config
        });
        if (!directResult || !directResult.success) {
            throw new Error(`Error generando boleta nativa en cola: ${directResult?.error}`);
        }
        xmlContentString = directResult.xml;
    } else {
        const token = await getSimpleApiToken(config.apiKey);
        const generateResponse = await fetchWithTimeout('https://api.simpleapi.cl/api/v1/dte/generar', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
            timeout: 20000
        });

        const generateClone = generateResponse.clone();
        const generateText = await generateResponse.text();
        if (!generateResponse.ok) {
            throw new Error(`Error generando DTE (${generateResponse.status}): ${generateText}`);
        }

        bufferDte = await generateClone.arrayBuffer();
        xmlContentString = new TextDecoder('utf-8').decode(bufferDte);

        await window.cajeroAPI.saveXml({
            filename: `DTE_${queueItem.tipoDte}_Folio_${queueItem.folio}.xml`,
            data: xmlContentString,
            folder: queueItem.tipoDte === 39 ? 'boletas' : 'facturas'
        });
    }

    if (queueItem.saleId) {
        await requestBackendJson({
            endpoint: '/dte/guardar',
            method: 'POST',
            body: {
                id_venta: queueItem.saleId,
                tipoDte: Number(queueItem.tipoDte),
                folio: Number(queueItem.folio),
                xmlContenido: xmlContentString,
                trackId: null,
                estadoSii: 'GENERADO'
            }
        });
    }

    if (isBoleta) {
        appendBoletaToPendingEnvelope({
            folio: queueItem.folio,
            tipoDte: queueItem.tipoDte,
            xmlContent: xmlContentString
        });
    } else {
        const rutEnvia = config.rutEnvia || config.rutEmisor;
        const wrapPayload = {
            Certificado: {
                Rut: rutEnvia,
                Password: config.certPassword
            },
            Caratula: {
                RutEnvia: rutEnvia,
                RutEmisor: config.rutEmisor,
                RutReceptor: '60803000-K',
                NumeroResolucion: Number(config.resolucionNumero || DEFAULT_SII_EMISOR.resolucionNumero),
                FechaResolucion: config.resolucionFecha || DEFAULT_SII_EMISOR.resolucionFecha
            }
        };

        const wrapFormData = new FormData();
        wrapFormData.append('input', JSON.stringify(wrapPayload));
        wrapFormData.append('files', certBlob, 'certificado.pfx');
        wrapFormData.append('files', new Blob([bufferDte], { type: 'text/xml' }), 'dte.xml');

        const wrapResponse = await fetch('https://api.simpleapi.cl/api/v1/envio/generar', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: wrapFormData
        });

        const wrapBuffer = await wrapResponse.arrayBuffer();
        if (wrapResponse.ok) {
            const sendFormData = new FormData();
            sendFormData.append('input', JSON.stringify({
                Tipo: 1,
                Ambiente: config.siiAmbiente === '2' ? 1 : 0,
                Certificado: {
                    Rut: rutEnvia,
                    Password: config.certPassword
                }
            }));
            sendFormData.append('files', certBlob, 'certificado.pfx');
            sendFormData.append('files', new Blob([wrapBuffer], { type: 'text/xml' }), 'envio.xml');

            const sendResponse = await fetch('https://api.simpleapi.cl/api/v1/envio/enviar', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: sendFormData
            });

            const sendText = await sendResponse.text();
            if (sendResponse.ok) {
                let sendPayload = JSON.parse(sendText);
                if (queueItem.saleId && (sendPayload?.TrackId || sendPayload?.trackId)) {
                    await requestBackendJson({
                        endpoint: '/dte/guardar',
                        method: 'POST',
                        body: {
                            id_venta: queueItem.saleId,
                            tipoDte: Number(queueItem.tipoDte),
                            folio: Number(queueItem.folio),
                            xmlContenido: xmlContentString,
                            trackId: sendPayload?.TrackId || sendPayload?.trackId || null,
                            estadoSii: 'ENVIADO_SII'
                        }
                    });
                }
            }
        }
    }
}

async function checkSimpleApiStatus() {
    const dot = document.getElementById('simpleapi-status-dot');
    const text = document.getElementById('simpleapi-status-text');
    const card = document.getElementById('simpleapi-status-card');
    if (!dot || !text) return;

    dot.style.backgroundColor = '#9ca3af';
    dot.style.boxShadow = '0 0 8px #9ca3af';
    text.textContent = 'Verificando SII...';
    text.style.color = '#9ca3af';
    if (card) {
        card.className = 'api-status-card';
    }

    try {
        const config = {
            ...DEFAULT_SII_EMISOR,
            ...(await window.cajeroAPI.getSiiConfig())
        };

        const connResult = await window.cajeroAPI.checkSiiConnection({ config });
        if (!connResult || !connResult.success) {
            throw new Error(connResult?.error || 'No se pudo conectar directamente con el SII');
        }

        if (card) {
            card.className = 'api-status-card status-online';
        }
        dot.style.backgroundColor = '#12b76a';
        dot.style.boxShadow = '0 0 8px #12b76a';
        text.textContent = 'SII Conexión Directa';
        text.style.color = '#12b76a';
        return true;
    } catch (e) {
        if (card) {
            card.className = 'api-status-card status-offline';
        }
        dot.style.backgroundColor = '#f04438';
        dot.style.boxShadow = '0 0 8px #f04438';
        text.textContent = 'SII Fuera de Servicio';
        text.style.color = '#f04438';
        return false;
    }
}

function renderDteQueueView() {
    const body = document.getElementById('dte-queue-table-body');
    if (!body) return;

    const queue = getDteQueue();

    if (!queue.length) {
        body.innerHTML = `
            <tr>
                <td colspan="6" style="padding: 2.5rem; text-align: center; color: var(--text-soft); font-weight: 500;">
                    No hay boletas pendientes de envío.
                </td>
            </tr>
        `;
        return;
    }

    body.innerHTML = queue.map(item => {
        const isBoleta = Number(item.tipoDte) === 39 || Number(item.tipoDte) === 41;
        const tipoLabel = isBoleta
            ? `<span class="dte-type-badge type-boleta"><i class="bi bi-receipt"></i> Boleta</span>`
            : `<span class="dte-type-badge type-factura"><i class="bi bi-file-earmark-text"></i> Factura</span>`;
        const formattedTotal = item.payload?.snapshot?.total 
            ? `$${formatCurrency(item.payload.snapshot.total)}`
            : 'N/A';
        const dateLabel = formatDateTime(item.createdAt);

        return `
            <tr>
                <td><span class="sale-id-badge">#${item.saleId || 'Sin ID'}</span></td>
                <td>${tipoLabel}</td>
                <td><strong>${item.folio}</strong></td>
                <td><span class="dte-amount">${formattedTotal}</span></td>
                <td style="color: var(--text-soft); font-weight: 500;">${dateLabel}</td>
                <td style="text-align: right;">
                    <button class="btn-action-retry" onclick="processQueueItemManual('${item.id}')">
                        <i class="bi bi-play-fill"></i> Reintentar
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

window.processQueueItemManual = async function(id) {
    const queue = getDteQueue();
    const item = queue.find(x => x.id === id);
    if (!item) return;

    showNotification({
        type: 'info',
        message: `Reintentando firma del Folio ${item.folio}...`
    });

    try {
        await processQueuedDte(item);
        lastSimpleApiSuccess = true;
        void checkSimpleApiStatus();
        removeDteFromQueue(id);
        showNotification({
            type: 'success',
            message: `Folio ${item.folio} firmado y enviado exitosamente.`
        });
    } catch (error) {
        lastSimpleApiSuccess = false;
        void checkSimpleApiStatus();
        console.error('Error re-processing DTE:', error);
        showNotification({
            type: 'error',
            message: `Error al firmar Folio ${item.folio}: ${error.message}`
        });
    }
};

function startDteQueueWorker() {
    const INTERVAL_MS = 15 * 60 * 1000; // Revisar cada 15 minutos
    setTimeout(processDteQueueBackground, 15 * 1000);
    setInterval(processDteQueueBackground, INTERVAL_MS);

    window.addEventListener('online', () => {
        console.log('[Network] Conexión restaurada. Revisando cola de DTEs offline...');
        setTimeout(processDteQueueBackground, 5000);
    });
}

async function processDteQueueBackground() {
    const queue = getDteQueue();
    if (!queue.length) return;

    console.log(`[DTE Queue Worker] Starting processing of ${queue.length} pending DTEs.`);
    
    const isOnline = await checkSimpleApiStatus();
    if (!isOnline) {
        console.log('[DTE Queue Worker] SII is offline. Postponing queue processing.');
        return;
    }

    for (const item of queue) {
        try {
            console.log(`[DTE Queue Worker] Processing Folio ${item.folio} (Sale #${item.saleId}).`);
            await processQueuedDte(item);
            lastSimpleApiSuccess = true;
            void checkSimpleApiStatus();
            
            let currentQueue = getDteQueue();
            currentQueue = currentQueue.filter(x => x.id !== item.id);
            saveDteQueue(currentQueue);
            
            console.log(`[DTE Queue Worker] Folio ${item.folio} processed successfully.`);
        } catch (error) {
            lastSimpleApiSuccess = false;
            void checkSimpleApiStatus();
            console.error(`[DTE Queue Worker] Error processing Folio ${item.folio}:`, error);
            break;
        }
    }
    
    // Si se procesaron boletas, despachar el sobre inmediatamente
    if (boletaEnvelopeState && boletaEnvelopeState.items.length > 0) {
        console.log(`[DTE Queue Worker] Flushing boleta envelope with ${boletaEnvelopeState.items.length} recovered items.`);
        try {
            await forceSendPendingBoletaEnvelope({ reason: 'Reconexión automática (Offline Queue)', notifyUser: false });
        } catch (e) {
            console.error('[DTE Queue Worker] Error flushing envelope after queue:', e);
        }
    }
    
    if (document.getElementById('settings-tab-pending-dtes')?.classList.contains('active')) {
        renderDteQueueView();
    }
}

function bindDteQueueSettings() {
    const checkBtn = document.getElementById('simpleapi-check-status-btn');
    const retryAllBtn = document.getElementById('dte-queue-retry-all-btn');
    const clearBtn = document.getElementById('dte-queue-clear-btn');

    if (checkBtn) {
        checkBtn.addEventListener('click', async () => {
            showNotification({ type: 'info', message: 'Verificando estado de la conexión al SII...' });
            lastSimpleApiSuccess = true;
            await checkSimpleApiStatus();
        });
    }

    if (retryAllBtn) {
        retryAllBtn.addEventListener('click', async () => {
            const queue = getDteQueue();
            if (!queue.length) {
                showNotification({ type: 'info', message: 'No hay boletas en cola.' });
                return;
            }
            showNotification({ type: 'info', message: 'Reintentando enviar todas las boletas de la cola...' });
            retryAllBtn.disabled = true;
            retryAllBtn.textContent = 'Procesando...';
            try {
                await processDteQueueBackground();
                showNotification({ type: 'success', message: 'Procesamiento de cola finalizado.' });
            } catch (err) {
                showNotification({ type: 'error', message: 'Hubo un error al reintentar: ' + err.message });
            } finally {
                retryAllBtn.disabled = false;
                retryAllBtn.textContent = 'Reintentar Envío de Todo';
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (confirm('¿Está seguro de que desea limpiar la cola de DTEs pendientes? Esto eliminará los registros de reenvío automático.')) {
                saveDteQueue([]);
                renderDteQueueView();
                showNotification({ type: 'info', message: 'Cola de DTEs limpiada.' });
            }
        });
    }
}
