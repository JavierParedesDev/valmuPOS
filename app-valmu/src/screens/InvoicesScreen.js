import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../services/api';
import {
    Card,
    Screen,
    SectionHeader,
    EmptyState,
    SecondaryButton
} from '../components/UI';
import { brandColors } from '../theme';
import { formatCurrency } from '../utils/format';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { DOMParser } from 'xmldom';

export default function InvoicesScreen({ token }) {
    const [loading, setLoading] = useState(true);
    const [invoices, setInvoices] = useState([]);
    const [generating, setGenerating] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Buscamos los registros de DTE
            const res = await apiRequest({ endpoint: '/dte/list', token });
            const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

            // Filtramos solo Facturas (33) y Facturas Exentas (34)
            const filtered = data.filter(doc => {
                const type = String(doc.tipoDte || doc.doc_type || doc.type || '');
                return type === '33' || type === '34';
            });

            // Ordenar por fecha o folio descendente
            const sorted = filtered.sort((a, b) => (b.folio || 0) - (a.folio || 0));
            setInvoices(sorted);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const generatePdf = async (invoice) => {
        setGenerating(true);
        try {
            const idXml = invoice.id_xml || invoice.id;
            if (!idXml) throw new Error('No se encontró el ID del documento.');

            // Descargar XML
            const xmlRes = await apiRequest({ endpoint: `/dte/${idXml}/xml`, token });
            if (!xmlRes.ok) throw new Error('No se pudo descargar el XML del documento.');

            const xmlContent = (typeof xmlRes.data === 'string')
                ? xmlRes.data
                : (xmlRes.data?.xmlContenido || xmlRes.data?.xmlContent || '');

            if (!xmlContent) throw new Error('El XML está vacío.');

            // Parsear XML
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');

            const getTag = (tag, parent = xmlDoc) => {
                const el = parent.getElementsByTagName(tag)[0];
                return el ? el.textContent : '';
            };

            const folio = getTag('Folio');
            const fecha = getTag('FchEmis');
            const tipo = getTag('TipoDTE');
            const emisor = xmlDoc.getElementsByTagName('Emisor')[0];
            const receptor = xmlDoc.getElementsByTagName('Receptor')[0];

            const rznSocEmi = getTag('RznSoc', emisor);
            const rutEmi = getTag('RUTEmisor', emisor);
            const giroEmi = getTag('GiroEmis', emisor);
            const dirEmi = getTag('DirOrigen', emisor);
            const cmnaEmi = getTag('CmnaOrigen', emisor);

            const rznSocRx = getTag('RznSocRecep', receptor);
            const rutRx = getTag('RUTRecep', receptor);
            const dirRx = getTag('DirRecep', receptor);
            const cmnaRx = getTag('CmnaRecep', receptor);

            const items = [];
            const detalleNodes = xmlDoc.getElementsByTagName('Detalle');
            for (let i = 0; i < detalleNodes.length; i++) {
                const det = detalleNodes[i];
                items.push({
                    qty: getTag('QtyItem', det),
                    name: getTag('NmbItem', det),
                    price: parseInt(getTag('PrcItem', det) || 0),
                    total: parseInt(getTag('MontoItem', det) || 0)
                });
            }

            const net = parseInt(getTag('MntNeto') || 0);
            const iva = parseInt(getTag('IVA') || 0);
            const total = parseInt(getTag('MntTotal') || 0);

            let tipoLabel = tipo === '33' ? 'FACTURA ELECTRÓNICA' : 'FACTURA EXENTA ELECTRÓNICA';

            // HTML Template (Matching Admin Design)
            const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Helvetica', sans-serif; padding: 20px; color: #333; }
                    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
                    .emisor-info { flex: 1; }
                    .emisor-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
                    .emisor-details { font-size: 12px; line-height: 1.4; color: #666; }
                    
                    .folio-box { 
                        border: 2px solid #CC0000; 
                        padding: 15px; 
                        text-align: center; 
                        width: 220px;
                        color: #CC0000;
                    }
                    .folio-rut { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
                    .folio-type { font-size: 12px; font-weight: bold; margin-bottom: 5px; }
                    .folio-num { font-size: 20px; font-weight: bold; }

                    .client-box { 
                        border: 1px solid #ddd; 
                        padding: 15px; 
                        margin-bottom: 20px; 
                        display: flex;
                        justify-content: space-between;
                        font-size: 12px;
                    }
                    .client-label { font-weight: bold; color: #999; text-transform: uppercase; font-size: 10px; margin-bottom: 2px; }
                    .client-val { font-weight: bold; margin-bottom: 10px; }

                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
                    th { background: #f5f5f5; padding: 8px; border: 1px solid #ddd; text-align: left; }
                    td { padding: 8px; border: 1px solid #ddd; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }

                    .footer { display: flex; justify-content: space-between; margin-top: 20px; }
                    .timbre-area { 
                        border: 1px solid #333; 
                        width: 250px; 
                        height: 80px; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center; 
                        font-size: 10px;
                        text-align: center;
                    }
                    .totals-box { width: 220px; }
                    .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
                    .total-final { background: #f5f5f5; font-weight: bold; font-size: 14px; padding: 8px 5px; margin-top: 5px; border: 1px solid #ddd; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="emisor-info">
                        <div class="emisor-name">${rznSocEmi}</div>
                        <div class="emisor-details">
                            RUT: ${rutEmi}<br>
                            ${giroEmi}<br>
                            ${dirEmi}, ${cmnaEmi}
                        </div>
                    </div>
                    <div class="folio-box">
                        <div class="folio-rut">R.U.T.: ${rutEmi}</div>
                        <div class="folio-type">${tipoLabel}</div>
                        <div class="folio-num">N° ${folio}</div>
                        <div style="font-size: 10px; margin-top: 10px;">S.I.I. - CONCEPCION</div>
                    </div>
                </div>

                <div class="client-box">
                    <div style="flex: 1;">
                        <div class="client-label">Señor(es)</div>
                        <div class="client-val">${rznSocRx}</div>
                        <div class="client-label">R.U.T.</div>
                        <div class="client-val">${rutRx}</div>
                        <div class="client-label">Dirección</div>
                        <div class="client-val">${dirRx}, ${cmnaRx}</div>
                    </div>
                    <div style="width: 150px; text-align: right;">
                        <div class="client-label">Fecha Emisión</div>
                        <div class="client-val">${fecha}</div>
                        <div class="client-label">Ciudad</div>
                        <div class="client-val">${cmnaRx}</div>
                    </div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th class="text-center" style="width: 60px;">CANT</th>
                            <th>DESCRIPCION</th>
                            <th class="text-right" style="width: 100px;">P. UNIT</th>
                            <th class="text-right" style="width: 100px;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td class="text-center">${item.qty}</td>
                                <td>${item.name}</td>
                                <td class="text-right">$${item.price.toLocaleString('es-CL')}</td>
                                <td class="text-right">$${item.total.toLocaleString('es-CL')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <div class="footer">
                    <div class="timbre-area">
                        TIMBRE ELECTRÓNICO SII<br>
                        Res. 80 de 2014<br>
                        Verifique documento en www.sii.cl
                    </div>
                    <div class="totals-box">
                        <div class="total-row">
                            <span>MONTO NETO</span>
                            <span>$${net.toLocaleString('es-CL')}</span>
                        </div>
                        <div class="total-row">
                            <span>IVA 19%</span>
                            <span>$${iva.toLocaleString('es-CL')}</span>
                        </div>
                        <div class="total-row total-final">
                            <span>TOTAL</span>
                            <span>$${total.toLocaleString('es-CL')}</span>
                        </div>
                    </div>
                </div>
            </body>
            </html>
            `;

            // Generar PDF
            if (Platform.OS === 'web') {
                const { uri } = await Print.printToFileAsync({ html });
                // En web, abrimos el PDF en una nueva pestaña (o forzamos descarga)
                window.open(uri, '_blank');
            } else {
                const { uri } = await Print.printToFileAsync({ html });

                // Compartir/Guardar
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(uri);
                } else {
                    Alert.alert('Éxito', 'PDF generado correctamente.');
                }
            }

        } catch (error) {
            console.error('PDF Generation error:', error);
            if (Platform.OS === 'web') {
                alert('No se pudo generar el PDF: ' + error.message);
            } else {
                Alert.alert('Error', 'No se pudo generar el PDF: ' + error.message);
            }
        } finally {
            setGenerating(false);
        }
    };

    const renderInvoice = ({ item }) => (
        <Card style={styles.invoiceCard}>
            <View style={styles.invoiceInfo}>
                <View style={[styles.typeBadge, { backgroundColor: item.tipoDte === '33' ? '#DBEAFE' : '#EEF2FF' }]}>
                    <Text style={[styles.typeText, { color: item.tipoDte === '33' ? '#1E40AF' : '#3730A3' }]}>
                        {item.tipoDte === '33' ? 'FACTURA' : 'EXENTA'}
                    </Text>
                </View>
                <View style={styles.details}>
                    <Text style={styles.folio}>Folio #{item.folio}</Text>
                    <Text style={styles.date}>{(item.fechaGuardado || '').split('T')[0]}</Text>
                </View>
            </View>
            <TouchableOpacity
                style={styles.downloadBtn}
                onPress={() => generatePdf(item)}
                disabled={generating}
            >
                <Ionicons name="cloud-download-outline" size={24} color={brandColors.accent} />
            </TouchableOpacity>
        </Card>
    );

    if (loading) {
        return (
            <View style={styles.loaderArea}>
                <ActivityIndicator size="large" color={brandColors.accent} />
                <Text style={styles.loaderText}>Cargando historial...</Text>
            </View>
        );
    }

    return (
        <Screen statusBarColor={brandColors.surface}>
            <FlatList
                data={invoices}
                keyExtractor={(item) => String(item.id_xml || item.id)}
                renderItem={renderInvoice}
                ListHeaderComponent={
                    <SectionHeader
                        title="Historial Facturas"
                        subtitle="Solo documentos tributarios tipo 33/34"
                        icon="document-text-outline"
                    />
                }
                ListEmptyComponent={<EmptyState title="No hay facturas" message="No se encontraron facturas tipo 33 o 34." />}
                contentContainerStyle={styles.listContent}
            />
            {generating && (
                <View style={styles.overlay}>
                    <ActivityIndicator size="large" color="#ffffff" />
                    <Text style={styles.overlayText}>Generando PDF...</Text>
                </View>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    listContent: {
        padding: 16
    },
    loaderArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: brandColors.background
    },
    loaderText: {
        marginTop: 12,
        color: brandColors.textMuted,
        fontWeight: '700'
    },
    invoiceCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        marginBottom: 10
    },
    invoiceInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    typeBadge: {
        width: 60,
        height: 30,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    typeText: {
        fontSize: 10,
        fontWeight: '900'
    },
    details: {
        flex: 1
    },
    folio: {
        fontSize: 16,
        fontWeight: '800',
        color: brandColors.text
    },
    date: {
        fontSize: 12,
        color: brandColors.textMuted,
        marginTop: 2
    },
    downloadBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: brandColors.accentSoft,
        justifyContent: 'center',
        alignItems: 'center'
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000
    },
    overlayText: {
        color: '#ffffff',
        marginTop: 12,
        fontWeight: '800'
    }
});
