import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
import { brandColors } from '../theme';
import { Ionicons } from '@expo/vector-icons';

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
        cantidadMayor: '6',
        cantidadPallet: '24',
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
        cantidadMayor: String(toInteger(product.cantidadMayor || 6)),
        cantidadPallet: String(toInteger(product.cantidadPallet || 24)),
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

export default function ProductsScreen({ token, onSummaryChange }) {
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

    const [detailsVisible, setDetailsVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

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
            const filtered = filterProductsLocally(term, items);
            setProducts(filtered);

            if (onSummaryChange) {
                onSummaryChange({
                    value: String(filtered.length),
                    label: term.trim() ? 'resultados' : 'total productos'
                });
            }
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
        setDetailsVisible(false); // Close details if opening edit
    };

    const openDetailsModal = (product) => {
        setSelectedProduct(product);
        setDetailsVisible(true);
    };

    const submitProduct = async () => {
        if (!productForm.nombreProducto.trim() || !productForm.codigoBarras.trim()) {
            Alert.alert('Validación', 'Nombre y código son obligatorios');
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
            cantidadMayor: toInteger(productForm.cantidadMayor || '6'),
            cantidadPallet: toInteger(productForm.cantidadPallet || '24'),
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

                    setDetailsVisible(false);
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
            Alert.alert('Validación', 'Debes seleccionar producto y cantidad');
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
                title="Catálogo"
                subtitle="Gestión de productos e inventario"
                actions={
                    <View style={styles.headerActions}>
                        <TouchableOpacity style={styles.actionCircle} onPress={() => openMovementModal('inbound')}>
                            <Ionicons name="add-circle-outline" size={24} color={brandColors.accent} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionCircle} onPress={() => openMovementModal('transfer')}>
                            <Ionicons name="swap-horizontal-outline" size={24} color={brandColors.accent} />
                        </TouchableOpacity>
                        <PrimaryButton title="+ Nuevo" onPress={() => openProductModal()} compact style={{ borderRadius: 12, height: 44 }} />
                    </View>
                }
            />

            <View style={styles.searchShell}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search-outline" size={20} color={brandColors.textMuted} style={styles.searchIcon} />
                    <Field
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholder="Nombre o código de barras..."
                        style={styles.searchField}
                        containerStyle={styles.searchFieldContainer}
                    />
                    <TouchableOpacity style={styles.scanButton} onPress={() => openScanner('search')}>
                        <Ionicons name="barcode-outline" size={22} color={brandColors.accent} />
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={brandColors.accent} />
                    <Text style={styles.loaderText}>Sincronizando productos...</Text>
                </View>
            ) : (
                <FlatList
                    data={products}
                    keyExtractor={(item) => String(item.id_producto)}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                        <TouchableOpacity activeOpacity={0.7} onPress={() => openDetailsModal(item)}>
                            <Card style={styles.productCard}>
                                <View style={styles.productTop}>
                                    <View style={styles.productInfo}>
                                        <Text style={styles.categoryLabel}>{item.nombreCategoria || 'Sin categoría'}</Text>
                                        <Text style={styles.productTitle} numberOfLines={2}>{item.nombreProducto}</Text>
                                        <View style={styles.codeRow}>
                                            <Ionicons name="barcode-outline" size={14} color={brandColors.textMuted} />
                                            <Text style={styles.productCode}>{item.codigoBarras}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.priceColumn}>
                                        <Text style={styles.priceHeading}>DETALLE</Text>
                                        <Text style={styles.priceValue}>{formatCurrency(item.precioDetalle)}</Text>
                                        {item.esPesable && (
                                            <View style={styles.pesableBadge}>
                                                <Text style={styles.pesableText}>PESABLE</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                <View style={styles.productMeta}>
                                    <View style={styles.metaItem}>
                                        <Text style={styles.metaLabel}>Costo</Text>
                                        <Text style={styles.metaValueSmall}>{formatCurrency(item.precioCosto)}</Text>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <Text style={styles.metaLabel}>Mayor</Text>
                                        <Text style={styles.metaValueSmall}>{formatCurrency(item.precioMayor)}</Text>
                                    </View>
                                    <View style={styles.metaItem}>
                                        <Text style={styles.metaLabel}>Pallet</Text>
                                        <Text style={styles.metaValueSmall}>{formatCurrency(item.precioPallet)}</Text>
                                    </View>
                                </View>
                            </Card>
                        </TouchableOpacity>
                    )}
                    ListEmptyComponent={<EmptyState text="No se encontraron productos." />}
                />
            )}

            <FormModal
                visible={formVisible}
                title={editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
                onClose={() => setFormVisible(false)}
                onSubmit={submitProduct}
                submitLabel={editingProduct ? 'Guardar cambios' : 'Crear producto'}
            >
                <Field label="Nombre del producto" value={productForm.nombreProducto} onChangeText={(value) => setProductForm((prev) => ({ ...prev, nombreProducto: value }))} />

                <View style={styles.scannerInputRow}>
                    <View style={styles.flexOne}>
                        <Field label="Código de barras" value={productForm.codigoBarras} onChangeText={(value) => setProductForm((prev) => ({ ...prev, codigoBarras: value }))} />
                    </View>
                    <TouchableOpacity style={styles.inputScanButton} onPress={() => openScanner('form')}>
                        <Ionicons name="barcode-outline" size={24} color={brandColors.accent} />
                    </TouchableOpacity>
                </View>

                <View style={styles.formGrid}>
                    <View style={styles.formCol}>
                        <Field label="Costo" value={productForm.precioCosto} onChangeText={(value) => setProductForm((prev) => ({ ...prev, precioCosto: value }))} keyboardType="numeric" />
                    </View>
                    <View style={styles.formCol}>
                        <Field label="Detalle" value={productForm.precioDetalle} onChangeText={(value) => setProductForm((prev) => ({ ...prev, precioDetalle: value }))} keyboardType="numeric" />
                    </View>
                </View>

                <View style={styles.formGrid}>
                    <View style={styles.formCol}>
                        <Field label="Mayorista" value={productForm.precioMayor} onChangeText={(value) => setProductForm((prev) => ({ ...prev, precioMayor: value }))} keyboardType="numeric" />
                    </View>
                    <View style={styles.formCol}>
                        <Field label="Pallet" value={productForm.precioPallet} onChangeText={(value) => setProductForm((prev) => ({ ...prev, precioPallet: value }))} keyboardType="numeric" />
                    </View>
                </View>

                <View style={styles.formGrid}>
                    <View style={styles.formCol}>
                        <Field label="Cant. Mayor" value={productForm.cantidadMayor} onChangeText={(value) => setProductForm((prev) => ({ ...prev, cantidadMayor: value }))} keyboardType="numeric" />
                    </View>
                    <View style={styles.formCol}>
                        <Field label="Cant. Pallet" value={productForm.cantidadPallet} onChangeText={(value) => setProductForm((prev) => ({ ...prev, cantidadPallet: value }))} keyboardType="numeric" />
                    </View>
                </View>

                <Field label="Precio oferta (opcional)" value={productForm.precioOferta} onChangeText={(value) => setProductForm((prev) => ({ ...prev, precioOferta: value }))} keyboardType="numeric" />

                <PickerField
                    label="Categoría"
                    value={productForm.id_categoria}
                    onChange={(value) => setProductForm((prev) => ({ ...prev, id_categoria: value }))}
                    options={categories.map((item) => ({ label: item.nombreCategoria, value: String(item.id_categoria) }))}
                    emptyLabel="Sin categoría"
                />
                <PickerField
                    label="Proveedor"
                    value={productForm.id_proveedor}
                    onChange={(value) => setProductForm((prev) => ({ ...prev, id_proveedor: value }))}
                    options={suppliers.map((item) => ({ label: item.nombreProveedor, value: String(item.id_proveedor) }))}
                    emptyLabel="Sin proveedor"
                />
                <SwitchField
                    label="¿Es un producto pesable?"
                    value={productForm.esPesable}
                    onValueChange={(value) => setProductForm((prev) => ({ ...prev, esPesable: value }))}
                />
            </FormModal>

            <FormModal
                visible={movementVisible}
                title={movementType === 'transfer' ? 'Traslado' : 'Ingreso'}
                onClose={() => setMovementVisible(false)}
                onSubmit={submitMovement}
                submitLabel="Registrar"
            >
                <View style={styles.scannerInputRow}>
                    <View style={styles.flexOne}>
                        <Field
                            label="Buscar o escanear"
                            value={productPickerQuery}
                            onChangeText={searchMovementProducts}
                            placeholder="Nombre o código..."
                        />
                    </View>
                    <TouchableOpacity style={styles.inputScanButton} onPress={() => openScanner('movement')}>
                        <Ionicons name="barcode-outline" size={24} color={brandColors.accent} />
                    </TouchableOpacity>
                </View>

                {selectedMovementProduct ? (
                    <View style={styles.selectedProductCard}>
                        <Text style={styles.selectedProductTitle}>{selectedMovementProduct.nombreProducto}</Text>
                        <Text style={styles.selectedProductMeta}>Código {selectedMovementProduct.codigoBarras}</Text>
                    </View>
                ) : null}

                {productPickerResults.length > 0 && (
                    <View style={styles.searchResultsPanel}>
                        {productPickerResults.map((item) => (
                            <TouchableOpacity
                                key={item.id_producto}
                                style={styles.searchResultItem}
                                onPress={() => {
                                    setSelectedMovementProduct(item);
                                    setMovementForm((prev) => ({ ...prev, id_producto: String(item.id_producto) }));
                                    setProductPickerQuery(item.nombreProducto);
                                    setProductPickerResults([]);
                                }}
                            >
                                <Text style={styles.searchResultTitle}>{item.nombreProducto}</Text>
                                <Text style={styles.searchResultMeta}>{item.codigoBarras}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

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
                            label="Sucursal"
                            value={movementForm.id_sucursal}
                            onChange={(value) => setMovementForm((prev) => ({ ...prev, id_sucursal: value }))}
                            options={branches.map((item) => ({ label: item.nombreSucursal, value: String(item.id_sucursal) }))}
                        />
                        <Field
                            label="N° Factura / Guía"
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

            {/* Modal de Detalles del Producto */}
            <Modal visible={detailsVisible} transparent animationType="slide" onRequestClose={() => setDetailsVisible(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <View style={styles.sheetHandle} />
                            <Text style={styles.modalTitle}>Detalles del Producto</Text>
                        </View>

                        {selectedProduct && (
                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                <View style={styles.detailsHeader}>
                                    <Text style={styles.categoryLabel}>{selectedProduct.nombreCategoria || 'Sin categoría'}</Text>
                                    <Text style={styles.detailsTitle}>{selectedProduct.nombreProducto}</Text>
                                    <View style={styles.codeRow}>
                                        <Ionicons name="barcode-outline" size={18} color={brandColors.textMuted} />
                                        <Text style={styles.detailsCode}>{selectedProduct.codigoBarras}</Text>
                                    </View>
                                </View>

                                <View style={styles.detailsGrid}>
                                    <DetailBlock label="Precio Detalle" value={formatCurrency(selectedProduct.precioDetalle)} highlight />
                                    <DetailBlock label="Precio Costo" value={formatCurrency(selectedProduct.precioCosto)} />
                                </View>

                                <View style={styles.detailsGrid}>
                                    <DetailBlock label="Precio Mayor" value={formatCurrency(selectedProduct.precioMayor)} />
                                    <DetailBlock label="Cant. Mayor" value={selectedProduct.cantidadMayor} />
                                </View>

                                <View style={styles.detailsGrid}>
                                    <DetailBlock label="Precio Pallet" value={formatCurrency(selectedProduct.precioPallet)} />
                                    <DetailBlock label="Cant. Pallet" value={selectedProduct.cantidadPallet} />
                                </View>

                                <View style={styles.infoSection}>
                                    <Text style={styles.infoLabel}>Proveedor</Text>
                                    <Text style={styles.infoValue}>{selectedProduct.nombreProveedor || 'No especificado'}</Text>
                                </View>

                                {selectedProduct.esPesable && (
                                    <View style={styles.pesableInfo}>
                                        <Ionicons name="scale-outline" size={20} color={brandColors.danger} />
                                        <Text style={styles.pesableTextLarge}>Producto sujeto a pesaje (Kg)</Text>
                                    </View>
                                )}
                            </ScrollView>
                        )}

                        <View style={styles.modalActions}>
                            <SecondaryButton title="Editar" onPress={() => openProductModal(selectedProduct)} style={styles.flexOne} />
                            <DangerButton title="Eliminar" onPress={() => removeProduct(selectedProduct)} style={styles.flexOne} />
                        </View>
                        <TouchableOpacity style={styles.closeFullButton} onPress={() => setDetailsVisible(false)}>
                            <Text style={styles.closeFullButtonText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={scannerVisible} transparent animationType="slide" onRequestClose={() => setScannerVisible(false)}>
                <View style={styles.scannerBackdrop}>
                    <View style={styles.scannerCard}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.scannerHeader}>
                            <View>
                                <Text style={styles.scannerTitle}>Escáner Valmu</Text>
                                <Text style={styles.scannerSubtitle}>Detectando código de barras o QR</Text>
                            </View>
                            <TouchableOpacity style={styles.scannerClose} onPress={() => setScannerVisible(false)}>
                                <Ionicons name="close" size={24} color="#ffffff" />
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

                        <Text style={styles.scannerHelp}>Centra el código en el recuadro para escanear.</Text>
                    </View>
                </View>
            </Modal>
        </Screen>
    );
}

function DetailBlock({ label, value, highlight = false }) {
    return (
        <View style={styles.detailBlock}>
            <Text style={styles.detailLabel}>{label}</Text>
            <Text style={[styles.detailValue, highlight && styles.detailValueHighlight]}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    actionCircle: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: brandColors.backgroundAlt,
        alignItems: 'center',
        justifyContent: 'center'
    },
    searchShell: {
        marginBottom: 16
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 20,
        paddingHorizontal: 12,
        height: 60,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2
    },
    searchIcon: {
        marginRight: 8
    },
    searchFieldContainer: {
        flex: 1,
        marginBottom: 0
    },
    searchField: {
        backgroundColor: 'transparent',
        borderWidth: 0,
        height: 48
    },
    scanButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: brandColors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8
    },
    loaderContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40
    },
    loaderText: {
        marginTop: 12,
        color: brandColors.textMuted,
        fontWeight: '600'
    },
    productCard: {
        marginBottom: 14,
        padding: 16,
        borderRadius: 24
    },
    productTop: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    productInfo: {
        flex: 1,
        marginRight: 12
    },
    categoryLabel: {
        color: brandColors.accentStrong,
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 4
    },
    productTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: brandColors.text,
        lineHeight: 22
    },
    codeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
        gap: 4
    },
    productCode: {
        color: brandColors.textMuted,
        fontSize: 13,
        fontWeight: '600'
    },
    priceColumn: {
        alignItems: 'flex-end'
    },
    priceHeading: {
        color: brandColors.textMuted,
        fontSize: 9,
        fontWeight: '800',
        marginBottom: 2
    },
    priceValue: {
        color: brandColors.accentStrong,
        fontSize: 20,
        fontWeight: '900'
    },
    pesableBadge: {
        marginTop: 6,
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    pesableText: {
        color: brandColors.danger,
        fontSize: 10,
        fontWeight: '900'
    },
    divider: {
        height: 1,
        backgroundColor: brandColors.outline,
        marginVertical: 14,
        opacity: 0.5
    },
    productMeta: {
        flexDirection: 'row',
        gap: 16
    },
    metaItem: {
        flex: 1
    },
    metaLabel: {
        fontSize: 10,
        color: brandColors.textMuted,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 2
    },
    metaValueSmall: {
        fontSize: 14,
        color: brandColors.text,
        fontWeight: '800'
    },
    formGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16
    },
    selectedProductCard: {
        backgroundColor: brandColors.accentSoft,
        borderRadius: 18,
        padding: 16,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: brandColors.accent
    },
    selectedProductTitle: {
        color: brandColors.accentStrong,
        fontWeight: '900',
        fontSize: 15
    },
    selectedProductMeta: {
        color: brandColors.accentStrong,
        marginTop: 4,
        fontSize: 13,
        opacity: 0.7
    },
    searchResultsPanel: {
        backgroundColor: brandColors.backgroundAlt,
        borderRadius: 18,
        padding: 8,
        marginBottom: 16
    },
    searchResultItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: brandColors.outline
    },
    searchResultTitle: {
        color: brandColors.text,
        fontWeight: '700'
    },
    searchResultMeta: {
        color: brandColors.textMuted,
        fontSize: 12,
        marginTop: 2
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'flex-end'
    },
    modalCard: {
        backgroundColor: brandColors.surface,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '90%'
    },
    modalHeader: {
        alignItems: 'center',
        paddingTop: 12,
        marginBottom: 20
    },
    sheetHandle: {
        width: 40,
        height: 5,
        backgroundColor: brandColors.outline,
        borderRadius: 999,
        marginBottom: 16
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: brandColors.text
    },
    modalBody: {
        marginBottom: 20
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10
    },
    detailsHeader: {
        marginBottom: 24
    },
    detailsTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: brandColors.text,
        marginTop: 4
    },
    detailsCode: {
        fontSize: 16,
        color: brandColors.textMuted,
        fontWeight: '600'
    },
    detailsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16
    },
    detailBlock: {
        flex: 1,
        backgroundColor: brandColors.backgroundAlt,
        padding: 16,
        borderRadius: 18
    },
    detailLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: brandColors.textMuted,
        textTransform: 'uppercase',
        marginBottom: 4
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '900',
        color: brandColors.text
    },
    detailValueHighlight: {
        color: brandColors.accentStrong,
        fontSize: 20
    },
    infoSection: {
        backgroundColor: brandColors.backgroundAlt,
        padding: 16,
        borderRadius: 18,
        marginBottom: 16
    },
    infoLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: brandColors.textMuted,
        textTransform: 'uppercase',
        marginBottom: 4
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '700',
        color: brandColors.text
    },
    pesableInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FEE2E2',
        padding: 16,
        borderRadius: 18,
        marginBottom: 20
    },
    pesableTextLarge: {
        color: brandColors.danger,
        fontWeight: '800',
        fontSize: 14
    },
    closeFullButton: {
        marginTop: 12,
        paddingVertical: 12,
        alignItems: 'center'
    },
    closeFullButtonText: {
        color: brandColors.textMuted,
        fontWeight: '700',
        fontSize: 15
    },
    scannerBackdrop: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.6)'
    },
    scannerCard: {
        backgroundColor: brandColors.shell,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: 24,
        paddingTop: 12
    },
    scannerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    scannerTitle: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '900'
    },
    scannerSubtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        marginTop: 2
    },
    scannerClose: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    cameraFrame: {
        height: 320,
        borderRadius: 28,
        overflow: 'hidden',
        backgroundColor: '#000'
    },
    camera: {
        flex: 1
    },
    scanGuide: {
        position: 'absolute',
        top: '25%',
        left: '10%',
        right: '10%',
        bottom: '25%',
        borderWidth: 2,
        borderColor: brandColors.accent,
        borderRadius: 24,
        backgroundColor: 'transparent'
    },
    scannerHelp: {
        marginTop: 20,
        color: 'rgba(255,255,255,0.4)',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: '600'
    }
});


