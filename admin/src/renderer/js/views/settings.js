function escapeSettingsHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatUpdateCheckedAt(value) {
    if (!value) return 'Aun no se ha comprobado.';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
    return new Intl.DateTimeFormat('es-CL', {
        dateStyle: 'medium',
        timeStyle: 'short'
    }).format(date);
}

function getUpdateStatusBadge(state) {
    const status = state?.status || 'idle';
    switch (status) {
        case 'available': return { label: 'Versión disponible', class: 'bg-orange-50 text-orange-600 border-orange-100' };
        case 'downloading': return { label: 'Descargando...', class: 'bg-blue-50 text-blue-600 border-blue-100' };
        case 'downloaded': return { label: 'Lista para instalar', class: 'bg-green-50 text-green-600 border-green-100' };
        case 'up-to-date': return { label: 'Sistema al día', class: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
        case 'error': return { label: 'Error al revisar', class: 'bg-red-50 text-red-600 border-red-100' };
        case 'development': return { label: 'Modo Desarrollo', class: 'bg-gray-100 text-gray-400 border-gray-200' };
        case 'checking': return { label: 'Buscando...', class: 'bg-blue-50 text-blue-600 border-blue-100' };
        default: return { label: 'Estado pendiente', class: 'bg-gray-50 text-gray-500 border-gray-100' };
    }
}

function renderReleaseNotes(notes) {
    if (!notes) return '<p class="text-[10px] text-gray-300 font-black uppercase tracking-widest italic py-10 opacity-30 text-center">Sin notas registradas</p>';

    const lines = notes.split('\n').filter(l => l.trim().length > 0);
    return lines.map(line => `
        <div class="flex gap-4 p-4 rounded-2xl bg-gray-50/50 mb-3 border border-gray-50 group hover:border-orange-100 transition-colors">
            <div class="h-6 w-6 rounded-lg bg-white shadow-sm flex items-center justify-center text-orange-500 text-[10px] font-black group-hover:bg-orange-500 group-hover:text-white transition-all">•</div>
            <span class="text-xs font-medium text-gray-600 leading-relaxed">${escapeSettingsHtml(line)}</span>
        </div>
    `).join('');
}

async function renderSettings() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) return;

    const appVersion = await window.electronAPI.getAppVersion();
    const updateState = await window.electronAPI.getUpdateState();
    const latestVersion = updateState?.latestVersion || 'Unknown';
    const badge = getUpdateStatusBadge(updateState);

    contentArea.innerHTML = `
        <div class="space-y-8 animate-fade-in pb-10">
            <!-- HEADER -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 class="text-3xl font-black text-gray-900 tracking-tighter">Configuración Maestro</h2>
                    <p class="text-gray-400 text-sm font-medium">Control de versiones, umbrales de stock y preferencias críticas</p>
                </div>
                <button class="flex items-center gap-2 px-6 py-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-orange-600 hover:border-orange-100 transition-all font-black text-[10px] uppercase tracking-widest shadow-sm" onclick="renderSettings()">
                    <i class="bi bi-arrow-clockwise text-lg"></i> Recargar Sincronización
                </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 sticky-container">
                <!-- SYSTEM & INVENTORY LOGIC -->
                <div class="lg:col-span-12 xl:col-span-8 space-y-8">
                    
                    <!-- VERSIONING & UPDATES -->
                    <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden border-b-4 border-b-gray-900/5 items-stretch flex flex-col md:flex-row">
                        <div class="p-10 md:w-1/2 flex flex-col justify-between border-b md:border-b-0 md:border-r border-gray-50">
                            <div>
                                <div class="flex justify-between items-center mb-10">
                                    <div class="h-16 w-16 rounded-[1.5rem] bg-gray-900 text-white flex items-center justify-center text-3xl shadow-2xl shadow-gray-200">
                                        <i class="bi bi-box-arrow-up"></i>
                                    </div>
                                    <span class="px-5 py-2 rounded-2xl border text-[9px] font-black uppercase tracking-widest ${badge.class}">${badge.label}</span>
                                </div>
                                
                                <h3 class="text-2xl font-black text-gray-900 uppercase tracking-tighter mb-2">Núcleo Valmu</h3>
                                <p class="text-gray-400 text-xs font-medium mb-10 leading-relaxed">Suscríbete a las últimas actualizaciones de motor para mantener la compatibilidad con el SII y mejorar la fluidez operativa.</p>
                                
                                <div class="grid grid-cols-2 gap-4 mb-10">
                                    <div class="p-6 bg-gray-50 rounded-[2rem] border border-gray-100 shadow-inner">
                                        <p class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2">Build Actual</p>
                                        <p class="text-xl font-black font-mono text-gray-900 tracking-tighter">${appVersion}</p>
                                    </div>
                                    <div class="p-6 bg-orange-50 rounded-[2rem] border border-orange-100 shadow-inner">
                                        <p class="text-[9px] font-black text-orange-400 uppercase tracking-widest mb-2">Versión Cloud</p>
                                        <p class="text-xl font-black font-mono text-orange-600 tracking-tighter">${latestVersion}</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="space-y-4">
                                <button class="h-14 w-full bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200 active:scale-95 flex items-center justify-center gap-3" id="check-updates-button">
                                    <i class="bi bi-cpu"></i> Buscar Mejoras en la Nube
                                </button>
                                ${updateState?.downloadReady ? `
                                    <button class="h-14 w-full bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-95 flex items-center justify-center gap-3 animate-bounce-slow" id="install-update-button">
                                        <i class="bi bi-lightning-fill"></i> Reiniciar e Instalar Ahora
                                    </button>
                                ` : ''}
                                <p class="text-[9px] text-center text-gray-300 font-bold uppercase tracking-widest">Sincronizado: ${formatUpdateCheckedAt(updateState?.checkedAt)}</p>
                            </div>
                        </div>

                        <div class="p-10 md:w-1/2 bg-gray-50/30 flex flex-col h-full">
                            <h4 class="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-6">Logs de Ingeniería</h4>
                            <div class="flex-1 overflow-y-auto max-h-[400px] pr-4 custom-scrollbar">
                                ${renderReleaseNotes(updateState?.releaseNotes)}
                            </div>
                        </div>
                    </div>

                    <!-- INVENTORY SETTINGS -->
                    <div class="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm p-10 flex flex-col md:flex-row gap-10 items-center">
                        <div class="flex-grow">
                            <div class="flex items-center gap-4 mb-4">
                                <div class="h-12 w-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center text-xl shadow-lg shadow-orange-100">
                                    <i class="bi bi-layers-half"></i>
                                </div>
                                <div>
                                    <h4 class="text-xl font-black text-gray-900 uppercase tracking-tighter">Umbrales de Inventario</h4>
                                    <p class="text-gray-400 text-xs font-medium">Configure cómo el sistema reacciona ante la escasez</p>
                                </div>
                            </div>
                            <div class="bg-orange-50/50 p-6 rounded-2xl border border-orange-100 border-dashed">
                                <label class="block text-[10px] font-black text-orange-600 uppercase tracking-widest mb-4">CANTIDAD MÍNIMA DE ALERTA (BAJO STOCK)</label>
                                <div class="relative group max-w-xs">
                                    <i class="bi bi-speedometer2 absolute left-5 top-1/2 -translate-y-1/2 text-orange-400"></i>
                                    <input type="number" id="setting-low-stock" class="w-full pl-14 pr-6 py-4 bg-white border border-orange-200 rounded-[1.5rem] text-xl font-black text-gray-900 shadow-inner outline-none transition-all" value="${localStorage.getItem('valmu_low_stock_threshold') || '10'}" min="1" step="1">
                                </div>
                                <p class="text-[10px] font-bold text-orange-400 mt-4 leading-relaxed uppercase tracking-tight">Los productos que alcancen o bajen de este valor serán marcados como CRÍTICOS en el panel de Mermas y Dashboard.</p>
                            </div>
                        </div>
                        <div class="w-full md:w-fit flex flex-col gap-4">
                            <button class="h-20 px-10 rounded-[2rem] bg-gray-900 text-white hover:bg-black font-black text-xs uppercase tracking-widest shadow-xl shadow-gray-100 transition-all flex flex-col items-center justify-center gap-1 group" id="save-inventory-settings">
                                <i class="bi bi-cloud-check-fill text-2xl group-hover:scale-125 transition-transform"></i>
                                ACTUALIZAR PREFERENCIA
                            </button>
                        </div>
                    </div>

                </div>

                <!-- INFO SIDEBAR -->
                <div class="lg:col-span-12 xl:col-span-4 h-full">
                    <div class="bg-gradient-to-br from-indigo-700 to-indigo-900 rounded-[3rem] p-10 text-white shadow-2xl shadow-indigo-100 h-full relative overflow-hidden flex flex-col justify-between">
                         <div class="absolute -left-10 -top-10 h-40 w-40 bg-white/10 rounded-full blur-3xl"></div>
                         
                         <div>
                             <h5 class="text-indigo-200 font-black text-[10px] uppercase tracking-[0.3em] mb-10 text-center">Protocolos del Sistema</h5>
                             <div class="space-y-8">
                                 <div class="flex gap-4">
                                     <div class="h-10 w-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center"><i class="bi bi-safe text-xl"></i></div>
                                     <div>
                                         <span class="text-xs font-black uppercase tracking-widest block mb-1 text-white">Seguridad Local</span>
                                         <p class="text-[10px] text-indigo-100 font-medium leading-relaxed">Sus credenciales de API y certificados digitales se almacenan de forma cifrada en este equipo bajo normativas de seguridad.</p>
                                     </div>
                                 </div>
                                 <div class="flex gap-4">
                                     <div class="h-10 w-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center"><i class="bi bi-clock-history text-xl"></i></div>
                                     <div>
                                         <span class="text-xs font-black uppercase tracking-widest block mb-1 text-white">Ciclo de Reposición</span>
                                         <p class="text-[10px] text-indigo-100 font-medium leading-relaxed">El umbral de stock afecta los reportes en tiempo real. Ajustarlo demasiado alto puede generar alertas innecesarias.</p>
                                     </div>
                                 </div>
                                 <div class="flex gap-4">
                                     <div class="h-10 w-10 shrink-0 rounded-xl bg-white/10 flex items-center justify-center"><i class="bi bi-github text-xl"></i></div>
                                     <div>
                                         <span class="text-xs font-black uppercase tracking-widest block mb-1 text-white">Código Abierto</span>
                                         <p class="text-[10px] text-indigo-100 font-medium leading-relaxed">Valmu Admin es un software vivo. Contribuya reportando errores o sugiriendo mejoras técnicas.</p>
                                     </div>
                                 </div>
                             </div>
                         </div>

                         <div class="pt-20 text-center">
                             <div class="inline-block p-4 bg-white/5 rounded-full backdrop-blur-md border border-white/10 mb-6">
                                <img src="../assets/img/logo-white.png" class="h-8 opacity-90 mx-auto" alt="Logo White">
                             </div>
                             <p class="text-[9px] text-indigo-300 font-black tracking-widest uppercase">Valmu Core v${appVersion}</p>
                         </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    bindSettingsEvents();
}

function bindSettingsEvents() {
    const checkButton = document.getElementById('check-updates-button');
    const installButton = document.getElementById('install-update-button');

    if (checkButton) {
        checkButton.addEventListener('click', async () => {
            const originalHtml = checkButton.innerHTML;
            checkButton.disabled = true;
            checkButton.innerHTML = `<i class="bi bi-hourglass-split animate-spin text-lg"></i> CONSULTANDO INFRAESTRUCTURA...`;

            try {
                await window.electronAPI.checkForUpdates();
                setTimeout(renderSettings, 1500);
            } catch (err) {
                console.error('Update check failed:', err);
                Toast.fire({ icon: 'error', title: 'Error al conectar con el servidor de actualizaciones' });
            } finally {
                checkButton.disabled = false;
                checkButton.innerHTML = originalHtml;
            }
        });
    }

    installButton?.addEventListener('click', () => {
        window.electronAPI.installUpdate();
    });

    const saveInvButton = document.getElementById('save-inventory-settings');
    saveInvButton?.addEventListener('click', () => {
        const threshold = document.getElementById('setting-low-stock')?.value || '10';
        localStorage.setItem('valmu_low_stock_threshold', threshold);
        Toast.fire({ icon: 'success', title: 'Política de inventario actualizada correctamente' });
    });
}
