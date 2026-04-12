window.ValmuInvoicingConfigView = {
    render(config) {
        return `
            <div class="max-w-7xl mx-auto space-y-8 animate-fade-in pb-20">
                
                <!-- HEADER & MAIN SETTINGS -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                    
                    <!-- Left: API & Security -->
                    <div class="lg:col-span-8 space-y-8">
                        <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 relative overflow-hidden">
                            <div class="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full -mr-32 -mt-32 opacity-20 blur-3xl"></div>
                            
                            <div class="relative z-10">
                                <div class="flex items-center gap-4 mb-8">
                                    <div class="h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-2xl shadow-inner border border-indigo-100">
                                        <i class="bi bi-shield-lock-fill"></i>
                                    </div>
                                    <div>
                                        <h3 class="text-2xl font-black text-gray-900 tracking-tight">Configuración Técnica</h3>
                                        <p class="text-gray-400 text-sm font-medium">Credenciales SimpleAPI y Certificado Digital</p>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <!-- API Key -->
                                    <div class="md:col-span-2">
                                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">API KEY SIMPLEAPI</label>
                                        <div class="relative group">
                                            <i class="bi bi-key absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors"></i>
                                            <input type="password" id="conf-api-key" value="${config.apiKey || ''}" 
                                                class="w-full pl-12 pr-12 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:border-indigo-200 outline-none transition-all focus:ring-4 focus:ring-indigo-50 group-hover:border-gray-200"
                                                placeholder="Ingresa tu token de API...">
                                            <button class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors" onclick="const i=document.getElementById('conf-api-key'); i.type = i.type==='password'?'text':'password';">
                                                <i class="bi bi-eye"></i>
                                            </button>
                                        </div>
                                    </div>

                                    <!-- Digital Certificate -->
                                    <div class="md:col-span-1 space-y-4">
                                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">CERTIFICADO DIGITAL (.PFX)</label>
                                        <div id="status-cert" class="px-4 py-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-[9px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                            <div class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                            VERIFICANDO FIRMA...
                                        </div>
                                        <button id="btn-update-cert" class="w-full bg-gray-900 text-white rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-3">
                                            <i class="bi bi-file-earmark-lock-fill text-lg"></i> ACTUALIZAR CERTIFICADO
                                        </button>
                                    </div>

                                    <div class="md:col-span-1">
                                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">CONTRASEÑA DEL FIRMANTE</label>
                                        <div class="relative">
                                            <i class="bi bi-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                            <input type="password" id="conf-cert-pass" value="${config.certPassword || ''}" 
                                                class="w-full pl-12 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl text-sm font-bold shadow-sm focus:border-indigo-200 outline-none transition-all focus:ring-4 focus:ring-indigo-50"
                                                placeholder="••••••••">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Emisor Form -->
                        <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10">
                            <div class="flex items-center gap-4 mb-8">
                                <div class="h-14 w-14 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center text-2xl shadow-inner border border-orange-100">
                                    <i class="bi bi-building"></i>
                                </div>
                                <div>
                                    <h3 class="text-2xl font-black text-gray-900 tracking-tight">Identidad Emisor</h3>
                                    <p class="text-gray-400 text-sm font-medium">Información corporativa legal ante el SII</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-12 gap-8">
                                <div class="md:col-span-6">
                                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">RUT EMPRESA</label>
                                    <input type="text" id="conf-rut-emisor" value="${config.rutEmisor || ''}" class="form-control rounded-2xl py-4 border-gray-100 font-black text-sm text-gray-700">
                                </div>
                                <div class="md:col-span-6">
                                    <label class="block text-[10px] font-black text-gray-600 uppercase tracking-widest mb-2">RUT FIRMANTE (CERTIFICADO)</label>
                                    <input type="text" id="conf-rut-envia" value="${config.rutEnvia || ''}" class="form-control rounded-2xl py-4 border-orange-200 bg-orange-50/30 font-black text-sm text-orange-700">
                                </div>
                                <div class="md:col-span-12">
                                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">RAZÓN SOCIAL</label>
                                    <input type="text" id="conf-razon-social" value="${config.razonSocial || ''}" class="form-control rounded-2xl py-4 border-gray-100 font-bold text-sm text-gray-700">
                                </div>
                                <div class="md:col-span-7">
                                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">DIRECCIÓN LEGAL</label>
                                    <input type="text" id="conf-direccion" value="${config.direccion || ''}" class="form-control rounded-2xl py-4 border-gray-100 font-bold text-sm text-gray-700 px-6">
                                </div>
                                <div class="md:col-span-5">
                                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">CORREO CONTACTO</label>
                                    <input type="email" id="conf-email" value="${config.email || ''}" class="form-control rounded-2xl py-4 border-gray-100 font-bold text-sm text-gray-700">
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right: Quick Actions & Status -->
                    <div class="lg:col-span-4 space-y-8">
                        <!-- Mode Info -->
                        <div class="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                            <div class="relative z-10">
                                <span class="bg-white/20 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest mb-4 inline-block">SISTEMA ACTIVADO</span>
                                <h4 class="text-xl font-black mb-2 uppercase tracking-tighter leading-tight">Procesamiento<br>Nativo Valmu</h4>
                                <p class="text-white/70 text-xs font-medium leading-relaxed">Sus documentos se procesan localmente asegurando máxima privacidad y velocidad de respuesta.</p>
                            </div>
                        </div>

                        <!-- System Actions -->
                        <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-8 space-y-4">
                            <h4 class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">HERRAMIENTAS SII</h4>
                            <button id="btn-sync-folios" class="w-full flex items-center justify-between p-4 rounded-2xl bg-orange-50 text-orange-600 border border-orange-100 hover:bg-orange-100 transition-all font-black text-[10px] uppercase tracking-widest group">
                                <span class="flex items-center gap-2"><i class="bi bi-arrow-repeat text-lg animate-spin-slow"></i> SINCRONIZAR FOLIOS</span>
                                <i class="bi bi-chevron-right opacity-0 group-hover:opacity-100 transition-all"></i>
                            </button>
                            <button id="btn-test-connection" class="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 text-gray-500 border border-gray-100 hover:bg-gray-100 transition-all font-black text-[10px] uppercase tracking-widest group">
                                <span class="flex items-center gap-2"><i class="bi bi-hdd-network text-lg"></i> TEST CONEXIÓN SII</span>
                                <i class="bi bi-chevron-right opacity-0 group-hover:opacity-100 transition-all"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- CAF & FOLIO MANAGEMENT -->
                <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10">
                    <div class="flex items-center gap-4 mb-10">
                        <div class="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl shadow-inner border border-emerald-100">
                            <i class="bi bi-file-earmark-zip"></i>
                        </div>
                        <div>
                            <h3 class="text-2xl font-black text-gray-900 tracking-tight">Gestión de Folios (CAF)</h3>
                            <p class="text-gray-400 text-sm font-medium">Control de rangos timbrados y autorizados por el SII</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                        ${[
                { id: '33', name: 'Factura Electrónica', icon: 'bi-file-earmark-spreadsheet-fill', color: 'blue' },
                { id: '39', name: 'Boleta Electrónica', icon: 'bi-receipt-cutoff', color: 'amber' },
                { id: '61', name: 'Nota de Crédito', icon: 'bi-file-earmark-minus-fill', color: 'red' },
                { id: '56', name: 'Nota de Débito', icon: 'bi-file-earmark-plus-fill', color: 'emerald' }
            ].map(doc => `
                            <div class="card p-6 bg-gray-50/50 rounded-3xl border border-gray-100 flex flex-col justify-between group hover:border-gray-200 transition-all">
                                <div>
                                    <div class="flex items-center justify-between mb-6">
                                        <div class="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-gray-400 group-hover:text-${doc.color}-600 transition-colors">
                                            <i class="bi ${doc.icon}"></i>
                                        </div>
                                        <div class="text-[9px] font-black text-gray-300 uppercase tracking-widest">TIPO ${doc.id}</div>
                                    </div>
                                    <h4 class="text-sm font-black text-gray-800 mb-6 uppercase tracking-tighter">${doc.name}</h4>
                                    
                                    <div class="grid grid-cols-2 gap-4 mb-6">
                                        <div>
                                            <label class="text-[8px] font-black uppercase text-gray-400 tracking-widest block mb-2">FOLIO ACTUAL</label>
                                            <input type="number" id="conf-folio-${doc.id}" value="${Number(config['folio_' + doc.id] || 0)}" class="w-full bg-white border border-gray-100 rounded-xl p-3 text-sm font-black text-center text-gray-900 outline-none focus:ring-2 focus:ring-${doc.color}-500/20">
                                        </div>
                                        <div>
                                            <label class="text-[8px] font-black uppercase text-gray-400 tracking-widest block mb-2">LÍMITE CAF</label>
                                            <input type="number" id="conf-folio-final-${doc.id}" value="${Number(config['folio_final_' + doc.id] || 0)}" class="w-full bg-red-50 text-red-700 border border-red-100 rounded-xl p-3 text-sm font-black text-center outline-none">
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="space-y-3">
                                    <div id="status-caf${doc.id}" class="text-center py-2 bg-white/50 border border-gray-100 rounded-xl text-[8px] font-black tracking-widest text-gray-400 uppercase">
                                        CARGANDO STATUS...
                                    </div>
                                    <button id="btn-update-caf${doc.id}" class="w-full bg-white border border-gray-200 text-gray-400 font-black text-[9px] uppercase py-3 rounded-xl tracking-widest hover:border-${doc.color}-200 hover:text-${doc.color}-600 transition-all group-hover:shadow-sm flex items-center justify-center gap-2">
                                        <i class="bi bi-upload"></i> CARGAR CAF
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- SAVE ACTIONS -->
                <div class="flex justify-center md:justify-end gap-4 mt-8 bg-gray-900 p-8 rounded-[2.5rem] shadow-2xl shadow-gray-200">
                    <p class="hidden md:block mr-20 text-gray-400 text-xs font-bold self-center">Verifica que todos los datos coincidan antes de guardar los cambios.</p>
                    <button id="btn-save-config" class="px-12 py-5 rounded-2xl bg-orange-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-900/20 hover:bg-orange-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-3">
                        <i class="bi bi-check-circle-fill text-lg"></i> GUARDAR CONFIGURACIÓN MAESTRA
                    </button>
                    <input type="hidden" id="conf-fono" value="${config.telefono || ''}">
                </div>
            </div>
        `;
    }
};
