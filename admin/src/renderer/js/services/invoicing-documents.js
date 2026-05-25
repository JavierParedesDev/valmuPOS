window.ValmuInvoicingDocuments = {
    async loadImageAsDataUrl(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;
                    const context = canvas.getContext('2d');
                    context.drawImage(image, 0, 0);
                    resolve(canvas.toDataURL('image/png'));
                } catch (error) {
                    reject(error);
                }
            };
            image.onerror = reject;
            image.src = src;
        });
    },

    async importXml({ input, api, toast, onImported } = {}) {
        if (!input?.files || input.files.length === 0) {
            return null;
        }

        const file = input.files[0];

        try {
            toast?.show?.(`Subiendo ${file.name}...`, 'info');
            const result = await api.uploadManualXml(file);

            if (!result || (!result.success && !result.id)) {
                throw new Error(result?.error || 'Error desconocido al importar');
            }

            toast?.show?.('XML Importado exitosamente', 'success');
            await onImported?.();
            return result;
        } catch (error) {
            console.error('Import Error:', error);
            toast?.show?.(`Error al importar: ${error.message}`, 'error');
            return null;
        } finally {
            input.value = '';
        }
    },

    async openRemoteXml({ filename, folder, idXml, api, toast, createPdfFromXml } = {}) {
        try {
            toast?.show?.(`Descargando ${filename}...`, 'info');
            if (!idXml) {
                throw new Error('No se encontro el identificador del XML en servidor.');
            }
            const data = await api.downloadXml(idXml);

            await createPdfFromXml?.(data, filename, folder);
            return true;
        } catch (error) {
            console.error(error);
            toast?.show?.(`Error al abrir XML Remoto: ${error.message}`, 'error');
            return false;
        }
    },

    async createPdfFromXmlWrapper({ type, folio, filename, idXml, api, electronAPI, toast, createPdfFromXml } = {}) {
        try {
            toast?.show?.('Generando PDF...', 'info');

            const folder = String(type) === '61'
                ? 'notas_de_credito'
                : (String(type) === '56' ? 'notas_de_debito' : 'facturas');
            const targetFilename = filename || `DTE_${type}_Folio_${folio}.xml`;

            let xmlContent = await electronAPI.readLocalText(`${folder}/${targetFilename}`);

            if (!xmlContent) {
                console.log('Local not found, trying remote...', targetFilename, idXml);
                if (!idXml) {
                    throw new Error('No se encontro el XML local y el documento no tiene respaldo remoto.');
                }
                xmlContent = await api.downloadXml(idXml);
                await electronAPI.saveXml(targetFilename, xmlContent, folder);
            }

            if (typeof xmlContent !== 'string' || !xmlContent.trim() || !xmlContent.includes('<')) {
                throw new Error('Contenido XML vacio.');
            }

            await createPdfFromXml?.(xmlContent, targetFilename, folder);
            return true;
        } catch (error) {
            console.error('PDF Wrapper Error:', error);
            toast?.show?.(`Error generando PDF: ${error.message}`, 'error');
            return false;
        }
    },

    async handleDelete({ filename, api, toast, refreshHistory } = {}) {
        if (!filename || filename === 'null') {
            toast?.show?.('No se puede eliminar un documento sin nombre de archivo.', 'warning');
            return false;
        }

        if (!confirm(`Estas seguro de que deseas eliminar el documento ${filename}? Esta accion no se puede deshacer.`)) {
            return false;
        }

        try {
            toast?.show?.('Eliminando...', 'info');
            let localDeleteError = null;

            if (typeof api.deleteXml === 'function') {
                const apiRes = await api.deleteXml(filename);
                if (apiRes?.error) {
                    console.warn('API Delete warning:', apiRes.error);
                }
            } else {
                console.warn('api.deleteXml no esta disponible; se omite borrado remoto.');
            }

            if (typeof window.electronAPI?.deleteInvoiceFiles === 'function') {
                const localResult = await window.electronAPI.deleteInvoiceFiles(filename);
                if (!localResult?.success) {
                    localDeleteError = localResult?.error || 'No se pudieron borrar archivos locales';
                    console.warn('Local delete warning:', localDeleteError);
                }
            }

            if (localDeleteError) {
                toast?.show?.('Documento eliminado con advertencias locales.', 'warning');
            } else {
                toast?.show?.('Documento eliminado.', 'success');
            }
            await refreshHistory?.();
            return true;
        } catch (error) {
            console.error('Delete Error:', error);
            toast?.show?.('Error al eliminar: ' + error.message, 'error');
            return false;
        }
    },

    async downloadAndSaveXml({ filename, folder, idXml, api, electronAPI, toast } = {}) {
        try {
            toast?.show?.('Descargando XML...', 'info');
            if (!idXml) {
                throw new Error('No se encontro el identificador del XML en servidor.');
            }
            const data = await api.downloadXml(idXml);
            if (!data) {
                throw new Error('No se pudo descargar el XML');
            }

            const result = await electronAPI.saveXml(filename, data, folder);
            if (!result?.success) {
                throw new Error('No se pudo guardar el archivo localmente.');
            }

            toast?.show?.('XML Guardado exitosamente', 'success');
            return result;
        } catch (error) {
            console.error('Download Error:', error);
            toast?.show?.('Error descargando XML: ' + error.message, 'error');
            return null;
        }
    },

    async createPdfFromXml({ xmlContent, filename, folder, electronAPI } = {}) {
        if (!window.jspdf) {
            throw new Error('jsPDF Library not loaded');
        }

        if (typeof xmlContent !== 'string' || !xmlContent.trim() || !xmlContent.includes('<')) {
            throw new Error('El contenido recibido no corresponde a un XML valido.');
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('No se pudo interpretar el XML del DTE.');
        }

        const getTag = (tag, parent = xmlDoc) => {
            const el = parent.getElementsByTagName(tag)[0];
            return el ? el.textContent : '';
        };

        const folio = getTag('Folio');
        const fecha = getTag('FchEmis');
        const tipo = getTag('TipoDTE');
        const emisorNode = xmlDoc.getElementsByTagName('Emisor')[0];
        const receptorNode = xmlDoc.getElementsByTagName('Receptor')[0];
        const rznSocEmi = getTag('RznSoc', emisorNode);
        const rutEmi = getTag('RUTEmisor', emisorNode);
        const giroEmi = getTag('GiroEmis', emisorNode);
        const dirEmi = getTag('DirOrigen', emisorNode);
        const cmnaEmi = getTag('CmnaOrigen', emisorNode);
        const rznSocRx = getTag('RznSocRecep', receptorNode);
        const rutRx = getTag('RUTRecep', receptorNode);
        const giroRx = getTag('GiroRecep', receptorNode);
        const dirRx = getTag('DirRecep', receptorNode);
        const cmnaRx = getTag('CmnaRecep', receptorNode);
        const ciudadRx = getTag('CiudadRecep', receptorNode);
        const total = getTag('MntTotal');
        const neto = getTag('MntNeto');
        const iva = getTag('IVA');
        const exento = getTag('MntExe');

        let tipoTxt = 'DOCUMENTO TRIBUTARIO';
        let subTipoTxt = 'ELECTRONICO';
        if (tipo === '33') tipoTxt = 'FACTURA ELECTRONICA';
        if (tipo === '39') tipoTxt = 'BOLETA ELECTRONICA';
        if (tipo === '61') tipoTxt = 'NOTA DE CREDITO';
        if (tipo === '61') subTipoTxt = 'ELECTRONICA';
        if (tipo === '56') tipoTxt = 'NOTA DE DEBITO';
        if (tipo === '56') subTipoTxt = 'ELECTRONICA';
        const fullTipoTxt = tipo === '61' || tipo === '56' ? `${tipoTxt} ${subTipoTxt}` : tipoTxt;

        // ── LOGO ──────────────────────────────────────────────────────────────
        try {
            const logoDataUrl = await this.loadImageAsDataUrl('assets/logo.png');
            doc.addImage(logoDataUrl, 'PNG', 10, 8, 22, 22);
        } catch (error) {
            console.warn('No se pudo cargar el logo para el PDF:', error);
        }

        // ── CUADRO ROJO (derecha) ─────────────────────────────────────────────
        // Se dibuja PRIMERO para saber cuánto espacio ocupa visualmente
        const boxX = 133;
        const boxY = 8;
        const boxW = 67;
        const boxH = 32;

        doc.setDrawColor(204, 0, 0);
        doc.setLineWidth(1);
        doc.rect(boxX, boxY, boxW, boxH);
        doc.setTextColor(204, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(`R.U.T.: ${rutEmi || ''}`, boxX + boxW / 2, boxY + 7, { align: 'center' });
        const tipoLines = doc.splitTextToSize(fullTipoTxt, boxW - 4);
        doc.text(tipoLines, boxX + boxW / 2, boxY + 14, { align: 'center', lineHeightFactor: 1.3 });
        doc.setFontSize(12);
        doc.text(`N° ${folio}`, boxX + boxW / 2, boxY + 25, { align: 'center' });
        doc.setFontSize(8);
        doc.text('S.I.I. - CONCEPCION', boxX + boxW / 2, boxY + boxH + 5, { align: 'center' });
        doc.setTextColor(0, 0, 0);
        doc.setDrawColor(0, 0, 0);

        // ── DATOS EMISOR (izquierda, limitado antes del cuadro rojo) ─────────
        // maxX disponible = boxX - margen = 133 - 3 = 130; ancho desde x=36 → maxW = 94
        const emisorMaxW = boxX - 36 - 2; // ~95 pts
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        const rznLines = doc.splitTextToSize(rznSocEmi || 'VALMU', emisorMaxW);
        doc.text(rznLines, 36, 14);

        const rznBlockH = rznLines.length * 5; // ~5pt por línea a fontSize 11
        const emisorBaseY = 14 + rznBlockH;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(rutEmi ? `RUT: ${rutEmi}` : '', 36, emisorBaseY + 1);
        const giroLines = doc.splitTextToSize(giroEmi || '', emisorMaxW);
        doc.text(giroLines, 36, emisorBaseY + 6);
        doc.text(doc.splitTextToSize(`${dirEmi || ''} - ${cmnaEmi || ''}`, emisorMaxW), 36, emisorBaseY + 6 + giroLines.length * 4);

        // clientY comienza después del bloque más alto (cuadro rojo o datos emisor)
        const headerBottom = Math.max(boxY + boxH + 8, emisorBaseY + 6 + giroLines.length * 4 + 6);
        const clientY = Math.max(headerBottom, 50);
        const userBoxH = 25;
        doc.setLineWidth(0.2);
        doc.rect(10, clientY, 190, userBoxH);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Señor(es):', 12, clientY + 5);
        doc.text('R.U.T.:', 12, clientY + 10);
        doc.text('Dirección:', 12, clientY + 15);
        doc.text('Giro:', 12, clientY + 20);

        doc.setFont('helvetica', 'normal');
        doc.text((rznSocRx || '').substring(0, 60), 35, clientY + 5);
        doc.text(rutRx || '', 35, clientY + 10);
        doc.text(`${dirRx || ''} ${cmnaRx || ''}`, 35, clientY + 15);
        doc.text((giroRx || '').substring(0, 70), 35, clientY + 20);

        doc.setFont('helvetica', 'bold');
        doc.text('Fecha Emisión:', 130, clientY + 5);
        doc.text('Ciudad:', 130, clientY + 10);
        doc.text('Cond. Venta:', 130, clientY + 15);

        doc.setFont('helvetica', 'normal');
        doc.text(fecha || '', 155, clientY + 5);
        doc.text(cmnaRx || ciudadRx || 'CONCEPCION', 155, clientY + 10);
        const formaPagoCode = getTag('FmaPago') || getTag('FormaPago');
        doc.text(formaPagoCode === '2' ? 'Credito' : 'Contado', 155, clientY + 15);

        const refNodes = xmlDoc.getElementsByTagName('Referencia');
        let currentY = clientY + userBoxH + 5;

        if (refNodes.length > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text('DOCUMENTOS REFERENCIADOS', 10, currentY);
            currentY += 2;

            const refs = [];
            for (let i = 0; i < refNodes.length; i += 1) {
                const node = refNodes[i];
                refs.push([
                    getTag('TpoDocRef', node),
                    getTag('FolioRef', node),
                    getTag('FchRef', node),
                    getTag('RazonRef', node)
                ]);
            }

            doc.autoTable({
                startY: currentY,
                head: [['TIPO DOCUMENTO', 'FOLIO', 'FECHA', 'RAZON REFERENCIA']],
                body: refs,
                theme: 'plain',
                styles: { fontSize: 8, cellPadding: 1 },
                headStyles: { fillColor: [220, 220, 220], textColor: 0, fontStyle: 'bold', lineWidth: 0.1, lineColor: 0 },
                bodyStyles: { lineWidth: 0.1, lineColor: 0 },
                margin: { left: 10, right: 10 }
            });

            currentY = doc.lastAutoTable.finalY + 5;
        } else {
            currentY += 5;
        }

        const items = [];
        const detalleNodes = xmlDoc.getElementsByTagName('Detalle');
        for (let i = 0; i < detalleNodes.length; i += 1) {
            const det = detalleNodes[i];
            const getSub = (tag) => {
                const el = det.getElementsByTagName(tag)[0];
                return el ? el.textContent : '';
            };

            const rawPrc = getSub('PrcItem') || '0';
            const numPrc = parseFloat(rawPrc);
            const formattedPrc = isNaN(numPrc) ? '$0' : '$' + numPrc.toLocaleString('es-CL', {
                minimumFractionDigits: 0,
                maximumFractionDigits: rawPrc.includes('.') ? 4 : 0
            });

            const rawMonto = getSub('MontoItem') || '0';
            const numMonto = parseFloat(rawMonto);
            const formattedMonto = isNaN(numMonto) ? '$0' : '$' + Math.round(numMonto).toLocaleString('es-CL');

            items.push([
                getSub('QtyItem'),
                getSub('NmbItem'),
                formattedPrc,
                formattedMonto
            ]);
        }

        const isNetDocument = tipo === '33' || tipo === '61' || tipo === '56';
        const prcHeader = isNetDocument ? 'P. UNITARIO' : 'P. UNITARIO';
        const subtotalHeader = isNetDocument ? 'SUBTOTAL NETO' : 'SUBTOTAL';

        doc.autoTable({
            startY: currentY,
            head: [['CANTIDAD', 'DESCRIPCION', prcHeader, subtotalHeader]],
            body: items,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: 150 },
            headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'center' },
            columnStyles: {
                0: { halign: 'center', cellWidth: 20 },
                2: { halign: 'right', cellWidth: 35 },
                3: { halign: 'right', cellWidth: 35 }
            },
            margin: { left: 10, right: 10 }
        });

        let bottomY = doc.lastAutoTable.finalY + 10;
        if (bottomY > 250) {
            doc.addPage();
            bottomY = 20;
        }

        const totalsW = 70;
        const totalsX = 210 - totalsW - 10;

        const parsedNeto = neto ? parseInt(neto, 10) : 0;
        const parsedIva = iva ? parseInt(iva, 10) : 0;
        const parsedExento = exento ? parseInt(exento, 10) : 0;
        const parsedTotal = total ? parseInt(total, 10) : 0;

        let currentTotalY = bottomY;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');

        if (parsedNeto > 0) {
            doc.text('SUBTOTAL:', totalsX, currentTotalY);
            doc.text('$' + parsedNeto.toLocaleString('es-CL'), 200, currentTotalY, { align: 'right' });
            currentTotalY += 5;
        }

        if (parsedIva > 0) {
            const tasaIva = getTag('TasaIVA') || '19';
            doc.text(`IVA ${tasaIva}%:`, totalsX, currentTotalY);
            doc.text('$' + parsedIva.toLocaleString('es-CL'), 200, currentTotalY, { align: 'right' });
            currentTotalY += 5;
        }

        if (parsedExento > 0) {
            doc.text('EXENTO:', totalsX, currentTotalY);
            doc.text('$' + parsedExento.toLocaleString('es-CL'), 200, currentTotalY, { align: 'right' });
            currentTotalY += 5;
        }

        // Draw the total box
        doc.setFillColor(240, 240, 240);
        doc.rect(totalsX, currentTotalY + 3, totalsW, 8, 'F');
        doc.rect(totalsX, currentTotalY + 3, totalsW, 8, 'S');
        doc.setFontSize(10);
        doc.text('TOTAL:', totalsX + 2, currentTotalY + 9);
        doc.text('$' + parsedTotal.toLocaleString('es-CL'), 200, currentTotalY + 9, { align: 'right' });

        const timbreY = bottomY;
        try {
            const tedNode = xmlDoc.getElementsByTagName('TED')[0];
            if (tedNode && window.bwipjs) {
                const serializer = new XMLSerializer();
                const tedString = serializer.serializeToString(tedNode);
                const canvas = document.createElement('canvas');
                window.bwipjs.toCanvas(canvas, {
                    bcid: 'pdf417',
                    text: tedString,
                    scale: 3,
                    height: 10,
                    incltext: false,
                    textxalign: 'center'
                });

                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', 10, timbreY, 75, 23);
            } else {
                doc.setLineWidth(0.5);
                doc.rect(10, timbreY, 70, 22);
                doc.text('TIMBRE NO DISPONIBLE', 45, timbreY + 11, { align: 'center' });
            }
        } catch (error) {
            console.error('Error generating PDF417:', error);
            doc.setLineWidth(0.5);
            doc.rect(10, timbreY, 70, 22);
            doc.text('ERROR TIMBRE', 45, timbreY + 11, { align: 'center' });
        }

        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.text('Timbre Electronico SII', 45, timbreY + 26, { align: 'center' });
        doc.text('Res. 80 de 2014 - Verifique documento en www.sii.cl', 45, timbreY + 30, { align: 'center' });

        const pdfArrayBuffer = doc.output('arraybuffer');
        const pdfBuffer = new Uint8Array(pdfArrayBuffer);
        const pdfFilename = filename.toLowerCase().replace('.xml', '.pdf');
        const result = await electronAPI.saveXml(pdfFilename, pdfBuffer, folder);

        if (!result?.success) {
            throw new Error('Error guardando el archivo PDF');
        }

        await electronAPI.openFile(result.path);
        return result;
    },

    async loadDteDataFromXml({
        type,
        folio,
        activeTab,
        electronAPI,
        toast,
        calcNCLine,
        calcNDLine
    } = {}) {
        try {
            toast?.show?.(`Buscando Folio ${folio}...`, 'info');
            const folders = ['facturas', 'notas_de_credito', 'notas_de_debito'];
            let xmlContent = null;
            let loadedFrom = 'local';

            // 1. Busqueda Local
            for (const folder of folders) {
                try {
                    const content = await electronAPI.readLocalText(`${folder}/DTE_${type}_Folio_${folio}.xml`);
                    if (content) {
                        xmlContent = content;
                        break;
                    }
                } catch (e) {
                    // Ignore local read errors
                }
            }

            // 2. Busqueda Remota si no se encontro local
            if (!xmlContent && window.ValmuInvoicingApi) {
                toast?.show?.(`Folio ${folio} no encontrado localmente. Buscando en servidor...`, 'info');
                try {
                    const listResponse = await window.ValmuInvoicingApi.getXmlList();
                    const list = Array.isArray(listResponse) ? listResponse : (listResponse?.data || []);
                    const remoteDte = list.find(d => String(d.tipo_dte || d.tipoDte) === String(type) && String(d.folio) === String(folio));

                    if (remoteDte) {
                        const idXml = remoteDte.id_xml || remoteDte.id;
                        xmlContent = await window.ValmuInvoicingApi.downloadXml(idXml);
                        loadedFrom = 'remote';
                        toast?.show?.(`DTE descargado del servidor.`, 'success');

                        // Opcional: Guardar localmente para la proxima
                        const folderTarget = String(type) === '61' ? 'notas_de_credito' : (String(type) === '56' ? 'notas_de_debito' : 'facturas');
                        const filename = `DTE_${type}_Folio_${folio}.xml`;
                        await electronAPI.saveXml(filename, xmlContent, folderTarget);
                    }
                } catch (remoteError) {
                    console.error('Remote DTE search failed:', remoteError);
                }
            }

            if (!xmlContent) {
                throw new Error(`No se encontro el DTE ${type} Folio ${folio} en local ni en el servidor.`);
            }

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
            const receptorEl = xmlDoc.getElementsByTagName('Receptor')[0];

            let prefix = activeTab === 'note' ? 'nc' : 'nd';
            if (activeTab === 'create') prefix = 'dte';

            if (receptorEl) {
                const fields = {
                    'rut-recep': receptorEl.getElementsByTagName('RUTRecep')[0]?.textContent,
                    'rzn-recep': receptorEl.getElementsByTagName('RznSocRecep')[0]?.textContent,
                    'dir-recep': receptorEl.getElementsByTagName('DirRecep')[0]?.textContent,
                    'cmna-recep': receptorEl.getElementsByTagName('CmnaRecep')[0]?.textContent,
                    'giro-recep': receptorEl.getElementsByTagName('GiroRecep')[0]?.textContent,
                    'ciudad-recep': receptorEl.getElementsByTagName('CiudadRecep')[0]?.textContent
                };

                for (const [suffix, value] of Object.entries(fields)) {
                    const el = document.getElementById(`${prefix}-${suffix}`);
                    if (el && (!el.value || el.value === 'BUSCAR...')) {
                        el.value = value || '';
                    }
                }

                toast?.show?.('Datos de Receptor cargados.', 'success');
            }

            const detalles = xmlDoc.getElementsByTagName('Detalle');
            if (detalles.length > 0) {
                const containerId = activeTab === 'create' ? 'invoice-items-container' : `${prefix}-items-container`;
                const container = document.getElementById(containerId);

                // Normalizacion de Precios: El UI asume que el precio ingresado (.item-price) es NETO.
                // Si el XML trae el precio en BRUTO (como en las Boletas 39), debemos dividir por 1.19.
                // Si el XML trae el precio en NETO (como en Facturas 33 o Notas 61/56), NO dividimos.
                const shouldNormalize = String(type) === '39';

                if (container) {
                    const itemPrefix = activeTab === 'create' ? 'item' : `${prefix}-item`;
                    const firstRow = container.querySelector(`.${itemPrefix}-row`) || container.querySelector('.item-row');
                    const isFirstEmpty = firstRow && !firstRow.querySelector(`.${itemPrefix}-nombre`).value;

                    for (let i = 0; i < detalles.length; i += 1) {
                        const det = detalles[i];
                        const name = det.getElementsByTagName('NmbItem')[0]?.textContent;
                        const qty = det.getElementsByTagName('QtyItem')[0]?.textContent;
                        let prc = parseFloat(det.getElementsByTagName('PrcItem')[0]?.textContent || 0);
                        const desc = parseFloat(det.getElementsByTagName('DescuentoPct')[0]?.textContent || 0);

                        if (shouldNormalize) {
                            prc = prc / 1.19;
                        }

                        let targetRow;
                        if (i === 0 && isFirstEmpty) {
                            targetRow = firstRow;
                        } else {
                            const btnAddId = activeTab === 'create' ? 'btn-add-line' : `btn-${prefix}-add-line`;
                            const btnAdd = document.getElementById(btnAddId);
                            if (btnAdd) {
                                btnAdd.click();
                                targetRow = container.lastElementChild;
                            }
                        }

                        if (targetRow) {
                            targetRow.querySelector(`.${itemPrefix}-nombre`).value = name || '';
                            targetRow.querySelector(`.${itemPrefix}-qty`).value = qty || 1;
                            targetRow.querySelector(`.${itemPrefix}-price`).value = Math.round(prc);
                            
                            const descEl = targetRow.querySelector(`.${itemPrefix}-pct-desc`);
                            if (descEl && desc > 0) descEl.value = Math.round(desc);

                            const qtyInput = targetRow.querySelector(`.${itemPrefix}-qty`);
                            if (activeTab === 'note' && calcNCLine) {
                                calcNCLine(qtyInput);
                            } else if (activeTab === 'debit' && calcNDLine) {
                                calcNDLine(qtyInput);
                            } else if (activeTab === 'create' && window.invoicePage?.calcLine) {
                                window.invoicePage.calcLine(qtyInput);
                            }
                        }
                    }
                }
            }

            return true;
        } catch (error) {
            console.error(error);
            toast?.show?.(error.message, 'error');
            return false;
        }
    }
};
