export function showAppViewLayout(view) {
    const cashierApp = document.getElementById('cashier-app');
    const saleView = document.getElementById('sale-view');
    const dispatchView = document.getElementById('dispatch-view');
    const cashView = document.getElementById('cash-view');
    const settingsView = document.getElementById('settings-view');
    const saleButton = document.getElementById('nav-sale-btn');
    const dispatchButton = document.getElementById('nav-dispatch-btn');
    const cashButton = document.getElementById('nav-cash-btn');
    const settingsButton = document.getElementById('nav-settings-btn');
    const headerKicker = document.getElementById('app-header-kicker');
    const headerTitle = document.getElementById('app-header-title');

    const isSaleView = view === 'sale';
    const isDispatchView = view === 'dispatch';
    const isCashView = view === 'cash';
    const isSettingsView = view === 'settings';

    if (cashierApp) {
        cashierApp.dataset.view = view;
    }

    saleView?.classList.toggle('hidden', !(isSaleView || isDispatchView));
    dispatchView?.classList.add('hidden');
    cashView?.classList.toggle('hidden', !isCashView);
    settingsView?.classList.toggle('hidden', !isSettingsView);
    saleButton?.classList.toggle('active', isSaleView);
    dispatchButton?.classList.toggle('active', isDispatchView);
    cashButton?.classList.toggle('active', isCashView);
    settingsButton?.classList.toggle('active', isSettingsView);

    if (headerKicker && headerTitle) {
        if (isDispatchView) {
            headerKicker.textContent = 'Operacion';
            headerTitle.textContent = 'Despachos';
        } else if (isCashView) {
            headerKicker.textContent = 'Turno';
            headerTitle.textContent = 'Caja';
        } else if (isSettingsView) {
            headerKicker.textContent = 'Sistema';
            headerTitle.textContent = 'Ajustes';
        } else {
            headerKicker.textContent = 'Caja';
            headerTitle.textContent = 'Vender';
        }
    }
}

export function showLoginScreenView() {
    document.getElementById('login-screen')?.classList.remove('hidden');
    document.getElementById('cashier-app')?.classList.add('hidden');
}

export function showCashierAppView() {
    document.getElementById('login-screen')?.classList.add('hidden');
    document.getElementById('cashier-app')?.classList.remove('hidden');
}

export function setLoginStatusView(message) {
    const statusLabel = document.getElementById('login-status');
    if (statusLabel) {
        statusLabel.textContent = message;
    }
}

export function hydrateVersionView(version) {
    const versionLabel = document.getElementById('app-version-label');
    const settingsVersionLabel = document.getElementById('settings-version-label');

    if (versionLabel && version) {
        versionLabel.textContent = `v${version}`;
    }

    if (settingsVersionLabel && version) {
        settingsVersionLabel.textContent = `v${version}`;
    }
}
