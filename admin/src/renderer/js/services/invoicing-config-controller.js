window.ValmuInvoicingConfigController = {
    async updateStatusBadge({ electronAPI, type, elementId } = {}) {
        const element = document.getElementById(elementId);
        if (!element) {
            return;
        }

        const config = await electronAPI.getSiiConfig();
        const exists = type === 'cert'
            ? !!config.certFilename
            : !!config[`caf_${type}_filename`];

        if (exists) {
            element.innerHTML = '<i class="fas fa-check bg-green-500 text-white rounded-full p-1 text-xs"></i> INSTALADO';
            element.className = 'text-xs font-bold text-green-700 bg-green-100 p-2 rounded border border-green-200 text-center';
            return;
        }

        element.innerHTML = '<i class="fas fa-times bg-red-500 text-white rounded-full p-1 text-xs"></i> FALTANTE';
        element.className = 'text-xs font-bold text-red-700 bg-red-100 p-2 rounded border border-red-200 text-center';
    },

    async refreshStatuses({ electronAPI } = {}) {
        await Promise.all([
            this.updateStatusBadge({ electronAPI, type: 'cert', elementId: 'status-cert' }),
            this.updateStatusBadge({ electronAPI, type: 33, elementId: 'status-caf33' }),
            this.updateStatusBadge({ electronAPI, type: 39, elementId: 'status-caf39' }),
            this.updateStatusBadge({ electronAPI, type: 61, elementId: 'status-caf61' }),
            this.updateStatusBadge({ electronAPI, type: 56, elementId: 'status-caf56' })
        ]);
    },

    bindAutoSave({ saveConfig } = {}) {
        const autoSaveIds = [
            'conf-folio-33',
            'conf-folio-39',
            'conf-folio-61',
            'conf-folio-56',
            'conf-folio-final-33',
            'conf-folio-final-39',
            'conf-folio-final-61',
            'conf-folio-final-56',
            'conf-api-key'
        ];

        autoSaveIds.forEach((id) => {
            document.getElementById(id)?.addEventListener('change', () => saveConfig?.());
        });
    },

    async installFile({ type, electronAPI, onConfigUpdated, SwalRef } = {}) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = type === 'cert' ? '.p12,.pfx' : '.xml';

        input.onchange = async (event) => {
            const file = event.target.files?.[0];
            if (!file) {
                return;
            }

            const reader = new FileReader();
            reader.onload = async () => {
                const base64 = reader.result;
                const fixedName = type === 'cert' ? 'certificado.pfx' : `CAF_${type}.xml`;
                const result = await electronAPI.uploadSiiFile(type, fixedName, base64);

                if (!result?.success) {
                    SwalRef?.fire('Error', result?.error || 'No se pudo guardar el archivo', 'error');
                    return;
                }

                const currentConfig = await electronAPI.getSiiConfig();
                if (type === 'cert') {
                    currentConfig.certFilename = fixedName;
                } else {
                    currentConfig[`caf_${type}_filename`] = fixedName;
                }

                await electronAPI.saveSiiConfig(currentConfig);
                onConfigUpdated?.(currentConfig);
                SwalRef?.fire('Exito', `Archivo ${fixedName} guardado correctamente`, 'success');
                await this.refreshStatuses({ electronAPI });
            };

            reader.readAsDataURL(file);
        };

        input.click();
    },

    bindInstallButtons({ electronAPI, onConfigUpdated, SwalRef } = {}) {
        document.getElementById('btn-update-cert')?.addEventListener('click', () => {
            this.installFile({ type: 'cert', electronAPI, onConfigUpdated, SwalRef });
        });

        [33, 39, 61, 56].forEach((type) => {
            document.getElementById(`btn-update-caf${type}`)?.addEventListener('click', () => {
                this.installFile({ type, electronAPI, onConfigUpdated, SwalRef });
            });
        });
    },

    async bind({ electronAPI, saveConfig, syncFolios, reserveFolio, onConfigUpdated, SwalRef } = {}) {
        document.getElementById('btn-save-config')?.addEventListener('click', () => saveConfig?.());
        document.getElementById('btn-sync-folios')?.addEventListener('click', () => syncFolios?.());
        document.getElementById('btn-reserve-folio')?.addEventListener('click', () => reserveFolio?.());

        this.bindAutoSave({ saveConfig });
        this.bindInstallButtons({ electronAPI, onConfigUpdated, SwalRef });
        await this.refreshStatuses({ electronAPI });
    }
};
