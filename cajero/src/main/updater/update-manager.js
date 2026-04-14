function createUpdateManager({ app, getMainWindow, sendToWindow }) {
    const { autoUpdater } = require('electron-updater');
    const updateState = {
        currentVersion: app.getVersion(),
        latestVersion: null,
        releaseNotes: '',
        status: 'idle',
        statusMessage: 'Aun no se ha comprobado si hay actualizaciones.',
        errorMessage: '',
        downloadReady: false,
        checkedAt: null,
        downloadProgress: 0
    };

    function serializeUpdateState() {
        return { ...updateState };
    }

    function emitUpdateState() {
        const payload = serializeUpdateState();

        if (typeof sendToWindow === 'function') {
            sendToWindow('update:state-changed', payload);
            return;
        }

        const mainWindow = getMainWindow?.();
        if (!mainWindow || mainWindow.isDestroyed()) {
            return;
        }

        mainWindow.webContents.send('update:state-changed', payload);
    }

    function setUpdateState(patch) {
        Object.assign(updateState, patch);
        emitUpdateState();
    }

    function normalizeReleaseNotes(releaseNotes) {
        if (!releaseNotes) {
            return '';
        }

        if (Array.isArray(releaseNotes)) {
            return releaseNotes
                .map((entry) => entry?.note || entry?.releaseNotes || '')
                .filter(Boolean)
                .join('\n\n');
        }

        return String(releaseNotes).trim();
    }

    function getFriendlyUpdateError(error) {
        const message = error?.message || 'Error desconocido al comprobar actualizaciones.';

        if (message.includes('releases.atom') && message.includes('404')) {
            return 'Aun no hay una release publicada para autoactualizacion en GitHub.';
        }

        if (message.includes('net::ERR_INTERNET_DISCONNECTED')) {
            return 'No hay conexion a internet para revisar actualizaciones.';
        }

        if (message.includes('net::ERR_NAME_NOT_RESOLVED')) {
            return 'No se pudo resolver el servidor de actualizaciones.';
        }

        if (message.includes('401') || message.includes('403')) {
            return 'La app no tiene permiso para consultar las releases publicadas.';
        }

        return message;
    }

    async function checkForUpdates(isManual = false) {
        if (!app.isPackaged) {
            setUpdateState({
                status: 'development',
                statusMessage: 'Las actualizaciones automaticas solo funcionan en la app instalada.',
                errorMessage: '',
                checkedAt: new Date().toISOString(),
                downloadReady: false
            });
            return serializeUpdateState();
        }

        setUpdateState({
            status: 'checking',
            statusMessage: isManual ? 'Buscando nuevas versiones...' : 'Comprobando actualizaciones en segundo plano...',
            errorMessage: '',
            checkedAt: new Date().toISOString(),
            downloadReady: false
        });

        try {
            const result = await autoUpdater.checkForUpdates();
            const updateInfo = result?.updateInfo;

            if (updateInfo) {
                setUpdateState({
                    latestVersion: updateInfo.version || updateState.latestVersion,
                    releaseNotes: normalizeReleaseNotes(updateInfo.releaseNotes),
                    checkedAt: new Date().toISOString()
                });
            }

            return serializeUpdateState();
        } catch (error) {
            console.error('Check for updates failed:', error);
            setUpdateState({
                status: 'error',
                statusMessage: 'No se pudo comprobar si hay actualizaciones.',
                errorMessage: getFriendlyUpdateError(error),
                checkedAt: new Date().toISOString(),
                downloadReady: false
            });
            return serializeUpdateState();
        }
    }

    async function downloadUpdate() {
        if (!app.isPackaged) {
            setUpdateState({
                status: 'development',
                statusMessage: 'Las actualizaciones automaticas solo funcionan en la app instalada.',
                errorMessage: '',
                checkedAt: new Date().toISOString(),
                downloadReady: false
            });
            return serializeUpdateState();
        }

        setUpdateState({
            status: 'downloading',
            statusMessage: 'Descargando actualizacion...',
            errorMessage: '',
            checkedAt: new Date().toISOString(),
            downloadReady: false
        });

        try {
            await autoUpdater.downloadUpdate();
            return serializeUpdateState();
        } catch (error) {
            console.error('Download update failed:', error);
            setUpdateState({
                status: 'error',
                statusMessage: 'No se pudo descargar la actualizacion.',
                errorMessage: getFriendlyUpdateError(error),
                checkedAt: new Date().toISOString(),
                downloadReady: false
            });
            return serializeUpdateState();
        }
    }

    function installUpdate() {
        autoUpdater.quitAndInstall(true, true);
        return true;
    }

    function initialize() {
        if (!app.isPackaged) {
            return;
        }

        autoUpdater.autoDownload = false;
        autoUpdater.autoInstallOnAppQuit = true;

        autoUpdater.on('error', (error) => {
            console.error('Auto-update error:', error);
            setUpdateState({
                status: 'error',
                statusMessage: 'No se pudo completar la actualizacion.',
                errorMessage: getFriendlyUpdateError(error),
                checkedAt: new Date().toISOString(),
                downloadReady: false
            });
        });

        autoUpdater.on('update-available', (info) => {
            setUpdateState({
                status: 'available',
                statusMessage: 'Hay una nueva version disponible lista para descargar.',
                latestVersion: info?.version || updateState.latestVersion,
                releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
                errorMessage: '',
                checkedAt: new Date().toISOString(),
                downloadReady: false
            });
        });

        autoUpdater.on('update-not-available', (info) => {
            setUpdateState({
                status: 'up-to-date',
                statusMessage: 'Ya tienes instalada la ultima version disponible.',
                latestVersion: info?.version || updateState.currentVersion,
                releaseNotes: normalizeReleaseNotes(info?.releaseNotes),
                errorMessage: '',
                checkedAt: new Date().toISOString(),
                downloadReady: false,
                downloadProgress: 0
            });
        });

        autoUpdater.on('download-progress', (progress) => {
            setUpdateState({
                status: 'downloading',
                statusMessage: `Descargando actualizacion: ${Math.round(progress.percent || 0)}%`,
                errorMessage: '',
                checkedAt: new Date().toISOString(),
                downloadReady: false,
                downloadProgress: Math.round(progress.percent || 0)
            });
        });

        autoUpdater.on('update-downloaded', (info) => {
            setUpdateState({
                status: 'downloaded',
                statusMessage: 'La nueva version ya esta lista para instalar.',
                latestVersion: info?.version || updateState.latestVersion,
                releaseNotes: normalizeReleaseNotes(info?.releaseNotes) || updateState.releaseNotes,
                errorMessage: '',
                checkedAt: new Date().toISOString(),
                downloadReady: true,
                downloadProgress: 100
            });
        });

        setTimeout(() => {
            checkForUpdates(false);
        }, 3000);
    }

    return {
        getUpdateState: serializeUpdateState,
        checkForUpdates,
        downloadUpdate,
        installUpdate,
        initialize,
        sendStateToWindow: emitUpdateState
    };
}

module.exports = {
    createUpdateManager
};
