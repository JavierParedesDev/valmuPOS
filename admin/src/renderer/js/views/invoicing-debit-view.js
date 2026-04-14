window.ValmuInvoicingDebitView = {
    render({ config, today, folio } = {}) {
        return `
            <div class="p-4 max-w-6xl mx-auto bg-[#fffdf9] min-h-screen text-[#3d2a1e]">
                <div class="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
                    <div class="flex-1 pt-4"></div>

                    <div class="w-full md:w-80">
                        <div class="border border-[#e4cbb4] p-6 text-center bg-[#fff7f0] rounded shadow-sm">
                            <h3 class="text-blue-900 font-bold text-lg uppercase tracking-tight">Rut ${config.rutEmisor || 'Sin Configurar'}</h3>
                            <div class="text-blue-900 font-bold text-lg my-1 uppercase">Nota de Debito Electronica</div>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col md:flex-row justify-end items-center gap-4 mb-6 text-sm">
                    <div class="flex border border-[#e4cbb4] rounded overflow-hidden">
                        <span class="bg-[#fff1e4] px-3 py-1 border-r font-medium text-[#705745]">Siguiente Folio</span>
                        <input id="nd-folio-display" type="number" readonly value="${folio}" class="px-3 py-1 w-20 text-center outline-none bg-[#fff7f0]">
                        <input id="nd-folio" type="hidden" value="${folio}">
                    </div>

                    <div class="flex border border-[#e4cbb4] rounded overflow-hidden">
                        <span class="bg-[#fff1e4] px-3 py-1 border-r font-medium text-[#705745]">Fecha Emision</span>
                        <input id="nd-fch-emis" type="date" value="${today}" class="px-3 py-1 w-40 text-center outline-none bg-[#fffdf9]">
                    </div>

                    <div class="flex border border-[#e4cbb4] rounded overflow-hidden">
                        <span class="bg-[#fff1e4] px-3 py-1 border-r font-medium text-[#705745]">Fecha Venc.</span>
                        <input id="nd-fch-venc" type="date" value="${today}" class="px-3 py-1 w-40 text-center outline-none bg-[#fffdf9]">
                    </div>
                </div>

                <div class="border border-[#e4cbb4] rounded mb-6">
                    <div class="bg-[#fff7f0] px-4 py-2 border-b flex justify-between items-center">
                        <h3 class="text-[#dd6313] font-bold text-sm uppercase">Datos Emisor</h3>
                    </div>
                    <div class="p-4 grid grid-cols-12 gap-3 text-sm bg-[#fffdf9]">
                        <div class="col-span-12">
                            <label class="block text-[#92735e] text-xs mb-1">Razon Social</label>
                            <input type="text" value="${config.razonSocial || ''}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none" readonly>
                        </div>

                        <div class="col-span-12 md:col-span-6">
                            <label class="block text-[#92735e] text-xs mb-1">Direccion</label>
                            <input type="text" value="${(config.direccion || '').toUpperCase()}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none uppercase" readonly>
                        </div>
                        <div class="col-span-12 md:col-span-3">
                            <label class="block text-[#92735e] text-xs mb-1">Comuna</label>
                            <input type="text" value="${(config.comuna || '').toUpperCase()}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none uppercase" readonly>
                        </div>
                        <div class="col-span-12 md:col-span-3">
                            <label class="block text-[#92735e] text-xs mb-1">Ciudad</label>
                            <input type="text" value="${(config.ciudad || 'CONCEPCION').toUpperCase()}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none uppercase" readonly>
                        </div>

                        <div class="col-span-12 md:col-span-5">
                            <label class="block text-[#92735e] text-xs mb-1">Giro</label>
                            <input type="text" value="${config.giro || ''}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none text-xs truncate" readonly title="${config.giro || ''}">
                        </div>
                        <div class="col-span-12 md:col-span-4">
                            <label class="block text-[#92735e] text-xs mb-1">Act. Econo.</label>
                            <input type="text" value="${config.acteco || ''}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none" readonly>
                        </div>
                        <div class="col-span-12 md:col-span-3">
                            <label class="block text-[#92735e] text-xs mb-1">Contacto</label>
                            <input type="text" value="${config.email || config.telefono || ''}" class="w-full border border-[#e4cbb4] bg-[#fff1e4] p-1 px-2 rounded outline-none" readonly>
                        </div>
                    </div>
                </div>

                <div class="border border-[#e4cbb4] rounded mb-6">
                    <div class="bg-[#fff7f0] px-4 py-2 border-b flex justify-between items-center">
                        <h3 class="text-orange-500 font-bold text-sm uppercase">Documento Referenciado</h3>
                    </div>
                    <div class="p-4 grid grid-cols-12 gap-3 text-sm bg-[#fffdf9]">
                        <div class="col-span-12 md:col-span-3">
                            <label class="block text-[#92735e] text-xs mb-1">Tipo Doc.</label>
                            <select id="nd-ref-type" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none">
                                <option value="33" selected>Factura Electronica (33)</option>
                                <option value="39">Boleta Electronica (39)</option>
                            </select>
                        </div>
                        <div class="col-span-12 md:col-span-3">
                            <label class="block text-[#92735e] text-xs mb-1">Folio Ref.</label>
                            <div class="flex gap-2">
                                <input id="nd-ref-folio" type="number" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none" placeholder="Ej: 123">
                                <button id="btn-nd-load-ref" type="button" class="bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold py-1 px-4 rounded shadow">Buscar</button>
                            </div>
                        </div>
                        <div class="col-span-12 md:col-span-2">
                            <label class="block text-[#92735e] text-xs mb-1">Fecha Ref.</label>
                            <input id="nd-ref-date" type="date" value="${today}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none">
                        </div>
                        <div class="col-span-12 md:col-span-2">
                            <label class="block text-[#92735e] text-xs mb-1">Codigo Ref.</label>
                            <select id="nd-ref-code" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none">
                                <option value="3" selected>3. Corrige Montos</option>
                                <option value="1">1. Anula Documento</option>
                                <option value="2">2. Corrige Texto</option>
                            </select>
                        </div>
                        <div class="col-span-12 md:col-span-2">
                            <label class="block text-[#92735e] text-xs mb-1">Motivo</label>
                            <input id="nd-ref-reason" type="text" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none" placeholder="Motivo de la ND">
                        </div>
                    </div>
                </div>

                <div class="border border-[#e4cbb4] rounded mb-6">
                    <div class="bg-[#fff7f0] px-4 py-2 border-b flex justify-between items-center">
                        <h3 class="text-orange-500 font-bold text-sm uppercase">Datos Receptor</h3>
                    </div>
                    <div class="p-4 grid grid-cols-12 gap-3 text-sm bg-[#fffdf9]">
                        <div class="col-span-12 md:col-span-3">
                            <label class="block text-[#92735e] text-xs mb-1">RUT</label>
                            <input id="nd-rut-recep" type="text" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none uppercase" placeholder="Buscar...">
                        </div>
                        <div class="col-span-12 md:col-span-9">
                            <label class="block text-[#92735e] text-xs mb-1">Razon Social</label>
                            <input id="nd-rzn-recep" type="text" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none">
                        </div>

                        <div class="col-span-12 md:col-span-6">
                            <label class="block text-[#92735e] text-xs mb-1">Direccion</label>
                            <input id="nd-dir-recep" type="text" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none">
                        </div>
                        <div class="col-span-12 md:col-span-3">
                            <label class="block text-[#92735e] text-xs mb-1">Comuna</label>
                            <input id="nd-cmna-recep" type="text" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none">
                        </div>
                        <div class="col-span-12 md:col-span-3">
                            <label class="block text-[#92735e] text-xs mb-1">Ciudad</label>
                            <input id="nd-ciudad-recep" type="text" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none">
                        </div>

                        <div class="col-span-12 md:col-span-6">
                            <label class="block text-[#92735e] text-xs mb-1">Giro</label>
                            <input id="nd-giro-recep" type="text" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none">
                        </div>
                        <div class="col-span-12 md:col-span-6">
                            <label class="block text-[#92735e] text-xs mb-1">Contacto</label>
                            <input id="nd-contacto-recep" type="text" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none focus:border-orange-500 uppercase">
                        </div>
                    </div>
                </div>

                <div class="mb-6">
                    <div class="flex bg-[#fff1e4] border border-[#e4cbb4] text-xs font-bold text-[#705745] uppercase">
                        <div class="p-2 w-full md:w-5/12 border-r">Descripcion</div>
                        <div class="p-2 w-20 border-r text-center">Cant.</div>
                        <div class="p-2 w-24 border-r text-center">Unidad</div>
                        <div class="p-2 w-32 border-r text-center">Precio</div>
                        <div class="p-2 w-24 border-r text-center">% Desc.</div>
                        <div class="p-2 w-32 border-r text-center">Subtotal</div>
                        <div class="p-2 w-16 text-center">Accion</div>
                    </div>

                    <div id="nd-items-container">
                        ${this.renderItemRow()}
                    </div>

                    <div class="mt-2 flex justify-center gap-4">
                        <button id="btn-nd-remove-last" type="button" class="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-1 px-4 rounded shadow hidden">
                            Quitar ultima
                        </button>
                        <button id="btn-nd-add-line" type="button" class="bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold py-1 px-4 rounded shadow">
                            Agrega linea de Detalle
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
                    <div class="flex gap-4">
                        <div class="bg-[#fff7f0] p-4 border border-[#e4cbb4] rounded w-full">
                            <div class="mb-3">
                                <label class="block text-xs font-bold text-[#705745] mb-1">Forma de Pago:</label>
                                <select id="nd-forma-pago" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded">
                                    <option value="1" selected>Contado</option>
                                    <option value="2">Credito</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-2 text-sm md:col-span-2">
                        <div class="flex items-center">
                            <span class="w-32 text-[#705745] font-bold">Sub Total</span>
                            <input id="nd-subtotal" type="number" readonly value="0" class="flex-1 bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded outline-none">
                        </div>

                        <div class="flex items-center gap-2">
                            <div class="flex items-center flex-1">
                                <span class="w-32 text-[#705745] font-bold text-xs whitespace-nowrap flex-shrink-0">Desc. Global %</span>
                                <input id="nd-descuento-global" type="number" value="0" min="0" max="100" class="w-16 bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded outline-none">
                            </div>
                            <div class="flex items-center flex-1">
                                <span class="w-auto text-[#705745] font-bold text-xs text-right pr-2 whitespace-nowrap">Monto $</span>
                                <input id="nd-monto-calculado" type="number" readonly value="0" class="w-full bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded outline-none">
                            </div>
                        </div>

                        <div class="flex items-center">
                            <span class="w-32 text-[#705745] font-bold">Monto Neto</span>
                            <input id="nd-monto-neto" type="number" readonly value="0" class="flex-1 bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded outline-none">
                        </div>
                        <div class="flex items-center gap-2">
                            <div class="flex items-center flex-1">
                                <span class="w-32 text-[#705745] font-bold text-xs whitespace-nowrap flex-shrink-0">IVA %</span>
                                <input type="text" readonly value="19%" class="w-16 bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded outline-none">
                            </div>
                            <div class="flex items-center flex-1">
                                <span class="w-auto text-[#705745] font-bold text-xs text-right pr-2 whitespace-nowrap">Total IVA</span>
                                <input id="nd-monto-iva" type="number" readonly value="0" class="w-full bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded outline-none">
                            </div>
                        </div>
                        <div class="flex items-center">
                            <span class="w-32 text-[#3d2a1e] font-bold text-base">Total</span>
                            <input id="nd-monto-total" type="number" readonly value="0" class="flex-1 bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded font-bold text-lg text-gray-900 outline-none">
                        </div>
                    </div>
                </div>

                <div class="mt-8 flex flex-wrap gap-4 justify-center md:justify-end border-t pt-6">
                    <button id="btn-nd-limpiar" type="button" class="bg-purple-800 hover:bg-purple-900 text-white px-6 py-2 rounded font-bold shadow transition">
                        Limpiar
                    </button>
                    <button id="btn-emit-nd" type="button" class="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded font-bold shadow-lg shadow-primary/30 transition transform hover:-translate-y-0.5">
                        Emitir Nota de Debito
                    </button>
                </div>

                <input type="hidden" id="nd-net-amount" value="0">
                <input type="hidden" id="nd-emi-razon" value="${config.razonSocial || ''}">
                <input type="hidden" id="nd-emi-dir" value="${config.direccion || ''}">
                <input type="hidden" id="nd-emi-comuna" value="${config.comuna || ''}">
                <input type="hidden" id="nd-emi-ciudad" value="${config.ciudad || ''}">
                <input type="hidden" id="nd-emi-giro" value="${config.giro || ''}">
                <input type="hidden" id="nd-emi-acteco" value="${config.acteco || ''}">
                <input type="hidden" id="nd-emi-email" value="${config.email || ''}">
                <input type="hidden" id="nd-emisor-fono" value="${config.telefono || ''}">
            </div>
        `;
    },

    renderItemRow() {
        return `
            <div class="flex bg-[#fffdf9] border-x border-b border-[#e4cbb4] p-2 gap-2 text-sm nd-item-row">
                <div class="w-full md:w-5/12 relative">
                    <input type="text" class="nd-item-nombre w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded focus:border-orange-500 outline-none" value="" placeholder="Descripcion">
                </div>
                <div class="w-20">
                    <input type="number" class="nd-item-qty w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded text-center focus:border-orange-500 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value="1" min="0">
                </div>
                <div class="w-24">
                    <input type="text" class="nd-item-unit w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded text-center focus:border-orange-500 outline-none" value="un">
                </div>
                <div class="w-32">
                    <input type="number" class="nd-item-price w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded text-right focus:border-orange-500 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value="0" min="0">
                </div>
                <div class="w-24">
                    <input type="number" class="nd-item-pct-desc w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded text-right focus:border-orange-500 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value="0" min="0" max="100">
                </div>
                <div class="w-32">
                    <input type="number" class="nd-item-total w-full border border-[#e4cbb4] bg-[#fff7f0] p-1 rounded text-right font-bold text-[#5a3318]" readonly value="0">
                    <input type="hidden" class="nd-item-subtotal" value="0">
                </div>
                <div class="w-16 flex items-center justify-center">
                    <button type="button" class="nd-remove-item text-red-500 font-black text-xs">X</button>
                </div>
            </div>
        `;
    }
};
