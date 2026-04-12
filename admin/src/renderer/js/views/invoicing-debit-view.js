window.ValmuInvoicingDebitView = {
    render({ config, today, folio } = {}) {
        return `
            <div class="max-w-6xl mx-auto space-y-6 animate-fade-in pb-10">
                
                <!-- HEADER & REFERENCE -->
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6 border-l-8 border-l-emerald-500">
                    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h2 class="text-xl font-bold text-gray-800">Nota de Débito</h2>
                            <p class="text-sm text-gray-500">Recargo o Incremento (Tipo 56)</p>
                        </div>
                        <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-xl text-center">
                            <div class="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Folio Asignado</div>
                            <div class="text-lg font-black text-emerald-900" id="nd-folio-display">${folio}</div>
                            <input type="hidden" id="nd-folio" value="${folio}">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div class="bg-gray-50/50 p-4 rounded-xl">
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-2">Tipo Ref.</label>
                            <select id="nd-ref-type" class="w-full bg-white border border-gray-100 rounded-lg p-2 text-sm font-bold">
                                <option value="33" selected>Factura Electrónica (33)</option>
                                <option value="39">Boleta Electrónica (39)</option>
                            </select>
                        </div>
                        <div class="bg-gray-50/50 p-4 rounded-xl">
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-2">Folio Ref.</label>
                            <div class="flex gap-2">
                                <input type="number" id="nd-ref-folio" class="w-full bg-white border border-gray-100 rounded-lg p-2 font-bold text-center" placeholder="000">
                                <button id="btn-nd-load-ref" class="bg-orange-600 text-white p-2 px-3 rounded-lg"><i class="bi bi-search"></i></button>
                            </div>
                        </div>
                        <div class="bg-gray-50/50 p-4 rounded-xl">
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-2">Fecha Ref.</label>
                            <input type="date" id="nd-ref-date" value="${today}" class="w-full bg-white border border-gray-100 rounded-lg p-2 text-sm font-bold">
                        </div>
                        <div class="bg-gray-50/50 p-4 rounded-xl">
                            <label class="block text-[10px] font-bold text-gray-400 uppercase mb-2">Código Acción</label>
                            <select id="nd-ref-code" class="w-full bg-white border border-gray-100 rounded-lg p-2 text-sm font-bold">
                                <option value="3" selected>3. Corrige Monto</option>
                                <option value="1">1. Anula Documento</option>
                                <option value="2">2. Corrige Texto</option>
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
                            <input type="text" id="nd-rut-recep" class="w-full border border-gray-100 rounded-lg p-2 text-sm font-black" placeholder="BUSCAR...">
                        </div>
                        <div class="md:col-span-9">
                            <label class="block text-[9px] font-bold text-gray-400 uppercase mb-1">Razón Social</label>
                            <input type="text" id="nd-rzn-recep" class="w-full border border-gray-100 rounded-lg p-2 text-sm font-medium">
                        </div>
                        <input type="hidden" id="nd-dir-recep"> <input type="hidden" id="nd-cmna-recep"> <input type="hidden" id="nd-ciudad-recep"> <input type="hidden" id="nd-giro-recep"> <input type="hidden" id="nd-contacto-recep">
                    </div>
                </div>

                <!-- ITEMS TABLE -->
                <div class="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                        <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">DETALLE DEL CARGO</h3>
                        <button id="btn-nd-add-line" class="text-xs font-bold text-gray-400 hover:text-emerald-600 flex items-center gap-2">
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
                        <tbody id="nd-items-container" class="divide-y divide-gray-50">
                            ${this.renderItemRow()}
                        </tbody>
                    </table>
                </div>

                <!-- FOOTER -->
                <div class="flex flex-col md:flex-row gap-6 justify-end items-end">
                    <div class="w-full md:w-80 space-y-4">
                         <button id="btn-emit-nd" class="w-full h-16 rounded-xl bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.2em] shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-3">
                            <i class="bi bi-file-earmark-plus-fill"></i> Emitir Nota de Débito
                         </button>
                    </div>
                    <div class="w-full md:w-80 bg-gray-900 rounded-xl p-6 text-white space-y-2">
                        <div class="flex justify-between text-[10px] font-bold opacity-50 uppercase">
                            <span>Neto</span>
                            <span id="nd-monto-neto">$0</span>
                        </div>
                        <div class="flex justify-between text-[10px] font-bold opacity-50 uppercase">
                            <span>IVA (19%)</span>
                            <span id="nd-monto-iva">$0</span>
                        </div>
                        <div class="pt-2 border-t border-white/10 flex justify-between items-center">
                            <span class="text-xs font-black uppercase text-emerald-500">Monto Final</span>
                            <span id="nd-monto-total" class="text-2xl font-black">$0</span>
                        </div>
                    </div>
                </div>

                <!-- HIDDEN PROPS -->
                <input type="hidden" id="nd-emi-razon" value="${config.razonSocial || ''}">
                <input type="hidden" id="nd-emi-dir" value="${config.direccion || ''}">
                <input type="hidden" id="nd-emi-comuna" value="${config.comuna || ''}">
                <input type="hidden" id="nd-emi-ciudad" value="${config.ciudad || ''}">
                <input type="hidden" id="nd-emi-giro" value="${config.giro || ''}">
                <input type="hidden" id="nd-emi-acteco" value="${config.acteco || ''}">
                <input type="hidden" id="nd-emi-email" value="${config.email || ''}">
                <input type="hidden" id="nd-emisor-fono" value="${config.telefono || ''}">
                <input type="hidden" id="nd-fch-emis" value="${today}">
                <input type="hidden" id="nd-fch-venc" value="${today}">
                <input type="hidden" id="nd-descuento-global" value="0">
                <input type="hidden" id="nd-monto-calculado" value="0">
                <input type="hidden" id="nd-subtotal" value="0">
                <input type="hidden" id="nd-net-amount" value="0">
            </div>
        `;
    },

    renderItemRow() {
        return `
            <tr class="nd-item-row hover:bg-emerald-50/20 transition-all">
                <td class="px-6 py-4">
                    <input type="text" class="nd-item-nombre w-full bg-transparent border-none outline-none text-sm font-bold text-gray-900" placeholder="Descripción...">
                </td>
                <td class="px-3 py-4">
                    <input type="number" class="nd-item-qty w-full bg-gray-50 border-none rounded p-1 text-center font-bold" value="1">
                </td>
                <td class="px-3 py-4">
                    <input type="number" class="nd-item-price w-full bg-gray-50 border-none rounded p-1 text-right font-bold" value="0">
                </td>
                <td class="px-3 py-4">
                    <input type="number" class="nd-item-pct-desc w-full bg-gray-50 border-none rounded p-1 text-center font-bold" value="0" min="0" max="100">
                </td>
                <td class="px-3 py-4 text-right">
                    <span class="nd-item-total text-sm font-black">$0</span>
                    <input type="hidden" class="nd-item-subtotal" value="0">
                </td>
                <td class="px-6 py-4 text-right">
                    <button class="nd-remove-item text-gray-300 hover:text-red-500"><i class="bi bi-x-circle-fill"></i></button>
                </td>
            </tr>
        `;
    }
};
