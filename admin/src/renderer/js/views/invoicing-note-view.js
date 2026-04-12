window.ValmuInvoicingNoteView = {
    render({ config, today, folio } = {}) {
        return `
            <div class="max-w-6xl mx-auto space-y-6 animate-fade-in pb-10">
                
                <!-- HEADER & REFERENCE -->
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6 border-l-8 border-l-red-500">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">Nota de Crédito</h2>
                            <p class="text-sm text-gray-500">Anulación o Devolución (Tipo 61)</p>
                        </div>
                        <div class="bg-red-50 border border-red-100 p-4 rounded-xl text-center">
                            <div class="text-[10px] font-bold text-red-600 uppercase tracking-widest mb-1">Folio Asignado</div>
                            <div class="text-lg font-black text-red-900" id="nc-folio-display">${folio}</div>
                            <input type="hidden" id="nc-folio" value="${folio}">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="bg-gray-50/50 p-4 rounded-xl">
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-2">Tipo Ref.</label>
                            <select id="nc-ref-type" class="w-full bg-white border border-gray-100 rounded-lg p-2 text-sm font-bold">
                                <option value="33" selected>Factura Electrónica (33)</option>
                                <option value="39">Boleta Electrónica (39)</option>
                            </select>
                        </div>
                        <div class="bg-gray-50/50 p-4 rounded-xl">
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-2">Folio Ref.</label>
                            <div class="flex gap-2">
                                <input type="number" id="nc-ref-folio" class="w-full bg-white border border-gray-100 rounded-lg p-2 font-bold text-center" placeholder="000">
                                <button id="btn-nc-load-ref" class="bg-orange-600 text-white p-2 px-3 rounded-lg"><i class="bi bi-search"></i></button>
                            </div>
                        </div>
                        <div class="bg-gray-50/50 p-4 rounded-xl">
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-2">Fecha Ref.</label>
                            <input type="date" id="nc-ref-date" value="${today}" class="w-full bg-white border border-gray-100 rounded-lg p-2 text-sm font-bold">
                        </div>
                        <div class="bg-gray-50/50 p-4 rounded-xl">
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-2">Motivo / Acción</label>
                            <select id="nc-ref-code" class="w-full bg-white border border-gray-100 rounded-lg p-2 text-sm font-bold">
                                <option value="1">1. Anula Documento</option>
                                <option value="2">2. Corrige Texto</option>
                                <option value="3">3. Corrige Monto</option>
                            </select>
                        </div>
                    </div>
                </div>

                <!-- RECEPTOR (DENSE) -->
                <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">DATOS RECEPTOR</h3>
                    <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div class="md:col-span-3">
                            <label class="block text-[9px] font-bold text-gray-400 uppercase mb-1">RUT Receptor</label>
                            <input type="text" id="nc-rut-recep" class="w-full border border-gray-100 rounded-lg p-2 text-sm font-black" placeholder="BUSCAR...">
                        </div>
                        <div class="md:col-span-9">
                            <label class="block text-[9px] font-bold text-gray-400 uppercase mb-1">Razón Social</label>
                            <input type="text" id="nc-rzn-recep" class="w-full border border-gray-100 rounded-lg p-2 text-sm font-medium">
                        </div>
                        <input type="hidden" id="nc-dir-recep"> <input type="hidden" id="nc-cmna-recep"> <input type="hidden" id="nc-ciudad-recep"> <input type="hidden" id="nc-giro-recep"> <input type="hidden" id="nc-contacto-recep">
                    </div>
                </div>

                <!-- ITEMS TABLE -->
                <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                        <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">DETALLE DEL ABONO</h3>
                        <button id="btn-nc-add-line" class="text-xs font-bold text-gray-400 hover:text-red-600 flex items-center gap-2">
                            <i class="bi bi-plus-circle-fill"></i> Agregar Detalle
                        </button>
                    </div>
                    <table class="w-full border-collapse">
                        <thead>
                            <tr class="bg-gray-50/50">
                                <th class="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase text-left">Descripción</th>
                                <th class="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase text-center" style="width: 80px;">Cant.</th>
                                <th class="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase text-right" style="width: 120px;">Precio</th>
                                <th class="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase text-center" style="width: 80px;">% Desc.</th>
                                <th class="px-3 py-3 text-[10px] font-bold text-gray-400 uppercase text-right" style="width: 120px;">Total</th>
                                <th class="px-6 py-3" style="width: 50px;"></th>
                            </tr>
                        </thead>
                        <tbody id="nc-items-container" class="divide-y divide-gray-50">
                            ${this.renderItemRow()}
                        </tbody>
                    </table>
                </div>

                <!-- FOOTER -->
                <div class="flex flex-col md:flex-row gap-6 justify-end items-end">
                    <div class="w-full md:w-80 space-y-4">
                         <button id="btn-emit-nc" class="w-full h-16 rounded-xl bg-red-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-red-700 transition-all flex items-center justify-center gap-3">
                            <i class="bi bi-file-earmark-check-fill"></i> Emitir Nota de Crédito
                         </button>
                    </div>
                    <div class="w-full md:w-80 bg-gray-900 rounded-xl p-6 text-white space-y-2">
                        <div class="flex justify-between text-[10px] font-bold opacity-50 uppercase">
                            <span>Neto</span>
                            <span id="nc-monto-neto">$0</span>
                        </div>
                        <div class="flex justify-between text-[10px] font-bold opacity-50 uppercase">
                            <span>IVA (19%)</span>
                            <span id="nc-monto-iva">$0</span>
                        </div>
                        <div class="pt-2 border-t border-white/10 flex justify-between items-center">
                            <span class="text-xs font-black uppercase text-red-500">Total Abono</span>
                            <span id="nc-monto-total" class="text-2xl font-black">$0</span>
                        </div>
                    </div>
                </div>

                <!-- HIDDEN PROPS -->
                <input type="hidden" id="nc-emi-razon" value="${config.razonSocial || ''}">
                <input type="hidden" id="nc-emi-dir" value="${config.direccion || ''}">
                <input type="hidden" id="nc-emi-comuna" value="${config.comuna || ''}">
                <input type="hidden" id="nc-emi-ciudad" value="${config.ciudad || ''}">
                <input type="hidden" id="nc-emi-giro" value="${config.giro || ''}">
                <input type="hidden" id="nc-emi-acteco" value="${config.acteco || ''}">
                <input type="hidden" id="nc-emi-email" value="${config.email || ''}">
                <input type="hidden" id="nc-emisor-fono" value="${config.telefono || ''}">
                <input type="hidden" id="nc-fch-emis" value="${today}">
                <input type="hidden" id="nc-fch-venc" value="${today}">
                <input type="hidden" id="nc-descuento-global" value="0">
                <input type="hidden" id="nc-monto-calculado" value="0">
                <input type="hidden" id="nc-subtotal" value="0">
                <input type="hidden" id="nc-net-amount" value="0">
            </div>
        `;
    },

    renderItemRow() {
        return `
            <tr class="nc-item-row hover:bg-red-50/20 transition-all">
                <td class="px-6 py-4">
                    <input type="text" class="nc-item-nombre w-full bg-transparent border-none outline-none text-sm font-bold text-gray-900" placeholder="Descripción...">
                </td>
                <td class="px-3 py-4">
                    <input type="number" class="nc-item-qty w-full bg-gray-50 border-none rounded p-1 text-center font-bold" value="1">
                </td>
                <td class="px-3 py-4">
                    <input type="number" class="nc-item-price w-full bg-gray-50 border-none rounded p-1 text-right font-bold" value="0">
                </td>
                <td class="px-3 py-4">
                    <input type="number" class="nc-item-pct-desc w-full bg-gray-50 border-none rounded p-1 text-center font-bold" value="0" min="0" max="100">
                </td>
                <td class="px-3 py-4 text-right">
                    <span class="nc-item-total text-sm font-black">$0</span>
                    <input type="hidden" class="nc-item-subtotal" value="0">
                </td>
                <td class="px-6 py-4 text-right">
                    <button class="nc-remove-item text-gray-300 hover:text-red-500"><i class="bi bi-x-circle-fill"></i></button>
                </td>
            </tr>
        `;
    }
};
