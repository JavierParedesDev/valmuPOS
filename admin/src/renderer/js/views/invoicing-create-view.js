window.ValmuInvoicingCreateView = {
    renderItemRow() {
        return `
 <div class="flex bg-[#fffdf9] border-x border-b border-[#e4cbb4] p-2 gap-2 text-sm item-row">
 <div class="w-full md:w-5/12 relative">
 <input type="text" list="list-products" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded focus:border-orange-500 outline-none item-nombre" value="" placeholder="Buscar producto..." autocomplete="off">
 </div>
 <div class="w-24">
 <select class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded text-xs focus:border-orange-500 outline-none item-price-type">
 <option value="normal">Efectivo</option>
 <option value="mayorista">Mayor</option>
 <option value="tarjeta">Tarjeta</option>
 </select>
 </div>
 <div class="w-20">
 <input type="text" inputmode="decimal" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded text-right focus:border-orange-500 outline-none item-qty" value="" oninput="this.value = this.value.replace(/[^0-9.,]/g, '').replace(/([.,].*)[.,]/g, '$1')" placeholder="0.000">
 </div>
 <div class="w-24">
 <input type="text" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded text-right focus:border-orange-500 outline-none item-unit" value="un">
 </div>
 <div class="w-32">
 <input type="text" inputmode="decimal" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded text-right focus:border-orange-500 outline-none item-price" value="" oninput="this.value = this.value.replace(/[^0-9.,]/g, '')" placeholder="0.00">
 </div>
 <div class="w-24">
 <input type="number" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded text-right focus:border-orange-500 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none item-pct-desc" value="" oninput="this.value = this.value.replace(/[^0-9]/g, ''); if(this.value > 100) this.value = 100; if(this.value.length > 3) this.value = this.value.slice(0, 3);" min="0" max="100">
 </div>
 <div class="w-32">
 <input type="text" class="w-full border border-[#e4cbb4] bg-[#fff7f0] p-1 rounded text-right font-bold text-[#5a3318] item-subtotal" value="0" readonly>
 </div>
 </div>
 `;
    },

    render({ config, today, folio } = {}) {
        return `
 <div class="p-4 max-w-6xl mx-auto bg-[#fffdf9] min-h-screen text-[#3d2a1e]">
 
 <div class="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
 <div class="flex-1 pt-4"></div>

 <div class="w-full md:w-80">
 <div class="border border-[#e4cbb4] p-6 text-center bg-[#fff7f0] rounded shadow-sm">
 <h3 class="text-blue-900 font-bold text-lg uppercase tracking-tight">Rut ${config.rutEmisor || 'Sin Configurar'}</h3>
 <div class="text-blue-900 font-bold text-lg my-1 uppercase">Factura Electrónica</div>
 </div>
 </div>
 </div>

 <div class="flex flex-col md:flex-row justify-end items-center gap-4 mb-6 text-sm">
 <div class="flex border border-[#e4cbb4] rounded overflow-hidden">
 <span class="bg-[#fff1e4] px-3 py-1 border-r font-medium text-[#705745]">Siguiente Folio</span>
 <input type="number" id="dte-folio" value="${folio}" class="px-3 py-1 w-20 text-center outline-none bg-[#fff7f0]" readonly>
 </div>

 <div class="flex border border-[#e4cbb4] rounded overflow-hidden">
 <span class="bg-[#fff1e4] px-3 py-1 border-r font-medium text-[#705745]">Fecha Emisión</span>
 <input type="date" id="dte-fch-emis" value="${today}" class="px-3 py-1 w-40 text-center outline-none bg-[#fffdf9]">
 </div>

 <div class="flex border border-[#e4cbb4] rounded overflow-hidden">
 <span class="bg-[#fff1e4] px-3 py-1 border-r font-medium text-[#705745]">Fecha Venc.</span>
 <input type="date" id="dte-fch-venc" value="${today}" class="px-3 py-1 w-40 text-center outline-none bg-[#fffdf9]">
 </div>
 </div>

 <datalist id="list-clients"></datalist>
 <datalist id="list-products"></datalist>

 <div class="border border-[#e4cbb4] rounded mb-6">
 <div class="bg-[#fff7f0] px-4 py-2 border-b flex justify-between items-center cursor-pointer">
 <h3 class="text-[#dd6313] font-bold text-sm uppercase">Datos Emisor</h3>
 </div>
 <div class="p-4 grid grid-cols-12 gap-3 text-sm bg-[#fffdf9]">
 <div class="col-span-12">
 <label class="block text-[#92735e] text-xs mb-1">Razón Social</label>
 <input type="text" id="emi-razon" value="${config.razonSocial || ''}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none focus:border-[#f97316]">
 </div>

 <div class="col-span-12 md:col-span-6">
 <label class="block text-[#92735e] text-xs mb-1">Dirección</label>
 <input type="text" id="emi-direccion" value="${(config.direccion || '').toUpperCase()}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none focus:border-[#f97316] uppercase">
 </div>
 <div class="col-span-12 md:col-span-3">
 <label class="block text-[#92735e] text-xs mb-1">Comuna</label>
 <input type="text" id="emi-comuna" value="${(config.comuna || '').toUpperCase()}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none focus:border-[#f97316] uppercase">
 </div>
 <div class="col-span-12 md:col-span-3">
 <label class="block text-[#92735e] text-xs mb-1">Ciudad</label>
 <input type="text" id="emi-ciudad" value="${(config.ciudad || 'CONCEPCION').toUpperCase()}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none focus:border-[#f97316] uppercase">
 </div>

 <div class="col-span-12 md:col-span-6">
 <label class="block text-[#92735e] text-xs mb-1">Tipo de Venta</label>
 <input type="text" value="Del Giro" class="w-full border border-[#e4cbb4] p-1 px-2 rounded outline-none bg-[#fff1e4] text-[#705745] cursor-not-allowed" readonly>
 </div>
 <div class="col-span-12 md:col-span-3">
 <label class="block text-[#92735e] text-xs mb-1">Email</label>
 <input type="text" id="emi-email" value="${config.email || ''}" class="w-full border border-[#e4cbb4] bg-[#fff1e4] p-1 px-2 rounded outline-none" readonly tabindex="-1">
 </div>
 <div class="col-span-12 md:col-span-3">
 <label class="block text-[#92735e] text-xs mb-1">Teléfono</label>
 <input type="tel" id="emi-telefono" value="${config.telefono || ''}" class="w-full border border-[#e4cbb4] bg-[#fff1e4] p-1 px-2 rounded outline-none" readonly tabindex="-1">
 </div>

 <div class="col-span-12 md:col-span-5">
 <label class="block text-[#92735e] text-xs mb-1">Giro</label>
 <input type="text" id="emi-giro" value="${config.giro || ''}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none text-xs truncate focus:border-[#f97316]" title="${config.giro || ''}">
 </div>
 <div class="col-span-12 md:col-span-7">
 <label class="block text-[#92735e] text-xs mb-1">Act. Econo.</label>
 <input type="number" id="emi-acteco" value="${config.acteco || ''}" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none text-xs focus:border-[#f97316]" placeholder="Ej: 463019">
 </div>
 </div>
 </div>

 <div class="border border-[#e4cbb4] rounded mb-6">
 <div class="bg-[#fff7f0] px-4 py-2 border-b flex justify-between items-center">
 <h3 class="text-orange-500 font-bold text-sm uppercase">Datos Receptor</h3>
 </div>
 <div class="p-4 grid grid-cols-12 gap-3 text-sm bg-[#fffdf9]">
 <div class="col-span-12 md:col-span-2 relative">
 <label class="block text-[#92735e] text-xs mb-1">RUT <span class="text-red-500">*</span></label>
 <input type="text" id="dte-rut-recep" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none uppercase" placeholder="Buscar..." required autocomplete="off">
 <div id="dte-client-suggestions" class="hidden absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded border border-[#e4cbb4] bg-[#fffdf9] shadow-lg z-20"></div>
 </div>
 <div class="col-span-12 md:col-span-6">
 <label class="block text-[#92735e] text-xs mb-1">Razón Social <span class="text-red-500">*</span></label>
 <input type="text" id="dte-rzn-recep" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none" required>
 </div>
 <div class="col-span-12 md:col-span-4">
 <label class="block text-[#92735e] text-xs mb-1">Tipo de Compra</label>
 <input type="text" value="Del Giro" class="w-full border border-[#e4cbb4] p-1 px-2 rounded outline-none bg-[#fff1e4] text-[#705745] cursor-not-allowed" readonly>
 </div>

 <div class="col-span-12 md:col-span-6">
 <label class="block text-[#92735e] text-xs mb-1">Dirección <span class="text-red-500">*</span></label>
 <input type="text" id="dte-dir-recep" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none" required>
 </div>
 <div class="col-span-12 md:col-span-3">
 <label class="block text-[#92735e] text-xs mb-1">Comuna <span class="text-red-500">*</span></label>
 <input type="text" id="dte-cmna-recep" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none" required>
 </div>
 <div class="col-span-12 md:col-span-3">
 <label class="block text-[#92735e] text-xs mb-1">Ciudad <span class="text-red-500">*</span></label>
 <input type="text" id="dte-ciudad-recep" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none" required>
 </div>

 <div class="col-span-12 md:col-span-5">
 <label class="block text-[#92735e] text-xs mb-1">Giro</label>
 <input type="text" id="dte-giro-recep" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded focus:border-orange-500 outline-none">
 </div>
 <div class="col-span-12 md:col-span-4">
 <label class="block text-[#92735e] text-xs mb-1">Contacto</label>
 <input type="text" id="dte-contacto-recep" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none focus:border-orange-500 uppercase">
 </div>
 <div class="col-span-12 md:col-span-3">
 <label class="block text-[#92735e] text-xs mb-1">Rut Solicita</label>
 <input type="text" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 px-2 rounded outline-none focus:border-orange-500 uppercase" placeholder="Ej: 15.123.456-7">
 </div>
 </div>
 </div>

 <div class="mb-6">
 <div class="flex bg-[#fff1e4] border border-[#e4cbb4] text-xs font-bold text-[#705745] uppercase">
 <div class="p-2 w-full md:w-5/12 border-r">Nombre Producto</div>
 <div class="p-2 w-24 border-r text-center">Tipo Precio</div>
 <div class="p-2 w-20 border-r text-center">Cant.</div>
 <div class="p-2 w-24 border-r text-center">Unidad</div>
 <div class="p-2 w-32 border-r text-center">Precio</div>
 <div class="p-2 w-24 border-r text-center">% Desc.</div>
 <div class="p-2 w-32 text-center">SubTotal</div>
 </div>

 <div id="invoice-items-container">
 ${this.renderItemRow()}
 </div>
 
 <div class="mt-2 flex justify-center gap-4">
 <button id="btn-remove-last" class="bg-red-600 hover:bg-red-700 text-white text-sm font-bold py-1 px-4 rounded shadow hidden">
 <i class="fas fa-trash"></i> Eliminar última
 </button>
 <button id="btn-add-line" class="bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold py-1 px-4 rounded shadow">
 Agrega línea de Detalle
 </button>
 </div>
 </div>

 <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
 <div class="flex gap-4">
 <div class="bg-[#fff7f0] p-4 border border-[#e4cbb4] rounded w-full">
 <div class="mb-3">
 <label class="block text-xs font-bold text-[#705745] mb-1">Forma de Pago:</label>
 <select id="dte-forma-pago" class="w-full border border-[#e4cbb4] bg-[#fffdf9] p-1 rounded">
 <option>Crédito</option>
 <option selected>Contado</option>
 <option>Transferencia</option>
 </select>
 </div>
 </div>
 </div>

 <div class="space-y-2 text-sm md:col-span-2">
 <div class="flex items-center">
 <span class="w-32 text-[#705745] font-bold">Sub Total</span>
 <input type="text" id="dte-subtotal" class="flex-1 bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded outline-none" value="" readonly>
 </div>
 
 <div class="flex items-center gap-2">
 <div class="flex items-center flex-1">
 <span class="w-32 text-[#705745] font-bold text-xs whitespace-nowrap flex-shrink-0">Desc. Global %</span>
 <input type="number" id="dte-descuento-global" class="w-16 bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" value="" min="0" max="100" placeholder="0">
 </div>
 <div class="flex items-center flex-1">
 <span class="w-auto text-[#705745] font-bold text-xs text-right pr-2 whitespace-nowrap">Monto $</span>
 <input type="text" id="dte-monto-calculado" class="w-full bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded outline-none" value="" readonly placeholder="0">
 </div>
 </div>

 <div class="flex items-center">
 <span class="w-32 text-[#705745] font-bold">Monto Neto</span>
 <input type="text" id="dte-monto-neto" class="flex-1 bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded outline-none" value="" readonly>
 </div>
 <div class="flex items-center gap-2">
 <div class="flex items-center flex-1">
 <span class="w-32 text-[#705745] font-bold text-xs whitespace-nowrap flex-shrink-0">IVA %</span>
 <input type="text" id="dte-iva-rate" class="w-16 bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded outline-none" value="19%" readonly>
 </div>
 <div class="flex items-center flex-1">
 <span class="w-auto text-[#705745] font-bold text-xs text-right pr-2 whitespace-nowrap">Total IVA</span>
 <input type="text" id="dte-monto-iva" class="w-full bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded outline-none" value="" readonly>
 </div>
 </div>
 <div class="flex items-center">
 <span class="w-32 text-[#3d2a1e] font-bold text-base">Total</span>
 <input type="text" id="dte-monto-total" class="flex-1 bg-[#fffdf9] border border-[#e4cbb4] p-1 px-2 text-right rounded font-bold text-lg text-gray-900 outline-none" value="" readonly>
 </div>
 </div>
 </div>

 <div class="mt-8 flex flex-wrap gap-4 justify-center md:justify-end border-t pt-6">
 <button class="bg-purple-800 hover:bg-purple-900 text-white px-6 py-2 rounded font-bold shadow transition" id="btn-limpiar">
 Limpiar
 </button>
 <button class="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded font-bold shadow-lg shadow-primary/30 transition transform hover:-translate-y-0.5" id="btn-emitir">
 <i class="fas fa-check-circle mr-2"></i> Validar y visualizar
 </button>
 </div>

 <select id="dte-tipo" class="hidden"><option value="33" selected>33</option></select>
 <input id="dte-folio-hidden" type="hidden" value="0">
 </div>
 `;
    }
};
