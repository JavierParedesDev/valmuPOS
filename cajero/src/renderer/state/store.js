export const SESSION_KEYS = {
    token: 'valmu_token',
    user: 'valmu_user',
    apiBaseUrl: 'valmu_cajero_api_base_url',
    selectedBranch: 'valmu_cajero_selected_branch',
    printerName: 'valmu_cajero_printer_name',
    printerPaper: 'valmu_cajero_printer_paper',
    releaseRepo: 'valmu_cajero_release_repo',
    cashHistory: 'valmu_cajero_cash_history',
    turnSummary: 'valmu_cajero_turn_summary'
};

export const fallbackProducts = [
    {
        id: '780123400002',
        code: '780123400002',
        name: 'Cerveza Cristal Lata 470cc (Pack 6)',
        category: 'Bebidas',
        price: 4800,
        detailPrice: 4800,
        offerPrice: null,
        offerAvailable: false,
        wholesalePrice: 4500,
        wholesaleMinQty: 4,
        palletPrice: 4200,
        palletMinQty: 12,
        familyPromo: null,
        stockActual: 120,
        isWeighted: false
    },
    {
        id: '200000000001',
        code: '200000000001',
        name: 'Queso Gouda Soprole',
        category: 'Lacteos',
        price: 7990,
        detailPrice: 7990,
        offerPrice: null,
        offerAvailable: false,
        wholesalePrice: 7600,
        wholesaleMinQty: 3,
        palletPrice: null,
        palletMinQty: null,
        familyPromo: null,
        stockActual: 42,
        isWeighted: true
    },
    {
        id: '7790272008851',
        code: '7790272008851',
        name: 'Aceite Vegetal SmartPrice 900ml',
        category: 'Abarrotes',
        price: 1690,
        detailPrice: 1690,
        offerPrice: null,
        offerAvailable: false,
        wholesalePrice: 1550,
        wholesaleMinQty: 6,
        palletPrice: 1490,
        palletMinQty: 18,
        familyPromo: null,
        stockActual: 90,
        isWeighted: false
    },
    {
        id: '7802820650013',
        code: '7802820650013',
        name: 'Agua Benedictino 3 Litros',
        category: 'Bebidas',
        price: 1990,
        detailPrice: 1990,
        offerPrice: null,
        offerAvailable: false,
        wholesalePrice: 1890,
        wholesaleMinQty: 6,
        palletPrice: 1790,
        palletMinQty: 15,
        familyPromo: 'AGUA_3L',
        stockActual: 180,
        isWeighted: false
    }
];

export const catalogState = {
    products: fallbackProducts.slice(),
    source: 'demo',
    status: 'Modo demo activo',
    branches: [],
    categories: []
};

export const saleState = {
    cart: [],
    documentType: 'Boleta',
    customer: null
};

export const cashSessionState = {
    isOpen: false,
    openingAmount: 0,
    openedAt: null
};

export const weightedProductState = {
    productId: null,
    mode: 'add'
};

export const turnHistoryState = {
    entries: []
};

export const turnSummaryState = {
    salesCount: 0,
    totalCash: 0,
    totalCard: 0,
    totalTransfer: 0,
    totalInternal: 0
};

export const salesHistoryState = {
    items: [],
    cancelledItems: [],
    currentTab: 'active'
};

export const invoiceClientState = {
    pendingDocumentType: null,
    customers: []
};

export const saleActionState = {
    saleId: null
};

export const DOCUMENT_TYPE_IDS = {
    Boleta: 1,
    Factura: 2,
    'Vale interno': 3
};

export const PAYMENT_METHOD_MAP = {
    efectivo: 'EFECTIVO',
    tarjeta: 'TARJETA',
    transferencia: 'TRANSFERENCIA'
};
