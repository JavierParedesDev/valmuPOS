window.ValmuInvoicingCreateController = {
    bind({ clients = [], products = [], getClients, getProducts, fetchLastFolio, emitInvoice, renderItemRow, toast, api } = {}) {
        const itemsContainer = document.getElementById('invoice-items-container');
        const showToast = (message, type = 'info') => toast?.show?.(message, type);
        let lastLoadedRut = '';
        let availableClients = Array.isArray(clients) ? [...clients] : [];
        let hasFetchedBackendClients = false;
        const currentProducts = () => Array.isArray(getProducts?.()) ? getProducts() : products;
        const currentClients = () => Array.isArray(getClients?.()) ? getClients() : availableClients;

        const normalizeRut = (value) => String(value || '')
            .trim()
            .toUpperCase()
            .replace(/\./g, '')
            .replace(/\s+/g, '');

        const normalizeText = (value) => String(value || '')
            .trim()
            .toUpperCase()
            .replace(/\s+/g, ' ');

        const parseAmount = (value) => {
            const raw = String(value || '').trim();
            if (!raw) {
                return 0;
            }

            const hasDot = raw.includes('.');
            const hasComma = raw.includes(',');
            let normalized = raw.replace(/\s+/g, '');

            if (hasDot && hasComma) {
                const lastDot = normalized.lastIndexOf('.');
                const lastComma = normalized.lastIndexOf(',');
                if (lastDot > lastComma) {
                    normalized = normalized.replace(/,/g, '');
                } else {
                    normalized = normalized.replace(/\./g, '').replace(',', '.');
                }
            } else if (hasComma) {
                const decimals = normalized.split(',').pop();
                if ((decimals || '').length <= 2) {
                    normalized = normalized.replace(/\./g, '').replace(',', '.');
                } else {
                    normalized = normalized.replace(/,/g, '');
                }
            } else if (hasDot) {
                const decimals = normalized.split('.').pop();
                if ((decimals || '').length > 2) {
                    normalized = normalized.replace(/\./g, '');
                }
            }

            const amount = Number.parseFloat(normalized);
            return Number.isFinite(amount) ? amount : 0;
        };

        const formatAmount = (value, decimals = 0) => {
            const amount = Number(value || 0);
            return amount.toFixed(decimals);
        };

        const findProduct = (value) => {
            const normalizedValue = normalizeText(value);
            if (!normalizedValue) {
                return null;
            }

            const productList = currentProducts();

            const exactMatch = productList.find((item) => normalizeText(item.name) === normalizedValue);
            if (exactMatch) {
                return exactMatch;
            }

            const startsWithMatch = productList.find((item) => normalizeText(item.name).startsWith(normalizedValue));
            if (startsWithMatch) {
                return startsWithMatch;
            }

            return productList.find((item) => normalizeText(item.name).includes(normalizedValue)) || null;
        };

        const tryResolveProductInput = (input, { focusQty = false } = {}) => {
            if (!input) {
                return false;
            }

            const row = input.closest('.item-row');
            if (!row) {
                return false;
            }

            const product = findProduct(input.value);
            if (!product) {
                return false;
            }

            return applyProductToRow(row, product, { focusQty });
        };

        const findClient = (value) => {
            const normalizedValue = normalizeRut(value);
            return currentClients().find((item) => {
                const clientRut = normalizeRut(item.rut);
                const clientRutNoDash = clientRut.replace(/-/g, '');
                const searchRutNoDash = normalizedValue.replace(/-/g, '');
                return clientRut === normalizedValue
                    || clientRutNoDash === searchRutNoDash
                    || String(item.business_name || '').trim().toUpperCase() === String(value || '').trim().toUpperCase();
            }) || null;
        };

        const getClientLabel = (client) => {
            const parts = [
                client.rut || '',
                client.business_name || '',
                client.comuna || client.city || ''
            ].filter(Boolean);
            return parts.join(' - ');
        };

        const mergeClients = (incomingClients = []) => {
            const merged = new Map();
            [...currentClients(), ...incomingClients].forEach((client) => {
                const key = normalizeRut(client.rut) || String(client.business_name || '').trim().toUpperCase();
                if (key) {
                    merged.set(key, client);
                }
            });
            availableClients = Array.from(merged.values());
        };

        const applyClient = (client, rawValue) => {
            if (!client) {
                return false;
            }

            document.getElementById('dte-rzn-recep').value = client.business_name || '';
            document.getElementById('dte-dir-recep').value = client.address || '';
            document.getElementById('dte-cmna-recep').value = client.comuna || '';
            document.getElementById('dte-ciudad-recep').value = client.city || '';
            document.getElementById('dte-giro-recep').value = client.giro || '';
            document.getElementById('dte-contacto-recep').value = client.email || client.phone || '';

            const rutInput = document.getElementById('dte-rut-recep');
            if (rutInput && client.rut && normalizeRut(client.rut) !== normalizeRut(rawValue)) {
                rutInput.value = client.rut;
            }

            lastLoadedRut = normalizeRut(client.rut || rawValue);
            showToast('Cliente cargado', 'success');
            return true;
        };

        const fetchClientFromBackend = async (rawValue) => {
            if (!api || typeof api.getClients !== 'function') {
                return null;
            }

            const normalizedValue = normalizeRut(rawValue);
            const searchRutNoDash = normalizedValue.replace(/-/g, '');
            try {
                const response = await api.getClients();
                const source = Array.isArray(response)
                    ? response
                    : Array.isArray(response?.data)
                        ? response.data
                        : [];

                const normalizedSource = source.map((remoteClient) => ({
                    rut: remoteClient.rut || remoteClient.rut_cliente || '',
                    business_name: remoteClient.business_name || remoteClient.nombreCliente || remoteClient.nombre || '',
                    address: remoteClient.address || remoteClient.direccion || '',
                    comuna: remoteClient.comuna || '',
                    city: remoteClient.city || remoteClient.ciudad || remoteClient.comuna || '',
                    giro: remoteClient.giro || remoteClient.giroCliente || '',
                    email: remoteClient.email || remoteClient.correo || '',
                    phone: remoteClient.phone || remoteClient.telefono || ''
                }));

                mergeClients(normalizedSource);
                hasFetchedBackendClients = true;

                const remoteClient = normalizedSource.find((item) => {
                    const itemRut = normalizeRut(item.rut);
                    return itemRut === normalizedValue || itemRut.replace(/-/g, '') === searchRutNoDash;
                });

                if (!remoteClient) {
                    return null;
                }

                return remoteClient;
            } catch (error) {
                console.error('Client lookup failed:', error);
                return null;
            }
        };

        const fetchBackendClients = async () => {
            if (!api || typeof api.getClients !== 'function') {
                return availableClients;
            }

            try {
                const response = await api.getClients();
                const source = Array.isArray(response)
                    ? response
                    : Array.isArray(response?.data)
                        ? response.data
                        : [];

                const normalizedSource = source.map((remoteClient) => ({
                    rut: remoteClient.rut || remoteClient.rut_cliente || '',
                    business_name: remoteClient.business_name || remoteClient.nombreCliente || remoteClient.nombre || '',
                    address: remoteClient.address || remoteClient.direccion || '',
                    comuna: remoteClient.comuna || '',
                    city: remoteClient.city || remoteClient.ciudad || remoteClient.comuna || '',
                    giro: remoteClient.giro || remoteClient.giroCliente || '',
                    email: remoteClient.email || remoteClient.correo || '',
                    phone: remoteClient.phone || remoteClient.telefono || ''
                }));

                mergeClients(normalizedSource);
                hasFetchedBackendClients = true;
            } catch (error) {
                console.error('Client list refresh failed:', error);
            }

            return availableClients;
        };

        const getClientMatches = (value) => {
            const normalizedValue = normalizeRut(value);
            const rutNeedle = normalizedValue.replace(/-/g, '');
            const nameNeedle = String(value || '').trim().toUpperCase();

            if (!rutNeedle && !nameNeedle) {
                return availableClients.slice(0, 8);
            }

            return availableClients.filter((item) => {
                const clientRut = normalizeRut(item.rut).replace(/-/g, '');
                const clientName = String(item.business_name || '').trim().toUpperCase();
                return clientRut.includes(rutNeedle) || clientName.includes(nameNeedle);
            }).slice(0, 8);
        };

        const calcTotals = () => {
            if (!itemsContainer) {
                return;
            }

            let subTotalBruto = 0;
            itemsContainer.querySelectorAll('.item-subtotal').forEach((input) => {
                subTotalBruto += parseAmount(input.value);
            });

            document.getElementById('dte-subtotal').value = formatAmount(subTotalBruto, 0);

            let globalDescPct = parseInt(document.getElementById('dte-descuento-global').value, 10) || 0;
            if (globalDescPct > 100) {
                globalDescPct = 100;
                document.getElementById('dte-descuento-global').value = 100;
            }
            if (globalDescPct < 0) {
                globalDescPct = 0;
                document.getElementById('dte-descuento-global').value = 0;
            }

            const montoDiscount = subTotalBruto * (globalDescPct / 100);
            document.getElementById('dte-monto-calculado').value = formatAmount(montoDiscount, 0);

            let totalBruto = subTotalBruto - montoDiscount;
            if (totalBruto < 0) {
                totalBruto = 0;
            }

            const montoNeto = Math.round(totalBruto / 1.19);
            document.getElementById('dte-monto-neto').value = formatAmount(montoNeto, 0);

            const totalIva = Math.round(totalBruto - montoNeto);
            document.getElementById('dte-monto-iva').value = formatAmount(totalIva, 0);
            document.getElementById('dte-monto-total').value = formatAmount(totalBruto, 0);
        };

        const calcLine = (target) => {
            const row = target.closest('.item-row');
            if (!row) {
                return;
            }

            const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
            const priceInput = row.querySelector('.item-price');
            const netUnitPrice = parseAmount(priceInput.value);
            const discPct = parseFloat(row.querySelector('.item-pct-desc').value) || 0;

            const grossUnitPrice = netUnitPrice * 1.19;
            const bruto = qty * grossUnitPrice;
            const discount = bruto * (discPct / 100);
            row.querySelector('.item-subtotal').value = formatAmount(bruto - discount, 0);

            calcTotals();
        };

        const applyProductToRow = (row, product, { focusQty = false } = {}) => {
            if (!row || !product) {
                return false;
            }

            const nameInput = row.querySelector('.item-nombre');
            const priceInput = row.querySelector('.item-price');
            const unitInput = row.querySelector('.item-unit');
            const priceTypeSelect = row.querySelector('.item-price-type');

            if (nameInput && !nameInput.value) {
                nameInput.value = product.name || '';
            }

            priceInput.dataset.normal = product.sale_price || 0;
            priceInput.dataset.mayorista = product.wholesale_price || 0;
            priceInput.dataset.tarjeta = product.card_price || 0;
            priceInput.value = formatAmount((product.sale_price || 0) / 1.19, 2);

            if (unitInput && !unitInput.value) {
                unitInput.value = 'un';
            }

            if (priceTypeSelect) {
                priceTypeSelect.value = 'normal';
            }

            calcLine(priceInput);

            if (focusQty) {
                row.querySelector('.item-qty')?.focus();
            }

            return true;
        };

        const toggleRemoveBtn = () => {
            const btn = document.getElementById('btn-remove-last');
            if (!btn || !itemsContainer) {
                return;
            }

            const count = itemsContainer.querySelectorAll('.item-row').length;
            btn.classList.toggle('hidden', count <= 1);
        };

        const resetForm = () => {
            lastLoadedRut = '';
            [
                'dte-rut-recep',
                'dte-rzn-recep',
                'dte-dir-recep',
                'dte-cmna-recep',
                'dte-ciudad-recep',
                'dte-giro-recep',
                'dte-contacto-recep'
            ].forEach((id) => {
                const field = document.getElementById(id);
                if (field) {
                    field.value = '';
                }
            });

            const payMethod = document.getElementById('dte-forma-pago');
            if (payMethod) {
                payMethod.value = 'Contado';
            }

            if (itemsContainer) {
                const rows = itemsContainer.querySelectorAll('.item-row');
                rows.forEach((row, index) => {
                    if (index > 0) {
                        row.remove();
                    }
                });

                const firstRow = itemsContainer.querySelector('.item-row');
                if (firstRow) {
                    firstRow.querySelector('.item-nombre').value = '';
                    firstRow.querySelector('.item-qty').value = '';
                    firstRow.querySelector('.item-unit').value = '';
                    firstRow.querySelector('.item-price').value = '';
                    firstRow.querySelector('.item-pct-desc').value = '';
                    firstRow.querySelector('.item-subtotal').value = '';
                    delete firstRow.querySelector('.item-price').dataset.normal;
                    delete firstRow.querySelector('.item-price').dataset.mayorista;
                    delete firstRow.querySelector('.item-price').dataset.tarjeta;
                    firstRow.querySelector('.item-price-type').value = 'normal';
                }
            }

            ['dte-subtotal', 'dte-descuento-global', 'dte-monto-calculado', 'dte-monto-neto', 'dte-monto-iva', 'dte-monto-total']
                .forEach((id) => {
                    const field = document.getElementById(id);
                    if (field) {
                        field.value = '';
                    }
                });

            toggleRemoveBtn();
            calcTotals();
        };

        const emitButton = document.getElementById('btn-emitir');
        if (emitButton) {
            emitButton.replaceWith(emitButton.cloneNode(true));
            document.getElementById('btn-emitir')?.addEventListener('click', () => emitInvoice?.());
        }
        document.getElementById('btn-limpiar')?.addEventListener('click', resetForm);
        document.getElementById('dte-descuento-global')?.addEventListener('input', calcTotals);

        const tipoSelect = document.getElementById('dte-tipo');
        if (tipoSelect) {
            tipoSelect.addEventListener('change', () => fetchLastFolio?.(tipoSelect.value));
            fetchLastFolio?.(tipoSelect.value);
        }

        document.getElementById('btn-remove-last')?.addEventListener('click', () => {
            if (!itemsContainer) {
                return;
            }

            const rows = itemsContainer.querySelectorAll('.item-row');
            if (rows.length <= 1) {
                showToast('No se puede eliminar la única fila', 'warning');
                return;
            }

            itemsContainer.lastElementChild?.remove();
            toggleRemoveBtn();
            calcTotals();
        });

        document.getElementById('btn-add-line')?.addEventListener('click', () => {
            if (!itemsContainer) {
                return;
            }

            itemsContainer.insertAdjacentHTML('beforeend', renderItemRow?.() || '');
            toggleRemoveBtn();
        });

        itemsContainer?.addEventListener('input', (event) => {
            if (event.target.matches('.item-qty, .item-price, .item-pct-desc')) {
                calcLine(event.target);
            }

            if (event.target.matches('.item-nombre')) {
                tryResolveProductInput(event.target);
            }
        });

        itemsContainer?.addEventListener('change', (event) => {
            const row = event.target.closest('.item-row');
            if (!row) {
                return;
            }

            if (event.target.matches('.item-nombre')) {
                tryResolveProductInput(event.target, { focusQty: true });
            }

            if (event.target.matches('.item-price-type')) {
                const priceInput = row.querySelector('.item-price');
                const rawPrice = priceInput.dataset[event.target.value];
                if (rawPrice === undefined) {
                    return;
                }

                priceInput.value = Math.round(parseFloat(rawPrice || 0));
                priceInput.classList.add('bg-yellow-50');
                setTimeout(() => priceInput.classList.remove('bg-yellow-50'), 500);
                calcLine(event.target);
            }
        });

        itemsContainer?.addEventListener('blur', (event) => {
            if (!event.target.matches('.item-nombre')) {
                return;
            }

            const row = event.target.closest('.item-row');
            if (!row) {
                return;
            }

            tryResolveProductInput(event.target);
        }, true);

        itemsContainer?.addEventListener('keydown', (event) => {
            if (!event.target.matches('.item-nombre')) {
                return;
            }

            if (event.key === 'Enter' || event.key === 'Tab') {
                tryResolveProductInput(event.target, { focusQty: event.key === 'Enter' });
            }
        });

        const rutInput = document.getElementById('dte-rut-recep');
        const suggestionsBox = document.getElementById('dte-client-suggestions');

        const hideSuggestions = () => {
            if (!suggestionsBox) {
                return;
            }

            suggestionsBox.innerHTML = '';
            suggestionsBox.classList.add('hidden');
        };

        const renderSuggestions = async (value) => {
            if (!suggestionsBox) {
                return;
            }

            let matches = getClientMatches(value);
            if (!matches.length && value && !hasFetchedBackendClients) {
                await fetchBackendClients();
                matches = getClientMatches(value);
            }

            if (!matches.length) {
                hideSuggestions();
                return;
            }

            suggestionsBox.innerHTML = matches.map((client) => `
                <button
                    type="button"
                    class="block w-full border-b border-[#f3e1d1] px-3 py-2 text-left text-sm text-[#5a3318] hover:bg-[#fff1e4]"
                    data-client-rut="${client.rut || ''}"
                >
                    <div class="font-semibold">${client.rut || ''}</div>
                    <div class="text-xs text-[#92735e]">${getClientLabel(client)}</div>
                </button>
            `).join('');
            suggestionsBox.classList.remove('hidden');
        };

        const tryResolveClient = async (rawValue, { silent = false } = {}) => {
            const client = findClient(rawValue);
            if (!client) {
                const remoteClient = await fetchClientFromBackend(rawValue);
                if (!remoteClient) {
                    return false;
                }

                return applyClient(remoteClient, rawValue);
            }

            const previousRut = lastLoadedRut;
            const applied = applyClient(client, rawValue);
            hideSuggestions();
            if (silent && applied) {
                lastLoadedRut = normalizeRut(client.rut || rawValue);
                if (previousRut === lastLoadedRut) {
                    return true;
                }
            }

            return applied;
        };

        rutInput?.addEventListener('change', async (event) => {
            await tryResolveClient(event.target.value);
        });

        rutInput?.addEventListener('input', async (event) => {
            await renderSuggestions(event.target.value);
        });

        rutInput?.addEventListener('blur', async (event) => {
            setTimeout(async () => {
                hideSuggestions();
                await tryResolveClient(event.target.value, { silent: true });
            }, 150);
        });

        rutInput?.addEventListener('keydown', async (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                await tryResolveClient(event.target.value);
            }
        });

        suggestionsBox?.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-client-rut]');
            if (!button) {
                return;
            }

            const rut = button.dataset.clientRut || '';
            if (rutInput) {
                rutInput.value = rut;
            }
            await tryResolveClient(rut);
        });

        return { calcTotals, calcLine };
    }
};
