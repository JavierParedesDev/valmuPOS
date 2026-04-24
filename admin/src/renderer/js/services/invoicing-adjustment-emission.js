const adjustmentEmissionUtils = window.ValmuInvoicingUtils;
const adjustmentEmissionTransport = window.ValmuInvoicingTransport;

function resolveAdjustmentSiiStatus(sendResult, sendError) {
    if (sendResult?.TrackId || sendResult?.trackId) {
        return 'ENVIADO_SII';
    }
    if (sendError) {
        return 'ERROR_ENVIO';
    }
    return 'GENERADO';
}

window.ValmuInvoicingAdjustmentEmission = {

    // ══════════════════════════════════════════════════════════════════════════
    //  NOTA DE CRÉDITO (Tipo 61)
    // ══════════════════════════════════════════════════════════════════════════
    async emitCreditNote({ page, api, electronAPI, toast, defaultEmisor } = {}) {
        if (page.isProcessing) return;

        const btn = document.getElementById('btn-emit-nc');
        let origText = '';
        if (btn) {
            origText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
            btn.disabled = true;
        }
        page.isProcessing = true;

        try {
            if (!page.checkFolioLimit(61)) {
                throw new Error('No se puede emitir: Folios Agotados');
            }

            const refType = document.getElementById('nc-ref-type').value;
            const refFolio = document.getElementById('nc-ref-folio').value;
            const refCode = document.getElementById('nc-ref-code').value;
            const refReason = document.getElementById('nc-ref-reason').value;

            if (!refFolio) throw new Error('Debe ingresar el Folio de referencia');
            if (!refReason) throw new Error('Debe ingresar un Motivo/Razón');

            // ── Items del DOM ───────────────────────────────────────────────
            let netAmount = 0;
            const items = [];
            document.querySelectorAll('.nc-item-row').forEach((row) => {
                const name = row.querySelector('.nc-item-nombre').value;
                const qty = parseFloat(row.querySelector('.nc-item-qty').value) || 0;
                const price = parseFloat(row.querySelector('.nc-item-price').value) || 0;
                const subtotal = parseInt(row.querySelector('.nc-item-subtotal').value, 10) || 0;
                if (name && qty > 0) {
                    netAmount += subtotal;
                    items.push({
                        nombre: adjustmentEmissionUtils.sanitizeString(name).substring(0, 80),
                        cantidad: qty,
                        precio: price,
                        montoItem: subtotal
                    });
                }
            });

            if (items.length === 0) throw new Error('Debe haber al menos 1 item en el detalle');
            if (netAmount <= 0) throw new Error('El monto neto debe ser mayor a 0');

            // ── Receptor del DOM ────────────────────────────────────────────
            const clientRut = document.getElementById('nc-rut-recep').value.trim();
            const clientRzn = document.getElementById('nc-rzn-recep').value.trim();
            const clientDir = document.getElementById('nc-dir-recep').value.trim();
            const clientComuna = document.getElementById('nc-cmna-recep').value.trim();
            const clientCiudad = document.getElementById('nc-ciudad-recep').value.trim();
            const clientGiro = document.getElementById('nc-giro-recep').value.trim();

            if (!clientRut) throw new Error('Debe ingresar el RUT del receptor');
            if (!clientRzn) throw new Error('Debe ingresar la Razón Social del receptor');
            if (!clientDir) throw new Error('Debe ingresar la Dirección del receptor');
            if (!clientComuna) throw new Error('Debe ingresar la Comuna del receptor');
            if (!clientCiudad) throw new Error('Debe ingresar la Ciudad del receptor');

            // ── Config ──────────────────────────────────────────────────────
            const local = JSON.parse(localStorage.getItem('sii_config') || '{}');
            const config = { ...local, rutEmisor: local.rutEmisor || defaultEmisor.rut };
            const emisorRut = config.rutEmisor || config.rut;
            const rutEnvia = config.rutEnvia || config.rutFirmante || emisorRut;

            let folio = parseInt(document.getElementById('nc-folio-display')?.value || config.folio_61 || 1, 10);
            const token = await adjustmentEmissionTransport.getBearerToken();
            toast.show('Verificando folio...', 'info');
            try {
                const reserved = await api.requestNextFolio?.(61);
                folio = parseInt(reserved?.folio, 10) || folio;
                config.folio_61 = folio;
                localStorage.setItem('sii_config', JSON.stringify(config));

                const folioDisplay = document.getElementById('nc-folio-display');
                const folioHidden = document.getElementById('nc-folio');
                if (folioDisplay && parseInt(folioDisplay.value, 10) !== folio) {
                    folioDisplay.value = folio;
                }
                if (folioHidden) {
                    folioHidden.value = folio;
                }
            } catch (error) {
                console.error('Backend folio reservation failed for NC, using fallback:', error);
                toast.show(`No se pudo reservar folio NC en backend: ${error.message}`, 'warning');
            }

            if (!folio || folio <= 0) throw new Error('Debe ingresar un Folio válido (mayor a 0)');

            // ── Certificado y CAF ───────────────────────────────────────────
            const certBase64 = await electronAPI.readLocalCert('certificado.pfx');
            if (!certBase64) throw new Error('Falta Certificado Digital');
            const certBlob = adjustmentEmissionUtils.b64toBlob(certBase64, 'application/x-pkcs12');

            const cafText = await electronAPI.readLocalText('CAF_61.xml');
            if (!cafText) throw new Error('Falta CAF Tipo 61 (Nota de Crédito)');
            const cafBlob = new Blob([cafText], { type: 'text/xml' });

            // ── Totales ─────────────────────────────────────────────────────
            const formaPago = parseInt(document.getElementById('nc-forma-pago')?.value || 1, 10);
            const medioPago = document.getElementById('nc-medio-pago')?.value || 'EF';
            const descPct = parseFloat(document.getElementById('nc-descuento-global')?.value || 0);
            const discountAmount = Math.round(netAmount * (descPct / 100));
            const finalNet = netAmount - discountAmount;
            const tax = Math.round(finalNet * 0.19);
            const total = finalNet + tax;

            // ── Emisor del DOM ──────────────────────────────────────────────
            const emisorRzn = document.getElementById('nc-emi-razon')?.value || config.razonSocial;
            const emisorGiro = document.getElementById('nc-emi-giro')?.value || config.giro;
            const emisorDir = document.getElementById('nc-emi-dir')?.value || config.direccion;
            const emisorComuna = document.getElementById('nc-emi-comuna')?.value || config.comuna;
            const emisorCiudad = document.getElementById('nc-emi-ciudad')?.value || config.ciudad;
            const emisorActeco = document.getElementById('nc-emi-acteco')?.value || config.acteco;
            const emisorFono = document.getElementById('nc-emisor-fono')?.value || '';
            const telefonos = emisorFono.trim() ? [emisorFono.trim()] : [];

            // ── Payload ─────────────────────────────────────────────────────
            const payload = {
                Documento: {
                    Encabezado: {
                        IdentificacionDTE: {
                            TipoDTE: 61,
                            Folio: parseInt(folio, 10),
                            FechaEmision: document.getElementById('nc-fch-emis')?.value || new Date().toISOString().slice(0, 10),
                            FechaVencimiento: document.getElementById('nc-fch-venc')?.value || new Date().toISOString().slice(0, 10),
                            TipoDespacho: 0,
                            FormaPago: formaPago,
                            MedioPago: medioPago,
                            IndicadorServicio: 3
                        },
                        Emisor: {
                            Rut: emisorRut,
                            RazonSocial: adjustmentEmissionUtils.sanitizeString(emisorRzn),
                            Giro: adjustmentEmissionUtils.sanitizeString(emisorGiro).substring(0, 80),
                            ActividadEconomica: [parseInt(emisorActeco, 10) || 472300],
                            DireccionOrigen: adjustmentEmissionUtils.sanitizeString(emisorDir),
                            ComunaOrigen: adjustmentEmissionUtils.sanitizeString(emisorComuna),
                            CiudadOrigen: adjustmentEmissionUtils.sanitizeString(emisorCiudad || emisorComuna),
                            Telefono: telefonos,
                            CorreoEmisor: document.getElementById('nc-emi-email')?.value || config.email || ''
                        },
                        Receptor: {
                            Rut: clientRut,
                            RazonSocial: adjustmentEmissionUtils.sanitizeString(clientRzn),
                            Direccion: adjustmentEmissionUtils.sanitizeString(clientDir),
                            Comuna: adjustmentEmissionUtils.sanitizeString(clientComuna),
                            Ciudad: adjustmentEmissionUtils.sanitizeString(clientCiudad || clientComuna),
                            Giro: adjustmentEmissionUtils.sanitizeString((clientGiro || 'PARTICULAR').substring(0, 40)),
                            Contacto: adjustmentEmissionUtils.sanitizeString(document.getElementById('nc-contacto-recep')?.value || '')
                        },
                        Totales: {
                            MontoNeto: finalNet,
                            TasaIVA: 19,
                            IVA: tax,
                            MontoTotal: total
                        }
                    },
                    Detalles: items.map((item) => ({
                        Nombre: adjustmentEmissionUtils.sanitizeString(item.nombre),
                        Cantidad: item.cantidad,
                        UnidadMedida: 'un',
                        Precio: item.precio,
                        MontoItem: item.montoItem
                    })),
                    Referencias: [{
                        FechaDocumentoReferencia: document.getElementById('nc-ref-date')?.value || new Date().toISOString().split('T')[0],
                        TipoDocumento: parseInt(refType, 10),
                        FolioReferencia: parseInt(refFolio, 10),
                        CodigoReferencia: parseInt(refCode, 10),
                        RazonReferencia: refReason
                    }]
                },
                Certificado: {
                    Rut: rutEnvia,
                    Password: config.certPassword || config.passwordCert || 'distribuidoraAlmi2020'
                },
                Ambiente: 1,
                Tipo: 1
            };

            if (descPct > 0) {
                payload.Documento.Encabezado.Totales.MontoDescuento = discountAmount;
                payload.Documento.DscRcgGlobal = [{
                    NroLinDR: 1, TpoMov: 'D', GlosaDR: 'Descuento Global',
                    TpoValor: '$', ValorDR: discountAmount
                }];
            }

            // ── Request ─────────────────────────────────────────────────────
            const formData = new FormData();
            formData.append('input', JSON.stringify(payload));
            formData.append('file', certBlob, 'certificado.pfx');
            formData.append('caf', cafBlob, 'CAF_61.xml');
            formData.append('password', config.certPassword || config.passwordCert || 'distribuidoraAlmi2020');

            const response = await fetch('https://api.simpleapi.cl/api/v1/dte/generar', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            const resClone = response.clone();
            const text = await response.text();
            console.log('NC API Response:', text);
            if (!response.ok) throw new Error(`Error API (${response.status}): ${text}`);

            const buffer = await resClone.arrayBuffer();
            const finalXml = new TextDecoder('utf-8').decode(buffer);
            let sendResult = null;
            let sendError = null;

            // ── Guardar localmente ──────────────────────────────────────────
            try {
                await electronAPI.saveXml(`DTE_61_Folio_${folio}.xml`, finalXml, 'notas_de_credito');
            } catch (saveErr) {
                console.warn('Could not save local copy:', saveErr);
            }

            // ── Avanzar folio ───────────────────────────────────────────────
            config.folio_61 = folio + 1;
            localStorage.setItem('sii_config', JSON.stringify(config));
            try { await api.saveSiiSettings(config); } catch (_) { }

            // ── Enviar al SII ───────────────────────────────────────────────
            try {
                const dteBlob = new Blob([buffer], { type: 'application/xml' });
                sendResult = await adjustmentEmissionTransport.sendDTE({
                    dteXmlContent: dteBlob, config, tipoDTE: 61, token, certBlob, toast
                });
                toast.show(`Nota de Crédito #${folio} EXITOSA`, 'success');
            } catch (err) {
                sendError = err;
                toast.show('Error enviando al SII (XML generado OK)', 'warning');
            }

            // ── Sync BD ─────────────────────────────────────────────────────
            try {
                await api.uploadXml('61', folio, finalXml, {
                    trackId: sendResult?.TrackId || sendResult?.trackId || null,
                    estadoSii: resolveAdjustmentSiiStatus(sendResult, sendError)
                });
            } catch (syncErr) {
                console.error('[SYNC] NC Upload Failed:', syncErr);
            }

            page.selectedNCClient = null;
            page.activeTab = 'history';
            page.historyData = null;
            setTimeout(() => page.updateUI(), 1000);

        } catch (error) {
            console.error(error);
            toast.show(error.message, 'error');
        } finally {
            page.isProcessing = false;
            if (btn) { btn.innerHTML = origText; btn.disabled = false; }
        }
    },

    // ══════════════════════════════════════════════════════════════════════════
    //  NOTA DE DÉBITO (Tipo 56)
    // ══════════════════════════════════════════════════════════════════════════
    async emitDebitNote({ page, api, electronAPI, toast, defaultEmisor } = {}) {
        if (page.isProcessing) return;

        if (!page.checkFolioLimit(56)) {
            toast.show('No se puede emitir: Folios Agotados', 'error');
            return;
        }

        const btn = document.getElementById('btn-emit-nd');
        let origText = '';
        if (btn) {
            origText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
            btn.disabled = true;
        }
        page.isProcessing = true;

        try {
            const refType = document.getElementById('nd-ref-type').value;
            const refFolio = document.getElementById('nd-ref-folio').value;
            const refCode = document.getElementById('nd-ref-code').value;
            const refReason = document.getElementById('nd-ref-reason').value;

            if (!refFolio) throw new Error('Debe ingresar el Folio de referencia');
            if (!refReason) throw new Error('Debe ingresar un Motivo/Razón');

            // ── Items del DOM (idéntico a NC) ───────────────────────────────
            let rawNet = 0;
            const items = [];
            document.querySelectorAll('.nd-item-row').forEach((row) => {
                const name = row.querySelector('.nd-item-nombre').value;
                const qty = parseFloat(row.querySelector('.nd-item-qty').value) || 0;
                const price = parseFloat(row.querySelector('.nd-item-price').value) || 0;
                const subtotal = parseInt(row.querySelector('.nd-item-subtotal').value, 10) || 0;
                if (name && qty > 0) {
                    rawNet += subtotal;
                    items.push({
                        nombre: adjustmentEmissionUtils.sanitizeString(name).substring(0, 80),
                        cantidad: qty,
                        precio: price,
                        montoItem: subtotal
                    });
                }
            });

            if (items.length === 0) throw new Error('Debe haber al menos 1 item en el detalle');
            if (rawNet <= 0) throw new Error('El monto neto debe ser mayor a 0');

            // ── Receptor del DOM ────────────────────────────────────────────
            const clientRut = document.getElementById('nd-rut-recep').value.trim();
            const clientRzn = document.getElementById('nd-rzn-recep').value.trim();
            const clientDir = document.getElementById('nd-dir-recep').value.trim();
            const clientComuna = document.getElementById('nd-cmna-recep').value.trim();
            const clientCiudad = document.getElementById('nd-ciudad-recep').value.trim();
            const clientGiro = document.getElementById('nd-giro-recep').value.trim();

            if (!clientRut) throw new Error('Debe ingresar el RUT del receptor');
            if (!clientRzn) throw new Error('Debe ingresar la Razón Social del receptor');
            if (!clientDir) throw new Error('Debe ingresar la Dirección del receptor');
            if (!clientComuna) throw new Error('Debe ingresar la Comuna del receptor');

            const token = await adjustmentEmissionTransport.getBearerToken();

            // ── Sincronizar folio con BD ────────────────────────────────────
            toast.show('Sincronizando folio...', 'info');
            let folio = 0;
            try {
                const reserved = await api.requestNextFolio?.(56);
                folio = parseInt(reserved?.folio, 10) || 0;
                const folioDisp = document.getElementById('nd-folio-display');
                if (folioDisp && folio > 0) {
                    folioDisp.value = folio;
                }
                if (folio > 0) {
                    const reservedConfig = JSON.parse(localStorage.getItem('sii_config') || '{}');
                    reservedConfig.folio_56 = folio;
                    localStorage.setItem('sii_config', JSON.stringify(reservedConfig));
                }
            } catch (error) {
                console.error('Backend folio reservation failed for ND, using fallback:', error);
                toast.show(`No se pudo reservar folio ND en backend: ${error.message}`, 'warning');
                folio = parseInt(document.getElementById('nd-folio-display')?.value || 1, 10);
            }
            if (!folio || folio <= 0) throw new Error('No se pudo determinar un folio válido para ND');

            // ── Certificado y CAF ───────────────────────────────────────────
            const certBase64 = await electronAPI.readLocalCert('certificado.pfx');
            if (!certBase64) throw new Error('No se pudo leer el Certificado Digital.');
            const certBlob = adjustmentEmissionUtils.b64toBlob(certBase64, 'application/x-pkcs12');

            const cafText = await electronAPI.readLocalText('CAF_56.xml');
            if (!cafText) throw new Error('Falta CAF Tipo 56 (Nota de Débito)');
            const cafBlob = new Blob([cafText], { type: 'text/xml' });

            // ── Config ──────────────────────────────────────────────────────
            const localConfig = JSON.parse(localStorage.getItem('sii_config') || '{}');
            const config = { ...defaultEmisor, ...localConfig };
            const emisorRut = localConfig.rutEmisor || config.rut || defaultEmisor.rut;
            const rutEnvia = localConfig.rutEnvia || localConfig.rutFirmante || emisorRut;
            const emisorRzn = document.getElementById('nd-emi-razon')?.value || config.razonSocial;
            const emisorGiro = document.getElementById('nd-emi-giro')?.value || config.giro;
            const emisorDir = document.getElementById('nd-emi-dir')?.value || config.direccion;
            const emisorComuna = document.getElementById('nd-emi-comuna')?.value || config.comuna;
            const emisorCiudad = document.getElementById('nd-emi-ciudad')?.value || config.ciudad || config.comuna;
            const emisorActeco = document.getElementById('nd-emi-acteco')?.value || config.acteco;
            const emisorFono = document.getElementById('nd-emisor-fono')?.value || config.telefono || '';
            const telefonos = emisorFono.trim() ? [emisorFono.trim().slice(0, 20)] : [];

            // ── Totales ─────────────────────────────────────────────────────
            const descPct = parseFloat(document.getElementById('nd-descuento-global')?.value || 0);
            const discountAmount = Math.round(rawNet * (descPct / 100));
            const finalNet = rawNet - discountAmount;
            const taxAmount = Math.round(finalNet * 0.19);
            const totalAmount = finalNet + taxAmount;
            const formaPago = parseInt(document.getElementById('nd-forma-pago')?.value || 1, 10);

            // ── Payload ─────────────────────────────────────────────────────
            const payload = {
                Documento: {
                    Encabezado: {
                        IdentificacionDTE: {
                            TipoDTE: 56,
                            Folio: parseInt(folio, 10),
                            FechaEmision: document.getElementById('nd-fch-emis')?.value || new Date().toISOString().slice(0, 10),
                            FechaVencimiento: document.getElementById('nd-fch-emis')?.value || new Date().toISOString().slice(0, 10),
                            TipoDespacho: 0,
                            FormaPago: formaPago,
                            IndicadorServicio: 3
                        },
                        Emisor: {
                            Rut: emisorRut,
                            RazonSocial: adjustmentEmissionUtils.sanitizeString(emisorRzn),
                            Giro: adjustmentEmissionUtils.sanitizeString(emisorGiro).substring(0, 80),
                            ActividadEconomica: [parseInt(emisorActeco, 10) || 472300],
                            DireccionOrigen: adjustmentEmissionUtils.sanitizeString(emisorDir),
                            ComunaOrigen: adjustmentEmissionUtils.sanitizeString(emisorComuna),
                            CiudadOrigen: adjustmentEmissionUtils.sanitizeString(emisorCiudad || emisorComuna),
                            Telefono: telefonos,
                            CorreoEmisor: document.getElementById('nd-emi-email')?.value || config.email || ''
                        },
                        Receptor: {
                            Rut: clientRut,
                            RazonSocial: adjustmentEmissionUtils.sanitizeString(clientRzn),
                            Direccion: adjustmentEmissionUtils.sanitizeString(clientDir),
                            Comuna: adjustmentEmissionUtils.sanitizeString(clientComuna),
                            Ciudad: adjustmentEmissionUtils.sanitizeString(clientCiudad || clientComuna),
                            Giro: adjustmentEmissionUtils.sanitizeString((clientGiro || 'PARTICULAR').substring(0, 40)),
                            Contacto: adjustmentEmissionUtils.sanitizeString(document.getElementById('nd-contacto-recep')?.value || '')
                        },
                        Totales: {
                            MontoNeto: finalNet,
                            TasaIVA: 19,
                            IVA: taxAmount,
                            MontoTotal: totalAmount
                        }
                    },
                    Detalles: items.map((item) => ({
                        Nombre: item.nombre,
                        Cantidad: item.cantidad,
                        UnidadMedida: 'un',
                        Precio: item.precio,
                        MontoItem: item.montoItem
                    })),
                    Referencias: [{
                        FechaDocumentoReferencia: document.getElementById('nd-ref-date')?.value || new Date().toISOString().split('T')[0],
                        TipoDocumento: parseInt(refType, 10),
                        FolioReferencia: parseInt(refFolio, 10),
                        CodigoReferencia: parseInt(refCode, 10),
                        RazonReferencia: adjustmentEmissionUtils.sanitizeString(refReason)
                    }]
                },
                Certificado: {
                    Rut: rutEnvia,
                    Password: localConfig.certPassword || localConfig.passwordCert || 'distribuidoraAlmi2020'
                },
                Ambiente: 1,
                Tipo: 1
            };

            if (descPct > 0) {
                payload.Documento.Encabezado.Totales.MontoDescuento = discountAmount;
                payload.Documento.DscRcgGlobal = [{
                    NroLinDR: 1, TpoMov: 'D', GlosaDR: 'Descuento Global',
                    TpoValor: '$', ValorDR: discountAmount
                }];
            }

            // ── Request ─────────────────────────────────────────────────────
            const formData = new FormData();
            formData.append('input', JSON.stringify(payload));
            formData.append('file', certBlob, 'certificado.pfx');
            formData.append('caf', cafBlob, 'CAF_56.xml');
            formData.append('password', localConfig.certPassword || localConfig.passwordCert || 'distribuidoraAlmi2020');

            const response = await fetch('https://api.simpleapi.cl/api/v1/dte/generar', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + token },
                body: formData
            });

            const resClone = response.clone();
            const text = await response.text();
            console.log('ND API Response:', text);
            if (!response.ok) throw new Error('Error Generando ND: ' + text);

            const buffer = await resClone.arrayBuffer();
            const finalXml = new TextDecoder('utf-8').decode(buffer);
            let sendResult = null;
            let sendError = null;

            // ── Guardar localmente ──────────────────────────────────────────
            try {
                await electronAPI.saveXml(`DTE_56_Folio_${folio}.xml`, finalXml, 'notas_de_debito');
            } catch (saveErr) { console.warn(saveErr); }

            // ── Enviar al SII ───────────────────────────────────────────────
            try {
                sendResult = await adjustmentEmissionTransport.sendDTE({
                    dteXmlContent: new Blob([buffer], { type: 'application/xml' }),
                    config, tipoDTE: 56, token, certBlob, toast
                });
            } catch (err) {
                sendError = err;
                toast.show('Error enviando ND al SII (XML generado OK)', 'warning');
            }

            // ── Sync BD ─────────────────────────────────────────────────────
            try {
                await api.uploadXml('56', folio, finalXml, {
                    trackId: sendResult?.TrackId || sendResult?.trackId || null,
                    estadoSii: resolveAdjustmentSiiStatus(sendResult, sendError)
                });
            } catch (syncErr) { console.error(syncErr); }

            // ── Avanzar folio ───────────────────────────────────────────────
            const updatedConfig = JSON.parse(localStorage.getItem('sii_config') || '{}');
            updatedConfig.folio_56 = parseInt(folio, 10) + 1;
            localStorage.setItem('sii_config', JSON.stringify(updatedConfig));
            api.saveSiiSettings(updatedConfig);

            if (!sendError) toast.show(`Nota de Débito #${folio} Emitida Exitosamente`, 'success');

            page.historyData = null;
            page.activeTab = 'history';
            setTimeout(() => page.updateUI(), 1500);

        } catch (error) {
            console.error(error);
            toast.show(error.message, 'error');
        } finally {
            page.isProcessing = false;
            if (btn) { btn.innerHTML = origText; btn.disabled = false; }
        }
    }
};
