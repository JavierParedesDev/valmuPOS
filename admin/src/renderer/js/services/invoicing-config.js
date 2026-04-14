window.ValmuInvoicingConfig = {
    getLocalConfig(currentConfig = {}) {
        let storedConfig = {};

        try {
            storedConfig = JSON.parse(localStorage.getItem('sii_config') || '{}');
        } catch (error) {
            console.warn('Could not parse sii_config from localStorage:', error);
        }

        return {
            ...storedConfig,
            ...(currentConfig || {})
        };
    },

    buildConfigFromDom(currentConfig = {}) {
        const readTrimmedValue = (id) => String(document.getElementById(id)?.value || '').trim();
        const readNumberValue = (id, fallback) => parseInt(document.getElementById(id)?.value, 10) || fallback;

        return {
            ...(currentConfig || {}),
            rutEmisor: readTrimmedValue('conf-rut-emisor'),
            rutEnvia: readTrimmedValue('conf-rut-envia'),
            razonSocial: readTrimmedValue('conf-razon-social'),
            direccion: readTrimmedValue('conf-direccion'),
            email: readTrimmedValue('conf-email'),
            telefono: readTrimmedValue('conf-fono'),
            apiKey: readTrimmedValue('conf-api-key'),
            certPassword: readTrimmedValue('conf-cert-pass'),
            folio_33: readNumberValue('conf-folio-33', 1),
            folio_39: readNumberValue('conf-folio-39', 1),
            folio_61: readNumberValue('conf-folio-61', 1),
            folio_56: readNumberValue('conf-folio-56', 1),
            folio_final_33: readNumberValue('conf-folio-final-33', 0),
            folio_final_39: readNumberValue('conf-folio-final-39', 0),
            folio_final_61: readNumberValue('conf-folio-final-61', 0),
            folio_final_56: readNumberValue('conf-folio-final-56', 0)
        };
    },

    persistLocalConfig(config) {
        localStorage.setItem('sii_config', JSON.stringify(config || {}));
        return config || {};
    },

    async load({ electronAPI, onLoaded } = {}) {
        try {
            const config = await electronAPI.getSiiConfig();
            const loadedConfig = config || {};
            this.persistLocalConfig(loadedConfig);
            onLoaded?.(loadedConfig);
            return loadedConfig;
        } catch (error) {
            console.error('Failed to load local config:', error);
            return {};
        }
    },

    async save({ electronAPI, api, currentConfig, onSaved, SwalRef } = {}) {
        try {
            const config = this.buildConfigFromDom(currentConfig);
            const result = await electronAPI.saveSiiConfig(config);

            if (result?.success) {
                this.persistLocalConfig(config);
                onSaved?.(config);

                api?.saveSiiSettings?.(config).catch((syncError) => {
                    console.warn('Background SII settings sync failed:', syncError);
                });

                if (SwalRef) {
                    SwalRef.fire('Exito', 'Configuracion guardada localmente en sii_data', 'success');
                } else {
                    alert('Configuracion guardada localmente');
                }
            }

            return result;
        } catch (error) {
            console.error(error);
            if (SwalRef) {
                SwalRef.fire('Error', 'No se pudo guardar la configuracion', 'error');
            }
            return { success: false, error: error?.message || 'save_failed' };
        }
    },

    checkFolioLimit(tipo, toast) {
        const config = this.getLocalConfig();
        const current = parseInt(config[`folio_${tipo}`], 10) || 0;
        const max = parseInt(config[`folio_final_${tipo}`], 10) || 0;

        if (max > 0) {
            const remaining = max - current + 1;

            if (current > max) {
                alert(`FOLIOS AGOTADOS (Tipo ${tipo})\n\nEl folio actual (${current}) excede el maximo permitido (${max}).\n\nPor favor obtenga e instale un nuevo CAF.`);
                return false;
            }

            if (remaining <= 10) {
                toast?.show?.(`Quedan ${remaining} folios disponibles para Tipo ${tipo}`, 'warning');
            }
        }

        return true;
    }
};
