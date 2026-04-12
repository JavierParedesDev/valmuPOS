window.ValmuInvoicingFolios = {
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
            const settings = await api.getSiiSettings();
            if (!settings) {
                return null;
            }

            const configService = window.ValmuInvoicingConfig;
            const localConfig = configService.getLocalConfig(currentConfig);
            const backendFolio = parseInt(settings[`folio_${target.tipoDTE}`], 10) || 0;
            const localFolio = parseInt(localConfig[`folio_${target.tipoDTE}`], 10) || this.getFallbackFolio(target.tipoDTE);
            const nextFolio = Math.max(backendFolio, localFolio);

            if (localFolio !== nextFolio) {
                const updatedConfig = {
                    ...localConfig,
                    [`folio_${target.tipoDTE}`]: nextFolio
                };
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
            const token = await getBearerToken();
            const configService = window.ValmuInvoicingConfig;
            const config = configService.getLocalConfig(currentConfig);
            const history = [];
            console.log('Sincronizacion de historial del servidor omitida (404)');

            for (const type of [33, 39]) {
                let current = parseInt(config[`folio_${type}`], 10) || 1;

                try {
                    const emisorRut = String(config.rutEmisor || '').replace(/\./g, '');
                    const ultimoUrl = `https://api.simpleapi.cl/api/v1/documentos/ultimo/${emisorRut}/${type}/0`;
                    const ultimoRes = await fetch(ultimoUrl, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    if (ultimoRes.ok) {
                        const lastFolio = parseInt(await ultimoRes.text(), 10) || 0;
                        if (lastFolio >= current) {
                            current = lastFolio + 1;
                            console.log(`Tipo ${type}: SimpleAPI (/ultimo) sugiere empezar desde folio ${current}`);
                        }
                    }
                } catch (error) {
                    console.error('Error consultando /ultimo:', error);
                }

                const maxInHistory = history
                    .filter((entry) => entry.doc_type == type || entry.doc_type == String(type))
                    .reduce((max, entry) => Math.max(max, parseInt(entry.folio, 10) || 0), 0);

                if (maxInHistory >= current) {
                    current = maxInHistory + 1;
                    console.log(`Tipo ${type}: Historial sugiere empezar desde folio ${current}`);
                }

                toast?.show?.(`Sincronizando ${type} (Demo)...`, 'info');
                config[`folio_${type}`] = current;
                toast?.show?.(`Folio ${type} sincronizado en: ${current}`, 'success');
            }

            configService.persistLocalConfig(config);
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
