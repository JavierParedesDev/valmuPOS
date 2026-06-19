window.ValmuInvoicingHistoryView = {
    getFilterOptions() {
        return [
            { value: 'all', label: 'Todos' },
            { value: 'facturas', label: 'Facturas' },
            { value: 'boletas', label: 'Boletas' },
            { value: 'notas_de_credito', label: 'Notas de Credito' },
            { value: 'notas_de_debito', label: 'Notas de Debito' }
        ];
    },

    bindFilterDropdown(currentFilter = 'all') {
        const trigger = document.getElementById('history-filter-trigger');
        const menu = document.getElementById('history-filter-menu');
        const label = document.getElementById('history-filter-label');

        if (!trigger || !menu || !label) {
            return;
        }

        const optionMap = new Map(this.getFilterOptions().map((option) => [option.value, option.label]));
        const closeMenu = () => {
            menu.classList.add('hidden');
            trigger.setAttribute('aria-expanded', 'false');
        };

        const openMenu = () => {
            menu.classList.remove('hidden');
            trigger.setAttribute('aria-expanded', 'true');
        };

        label.textContent = optionMap.get(currentFilter) || 'Todos';

        trigger.addEventListener('click', (event) => {
            event.stopPropagation();
            const isHidden = menu.classList.contains('hidden');
            if (isHidden) {
                openMenu();
            } else {
                closeMenu();
            }
        });

        menu.querySelectorAll('[data-history-filter]').forEach((optionButton) => {
            optionButton.addEventListener('click', (event) => {
                event.stopPropagation();
                const nextFilter = optionButton.dataset.historyFilter;
                label.textContent = optionMap.get(nextFilter) || 'Todos';
                closeMenu();
                window.invoicePage?.setHistoryFilter?.(nextFilter);
            });
        });

        document.addEventListener('click', closeMenu, { once: true });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closeMenu();
            }
        }, { once: true });
    },

    render({ historyData, currentFilter = 'all', searchTerm = '' } = {}) {
        if (!historyData) {
            return `
                <div class="flex flex-col items-center justify-center p-20 text-gray-400 animate-pulse">
                    <div class="h-16 w-16 border-4 border-orange-100 border-t-orange-600 rounded-full animate-spin mb-4"></div>
                    <p class="font-black text-xs uppercase tracking-widest">Sincronizando Historial...</p>
                </div>
            `;
        }

        return `
            <div class="space-y-6 animate-fade-in">
                <div class="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
                    <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                        <div class="max-w-md">
                            <div class="text-[10px] font-bold uppercase tracking-widest text-orange-500 mb-1">Historial DTE</div>
                            <h3 class="text-xl font-bold text-gray-900 tracking-tight leading-none">Expediente de Documentos</h3>
                            <p class="text-gray-500 text-xs font-medium mt-1.5">Consulta y filtra los documentos emitidos desde una sola vista.</p>
                        </div>

                        <div class="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center w-full xl:w-auto xl:max-w-[760px]">
                            <div class="relative w-full md:w-80 group">
                                <i class="bi bi-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-500 transition-colors"></i>
                                <input type="text" id="history-search" 
                                    value="${searchTerm}"
                                    oninput="window.invoicePage.handleSearch(this.value)" 
                                    placeholder="Folio, RUT o Fecha..." 
                                    class="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-semibold shadow-sm focus:border-orange-500 outline-none transition-all focus:ring-4 focus:ring-orange-100/40 text-gray-800 placeholder-gray-400">
                            </div>

                            <div class="relative min-w-[220px]">
                                <div class="absolute left-4 top-2 text-[9px] font-bold uppercase tracking-wider text-gray-400 pointer-events-none">Filtrar por</div>
                                <button
                                    id="history-filter-trigger"
                                    type="button"
                                    aria-haspopup="listbox"
                                    aria-expanded="false"
                                    class="w-full bg-white border border-gray-200 rounded-2xl pl-4 pr-11 pt-6 pb-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-gray-700 shadow-sm outline-none transition-all hover:border-orange-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100/40"
                                >
                                    <span id="history-filter-label">${this.getFilterOptions().find((option) => option.value === currentFilter)?.label || 'Todos'}</span>
                                </button>
                                <i class="bi bi-chevron-down pointer-events-none absolute right-4 top-1/2 translate-y-[2px] text-gray-400 text-sm"></i>

                                <div
                                    id="history-filter-menu"
                                    class="hidden absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
                                    role="listbox"
                                >
                                    <div class="p-2 space-y-1 bg-white">
                                        ${this.getFilterOptions().map((option) => `
                                            <button
                                                type="button"
                                                data-history-filter="${option.value}"
                                                class="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider transition-all ${currentFilter === option.value ? 'bg-orange-600 text-white shadow-sm' : 'text-gray-600 hover:bg-orange-50 hover:text-orange-700'}"
                                            >
                                                <span>${option.label}</span>
                                                ${currentFilter === option.value ? '<i class="bi bi-check2 text-sm"></i>' : ''}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>

                            <button onclick="window.invoicePage.fetchHistory()" 
                                class="h-11 w-11 shrink-0 flex items-center justify-center bg-white border border-gray-200 rounded-2xl text-gray-500 hover:text-orange-600 hover:border-orange-200 hover:shadow-md hover:shadow-orange-100/40 transition-all active:scale-95"
                                title="Refrescar datos">
                                <i class="bi bi-arrow-clockwise text-xl"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <div id="history-grid-container" class="min-h-[400px]">
                    <div class="flex flex-col items-center justify-center py-20 text-gray-300">
                        <div class="h-10 w-10 border-2 border-orange-100 border-t-orange-600 rounded-full animate-spin mb-4"></div>
                        <p class="text-[10px] font-bold uppercase tracking-widest">Indexando registros...</p>
                    </div>
                </div>

                <div id="history-pagination-container" class="flex justify-center items-center gap-6 py-6 border-t border-gray-100 border-dashed"></div>
            </div>
        `;
    }
};
