import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { apiRequest } from '../services/api';
import {
    Badge,
    Card,
    DangerButton,
    EmptyState,
    Field,
    FormModal,
    PickerField,
    PrimaryButton,
    Screen,
    SecondaryButton,
    SectionHeader,
    SwitchField
} from '../components/UI';
import { formatCurrency, toInteger, toNumber } from '../utils/format';

const PRODUCT_PAGE_SIZE = 40;
const PRODUCT_PICKER_LIMIT = 12;
let mobileProductRequestId = 0;
let mobileProductPickerRequestId = 0;

function normalizeProductSearchValue(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function filterProductsLocally(term = '', source = []) {
    const normalizedTerm = normalizeProductSearchValue(term);
    if (!normalizedTerm) return source;

    const tokens = normalizedTerm.split(/\s+/).filter(Boolean);

    return source.filter((product) => {
        const haystack = [
            product.nombreProducto,
            product.codigoBarras,
            product.nombreCategoria,
            product.nombreProveedor
        ]
            .filter(Boolean)
            .map(normalizeProductSearchValue)
            .join(' ');

        return tokens.every((token) => haystack.includes(token));
    });
}

function emptyProductForm() {
    return {
        nombreProducto: '',
        codigoBarras: '',
        precioCosto: '0',
        precioDetalle: '0',
        precioMayor: '0',
        precioPallet: '0',
        precioOferta: '',
        id_categoria: '',
        id_proveedor: '',
        esPesable: false
    };
}

function mapProductToForm(product) {
    return {
        nombreProducto: product.nombreProducto || '',
        codigoBarras: product.codigoBarras || '',
        precioCosto: String(toInteger(product.precioCosto)),
        precioDetalle: String(toInteger(product.precioDetalle)),
        precioMayor: String(toInteger(product.precioMayor)),
        precioPallet: String(toInteger(product.precioPallet)),
        precioOferta: product.precioOferta != null ? String(toInteger(product.precioOferta)) : '',
        id_categoria: product.id_categoria ? String(product.id_categoria) : '',
        id_proveedor: product.id_proveedor ? String(product.id_proveedor) : '',
        esPesable: Boolean(product.esPesable)
    };
}

function emptyMovementForm() {
    return {
        id_producto: '',
        id_sucursal: '',
        id_sucursalDestino: '',
        cantidad: '',
        numeroFactura: ''
    };
}

function buildProductEndpoint(term = '', limit = PRODUCT_PAGE_SIZE) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));

    if (term.trim()) {
        params.set('search', term.trim());
    }

    return `/productos?${params.toString()}`;
}

