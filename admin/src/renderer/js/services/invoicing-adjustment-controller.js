window.ValmuInvoicingAdjustmentController = {
    bind({
        prefix,
        clients = [],
        emitDocument,
        loadDteDataFromXml,
        renderItemRow,
        toast,
        onClientSelected
    } = {}) {
        const itemsContainer = document.getElementById(`${prefix}-items-container`);
        const globalDiscountInput = document.getElementById(`${prefix}-descuento-global`);
        const clientSearchInput = document.getElementById(`${prefix}-rut-recep`);
        const emitButtonId = prefix === 'nc' ? 'btn-emit-nc' : 'btn-emit-nd';
        const clearButtonId = prefix === 'nc' ? 'btn-nc-limpiar' : 'btn-nd-limpiar';
        const loadRefButtonId = prefix === 'nc' ? 'btn-nc-load-ref' : 'btn-nd-load-ref';
        const addButtonId = prefix === 'nc' ? 'btn-nc-add-line' : 'btn-nd-add-line';
        const removeButtonId = prefix === 'nc' ? 'btn-nc-remove-last' : 'btn-nd-remove-last';
        const clientToastMessage = prefix === 'nc' ? 'Cliente cargado' : 'Cliente cargado (Débito)';
        const itemTotalSelector = `.${prefix}-item-total`;

        const showToast = (message, type = 'info') => toast?.show?.(message, type);

        const calcTotals = () => {
            if (!itemsContainer) {
                return;
            }

            let subTotal = 0;
            itemsContainer.querySelectorAll(`.${prefix}-item-subtotal`).forEach((input) => {
                subTotal += parseInt(input.value, 10) || 0;
            });

            document.getElementById(`${prefix}-subtotal`).value = subTotal;

            let globalDiscountPct = parseFloat(globalDiscountInput?.value) || 0;
            if (globalDiscountPct > 100) {
                globalDiscountPct = 100;
                if (globalDiscountInput) {
                    globalDiscountInput.value = 100;
                }
            }
            if (globalDiscountPct < 0) {
                globalDiscountPct = 0;
                if (globalDiscountInput) {
                    globalDiscountInput.value = 0;
                }
            }

            const discountAmount = Math.round(subTotal * (globalDiscountPct / 100));
            document.getElementById(`${prefix}-monto-calculado`).value = discountAmount;

            let net = subTotal - discountAmount;
            if (net < 0) {
                net = 0;
            }

            document.getElementById(`${prefix}-monto-neto`).value = net;

            const tax = Math.round(net * 0.19);
            document.getElementById(`${prefix}-monto-iva`).value = tax;
            document.getElementById(`${prefix}-monto-total`).value = net + tax;
            document.getElementById(`${prefix}-net-amount`).value = net;
        };

        const calcLine = (target) => {
            const row = target.closest(`.${prefix}-item-row`);
            if (!row) {
                return;
            }

            const qty = parseFloat(row.querySelector(`.${prefix}-item-qty`).value) || 0;
            const price = parseFloat(row.querySelector(`.${prefix}-item-price`).value) || 0;
            const discPct = parseFloat(row.querySelector(`.${prefix}-item-pct-desc`).value) || 0;

            const baseTotal = qty * price;
            const discount = baseTotal * (discPct / 100);
            const netSub = Math.round(baseTotal - discount);

            row.querySelector(`.${prefix}-item-subtotal`).value = netSub;

            const totalInput = row.querySelector(itemTotalSelector);
            if (totalInput) {
                totalInput.value = Math.round(netSub * 1.19);
            }

            calcTotals();
        };

        const toggleRemoveBtn = () => {
            const btn = document.getElementById(removeButtonId);
            if (!btn || !itemsContainer) {
                return;
            }

            const rows = itemsContainer.querySelectorAll(`.${prefix}-item-row`);
            btn.classList.toggle('hidden', rows.length <= 1);
        };

        const clearForm = () => {
            [
                `${prefix}-rut-recep`,
                `${prefix}-rzn-recep`,
                `${prefix}-dir-recep`,
                `${prefix}-cmna-recep`,
                `${prefix}-ciudad-recep`,
                `${prefix}-giro-recep`,
                `${prefix}-contacto-recep`,
                `${prefix}-ref-folio`,
                `${prefix}-ref-reason`
            ].forEach((id) => {
                const field = document.getElementById(id);
                if (field) {
                    field.value = '';
                }
            });

            if (itemsContainer) {
                const rows = itemsContainer.querySelectorAll(`.${prefix}-item-row`);
                rows.forEach((row, index) => {
                    if (index > 0) {
                        row.remove();
                    }
                });

                const firstRow = itemsContainer.querySelector(`.${prefix}-item-row`);
                if (firstRow) {
                    firstRow.querySelectorAll('input').forEach((input) => {
                        input.value = '';
                    });
                    const unitInput = firstRow.querySelector(`.${prefix}-item-unit`);
                    if (unitInput) {
                        unitInput.value = '';
                    }
                }
            }

            onClientSelected?.(null);
            toggleRemoveBtn();
            calcTotals();
        };

        itemsContainer?.addEventListener('input', (event) => {
            if (event.target.matches(`.${prefix}-item-qty, .${prefix}-item-price, .${prefix}-item-pct-desc`)) {
                calcLine(event.target);
            }
        });

        globalDiscountInput?.addEventListener('input', calcTotals);

        document.getElementById(removeButtonId)?.addEventListener('click', () => {
            if (!itemsContainer) {
                return;
            }

            const rows = itemsContainer.querySelectorAll(`.${prefix}-item-row`);
            if (rows.length <= 1) {
                showToast('No se puede eliminar la única fila', 'warning');
                return;
            }

            itemsContainer.lastElementChild?.remove();
            toggleRemoveBtn();
            calcTotals();
        });

        document.getElementById(addButtonId)?.addEventListener('click', () => {
            if (!itemsContainer) {
                return;
            }

            itemsContainer.insertAdjacentHTML('beforeend', renderItemRow?.() || '');
            toggleRemoveBtn();
        });

        clientSearchInput?.addEventListener('change', (event) => {
            const value = event.target.value;
            const client = clients.find((item) => item.rut === value || item.business_name === value);
            onClientSelected?.(client || null);

            if (!client) {
                return;
            }

            document.getElementById(`${prefix}-rzn-recep`).value = (client.business_name || '').toUpperCase();
            document.getElementById(`${prefix}-dir-recep`).value = (client.address || '').toUpperCase();
            document.getElementById(`${prefix}-cmna-recep`).value = (client.comuna || '').toUpperCase();
            document.getElementById(`${prefix}-ciudad-recep`).value = (client.city || client.comuna || '').toUpperCase();
            document.getElementById(`${prefix}-giro-recep`).value = (client.giro || '').toUpperCase();
            document.getElementById(`${prefix}-contacto-recep`).value = (client.email || client.phone || '').toUpperCase();

            if (client.rut !== value) {
                clientSearchInput.value = client.rut;
            }

            showToast(clientToastMessage, 'success');
        });

        const emitButton = document.getElementById(emitButtonId);
        if (emitButton) {
            emitButton.replaceWith(emitButton.cloneNode(true));
            document.getElementById(emitButtonId)?.addEventListener('click', () => emitDocument?.());
        }

        document.getElementById(clearButtonId)?.addEventListener('click', clearForm);

        document.getElementById(loadRefButtonId)?.addEventListener('click', () => {
            const type = document.getElementById(`${prefix}-ref-type`).value;
            const folio = document.getElementById(`${prefix}-ref-folio`).value;

            if (!folio) {
                showToast('Ingresa un folio para cargar', 'warning');
                return;
            }

            loadDteDataFromXml?.(type, folio);
        });

        toggleRemoveBtn();

        return { calcLine, calcTotals, toggleRemoveBtn };
    }
};
