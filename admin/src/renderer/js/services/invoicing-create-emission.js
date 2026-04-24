const createEmissionUtils = window.ValmuInvoicingUtils;
const createEmissionTransport = window.ValmuInvoicingTransport;

function resolveSiiStatus(sendResult, sendError) {
    if (sendResult?.TrackId || sendResult?.trackId) {
        return 'ENVIADO_SII';
    }

    if (sendError) {
        return 'ERROR_ENVIO';
    }

    return 'GENERADO';
}

function parseInvoiceAmount(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return 0;
    }

    const hasDot = raw.includes('.');
    const hasComma = raw.includes(',');
    let normalized = raw.replace(/\s+/g, '');

    if (hasDot && hasComma) {
        const lastDot = normalized.lastIndexOf('.');
        const lastComma = normalized.lastIndexOf(',');
        if (lastDot > lastComma) {
            normalized = normalized.replace(/,/g, '');
        } else {
            normalized = normalized.replace(/\./g, '').replace(',', '.');
        }
    } else if (hasComma) {
        const decimals = normalized.split(',').pop();
        if ((decimals || '').length <= 2) {
            normalized = normalized.replace(/\./g, '').replace(',', '.');
        } else {
            normalized = normalized.replace(/,/g, '');
        }
    } else if (hasDot) {
        const decimals = normalized.split('.').pop();
        if ((decimals || '').length > 2) {
            normalized = normalized.replace(/\./g, '');
        }
    }

    const amount = Number.parseFloat(normalized);
    return Number.isFinite(amount) ? amount : 0;
}

