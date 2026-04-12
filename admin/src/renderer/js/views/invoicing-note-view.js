window.ValmuInvoicingNoteView = {
    render({ config, today, folio } = {}) {
        return `
            <div class="max-w-7xl mx-auto pb-10 space-y-8">
                <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div class="xl:col-span-2 bg-white/90 border border-orange-100 rounded-[28px] shadow-sm p-8">
                        <h3 class="text-xl font-black text-[#4B2E1F] uppercase tracking-tight">Nota de Credito Electronica</h3>
                        <p class="text-sm text-[#9B6B4A] mt-1">Documento tipo 61 para anular o corregir una venta previa.</p>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                            <div>
                                <label class="block text-[11px] font-black text-[#B86B2B] uppercase mb-1">Folio</label>
                                <input id="nc-folio-display" type="number" readonly value="${folio}" class="w-full rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 font-black text-[#4B2E1F]">
                                <input id="nc-folio" type="hidden" value="${folio}">
                            </div>
                            <div>
                                <label class="block text-[11px] font-black text-[#B86B2B] uppercase mb-1">Fecha Emision</label>
                                <input id="nc-fch-emis" type="date" value="${today}" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]">
                            </div>
                            <div>
                                <label class="block text-[11px] font-black text-[#B86B2B] uppercase mb-1">Fecha Vencimiento</label>
                                <input id="nc-fch-venc" type="date" value="${today}" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]">
                            </div>
                        </div>
                    </div>

                    <div class="bg-white/90 border-2 border-red-200 rounded-[28px] shadow-sm p-8 text-center">
                        <div class="text-xs font-black text-red-600 uppercase tracking-[0.2em]">RUT ${config.rutEmisor || ''}</div>
                        <div class="mt-3 text-2xl font-black text-[#4B2E1F] leading-tight">NOTA DE CREDITO</div>
                        <div class="text-sm font-bold text-[#9B6B4A]">ELECTRONICA</div>
                        <div class="mt-4 text-lg font-black text-red-700">Folio ${folio}</div>
                        <div class="text-xs font-black text-[#9B6B4A] mt-2">S.I.I. CONCEPCION</div>
                    </div>
                </div>

                <div class="bg-white/90 border border-orange-100 rounded-[28px] shadow-sm p-8">
                    <h4 class="text-[12px] font-black text-[#FF6A00] uppercase tracking-[0.2em] mb-4">Documento Referenciado</h4>
                    <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-1">Tipo Doc.</label>
                            <select id="nc-ref-type" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]">
                                <option value="33" selected>Factura Electronica (33)</option>
                                <option value="39">Boleta Electronica (39)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-1">Folio Ref.</label>
                            <div class="flex gap-2">
                                <input id="nc-ref-folio" type="number" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]" placeholder="Ej: 123">
                                <button id="btn-nc-load-ref" type="button" class="px-4 rounded-xl bg-orange-500 text-white font-black">Buscar</button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-1">Fecha Ref.</label>
                            <input id="nc-ref-date" type="date" value="${today}" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]">
                        </div>
                        <div>
                            <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-1">Codigo Ref.</label>
                            <select id="nc-ref-code" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]">
                                <option value="1">1. Anula Documento</option>
                                <option value="2">2. Corrige Texto</option>
                                <option value="3">3. Corrige Montos</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-1">Motivo</label>
                            <input id="nc-ref-reason" type="text" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]" placeholder="Motivo de la NC">
                        </div>
                    </div>
                </div>

                <div class="bg-white/90 border border-orange-100 rounded-[28px] shadow-sm p-8">
                    <h4 class="text-[12px] font-black text-[#FF6A00] uppercase tracking-[0.2em] mb-4">Datos Receptor</h4>
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div class="md:col-span-3">
                            <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-1">RUT</label>
                            <input id="nc-rut-recep" type="text" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]" placeholder="Buscar...">
                        </div>
                        <div class="md:col-span-9">
                            <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-1">Razon Social</label>
                            <input id="nc-rzn-recep" type="text" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]">
                        </div>
                        <div class="md:col-span-5">
                            <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-1">Direccion</label>
                            <input id="nc-dir-recep" type="text" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]">
                        </div>
                        <div class="md:col-span-3">
                            <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-1">Comuna</label>
                            <input id="nc-cmna-recep" type="text" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-1">Ciudad</label>
                            <input id="nc-ciudad-recep" type="text" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]">
                        </div>
                        <div class="md:col-span-2">
                            <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-1">Contacto</label>
                            <input id="nc-contacto-recep" type="text" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]">
                        </div>
                        <div class="md:col-span-8">
                            <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-1">Giro</label>
                            <input id="nc-giro-recep" type="text" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]">
                        </div>
                    </div>
                </div>

                <div class="bg-white/90 border border-orange-100 rounded-[28px] shadow-sm p-8">
                    <div class="flex items-center justify-between mb-4">
                        <h4 class="text-[12px] font-black text-[#FF6A00] uppercase tracking-[0.2em]">Detalle Nota de Credito</h4>
                        <div class="flex gap-2">
                            <button id="btn-nc-add-line" type="button" class="px-4 py-2 rounded-xl bg-orange-500 text-white font-black text-xs uppercase">Agregar linea</button>
                            <button id="btn-nc-remove-last" type="button" class="px-4 py-2 rounded-xl bg-white border border-orange-200 text-[#7A4A28] font-black text-xs uppercase">Quitar</button>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full min-w-[900px] text-sm">
                            <thead>
                                <tr class="text-[#8C5A35]">
                                    <th class="text-left font-black py-3">DESCRIPCION</th>
                                    <th class="text-center font-black py-3">CANT.</th>
                                    <th class="text-center font-black py-3">UNIDAD</th>
                                    <th class="text-right font-black py-3">PRECIO</th>
                                    <th class="text-right font-black py-3">% DESC.</th>
                                    <th class="text-right font-black py-3">SUBTOTAL</th>
                                    <th class="text-right font-black py-3"></th>
                                </tr>
                            </thead>
                            <tbody id="nc-items-container">
                                ${this.renderItemRow()}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div class="bg-white/90 border border-orange-100 rounded-[28px] shadow-sm p-8">
                        <label class="block text-[11px] font-black text-[#7A4A28] uppercase mb-2">Forma de Pago</label>
                        <select id="nc-forma-pago" class="w-full rounded-xl border border-orange-200 px-4 py-3 font-bold text-[#4B2E1F]">
                            <option value="1" selected>Contado</option>
                            <option value="2">Credito</option>
                        </select>
                        <input id="nc-medio-pago" type="hidden" value="EF">
                        <button id="btn-nc-limpiar" type="button" class="mt-6 w-full px-4 py-3 rounded-xl bg-purple-700 text-white font-black uppercase text-sm">Limpiar</button>
                    </div>

                    <div class="xl:col-span-2 bg-white/90 border border-orange-100 rounded-[28px] shadow-sm p-8">
                        <div class="grid grid-cols-2 gap-4 items-center">
                            <label class="font-black text-[#7A4A28]">Sub Total</label>
                            <input id="nc-subtotal" type="number" readonly value="0" class="w-full rounded-xl border border-orange-200 px-4 py-3 text-right font-black text-[#4B2E1F] bg-orange-50">

                            <label class="font-black text-[#7A4A28]">Desc. Global %</label>
                            <input id="nc-descuento-global" type="number" value="0" min="0" max="100" class="w-full rounded-xl border border-orange-200 px-4 py-3 text-right font-black text-[#4B2E1F]">

                            <label class="font-black text-[#7A4A28]">Monto Neto</label>
                            <input id="nc-monto-neto" type="number" readonly value="0" class="w-full rounded-xl border border-orange-200 px-4 py-3 text-right font-black text-[#4B2E1F] bg-orange-50">

                            <label class="font-black text-[#7A4A28]">IVA %</label>
                            <div class="grid grid-cols-2 gap-4">
                                <input type="number" readonly value="19" class="w-full rounded-xl border border-orange-200 px-4 py-3 text-right font-black text-[#4B2E1F] bg-orange-50">
                                <input id="nc-monto-iva" type="number" readonly value="0" class="w-full rounded-xl border border-orange-200 px-4 py-3 text-right font-black text-[#4B2E1F] bg-orange-50">
                            </div>

                            <label class="font-black text-[#4B2E1F] text-xl">Total</label>
                            <input id="nc-monto-total" type="number" readonly value="0" class="w-full rounded-xl border-2 border-[#4B2E1F] px-4 py-3 text-right font-black text-[#4B2E1F] text-2xl bg-white">
                        </div>

                        <div class="mt-6 flex justify-end">
                            <button id="btn-emit-nc" type="button" class="px-8 py-4 rounded-2xl bg-red-600 text-white font-black uppercase tracking-wide shadow-sm">Emitir Nota de Credito</button>
                        </div>
                    </div>
                </div>

                <input type="hidden" id="nc-monto-calculado" value="0">
                <input type="hidden" id="nc-net-amount" value="0">
                <input type="hidden" id="nc-emi-razon" value="${config.razonSocial || ''}">
                <input type="hidden" id="nc-emi-dir" value="${config.direccion || ''}">
                <input type="hidden" id="nc-emi-comuna" value="${config.comuna || ''}">
                <input type="hidden" id="nc-emi-ciudad" value="${config.ciudad || ''}">
                <input type="hidden" id="nc-emi-giro" value="${config.giro || ''}">
                <input type="hidden" id="nc-emi-acteco" value="${config.acteco || ''}">
                <input type="hidden" id="nc-emi-email" value="${config.email || ''}">
                <input type="hidden" id="nc-emisor-fono" value="${config.telefono || ''}">
            </div>
        `;
    },

    renderItemRow() {
        return `
            <tr class="nc-item-row border-t border-orange-50">
                <td class="py-2 pr-2">
                    <input type="text" class="nc-item-nombre w-full rounded-xl border border-orange-200 px-3 py-2 font-bold text-[#4B2E1F]" placeholder="Descripcion">
                </td>
                <td class="py-2 px-1">
                    <input type="number" class="nc-item-qty w-full rounded-xl border border-orange-200 px-3 py-2 text-center font-bold text-[#4B2E1F]" value="1">
                </td>
                <td class="py-2 px-1">
                    <input type="text" class="nc-item-unit w-full rounded-xl border border-orange-200 px-3 py-2 text-center font-bold text-[#4B2E1F]" value="un">
                </td>
                <td class="py-2 px-1">
                    <input type="number" class="nc-item-price w-full rounded-xl border border-orange-200 px-3 py-2 text-right font-bold text-[#4B2E1F]" value="0">
                </td>
                <td class="py-2 px-1">
                    <input type="number" class="nc-item-pct-desc w-full rounded-xl border border-orange-200 px-3 py-2 text-right font-bold text-[#4B2E1F]" value="0" min="0" max="100">
                </td>
                <td class="py-2 pl-2">
                    <input type="number" class="nc-item-total w-full rounded-xl border border-orange-200 px-3 py-2 text-right font-black text-[#4B2E1F] bg-orange-50" readonly value="0">
                    <input type="hidden" class="nc-item-subtotal" value="0">
                </td>
                <td class="py-2 pl-2 text-right">
                    <button type="button" class="nc-remove-item text-red-500 font-black">X</button>
                </td>
            </tr>
        `;
    }
};