export default function ProductsScreen({ token }) {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [formVisible, setFormVisible] = useState(false);
    const [movementVisible, setMovementVisible] = useState(false);
    const [movementType, setMovementType] = useState('inbound');
    const [editingProduct, setEditingProduct] = useState(null);
    const [productForm, setProductForm] = useState(emptyProductForm());
    const [movementForm, setMovementForm] = useState(emptyMovementForm());
    const [productPickerQuery, setProductPickerQuery] = useState('');
    const [productPickerResults, setProductPickerResults] = useState([]);
    const [selectedMovementProduct, setSelectedMovementProduct] = useState(null);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [scannerMode, setScannerMode] = useState('search');
    const [hasScanned, setHasScanned] = useState(false);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();

    const loadProducts = async (term = '') => {
        setLoading(true);
        const currentRequestId = ++mobileProductRequestId;

        try {
            const response = await apiRequest({
                endpoint: buildProductEndpoint(term, PRODUCT_PAGE_SIZE),
                token
            });

            if (currentRequestId !== mobileProductRequestId) {
                return;
            }

            const items = response.ok && Array.isArray(response.data) ? response.data : [];
            setProducts(filterProductsLocally(term, items));
        } finally {
            if (currentRequestId === mobileProductRequestId) {
                setLoading(false);
            }
        }
    };

    const loadReferences = async () => {
        const [categoriesResponse, suppliersResponse, branchesResponse] = await Promise.all([
            apiRequest({ endpoint: '/categorias', token }),
            apiRequest({ endpoint: '/proveedores', token }),
            apiRequest({ endpoint: '/sucursales', token })
        ]);

        setCategories(categoriesResponse.ok && Array.isArray(categoriesResponse.data) ? categoriesResponse.data : []);
        setSuppliers(suppliersResponse.ok && Array.isArray(suppliersResponse.data) ? suppliersResponse.data : []);
        setBranches(branchesResponse.ok && Array.isArray(branchesResponse.data) ? branchesResponse.data : []);
    };

    const searchMovementProducts = async (term) => {
        setProductPickerQuery(term);
        const currentRequestId = ++mobileProductPickerRequestId;

        if (!term.trim()) {
            setProductPickerResults([]);
            return;
        }

        const response = await apiRequest({
            endpoint: buildProductEndpoint(term, PRODUCT_PICKER_LIMIT),
            token
        });

        if (currentRequestId !== mobileProductPickerRequestId) {
            return;
        }

        const items = response.ok && Array.isArray(response.data) ? response.data : [];
        setProductPickerResults(filterProductsLocally(term, items));
    };

    useEffect(() => {
        loadProducts();
        loadReferences();
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => {
            loadProducts(searchText);
        }, 350);

        return () => clearTimeout(timeout);
    }, [searchText]);

    const openProductModal = (product = null) => {
        setEditingProduct(product);
        setProductForm(product ? mapProductToForm(product) : emptyProductForm());
        setFormVisible(true);
    };

    const submitProduct = async () => {
        if (!productForm.nombreProducto.trim() || !productForm.codigoBarras.trim()) {
            Alert.alert('Validacion', 'Nombre y codigo son obligatorios');
            return;
        }

        const payload = {
            nombreProducto: productForm.nombreProducto.trim(),
            codigoBarras: productForm.codigoBarras.trim(),
            precioCosto: toInteger(productForm.precioCosto),
            precioDetalle: toInteger(productForm.precioDetalle),
            precioMayor: toInteger(productForm.precioMayor),
            precioPallet: toInteger(productForm.precioPallet),
            precioOferta: productForm.precioOferta.trim() ? toInteger(productForm.precioOferta) : null,
            id_categoria: productForm.id_categoria ? Number(productForm.id_categoria) : null,
            id_proveedor: productForm.id_proveedor ? Number(productForm.id_proveedor) : null,
            esPesable: productForm.esPesable
        };

        const response = await apiRequest({
            endpoint: editingProduct ? `/productos/${editingProduct.id_producto}` : '/productos',
            method: editingProduct ? 'PUT' : 'POST',
            body: payload,
            token
        });

        if (!response.ok) {
            Alert.alert('Error', response.error || 'No se pudo guardar el producto');
            return;
        }

        setFormVisible(false);
        setEditingProduct(null);
        loadProducts(searchText);
    };

    const removeProduct = (product) => {
        Alert.alert('Eliminar producto', `¿Quieres eliminar ${product.nombreProducto}?`, [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar',
                style: 'destructive',
                onPress: async () => {
                    const response = await apiRequest({
                        endpoint: `/productos/${product.id_producto}`,
                        method: 'DELETE',
                        token
                    });

                    if (!response.ok) {
                        Alert.alert('Error', response.error || 'No se pudo eliminar');
                        return;
                    }

                    loadProducts(searchText);
                }
            }
        ]);
    };

    const openMovementModal = (type) => {
        setMovementType(type);
        setMovementForm(emptyMovementForm());
        setSelectedMovementProduct(null);
        setProductPickerQuery('');
        setProductPickerResults([]);
        setMovementVisible(true);
    };

    const submitMovement = async () => {
        if (!movementForm.id_producto || !movementForm.cantidad) {
            Alert.alert('Validacion', 'Debes seleccionar producto y cantidad');
            return;
        }

        const response = await apiRequest({
            endpoint: movementType === 'transfer' ? '/productos/traslado' : '/productos/ingreso',
            method: 'POST',
            body: movementType === 'transfer'
                ? {
                    id_producto: Number(movementForm.id_producto),
                    id_sucursalDestino: Number(movementForm.id_sucursalDestino),
                    cantidadMov: toNumber(movementForm.cantidad)
                }
                : {
                    id_producto: Number(movementForm.id_producto),
                    id_sucursal: Number(movementForm.id_sucursal),
                    cantidadIngreso: toNumber(movementForm.cantidad),
                    numeroFactura: movementForm.numeroFactura.trim()
                },
            token
        });

        if (!response.ok) {
            Alert.alert('Error', response.error || 'No se pudo registrar el movimiento');
            return;
        }

        setMovementVisible(false);
        loadProducts(searchText);
    };

    const openScanner = async (mode) => {
        if (!cameraPermission?.granted) {
            const permissionResponse = await requestCameraPermission();
            if (!permissionResponse.granted) {
                Alert.alert('Permiso requerido', 'Debes permitir el uso de camara para escanear codigos.');
                return;
            }
        }

        setHasScanned(false);
        setScannerMode(mode);
        setScannerVisible(true);
    };

    const handleScanned = async ({ data }) => {
        if (hasScanned) return;
        setHasScanned(true);

        if (scannerMode === 'search') {
            setSearchText(data);
        } else if (scannerMode === 'form') {
            setProductForm((prev) => ({ ...prev, codigoBarras: data }));
        } else if (scannerMode === 'movement') {
            await searchMovementProducts(data);
            setProductPickerQuery(data);
        }

        setScannerVisible(false);
    };

    return (
        <Screen>
            <SectionHeader
                title="Productos"
                subtitle="Carga parcial, busqueda incremental y scanner"
                actions={
                    <View style={styles.headerActions}>
                        <SecondaryButton title="Ingreso" onPress={() => openMovementModal('inbound')} />
                        <SecondaryButton title="Traslado" onPress={() => openMovementModal('transfer')} />
                        <PrimaryButton title="+ Nuevo" onPress={() => openProductModal()} compact />
                    </View>
                }
            />

            <View style={styles.searchShell}>
                <View style={styles.searchPanel}>
                    <Field
                        label="Buscar producto"
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholder="Nombre o codigo de barras"
                    />

                    <View style={styles.searchActions}>
                        <SecondaryButton title="Escanear" onPress={() => openScanner('search')} />
                        {searchText ? <SecondaryButton title="Limpiar" onPress={() => setSearchText('')} /> : null}
                    </View>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#f58233" style={{ marginTop: 32 }} />
            ) : (
                <FlatList
                    data={products}
                    keyExtractor={(item) => String(item.id_producto)}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    renderItem={({ item }) => (
                        <Card>
                            <View style={styles.productHero}>
                                <View style={styles.productBadge}>
                                    <Text style={styles.productBadgeText}>{(item.nombreCategoria || 'General').slice(0, 12)}</Text>
                                </View>
                                {item.esPesable ? <Badge label="Pesable" /> : null}
                            </View>

                            <Text style={styles.title}>{item.nombreProducto}</Text>
                            <Text style={styles.code}>Codigo {item.codigoBarras}</Text>

                            <View style={styles.infoGrid}>
                                <InfoPill label="Categoria" value={item.nombreCategoria || 'Sin categoria'} />
                                <InfoPill label="Proveedor" value={item.nombreProveedor || '-'} />
                                <InfoPill label="Venta" value={formatCurrency(item.precioDetalle)} accent />
                                <InfoPill label="Costo" value={formatCurrency(item.precioCosto)} />
                            </View>

                            <View style={styles.actions}>
                                <SecondaryButton title="Editar" onPress={() => openProductModal(item)} />
                                <DangerButton title="Eliminar" onPress={() => removeProduct(item)} />
                            </View>
                        </Card>
                    )}
                    ListEmptyComponent={<EmptyState text="No hay productos para mostrar con ese filtro." />}
                />
            )}

            <FormModal
                visible={formVisible}
                title={editingProduct ? 'Editar producto' : 'Nuevo producto'}
                onClose={() => setFormVisible(false)}
                onSubmit={submitProduct}
                submitLabel={editingProduct ? 'Guardar cambios' : 'Crear producto'}
            >
                <Field label="Nombre" value={productForm.nombreProducto} onChangeText={(value) => setProductForm((prev) => ({ ...prev, nombreProducto: value }))} />
                <Field label="Codigo de barras" value={productForm.codigoBarras} onChangeText={(value) => setProductForm((prev) => ({ ...prev, codigoBarras: value }))} />
                <View style={styles.formScannerAction}>
                    <SecondaryButton title="Escanear codigo" onPress={() => openScanner('form')} />
                </View>
                <Field label="Precio costo" value={productForm.precioCosto} onChangeText={(value) => setProductForm((prev) => ({ ...prev, precioCosto: value }))} keyboardType="numeric" />
                <Field label="Precio detalle" value={productForm.precioDetalle} onChangeText={(value) => setProductForm((prev) => ({ ...prev, precioDetalle: value }))} keyboardType="numeric" />
                <Field label="Precio mayorista" value={productForm.precioMayor} onChangeText={(value) => setProductForm((prev) => ({ ...prev, precioMayor: value }))} keyboardType="numeric" />
                <Field label="Precio pallet" value={productForm.precioPallet} onChangeText={(value) => setProductForm((prev) => ({ ...prev, precioPallet: value }))} keyboardType="numeric" />
                <Field label="Precio oferta" value={productForm.precioOferta} onChangeText={(value) => setProductForm((prev) => ({ ...prev, precioOferta: value }))} keyboardType="numeric" />
                <PickerField
                    label="Categoria"
                    value={productForm.id_categoria}
                    onChange={(value) => setProductForm((prev) => ({ ...prev, id_categoria: value }))}
                    options={categories.map((item) => ({ label: item.nombreCategoria, value: String(item.id_categoria) }))}
                    emptyLabel="Sin categoria"
                />
                <PickerField
                    label="Proveedor"
                    value={productForm.id_proveedor}
                    onChange={(value) => setProductForm((prev) => ({ ...prev, id_proveedor: value }))}
                    options={suppliers.map((item) => ({ label: item.nombreProveedor, value: String(item.id_proveedor) }))}
                    emptyLabel="Sin proveedor"
                />
                <SwitchField
                    label="Producto pesable"
                    value={productForm.esPesable}
                    onValueChange={(value) => setProductForm((prev) => ({ ...prev, esPesable: value }))}
                />
            </FormModal>

            <FormModal
                visible={movementVisible}
                title={movementType === 'transfer' ? 'Traslado de productos' : 'Ingreso de mercaderia'}
                onClose={() => setMovementVisible(false)}
                onSubmit={submitMovement}
                submitLabel="Guardar movimiento"
            >
                <Field
                    label="Buscar o escanear producto"
                    value={productPickerQuery}
                    onChangeText={searchMovementProducts}
                    placeholder="Nombre o codigo"
                />
                <View style={styles.searchActions}>
                    <SecondaryButton title="Escanear producto" onPress={() => openScanner('movement')} />
                </View>

                {selectedMovementProduct ? (
                    <View style={styles.selectedProductCard}>
                        <Text style={styles.selectedProductTitle}>{selectedMovementProduct.nombreProducto}</Text>
                        <Text style={styles.selectedProductMeta}>Codigo {selectedMovementProduct.codigoBarras}</Text>
                    </View>
                ) : null}

                {productPickerResults.map((item) => (
                    <TouchableOpacity
                        key={item.id_producto}
                        style={styles.searchResult}
                        onPress={() => {
                            setSelectedMovementProduct(item);
                            setMovementForm((prev) => ({ ...prev, id_producto: String(item.id_producto) }));
                            setProductPickerQuery(`${item.nombreProducto} (${item.codigoBarras})`);
                            setProductPickerResults([]);
                        }}
                    >
                        <Text style={styles.searchResultTitle}>{item.nombreProducto}</Text>
                        <Text style={styles.searchResultMeta}>{item.codigoBarras}</Text>
                    </TouchableOpacity>
                ))}

                {movementType === 'transfer' ? (
                    <PickerField
                        label="Sucursal destino"
                        value={movementForm.id_sucursalDestino}
                        onChange={(value) => setMovementForm((prev) => ({ ...prev, id_sucursalDestino: value }))}
                        options={branches.map((item) => ({ label: item.nombreSucursal, value: String(item.id_sucursal) }))}
                    />
                ) : (
                    <>
                        <PickerField
                            label="Sucursal destino"
                            value={movementForm.id_sucursal}
                            onChange={(value) => setMovementForm((prev) => ({ ...prev, id_sucursal: value }))}
                            options={branches.map((item) => ({ label: item.nombreSucursal, value: String(item.id_sucursal) }))}
                        />
                        <Field
                            label="Numero factura / guia"
                            value={movementForm.numeroFactura}
                            onChangeText={(value) => setMovementForm((prev) => ({ ...prev, numeroFactura: value }))}
                        />
                    </>
                )}
                <Field
                    label="Cantidad"
                    value={movementForm.cantidad}
                    onChangeText={(value) => setMovementForm((prev) => ({ ...prev, cantidad: value }))}
                    keyboardType="numeric"
                />
            </FormModal>

            <Modal visible={scannerVisible} transparent animationType="slide" onRequestClose={() => setScannerVisible(false)}>
                <View style={styles.scannerBackdrop}>
                    <View style={styles.scannerCard}>
                        <View style={styles.scannerHeader}>
                            <View>
                                <Text style={styles.scannerTitle}>Scanner de codigo</Text>
                                <Text style={styles.scannerSubtitle}>
                                    {scannerMode === 'search'
                                        ? 'Busca productos con la camara'
                                        : scannerMode === 'movement'
                                            ? 'Selecciona un producto para el movimiento'
                                            : 'Carga el codigo en el formulario'}
                                </Text>
                            </View>

                            <TouchableOpacity style={styles.scannerClose} onPress={() => setScannerVisible(false)}>
                                <Text style={styles.scannerCloseText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.cameraFrame}>
                            <CameraView
                                style={styles.camera}
                                barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
                                onBarcodeScanned={handleScanned}
                            />
                            <View style={styles.scanGuide} />
                        </View>

                        <Text style={styles.scannerHelp}>Alinea el codigo dentro del recuadro para capturarlo.</Text>
                    </View>
                </View>
            </Modal>
        </Screen>
    );
}

