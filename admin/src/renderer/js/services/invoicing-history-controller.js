window.ValmuInvoicingHistoryController = {
    setFilter(page, filter) {
        page.historyFilter = filter;
        page.historyPage = 1;
        this.updateGrid(page);
        page.updateUI();
    },

    handleSearch(page, value) {
        page.historySearchTerm = value;
        page.historyPage = 1;
        this.updateGrid(page);
    },

    setPage(page, nextPage) {
        page.historyPage = nextPage;
        this.updateGrid(page);
    },

    render(page) {
        if (!page.historyData) {
            void this.fetch(page);
        } else {
            setTimeout(() => this.updateGrid(page), 0);
        }

        return window.ValmuInvoicingHistoryView.render({
            historyData: page.historyData,
            currentFilter: page.historyFilter || 'all',
            searchTerm: page.historySearchTerm || ''
        });
    },

    updateGrid(page) {
        const container = document.getElementById('history-grid-container');
        const paginationContainer = document.getElementById('history-pagination-container');
        if (!container || !page.historyData) {
            return;
        }

        const result = window.ValmuInvoicingHistory.renderGrid({
            historyData: page.historyData,
            currentFilter: page.historyFilter || 'all',
            searchTerm: page.historySearchTerm || '',
            historyPage: page.historyPage || 1,
            historyItemsPerPage: page.historyItemsPerPage
        });

        page.historyPage = result.meta.currentPage;
        page.historyMetaData = result.meta;
        container.innerHTML = result.gridHtml;
        if (paginationContainer) {
            paginationContainer.innerHTML = result.paginationHtml;
        }
        window.ValmuInvoicingHistoryView?.bindFilterDropdown?.(page.historyFilter || 'all');
    },

    async fetch(page) {
        if (page.isLoadingHistory) {
            return page.historyData;
        }

        page.isLoadingHistory = true;

        try {
            page.historyData = await window.ValmuInvoicingHistory.fetchMergedHistory({
                api: window.ValmuInvoicingApi,
                electronAPI: window.electronAPI,
                toast: Toast
            });
            return page.historyData;
        } catch (error) {
            console.error('History Load Failed:', error);
            page.historyData = [];
            Toast.show('Error cargando historial: ' + error.message, 'error');
            return page.historyData;
        } finally {
            page.isLoadingHistory = false;
            page.updateUI();
        }
    }
};
