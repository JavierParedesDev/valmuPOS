export function normalizeCustomerList(payload) {
    return (Array.isArray(payload) ? payload : []).map((customer) => ({
        id: Number(customer.id_cliente || 0),
        rut: String(customer.rut_cliente || '').trim(),
        name: String(customer.nombreCliente || '').trim(),
        business: String(customer.giroCliente || '').trim()
    })).filter((customer) => customer.id > 0);
}

export function filterCustomers(customers, filterTerm = '') {
    const term = String(filterTerm || '').trim().toLowerCase();

    return customers.filter((customer) => {
        if (!term) {
            return true;
        }

        return customer.name.toLowerCase().includes(term) || customer.rut.toLowerCase().includes(term);
    });
}

export function buildSaleCustomer(customer) {
    if (!customer) {
        return null;
    }

    return {
        id: Number(customer.id),
        name: customer.name,
        rut: customer.rut
    };
}
