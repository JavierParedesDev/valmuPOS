window.ValmuInvoicingCreateView = {
    renderItemRow() {
        return `
            <div class="flex items-center bg-white p-3 gap-3 text-sm item-row border-b border-gray-50 group hover:bg-gray-50/50 transition-colors">
                <div class="flex-1">
                    <input type="text" list="list-products" class="form-control border-transparent bg-transparent font-bold text-gray-800 item-nombre placeholder:text-gray-300" value="" placeholder="Buscar producto..." autocomplete="off">
                </div>
                <div class="w-24">
                    <select class="form-control border-transparent bg-transparent text-[10px] font-black uppercase text-gray-400 item-price-type">
                        <option value="normal">EFECTIVO</option>
                        <option value="mayorista">MAYORISTA</option>
                        <option value="tarjeta">TARJETA</option>
                    </select>
                </div>
                <div class="w-20">
                    <input type="number" class="form-control border-transparent bg-transparent text-center font-black text-orange-600 item-qty" value="" oninput="this.value = this.value.replace(/[^0-9]/g, '')" min="0" placeholder="0">
                </div>
                <div class="w-24">
                    <input type="text" class="form-control border-transparent bg-transparent text-center text-[10px] font-bold text-gray-300 uppercase item-unit" value="un.">
                </div>
                <div class="w-32">
                    <div class="relative">
                        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-300">$</span>
                        <input type="text" class="form-control border-transparent bg-transparent pl-4 text-right font-bold text-gray-700 item-price" value="" oninput="this.value = this.value.replace(/[^0-9.,]/g, '')" placeholder="0">
                    </div>
                </div>
                <div class="w-24">
                    <input type="number" class="form-control border-transparent bg-transparent text-center font-bold text-gray-400 item-pct-desc" value="" min="0" max="100" placeholder="0%">
                </div>
                <div class="w-32 text-right pr-4 font-black text-gray-900 item-subtotal">
                    $0
                </div>
            </div>
        `;
    },

    render({ config, today, folio } = {}) {
        return `
            <div class="max-w-6xl mx-auto space-y-6 animate-fade-in pb-20 mt-4">
                
                <!-- SIMPLE HEADER -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 px-2">
                    <div>
                        <h2 class="text-3xl font-black text-gray-900 tracking-tighter uppercase">Factura Electrónica</h2>
                        <p class="text-gray-400 text-sm font-medium">Emisión de Documento Tributario (Tipo 33)</p>
                    </div>
                    <div class="bg-gray-900 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-4">
                        <div class="text-right border-r border-white/10 pr-4">
                            <span class="text-[9px] font-black block opacity-50 uppercase tracking-widest">Folio Sincronizado</span>
                            <span id="dte-folio-display" class="text-xl font-black text-orange-500">${folio}</span>
                            <input type="hidden" id="dte-folio" value="${folio}">
                        </div>
                        <i class="bi bi-shield-check text-2xl text-emerald-500"></i>
                    </div>
                </div>

                <!-- MAIN FORM GRID -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <!-- RECEPTOR SECTION -->
                    <div class="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 space-y-6">
                        <div class="flex items-center gap-3 mb-2">
                            <i class="bi bi-person-badge text-orange-600 text-xl font-black"></i>
                            <h3 class="text-sm font-black text-gray-900 uppercase tracking-widest">Información del Receptor</h3>
                        </div>
                        
                        <div class="grid grid-cols-12 gap-4">
                            <div class="col-span-12 md:col-span-5 relative">
                                <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">RUT Empresa</label>
                                <input type="text" id="dte-rut-recep" class="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold shadow-inner outline-none focus:border-orange-200" placeholder="Ej: 77.292.701-0" required autocomplete="off">
                                <div id="dte-client-suggestions" class="hidden absolute left-0 right-0 top-full mt-2 max-h-56 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl z-50 p-2"></div>
                            </div>
                            <div class="col-span-12 md:col-span-7">
                                <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Razón Social</label>
                                <input type="text" id="dte-rzn-recep" class="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold shadow-inner outline-none" required>
                            </div>
                            <div class="col-span-12">
                                <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Dirección Legal</label>
                                <input type="text" id="dte-dir-recep" class="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium shadow-inner outline-none" required>
                            </div>
                            <div class="col-span-6">
                                <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Comuna</label>
                                <input type="text" id="dte-cmna-recep" class="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium shadow-inner outline-none" required>
                            </div>
                            <div class="col-span-6">
                                <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Ciudad</label>
                                <input type="text" id="dte-ciudad-recep" class="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium shadow-inner outline-none" required>
                            </div>
                            <div class="col-span-12">
                                <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Giro Comercial</label>
                                <input type="text" id="dte-giro-recep" class="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium shadow-inner outline-none">
                            </div>
                        </div>
                    </div>

                    <!-- EMISOR & DATES SECTION -->
                    <div class="space-y-6">
                        <!-- DATE BOX -->
                        <div class="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
                            <div class="grid grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Fecha Emisión</label>
                                    <input type="date" id="dte-fch-emis" value="${today}" class="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold shadow-inner outline-none">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Fecha Vencimiento</label>
                                    <input type="date" id="dte-fch-venc" value="${today}" class="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm font-bold shadow-inner outline-none">
                                </div>
                            </div>
                        </div>

                        <!-- EMISOR PREVIEW (CLASSIC STYLE) -->
                        <div class="bg-gray-50 rounded-[2rem] border border-gray-100 p-8 flex items-center gap-6">
                            <div class="h-14 w-14 rounded-2xl bg-white text-gray-300 flex items-center justify-center text-2xl shadow-sm">
                                <i class="bi bi-building"></i>
                            </div>
                            <div>
                                <span class="text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] block mb-1">Empresa Emisora</span>
                                <p class="text-sm font-black text-gray-800 leading-tight uppercase">${config.razonSocial || 'VALMU SPA'}</p>
                                <p class="text-[10px] text-gray-400 font-medium mt-1 uppercase tracking-tighter">${config.rutEmisor || '77.292.701-0'} • ${config.comuna || 'CORONEL'}</p>
                            </div>
                        </div>

                        <!-- CONDITIONS -->
                        <div class="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8">
                            <label class="block text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest font-bold">Condiciones de Venta</label>
                            <div class="flex items-center gap-4">
                                <select id="dte-forma-pago" class="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-black uppercase shadow-inner outline-none cursor-pointer">
                                    <option>Contado</option>
                                    <option>Crédito</option>
                                    <option>Transferencia</option>
                                </select>
                                <div class="w-px h-8 bg-gray-100"></div>
                                <input type="text" value="DEL GIRO" class="flex-1 px-4 py-3 bg-gray-50 border-transparent text-gray-300 font-black text-xs rounded-xl shadow-inner text-center" readonly>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ITEMS TABLE (CLASSIC REINVENTED) -->
                <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                    <div class="px-8 py-5 border-b border-gray-50 bg-gray-50/20 flex justify-between items-center">
                        <h3 class="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Detalle de Productos / Servicios (Afecto)</h3>
                        <button id="btn-add-line" class="px-4 py-2 bg-gray-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95">
                            <i class="bi bi-plus-circle-fill me-1"></i> Agregar Ítem
                        </button>
                    </div>
                    
                    <div class="bg-gray-50/50 px-2 py-3 border-b border-gray-50 flex text-[9px] font-black text-gray-300 uppercase tracking-widest opacity-80">
                        <div class="px-2 w-full md:w-5/12 ml-2">Descripción</div>
                        <div class="w-24 text-center">Precio</div>
                        <div class="w-20 text-center">Cant.</div>
                        <div class="w-24 text-center">Unidad</div>
                        <div class="w-32 text-center">Unitario</div>
                        <div class="w-24 text-center">% Desc.</div>
                        <div class="w-32 text-right pr-4">Monto</div>
                    </div>

                    <div id="invoice-items-container" class="min-h-[200px]">
                        ${this.renderItemRow()}
                    </div>
                    
                    <div class="p-6 bg-gray-50/50 border-t border-gray-50 flex justify-end">
                        <button id="btn-remove-last" class="text-[9px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 transition-all hidden">
                            <i class="bi bi-eraser-fill me-1"></i> Eliminar Última Fila
                        </button>
                    </div>
                </div>

                <!-- TOTALS SECTION (MINIMALIST) -->
                <div class="flex flex-col md:flex-row gap-6 justify-end items-stretch">
                    <div class="md:w-96 bg-gray-900 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between ml-auto">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-orange-600 rounded-full -mr-16 -mt-16 blur-3xl opacity-20"></div>
                        <div class="space-y-4 relative z-10">
                            <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-50">
                                <span>NETO</span>
                                <input type="text" id="dte-monto-neto" class="bg-transparent border-none p-0 text-right font-black outline-none w-24" value="0" readonly>
                            </div>
                            <div class="flex justify-between items-center text-[10px] font-black uppercase tracking-widest opacity-50">
                                <span>IVA (19%)</span>
                                <input type="text" id="dte-monto-iva" class="bg-transparent border-none p-0 text-right font-black outline-none w-24" value="0" readonly>
                            </div>
                            <div class="pt-6 mt-2 border-t border-white/10">
                                <div class="flex justify-between items-center">
                                    <span class="text-xl font-black uppercase tracking-tight text-orange-600">Total Pago</span>
                                    <input type="text" id="dte-monto-total" class="bg-transparent border-none p-0 text-right text-4xl font-black text-white outline-none w-48 tracking-tighter" value="$0" readonly>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col justify-end gap-4 md:w-80">
                         <button class="w-full py-5 rounded-2xl bg-orange-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-100 hover:bg-orange-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3" id="btn-emitir">
                            <i class="bi bi-rocket-takeoff-fill text-xl"></i> Emitir Factura SII
                        </button>
                        <button class="w-full py-3 rounded-xl bg-white text-gray-400 font-black text-[9px] uppercase tracking-widest border border-gray-100 hover:bg-gray-50 transition-all" id="btn-limpiar">
                            Limpiar Formulario
                        </button>
                    </div>
                </div>

                <!-- HIDDEN LOGIC FIELDS -->
                <input type="hidden" id="emi-razon" value="${config.razonSocial || ''}">
                <input type="hidden" id="emi-direccion" value="${(config.direccion || '').toUpperCase()}">
                <input type="hidden" id="emi-comuna" value="${(config.comuna || '').toUpperCase()}">
                <input type="hidden" id="emi-ciudad" value="${(config.ciudad || 'CONCEPCION').toUpperCase()}">
                <input type="hidden" id="emi-giro" value="${config.giro || ''}">
                <input type="hidden" id="emi-acteco" value="${config.acteco || ''}">
                <input type="hidden" id="emi-email" value="${config.email || ''}">
                <input type="hidden" id="emi-telefono" value="${config.telefono || ''}">
                <select id="dte-tipo" class="hidden"><option value="33" selected>33</option></select>
                <input id="dte-folio-hidden" type="hidden" value="0">
                <input type="hidden" id="dte-subtotal" value="0">
                <input type="hidden" id="dte-descuento-global" value="0">
                <input type="hidden" id="dte-monto-calculado" value="0">
                
                <datalist id="list-clients"></datalist>
                <datalist id="list-products"></datalist>
            </div>
        `;
    }
}