function InfoPill({ label, value, accent = false }) {
    return (
        <View style={[styles.infoPill, accent && styles.infoPillAccent]}>
            <Text style={[styles.infoPillLabel, accent && styles.infoPillLabelAccent]}>{label}</Text>
            <Text style={[styles.infoPillValue, accent && styles.infoPillValueAccent]} numberOfLines={2}>
                {value}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    headerActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    searchShell: {
        marginBottom: 14
    },
    searchPanel: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 16,
        shadowColor: '#17365a',
        shadowOpacity: 0.06,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2
    },
    searchActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    productHero: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    productBadge: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: '#e8f0fa',
        borderRadius: 999
    },
    productBadgeText: {
        color: '#1f4b73',
        fontWeight: '800',
        fontSize: 12,
        textTransform: 'uppercase'
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: '#1e293b',
        lineHeight: 28
    },
    code: {
        marginTop: 6,
        color: '#64748b',
        fontWeight: '600'
    },
    infoGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 16
    },
    infoPill: {
        width: '47%',
        backgroundColor: '#f8fbff',
        borderRadius: 18,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2ebf4'
    },
    infoPillAccent: {
        backgroundColor: '#fff3ea',
        borderColor: '#ffd5ba'
    },
    infoPillLabel: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 4
    },
    infoPillLabelAccent: {
        color: '#c2410c'
    },
    infoPillValue: {
        color: '#1f2937',
        fontWeight: '700'
    },
    infoPillValueAccent: {
        color: '#9a3412'
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 18
    },
    formScannerAction: {
        marginBottom: 14
    },
    selectedProductCard: {
        backgroundColor: '#fff3ea',
        borderRadius: 18,
        padding: 14,
        marginTop: 10,
        marginBottom: 10
    },
    selectedProductTitle: {
        color: '#9a3412',
        fontWeight: '800'
    },
    selectedProductMeta: {
        color: '#c2410c',
        marginTop: 4
    },
    searchResult: {
        backgroundColor: '#f8fbff',
        borderRadius: 16,
        padding: 12,
        marginTop: 8
    },
    searchResultTitle: {
        color: '#1f2937',
        fontWeight: '700'
    },
    searchResultMeta: {
        color: '#64748b',
        marginTop: 4
    },
    scannerBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(5, 16, 29, 0.55)'
    },
    scannerCard: {
        backgroundColor: '#0f2d49',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 18
    },
    scannerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16
    },
    scannerTitle: {
        color: '#ffffff',
        fontSize: 22,
        fontWeight: '900'
    },
    scannerSubtitle: {
        marginTop: 4,
        color: '#c5d5e4'
    },
    scannerClose: {
        width: 40,
        height: 40,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    scannerCloseText: {
        color: '#ffffff',
        fontWeight: '800'
    },
    cameraFrame: {
        height: 360,
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#000000'
    },
    camera: {
        flex: 1
    },
    scanGuide: {
        position: 'absolute',
        top: '38%',
        left: '12%',
        right: '12%',
        height: 92,
        borderWidth: 2,
        borderColor: '#f58233',
        borderRadius: 20,
        backgroundColor: 'transparent'
    },
    scannerHelp: {
        marginTop: 16,
        color: '#d4e0eb',
        textAlign: 'center'
    }
});
