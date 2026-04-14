window.ValmuInvoicingFolios = {
    getBackendNextFolio(controls, tipoDTE) {
        const match = (Array.isArray(controls) ? controls : []).find((row) => String(row.tipoDte) === String(tipoDTE));
        if (!match) {
            return null;
        }

        return {
            current: (parseInt(match.ultimoFolioUsado, 10) || 0) + 1,
            max: parseInt(match.folioDisponibleHasta, 10) || 0,
            idTipoDoc: parseInt(match.id_tipoDoc, 10) || 0
        };
    },

    getFallbackFolio(tipoDTE) {
        return String(tipoDTE) === '61' ? 41 : 1;
    },

    getLocalNextFolio(tipoDTE, currentConfig = {}) {
        const configService = window.ValmuInvoicingConfig;
        const config = configService.getLocalConfig(currentConfig);
        return parseInt(config[`folio_${tipoDTE}`], 10) || this.getFallbackFolio(tipoDTE);
    },

    async fetchLastFolio({ tipoDTE, currentConfig, inputId = 'dte-folio' } = {}) {
        const folioInput = document.getElementById(inputId);
        if (!folioInput) {
            return this.getFallbackFolio(tipoDTE);
        }

        try {
            const currentFolio = this.getLocalNextFolio(tipoDTE, currentConfig);
            folioInput.value = currentFolio;
            return currentFolio;
        } catch (error) {
            console.error('Error al leer folio de config:', error);
            folioInput.value = this.getFallbackFolio(tipoDTE);
            return this.getFallbackFolio(tipoDTE);
        } finally {
            folioInput.disabled = false;
        }
    },

    resolvePollTarget(activeTab) {
        if (activeTab === 'create') {
            return {
                tipoDTE: document.getElementById('dte-tipo')?.value || 33,
                inputId: 'dte-folio'
            };
        }

        if (activeTab === 'note') {
            return {
                tipoDTE: 61,
                inputId: 'nc-folio-display'
            };
        }

        if (activeTab === 'debit') {
            return {
                tipoDTE: 56,
                inputId: 'nd-folio-display'
            };
        }

        return null;
    },

    async poll({ activeTab, currentConfig, api, onConfigUpdated } = {}) {
        const target = this.resolvePollTarget(activeTab);
        if (!target) {
            return null;
        }

        const folioInput = document.getElementById(target.inputId);

        try {
            const controls = await api.getFoliosControl?.();
            const backend = this.getBackendNextFolio(controls, target.tipoDTE);
            if (!backend) {
                return null;
            }

            const configService = window.ValmuInvoicingConfig;
            const localConfig = configService.getLocalConfig(currentConfig);
            const backendFolio = parseInt(backend.current, 10) || 0;
            const localFolio = parseInt(localConfig[`folio_${target.tipoDTE}`], 10) || this.getFallbackFolio(target.tipoDTE);
            const nextFolio = Math.max(backendFolio, localFolio);

            const updatedConfig = {
                ...localConfig,
                [`folio_${target.tipoDTE}`]: nextFolio
            };

            if (backend.max > 0) {
                updatedConfig[`folio_final_${target.tipoDTE}`] = backend.max;
            }

            if (localFolio !== nextFolio || (backend.max > 0 && parseInt(localConfig[`folio_final_${target.tipoDTE}`], 10) !== backend.max)) {
                configService.persistLocalConfig(updatedConfig);
                onConfigUpdated?.(updatedConfig);
            }

            if (folioInput && document.activeElement !== folioInput) {
                const currentValue = parseInt(folioInput.value, 10);
                if (currentValue !== nextFolio) {
                    folioInput.value = nextFolio;
                    console.log(`Folio Auto-Updated to ${nextFolio}`);
                }
            }

            return nextFolio;
        } catch (error) {
            console.warn('Polling Error:', error);
            return null;
        }
    },

    async sync({ button, getBearerToken, currentConfig, loadConfig, api, toast } = {}) {
        const originalContent = button?.innerHTML || '';
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sincronizando...';
        }

        try {
            const configService = window.ValmuInvoicingConfig;
            const config = configService.getLocalConfig(currentConfig);
            const controls = await api?.getFoliosControl?.();
            const syncedTypes = [];

            for (const type of [33, 39, 61, 56]) {
                const backend = this.getBackendNextFolio(controls, type);
                if (!backend) {
                    continue;
                }

                config[`folio_${type}`] = backend.current;
                if (backend.max > 0) {
                    config[`folio_final_${type}`] = backend.max;
                }
                syncedTypes.push(type);
                toast?.show?.(`Folio ${type} sincronizado en: ${backend.current}`, 'success');
            }

            if (!syncedTypes.length) {
                throw new Error('El backend no devolvio tipos de documento compatibles');
            }

            configService.persistLocalConfig(config);
            await api?.saveSiiSettings?.(config);
            await loadConfig?.();
            toast?.show?.('Sincronizacion completada', 'success');
            return config;
        } catch (error) {
            console.error('Sync Error:', error);
            toast?.show?.('Error en la sincronizacion', 'error');
            return null;
        } finally {
            if (button) {
                button.disabled = false;
                button.innerHTML = originalContent;
            }
        }
    }
};