window.ValmuInvoicingCreateEmission = {
    async emitInvoice({ page, api, electronAPI, toast, defaultEmisor } = {}) {
        const btn = document.getElementById('btn-emitir');
        if (!btn || btn.disabled) {
            return;
        }

        const originalContent = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-sync fa-spin"></i> Generando DTE...';

        try {
            const local = JSON.parse(localStorage.getItem('sii_config') || '{}');
            const config = {
                ...local,
                rutEmisor: local.rutEmisor || defaultEmisor.rut
            };

            const { apiKey, rutEmisor } = config;

            if (!apiKey) {
                btn.disabled = false;
                btn.innerHTML = originalContent;
                return toast.show('Falta configurar API Key', 'error');
            }

            if (!rutEmisor) {
                btn.disabled = false;
                btn.innerHTML = originalContent;
                return toast.show('Falta configurar RUT Emisor', 'error');
            }

            const tipoDTE = parseInt(document.getElementById('dte-tipo').value, 10);

            toast.show('Verificando folio...', 'info');
            let folio = 0;
            try {
                const reserved = await api.requestNextFolio?.(tipoDTE);
                folio = parseInt(reserved?.folio, 10) || 0;

                if (folio > 0) {
                    config[`folio_${tipoDTE}`] = folio;
                    localStorage.setItem('sii_config', JSON.stringify(config));

                    const uiFolio = parseInt(document.getElementById('dte-folio').value, 10);
                    if (uiFolio !== folio) {
                        console.warn(`Folio mismatch: UI showed ${uiFolio}, backend reserved ${folio}. Auto-correcting.`);
                        document.getElementById('dte-folio').value = folio;
                        toast.show(`Folio reservado: #${folio}`, 'info');
                    }
                }
            } catch (error) {
                console.error('Backend folio reservation failed, using fallback:', error);
                toast.show(`No se pudo reservar folio en backend: ${error.message}`, 'warning');
                folio = parseInt(config[`folio_${tipoDTE}`], 10) || 1;
            }

            if (!folio || folio <= 0) {
                return toast.show('No se pudo determinar un folio valido', 'error');
            }

            const btnEmitir = document.getElementById('btn-emitir');
            let originalBtnText = '';
            if (btnEmitir) {
                originalBtnText = btnEmitir.innerHTML;
                btnEmitir.disabled = true;
                btnEmitir.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
            }

            try {
                toast.show('Iniciando emision...', 'info');

                const certBase64Data = await electronAPI.readLocalCert('certificado.pfx');
                if (!certBase64Data) {
                    return toast.show('Falta Certificado Digital (no instalado)', 'error');
                }

                const cafText = await electronAPI.readLocalText(`CAF_${tipoDTE}.xml`);
                if (!cafText) {
                    return toast.show(`Falta CAF tipo ${tipoDTE} (no instalado)`, 'error');
                }

                if (!page.checkFolioLimit(tipoDTE)) {
                    toast.show('No se puede emitir: folios agotados', 'error');
                    if (btnEmitir) {
                        btnEmitir.disabled = false;
                        btnEmitir.innerHTML = originalBtnText;
                    }
                    return;
                }

                const emisorRzn = document.getElementById('emi-razon').value || config.razonSocial;
                const emisorDir = document.getElementById('emi-direccion').value || config.direccion;
                const emisorComuna = document.getElementById('emi-comuna').value || config.comuna;
                const emisorCiudad = document.getElementById('emi-ciudad').value || config.ciudad;
                const emisorGiro = document.getElementById('emi-giro').value || config.giro;
                const emisorActeco = document.getElementById('emi-acteco').value || config.acteco;
                const emisorRut = config.rutEmisor;

                if (!emisorRut) {
                    return toast.show('Falta configurar RUT Emisor', 'error');
                }

                const rutRecep = document.getElementById('dte-rut-recep').value;
                const rznRecep = document.getElementById('dte-rzn-recep').value;
                const giroRecep = document.getElementById('dte-giro-recep').value;
                const dirRecep = document.getElementById('dte-dir-recep').value;
                const cmnaRecep = document.getElementById('dte-cmna-recep').value;
                const ciudadRecep = document.getElementById('dte-ciudad-recep').value;

                const itemDetails = [];
                let netoTotal = 0;

                document.querySelectorAll('.item-row').forEach((row) => {
                    const nombre = row.querySelector('.item-nombre').value;
                    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
                    const priceInput = row.querySelector('.item-price');
                    const netPrice = parseInvoiceAmount(priceInput.value);
                    const pctDesc = parseFloat(row.querySelector('.item-pct-desc').value) || 0;

                    if (nombre && qty > 0) {
                        const bruto = qty * netPrice;
                        const discount = bruto * (pctDesc / 100);
                        const subTotalRounded = Math.round(bruto - discount);

                        itemDetails.push({
                            NmbItem: nombre,
                            QtyItem: qty,
                            PrcItem: netPrice,
                            DescuentoPct: pctDesc,
                            MontoItem: subTotalRounded
                        });
                        netoTotal += subTotalRounded;
                    }
                });

                if (itemDetails.length === 0) {
                    return toast.show('Debe agregar al menos un item con nombre y cantidad', 'warning');
                }

                const total = Math.round(netoTotal * 1.19);

                if (!rutRecep) {
                    return toast.show('Falta RUT Receptor', 'warning');
                }
                if (!rznRecep) {
                    return toast.show('Falta Razon Social del Receptor', 'warning');
                }
                if (!dirRecep) {
                    return toast.show('Falta Direccion del Receptor', 'warning');
                }
                if (!cmnaRecep) {
                    return toast.show('Falta Comuna del Receptor', 'warning');
                }
                if (!ciudadRecep) {
                    return toast.show('Falta Ciudad del Receptor', 'warning');
                }

                const certBlob = createEmissionUtils.b64toBlob(certBase64Data);
                const cafBlob = new Blob([cafText], { type: 'text/xml' });

                const formaPagoTxt = document.getElementById('dte-forma-pago').value;
                const formaPagoCode = formaPagoTxt === 'Crédito' ? 2 : 1;

                const inputPayload = {
                    Documento: {
                        Encabezado: {
                            IdentificacionDTE: {
                                TipoDTE: tipoDTE,
                                Folio: folio,
                                FechaEmision: document.getElementById('dte-fch-emis')?.value || new Date().toISOString().slice(0, 10),
                                FechaVencimiento: document.getElementById('dte-fch-venc')?.value || new Date().toISOString().slice(0, 10),
                                FormaPago: formaPagoCode
                            },
                            Emisor: {
                                Rut: emisorRut,
                                RazonSocial: createEmissionUtils.sanitizeString(emisorRzn),
                                Giro: createEmissionUtils.sanitizeString(emisorGiro).substring(0, 80),
                                ActividadEconomica: [parseInt(emisorActeco, 10) || 0],
                                DireccionOrigen: createEmissionUtils.sanitizeString(emisorDir),
                                ComunaOrigen: createEmissionUtils.sanitizeString(emisorComuna),
                                CiudadOrigen: createEmissionUtils.sanitizeString(emisorCiudad || emisorComuna),
                                Telefono: [createEmissionUtils.sanitizeString(document.getElementById('emi-telefono').value || '+569 3259 3474').slice(0, 20)],
                                CorreoEmisor: document.getElementById('emi-email')?.value || 'posventa.almi@gmail.com'
                            },
                            Receptor: {
                                Rut: rutRecep,
                                RazonSocial: createEmissionUtils.sanitizeString(rznRecep),
                                Direccion: createEmissionUtils.sanitizeString(dirRecep),
                                Comuna: createEmissionUtils.sanitizeString(cmnaRecep),
                                Ciudad: createEmissionUtils.sanitizeString(ciudadRecep || cmnaRecep),
                                Giro: createEmissionUtils.sanitizeString(giroRecep || 'COMERCIO').substring(0, 40),
                                Contacto: createEmissionUtils.sanitizeString(document.getElementById('dte-contacto-recep').value).slice(0, 40)
                            },
                            Totales: {
                                MontoNeto: Math.round(total / 1.19),
                                TasaIVA: 19,
                                IVA: total - Math.round(total / 1.19),
                                MontoTotal: total
                            }
                        },
                        Detalles: itemDetails.map((item) => ({
                            IndicadorExento: 0,
                            Nombre: item.NmbItem,
                            Descripcion: item.NmbItem,
                            Cantidad: item.QtyItem,
                            UnidadMedida: 'un',
                            Precio: parseFloat(item.PrcItem.toFixed(4)),
                            Descuento: Math.round((item.PrcItem * item.QtyItem) * (item.DescuentoPct / 100)),
                            Recargo: 0,
                            MontoItem: Math.round(item.MontoItem)
                        })),
                        Referencias: [],
                        DescuentosRecargos: []
                    },
                    Certificado: {
                        Rut: emisorRut,
                        Password: config.certPassword || config.passwordCert || 'distribuidoraAlmi2020'
                    },
                    Ambiente: 1,
                    Tipo: 1
                };

                const formData = new FormData();
                formData.append('file', certBlob, 'certificado.pfx');
                formData.append('password', config.certPassword || config.passwordCert || 'distribuidoraAlmi2020');
                formData.append('caf', cafBlob, `CAF_${tipoDTE}.xml`);
                formData.append('input', JSON.stringify(inputPayload));

                const token = await createEmissionTransport.getBearerToken();
                if (!token) {
                    throw new Error('No se pudo obtener el token de autenticacion.');
                }
                console.log('Bearer Token obtenido:', token);

                const response = await fetch('https://api.simpleapi.cl/api/v1/dte/generar', {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer ' + token
                    },
                    body: formData
                });

                const resClone = response.clone();
                const text = await response.text();
                console.log('Raw Response:', text);

                if (response.ok) {
                    const buffer = await resClone.arrayBuffer();
                    const finalXml = new TextDecoder('utf-8').decode(buffer);
                    let sendResult = null;
                    let sendError = null;

                    try {
                        const filename = `DTE_${tipoDTE}_Folio_${folio}.xml`;
                        const folder = tipoDTE == 61 ? 'notas_de_credito' : (tipoDTE == 56 ? 'notas_de_debito' : 'facturas');
                        await electronAPI.saveXml(filename, finalXml, folder);
                        console.log(`[FILE] Local DTE Saved in ${folder}: ${filename}`);
                    } catch (error) {
                        console.warn('Could not save local copy:', error);
                        toast.show('Error guardando XML localmente', 'warning');
                    }

                    const updatedConfig = JSON.parse(localStorage.getItem('sii_config') || '{}');
                    const nextFolio = folio + 1;
                    updatedConfig[`folio_${tipoDTE}`] = nextFolio;
                    localStorage.setItem('sii_config', JSON.stringify(updatedConfig));
                    api.saveSiiSettings(updatedConfig).catch((error) => console.error('Background Sync Failed:', error));

                    page.historyData = null;
                    page.activeTab = 'history';
                    setTimeout(() => page.updateUI(), 1500);

                    try {
                        console.log('[SII] Preparing to send to SII...');
                        const dteBlob = new Blob([buffer], { type: 'application/xml' });
                        sendResult = await createEmissionTransport.sendDTE({
                            dteXmlContent: dteBlob,
                            config,
                            tipoDTE,
                            token,
                            certBlob,
                            toast
                        });
                        toast.show('Documento enviado al SII exitosamente', 'success');
                        console.log('[SII] Sent Successfully');
                    } catch (error) {
                        sendError = error;
                        console.error('[SII] Error sending:', error);
                        toast.show('Error enviando al SII: ' + error.message, 'warning');
                    }

                    try {
                        const uploadRes = await api.uploadXml(tipoDTE, folio, finalXml, {
                            trackId: sendResult?.TrackId || sendResult?.trackId || null,
                            estadoSii: resolveSiiStatus(sendResult, sendError)
                        });
                        if (uploadRes?.skipped) {
                            console.warn('[SYNC] DTE backup skipped:', uploadRes.reason);
                            toast.show(`Documento emitido sin respaldo DTE en BD: ${uploadRes.reason}`, 'warning');
                        } else {
                            console.log('[SYNC] Uploaded to DB:', uploadRes);
                        }
                    } catch (syncErr) {
                        console.error('[SYNC] Failed to upload to DB:', syncErr);
                        toast.show(`Documento emitido, pero fallo respaldo DTE: ${syncErr.message}`, 'warning');
                    }

                    if (!sendError) {
                        toast.show(`Documento emitido correctamente. Folio: ${folio}`, 'success');
                    }
                } else {
                    toast.show(`Error al emitir: ${response.status}`, 'error');

                    try {
                        const errJson = JSON.parse(text);
                        const msg = errJson.message || errJson.error || errJson.glosa || JSON.stringify(errJson);
                        alert(`Error API:\n${msg}`);
                    } catch (error) {
                        alert(`Error API (Raw):\n${text.substring(0, 500)}...`);
                    }
                }
            } catch (error) {
                console.error('Emit Error:', error);
                toast.show('Error de conexion o proceso', 'error');
            } finally {
                if (btnEmitir) {
                    btnEmitir.disabled = false;
                    btnEmitir.innerHTML = originalBtnText || '<i class="fas fa-paper-plane mr-2"></i> Emitir Documento';
                }
            }
        } catch (outerError) {
            console.error('Outer Config Error:', outerError);
            const currentBtn = document.getElementById('btn-emitir');
            if (currentBtn) {
                currentBtn.disabled = false;
                currentBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error Config';
            }
            toast.show('Error en configuracion inicial: ' + outerError.message, 'error');
        }
    }
};
