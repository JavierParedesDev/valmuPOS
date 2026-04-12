window.ValmuInvoicingHistoryView = {
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
            <div class="space-y-8 animate-fade-in">
                <!-- HISTORY HEADER -->
                <div class="flex flex-col xl:flex-row justify-between items-start xl:items-end gap-6">
                    <div>
                        <h3 class="text-2xl font-black text-gray-900 tracking-tight">Expediente de Documentos</h3>
                        <p class="text-gray-400 text-sm font-medium">Búsqueda y gestión de DTEs emitidos y recibidos</p>
                    </div>
                    
                    <div class="flex flex-col md:flex-row gap-4 items-center w-full xl:w-auto">
                        <!-- Search Box -->
                        <div class="relative w-full md:w-80 group">
                            <i class="bi bi-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-orange-600 transition-colors"></i>
                            <input type="text" id="history-search" 
                                value="${searchTerm}"
                                oninput="window.invoicePage.handleSearch(this.value)" 
                                placeholder="Folio, RUT o Fecha..." 
                                class="w-full pl-11 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:border-orange-200 outline-none transition-all focus:ring-4 focus:ring-orange-50 group-hover:border-gray-200">
                        </div>

                        <!-- Tab Filters -->
                        <div class="flex bg-gray-100 p-1 rounded-2xl shadow-inner border border-gray-200/50 overflow-x-auto max-w-full no-scrollbar">
                            <button onclick="invoicePage.setHistoryFilter('all')" class="whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${currentFilter === 'all' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}">TODOS</button>
                            <button onclick="invoicePage.setHistoryFilter('facturas')" class="whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${currentFilter === 'facturas' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}">FACTURAS</button>
                            <button onclick="invoicePage.setHistoryFilter('boletas')" class="whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${currentFilter === 'boletas' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}">BOLETAS</button>
                            <button onclick="invoicePage.setHistoryFilter('notas_de_credito')" class="whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${currentFilter === 'notas_de_credito' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}">N. CRÉDITO</button>
                            <button onclick="invoicePage.setHistoryFilter('notas_de_debito')" class="whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${currentFilter === 'notas_de_debito' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}">N. DÉBITO</button>
                        </div>

                        <!-- Refresh -->
                        <button onclick="window.invoicePage.fetchHistory()" 
                            class="h-11 w-11 flex items-center justify-center bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-orange-600 hover:border-orange-100 hover:shadow-lg hover:shadow-orange-100/50 transition-all active:scale-90"
                            title="Refrescar datos">
                            <i class="bi bi-arrow-clockwise text-xl"></i>
                        </button>
                    </div>
                </div>

                <!-- GRID -->
                <div id="history-grid-container" class="min-h-[400px]">
                    <div class="flex flex-col items-center justify-center py-20 text-gray-300">
                        <div class="h-10 w-10 border-2 border-orange-100 border-t-orange-600 rounded-full animate-spin mb-4"></div>
                        <p class="text-[10px] font-black uppercase tracking-[0.2em]">Indexando registros...</p>
                    </div>
                </div>

                <!-- PAGINATION -->
                <div id="history-pagination-container" class="flex justify-center items-center gap-6 py-6 border-t border-gray-50 border-dashed"></div>
            </div>
        `;
    }
};
