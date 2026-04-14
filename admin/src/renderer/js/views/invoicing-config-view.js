window.ValmuInvoicingConfigView = {
    renderDocCard(doc, config) {
        const currentFolio = Number(config['folio_' + doc.id] || 0);
        const maxFolio = Number(config['folio_final_' + doc.id] || 0);
        const remaining = maxFolio > 0 ? Math.max(maxFolio - currentFolio + 1, 0) : null;

        return `
            <div class="rounded-[28px] border border-[#efe2d3] bg-white p-6 shadow-[0_16px_50px_rgba(78,44,20,0.07)] transition-all hover:shadow-[0_20px_60px_rgba(78,44,20,0.10)]">
                <div class="flex items-start justify-between gap-3 mb-5">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="h-12 w-12 rounded-2xl bg-${doc.soft} text-${doc.strong} flex items-center justify-center text-xl border border-${doc.border}">
                            <i class="bi ${doc.icon}"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="text-[10px] font-black uppercase tracking-[0.22em] text-gray-400">Tipo ${doc.id}</div>
                            <h4 class="text-base font-black text-[#2f241c] leading-tight mt-1">${doc.name}</h4>
                        </div>
                    </div>
                    <div class="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] bg-[#fff6ee] text-[#c96a1b] border border-[#f5d7b8]">
                        ${remaining === null ? 'Sin limite' : `${remaining} disp.`}
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div class="rounded-2xl border border-[#eee6dc] bg-[#fcfaf7] p-3">
                        <label class="text-[9px] font-black uppercase tracking-[0.18em] text-gray-400 block mb-2">Folio actual</label>
                        <input type="number" id="conf-folio-${doc.id}" value="${currentFolio}" class="w-full bg-white border border-[#eadfd2] rounded-xl px-3 py-3 text-lg font-black text-center text-[#2f241c] outline-none focus:ring-2 focus:ring-orange-200">
                    </div>
                    <div class="rounded-2xl border border-[#f7d7d5] bg-[#fff7f6] p-3">
                        <label class="text-[9px] font-black uppercase tracking-[0.18em] text-[#d27d76] block mb-2">Limite CAF</label>
                        <input type="number" id="conf-folio-final-${doc.id}" value="${maxFolio}" class="w-full bg-white border border-[#f3c5c1] rounded-xl px-3 py-3 text-lg font-black text-center text-[#d14334] outline-none focus:ring-2 focus:ring-red-100">
                    </div>
                </div>

                <div class="rounded-2xl bg-[#fcfaf7] border border-[#eee6dc] p-4 mb-4">
                    <div class="flex items-center justify-between gap-3">
                        <div>
                            <div class="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-1">Estado archivo</div>
                            <div id="status-caf${doc.id}" class="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Cargando status...</div>
                        </div>
                        <div class="text-right">
                            <div class="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 mb-1">Rango</div>
                            <div class="text-sm font-black text-[#2f241c]">${currentFolio} / ${maxFolio || 'Sin tope'}</div>
                        </div>
                    </div>
                </div>

                <button id="btn-update-caf${doc.id}" class="w-full rounded-2xl border border-[#e9d9c7] bg-[#fff8f1] px-4 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-[#8f5a2c] hover:bg-[#fff1e4] hover:border-[#f3c89b] transition-all flex items-center justify-center gap-2">
                    <i class="bi bi-upload"></i> Cargar CAF
                </button>
            </div>
        `;
    },

    render(config) {
        const cafDocs = [
            { id: '33', name: 'Factura Electronica', icon: 'bi-file-earmark-spreadsheet-fill', soft: '[#eef5ff]', strong: '[#356ae6]', border: '[#d6e5ff]' },
            { id: '39', name: 'Boleta Electronica', icon: 'bi-receipt-cutoff', soft: '[#fff6e7]', strong: '[#d9871a]', border: '[#f6dfb8]' },
            { id: '61', name: 'Nota de Credito', icon: 'bi-file-earmark-minus-fill', soft: '[#fff0f0]', strong: '[#d84d4d]', border: '[#f4d0d0]' },
            { id: '56', name: 'Nota de Debito', icon: 'bi-file-earmark-plus-fill', soft: '[#ebfbf2]', strong: '[#20a464]', border: '[#c9efd9]' }
        ];

        return `
            <div class="max-w-7xl mx-auto space-y-6 animate-fade-in pb-20">
                <div class="rounded-[30px] border border-[#efe2d3] bg-[linear-gradient(135deg,#fff8f1_0%,#ffffff_45%,#fffdf9_100%)] p-6 shadow-[0_18px_60px_rgba(78,44,20,0.07)]">
                    <div class="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5">
                        <div class="max-w-2xl">
                            <div class="text-[10px] font-black uppercase tracking-[0.26em] text-orange-500 mb-2">Configuracion SII</div>
                            <h3 class="text-3xl font-black text-[#2f241c] leading-none tracking-tight">Centro de Facturacion</h3>
                            <p class="text-[#8f8a83] text-sm font-medium mt-3">Administra credenciales, emisor tributario y rangos CAF desde una sola vista de control.</p>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full xl:w-auto xl:min-w-[360px]">
                            <button id="btn-sync-folios" class="rounded-2xl border border-[#f4d5b7] bg-[#fff4e8] px-4 py-4 text-left hover:bg-[#ffedd9] transition-all">
                                <div class="flex items-center gap-3">
                                    <div class="h-11 w-11 rounded-2xl bg-white text-orange-600 flex items-center justify-center border border-[#f5dcc1]">
                                        <i class="bi bi-arrow-repeat text-lg"></i>
                                    </div>
                                    <div>
                                        <div class="text-[10px] font-black uppercase tracking-[0.18em] text-orange-400">Herramienta</div>
                                        <div class="text-sm font-black text-[#8f5a2c]">Sincronizar folios</div>
                                    </div>
                                </div>
                            </button>

                            <button id="btn-test-connection" class="rounded-2xl border border-[#e5ddd3] bg-white px-4 py-4 text-left hover:bg-[#fcfaf7] transition-all">
                                <div class="flex items-center gap-3">
                                    <div class="h-11 w-11 rounded-2xl bg-[#f6f3ef] text-[#6d655b] flex items-center justify-center border border-[#e8e0d6]">
                                        <i class="bi bi-hdd-network text-lg"></i>
                                    </div>
                                    <div>
                                        <div class="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Diagnostico</div>
                                        <div class="text-sm font-black text-[#45362a]">Probar conexion SII</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    <div class="xl:col-span-7 space-y-6">
                        <div class="rounded-[30px] border border-[#efe2d3] bg-white p-7 shadow-[0_16px_50px_rgba(78,44,20,0.06)]">
                            <div class="flex items-center gap-4 mb-6">
                                <div class="h-14 w-14 rounded-2xl bg-[#eef2ff] text-indigo-600 flex items-center justify-center text-2xl border border-[#dbe4ff]">
                                    <i class="bi bi-shield-lock-fill"></i>
                                </div>
                                <div>
                                    <h3 class="text-2xl font-black text-[#2f241c] tracking-tight">Acceso Tecnico</h3>
                                    <p class="text-[#8f8a83] text-sm font-medium">SimpleAPI, certificado digital y autenticacion de firma.</p>
                                </div>
                            </div>

                            <div class="space-y-5">
                                <div>
                                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">API Key SimpleAPI</label>
                                    <div class="relative group">
                                        <i class="bi bi-key absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-600 transition-colors"></i>
                                        <input type="password" id="conf-api-key" value="${config.apiKey || ''}" class="w-full pl-12 pr-12 py-4 bg-[#fcfaf7] border border-[#eadfd2] rounded-2xl text-sm font-bold text-[#45362a] shadow-sm focus:border-indigo-200 outline-none transition-all focus:ring-4 focus:ring-indigo-50" placeholder="Ingresa tu token de API...">
                                        <button class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors" onclick="const i=document.getElementById('conf-api-key'); i.type = i.type==='password'?'text':'password';">
                                            <i class="bi bi-eye"></i>
                                        </button>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div class="rounded-[24px] border border-[#e7efe7] bg-[#f7fcf8] p-5">
                                        <div class="flex items-start justify-between gap-3 mb-4">
                                            <div>
                                                <div class="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500 mb-1">Certificado</div>
                                                <div class="text-base font-black text-[#2f241c]">Firma digital</div>
                                            </div>
                                            <div id="status-cert" class="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Verificando...</div>
                                        </div>
                                        <button id="btn-update-cert" class="w-full bg-[#153047] text-white rounded-2xl py-3.5 text-[11px] font-black uppercase tracking-[0.18em] hover:bg-[#102536] transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2">
                                            <i class="bi bi-file-earmark-lock-fill"></i> Actualizar certificado
                                        </button>
                                    </div>

                                    <div class="rounded-[24px] border border-[#efe2d3] bg-[#fcfaf7] p-5">
                                        <label class="block text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">Contrasena del firmante</label>
                                        <div class="relative">
                                            <i class="bi bi-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                            <input type="password" id="conf-cert-pass" value="${config.certPassword || ''}" class="w-full pl-12 pr-4 py-4 bg-white border border-[#eadfd2] rounded-2xl text-sm font-bold text-[#45362a] shadow-sm focus:border-indigo-200 outline-none transition-all focus:ring-4 focus:ring-indigo-50" placeholder="••••••••">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-[30px] border border-[#efe2d3] bg-white p-7 shadow-[0_16px_50px_rgba(78,44,20,0.06)]">
                            <div class="flex items-center gap-4 mb-6">
                                <div class="h-14 w-14 rounded-2xl bg-[#fff3e8] text-orange-600 flex items-center justify-center text-2xl border border-[#f7dcc0]">
                                    <i class="bi bi-building"></i>
                                </div>
                                <div>
                                    <h3 class="text-2xl font-black text-[#2f241c] tracking-tight">Identidad del Emisor</h3>
                                    <p class="text-[#8f8a83] text-sm font-medium">Datos tributarios y de contacto usados en la emision.</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-12 gap-5">
                                <div class="md:col-span-4">
                                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">RUT empresa</label>
                                    <input type="text" id="conf-rut-emisor" value="${config.rutEmisor || ''}" class="w-full rounded-2xl py-4 px-4 border border-[#eadfd2] bg-[#fcfaf7] font-black text-sm text-[#45362a] outline-none focus:ring-4 focus:ring-orange-50">
                                </div>
                                <div class="md:col-span-4">
                                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">RUT firmante</label>
                                    <input type="text" id="conf-rut-envia" value="${config.rutEnvia || ''}" class="w-full rounded-2xl py-4 px-4 border border-[#f5dcc1] bg-[#fff8f1] font-black text-sm text-[#8f5a2c] outline-none focus:ring-4 focus:ring-orange-50">
                                </div>
                                <div class="md:col-span-4">
                                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">Correo contacto</label>
                                    <input type="email" id="conf-email" value="${config.email || ''}" class="w-full rounded-2xl py-4 px-4 border border-[#eadfd2] bg-[#fcfaf7] font-bold text-sm text-[#45362a] outline-none focus:ring-4 focus:ring-orange-50">
                                </div>
                                <div class="md:col-span-12">
                                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">Razon social</label>
                                    <input type="text" id="conf-razon-social" value="${config.razonSocial || ''}" class="w-full rounded-2xl py-4 px-4 border border-[#eadfd2] bg-[#fcfaf7] font-bold text-sm text-[#45362a] outline-none focus:ring-4 focus:ring-orange-50">
                                </div>
                                <div class="md:col-span-12">
                                    <label class="block text-[10px] font-black text-gray-400 uppercase tracking-[0.18em] mb-2">Direccion legal</label>
                                    <input type="text" id="conf-direccion" value="${config.direccion || ''}" class="w-full rounded-2xl py-4 px-4 border border-[#eadfd2] bg-[#fcfaf7] font-bold text-sm text-[#45362a] outline-none focus:ring-4 focus:ring-orange-50">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="xl:col-span-5 space-y-6">
                        <div class="rounded-[30px] border border-[#e3ebf7] bg-[linear-gradient(160deg,#18354f_0%,#0f2234_100%)] p-7 text-white shadow-[0_18px_60px_rgba(15,34,52,0.25)] overflow-hidden">
                            <div class="text-[10px] font-black uppercase tracking-[0.24em] text-white/60 mb-2">Resumen operativo</div>
                            <h4 class="text-2xl font-black leading-tight tracking-tight">Panel de control tributario</h4>
                            <p class="text-sm font-medium text-white/70 mt-3 leading-relaxed">Mantiene sincronizados tus rangos, certificado y datos de emision para trabajar sin cortes ni folios fuera de rango.</p>

                            <div class="grid grid-cols-2 gap-3 mt-6">
                                <div class="rounded-2xl bg-white/8 border border-white/10 p-4">
                                    <div class="text-[10px] font-black uppercase tracking-[0.18em] text-white/50 mb-1">Documentos</div>
                                    <div class="text-xl font-black">${cafDocs.length}</div>
                                </div>
                                <div class="rounded-2xl bg-white/8 border border-white/10 p-4">
                                    <div class="text-[10px] font-black uppercase tracking-[0.18em] text-white/50 mb-1">Emisor</div>
                                    <div class="text-sm font-black truncate">${config.rutEmisor || 'Sin RUT'}</div>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-[30px] border border-[#efe2d3] bg-white p-7 shadow-[0_16px_50px_rgba(78,44,20,0.06)]">
                            <div class="text-[10px] font-black uppercase tracking-[0.24em] text-orange-500 mb-2">Accion principal</div>
                            <h4 class="text-xl font-black text-[#2f241c] tracking-tight">Guardar configuracion maestra</h4>
                            <p class="text-sm font-medium text-[#8f8a83] mt-2 mb-5">Guarda los cambios locales en sii_data y sincroniza la configuracion activa para facturacion.</p>

                            <button id="btn-save-config" class="w-full rounded-2xl bg-orange-600 text-white px-6 py-4 font-black text-[11px] uppercase tracking-[0.18em] shadow-xl shadow-orange-900/20 hover:bg-orange-700 transition-all flex items-center justify-center gap-3">
                                <i class="bi bi-check-circle-fill text-lg"></i> Guardar configuracion
                            </button>
                            <input type="hidden" id="conf-fono" value="${config.telefono || ''}">
                        </div>
                    </div>
                </div>

                <div class="rounded-[30px] border border-[#efe2d3] bg-[linear-gradient(180deg,#fffdf9_0%,#ffffff_100%)] p-7 shadow-[0_16px_50px_rgba(78,44,20,0.06)]">
                    <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
                        <div>
                            <div class="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-500 mb-2">Gestion CAF</div>
                            <h3 class="text-2xl font-black text-[#2f241c] tracking-tight">Folios y rangos autorizados</h3>
                            <p class="text-sm font-medium text-[#8f8a83] mt-2">Controla el folio activo, el limite del CAF y el estado de instalacion por tipo de documento.</p>
                        </div>

                        <div class="rounded-2xl border border-[#e7efe7] bg-[#f7fcf8] px-4 py-3">
                            <div class="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-500 mb-1">Estado general</div>
                            <div id="config-folios-sync-status" class="text-sm font-black text-[#236844]">Sincronizacion automatica activa</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-5">
                        ${cafDocs.map((doc) => this.renderDocCard(doc, config)).join('')}
                    </div>
                </div>
            </div>
        `;
    }
};
