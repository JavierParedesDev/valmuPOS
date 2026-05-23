import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
import { formatCurrency, toInteger, toNumber, filterProductsLocally, normalizeSearchValue } from '../utils/format';
import { brandColors } from '../theme';
import { Ionicons } from '@expo/vector-icons';

const PRODUCT_PAGE_SIZE = 40;
const PRODUCT_PICKER_LIMIT = 12;
const PRODUCT_REFERENCE_LIMIT = 500;
let mobileProductRequestId = 0;
let mobileProductPickerRequestId = 0;

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
        familiaPromo: '',
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
        familiaPromo: product.familiaPromo || '',
        id_categoria: product.id_categoria ? String(product.id_categoria) : '',
        id_proveedor: product.id_proveedor ? String(product.id_proveedor) : '',
        esPesable: Boolean(product.esPesable)
    };
}

function resolveProductId(product) {
    const numericValue = Number(product?.id_producto ?? product?.id ?? product?.idProducto);
    return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
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

function buildReferenceEndpoint(basePath, limit = PRODUCT_REFERENCE_LIMIT) {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', '0');
    params.set('page', '1');
    return `${basePath}?${params.toString()}`;
}

function normalizeReferenceOptions(items = [], idKey, nameKey) {
    const uniqueItems = new Map();

    items.forEach((item) => {
        const id = item?.[idKey];
        const name = String(item?.[nameKey] || '').trim();
        if (!id || !name || uniqueItems.has(id)) return;
        uniqueItems.set(id, item);
    });

    return Array.from(uniqueItems.values()).sort((left, right) =>
        String(left?.[nameKey] || '').localeCompare(String(right?.[nameKey] || ''), 'es', { sensitivity: 'base' })
    );
}

function resolveUserId(user) {
    const rawUserId = user?.id_usuario ?? user?.idUsuario ?? user?.usuario_id ?? user?.id ?? null;
    const numericUserId = Number(rawUserId);
    return Number.isNaN(numericUserId) ? null : numericUserId;
}

function resolveUserBranchId(user) {
    const rawBranchId = user?.id_sucursal ?? user?.idSucursal ?? user?.sucursal_id ?? null;
    const numericBranchId = Number(rawBranchId);
    return Number.isNaN(numericBranchId) ? null : numericBranchId;
}

function formatMovementError(response, fallback) {
    const statusLabel = response?.status ? `HTTP ${response.status}` : 'Sin respuesta del servidor';
    const detail = response?.data?.detalle
        ? ` (${typeof response.data.detalle === 'string' ? response.data.detalle : JSON.stringify(response.data.detalle)})`
        : '';
    return `${statusLabel}: ${response?.data?.error || response?.error || fallback}${detail}`;
}

function createMovementRequestId(prefix = 'MOV') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function ProductsScreen({ token, user, onSummaryChange }) {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');
    const [formVisible, setFormVisible] = useState(false);
    const [movementVisible, setMovementVisible] = useState(false);
    const [movementType, setMovementType] = useState('inbound');
    const [movementSubmitting, setMovementSubmitting] = useState(false);
    const [movementRequestId, setMovementRequestId] = useState('');
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
    const [deleteVisible, setDeleteVisible] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteSubmitting, setDeleteSubmitting] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [visibleCount, setVisibleCount] = useState(PRODUCT_PAGE_SIZE);
    const [supplierPickerOpen, setSupplierPickerOpen] = useState(false);
    const [supplierFilter, setSupplierFilter] = useState('');

    const closeDetailsModal = () => {
        setDetailsVisible(false);
    };

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
            setVisibleCount(PRODUCT_PAGE_SIZE);

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
            apiRequest({ endpoint: buildReferenceEndpoint('/categorias'), token }),
            apiRequest({ endpoint: buildReferenceEndpoint('/proveedores'), token }),
            apiRequest({ endpoint: '/sucursales', token })
        ]);

        setCategories(normalizeReferenceOptions(categoriesResponse.ok && Array.isArray(categoriesResponse.data) ? categoriesResponse.data : [], 'id_categoria', 'nombreCategoria'));
        setSuppliers(normalizeReferenceOptions(suppliersResponse.ok && Array.isArray(suppliersResponse.data) ? suppliersResponse.data : [], 'id_proveedor', 'nombreProveedor'));
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
        setSupplierPickerOpen(false);
        setSupplierFilter('');
        setFormVisible(true);
        setDetailsVisible(false); // Close details if opening edit
    };

    const openDetailsModal = (product) => {
        setSelectedProduct(product);
        setDetailsVisible(true);
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
            cantidadMayor: toInteger(productForm.cantidadMayor || '6'),
            cantidadPallet: toInteger(productForm.cantidadPallet || '24'),
            familiaPromo: productForm.familiaPromo.trim() || null,
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

    const openDeleteProductModal = (product) => {
        const productId = resolveProductId(product);

        if (!productId) {
            Alert.alert('Error', 'No se pudo identificar el producto para eliminar.');
            return;
        }

        setDeleteTarget(product);
        setDeleteError('');
        setDeleteVisible(true);
    };

    const closeDeleteProductModal = () => {
        if (deleteSubmitting) return;
        setDeleteVisible(false);
        setDeleteTarget(null);
        setDeleteError('');
    };

    const confirmDeleteProduct = async () => {
        if (deleteSubmitting) return;

        const productId = resolveProductId(deleteTarget);
        if (!productId) {
            setDeleteError('No se pudo identificar el producto para eliminar.');
            return;
        }

        setDeleteSubmitting(true);
        setDeleteError('');

        try {
            const response = await apiRequest({
                endpoint: `/productos/${productId}`,
                method: 'DELETE',
                token
            });

            if (!response.ok) {
                const detail = response.data?.detalle ? ` ${response.data.detalle}` : '';
                setDeleteError(`${response.data?.error || response.error || 'No se pudo eliminar.'}${detail}`);
                return;
            }

            setDeleteVisible(false);
            setDeleteTarget(null);
            setDetailsVisible(false);
            setSelectedProduct(null);
            setProducts((current) => current.filter((item) => resolveProductId(item) !== productId));
            loadProducts(searchText);
        } catch (error) {
            setDeleteError('No se pudo conectar con el servidor.');
        } finally {
            setDeleteSubmitting(false);
        }
    };

    const openMovementModal = (type) => {
        setMovementType(type);
        setMovementForm(emptyMovementForm());
        setMovementRequestId(createMovementRequestId(type === 'transfer' ? 'TRASLADO' : 'INGRESO'));
        setSelectedMovementProduct(null);
        setProductPickerQuery('');
        setProductPickerResults([]);
        setMovementVisible(true);
    };

    const submitMovement = async () => {
        if (movementSubmitting) return;

        if (!movementForm.id_producto || !movementForm.cantidad) {
            Alert.alert('Validacion', 'Debes seleccionar producto y cantidad');
            return;
        }

        const currentUserId = resolveUserId(user);
        const sourceBranchId = resolveUserBranchId(user) || Number(movementForm.id_sucursal);

        if (movementType === 'transfer' && !sourceBranchId) {
            Alert.alert('Validacion', 'No se pudo identificar la sucursal de origen del usuario logeado.');
            return;
        }

        setMovementSubmitting(true);
        try {
            const response = await apiRequest({
            endpoint: movementType === 'transfer' ? '/productos/traslado' : '/productos/ingreso',
            method: 'POST',
            body: movementType === 'transfer'
                ? {
                    id_producto: Number(movementForm.id_producto),
                    id_usuario: currentUserId,
                    id_sucursalOrigen: sourceBranchId,
                    id_sucursalDestino: Number(movementForm.id_sucursalDestino),
                    cantidadMov: toNumber(movementForm.cantidad),
                    comprobanteMov: `${movementRequestId}-${movementForm.id_producto}`
                }
                : {
                    id_producto: Number(movementForm.id_producto),
                    id_usuario: currentUserId,
                    id_sucursal: Number(movementForm.id_sucursal),
                    cantidadIngreso: toNumber(movementForm.cantidad),
                    numeroFactura: movementForm.numeroFactura.trim(),
                    comprobanteMov: `${movementRequestId}-${movementForm.id_producto}`
                },
            token
            });

            if (!response.ok) {
                Alert.alert('Error', formatMovementError(response, 'No se pudo registrar el movimiento'));
                return;
            }

            setMovementVisible(false);
            loadProducts(searchText);
        } finally {
            setMovementSubmitting(false);
        }
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

    const visibleProducts = products.slice(0, visibleCount);
    const canLoadMoreProducts = visibleCount < products.length;
    const filteredSuppliers = suppliers.filter((item) =>
        String(item?.nombreProveedor || '')
            .toLowerCase()
            .includes(String(supplierFilter || '').trim().toLowerCase())
    );
    const selectedSupplierLabel =
        suppliers.find((item) => String(item.id_proveedor) === productForm.id_proveedor)?.nombreProveedor || 'Sin proveedor';

    const loadMoreProducts = () => {
        if (loading || !canLoadMoreProducts) return;
        setVisibleCount((prev) => Math.min(prev + PRODUCT_PAGE_SIZE, products.length));
    };

    return (
        <Screen>
            <SectionHeader
                title="Catalogo"
                subtitle="Gestion de productos e inventario"
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
                    <TextInput
                        value={searchText}
                        onChangeText={setSearchText}
                        placeholder="Nombre o codigo de barras..."
                        placeholderTextColor={brandColors.textMuted}
                        selectionColor={brandColors.accent}
                        style={styles.searchInput}
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
                    data={visibleProducts}
                    keyExtractor={(item) => String(item.id_producto)}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    showsVerticalScrollIndicator={false}
                    onEndReached={loadMoreProducts}
                    onEndReachedThreshold={0.35}
                    renderItem={({ item }) => (
                        <TouchableOpacity activeOpacity={0.7} onPress={() => openDetailsModal(item)}>
                            <Card style={styles.productCard}>
                                <View style={styles.productTop}>
                                    <View style={styles.productInfo}>
                                        <Text style={styles.categoryLabel}>{item.nombreCategoria || 'Sin categoria'}</Text>
                                        <Text style={styles.productTitle} numberOfLines={2}>{item.nombreProducto}</Text>
                                        <View style={styles.codeRow}>
                                            <Ionicons name="barcode-outline" size={14} color={brandColors.textMuted} />
                                            <Text style={styles.productCode}>{item.codigoBarras}</Text>
                                        </View>
                                        {item.familiaPromo ? (
                                            <View style={styles.familyBadge}>
                                                <Text style={styles.familyBadgeText}>Familia {item.familiaPromo}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                    <View style={styles.priceColumn}>
                                        <Text style={styles.priceHeading}>DETALLE</Text>
                                        <Text style={styles.priceValue}>{formatCurrency(item.precioDetalle)}</Text>
                                        {Boolean(item.esPesable) && (
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
                        <Field label="Codigo de barras" value={productForm.codigoBarras} onChangeText={(value) => setProductForm((prev) => ({ ...prev, codigoBarras: value }))} />
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
                <Field
                    label="Familia promocional"
                    value={productForm.familiaPromo}
                    onChangeText={(value) => setProductForm((prev) => ({ ...prev, familiaPromo: value }))}
                    placeholder="Ej: bebidas-3l, yogur-batido"
                />

                <PickerField
                    label="Categoria"
                    value={productForm.id_categoria}
                    onChange={(value) => setProductForm((prev) => ({ ...prev, id_categoria: value }))}
                    options={categories.map((item) => ({ label: item.nombreCategoria, value: String(item.id_categoria) }))}
                    emptyLabel="Sin categoria"
                />
                <View style={styles.inlineSelectBlock}>
                    <Text style={styles.inlineSelectLabel}>Proveedor</Text>
                    <TouchableOpacity
                        style={styles.inlineSelectTrigger}
                        activeOpacity={0.75}
                        onPress={() => setSupplierPickerOpen((current) => !current)}
                    >
                        <Text
                            style={[
                                styles.inlineSelectTriggerText,
                                !productForm.id_proveedor && styles.inlineSelectPlaceholder
                            ]}
                        >
                            {selectedSupplierLabel}
                        </Text>
                        <Ionicons
                            name={supplierPickerOpen ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color={brandColors.textMuted}
                        />
                    </TouchableOpacity>

                    {supplierPickerOpen ? (
                        <View style={styles.inlineSelectPanel}>
                            <TextInput
                                value={supplierFilter}
                                onChangeText={setSupplierFilter}
                                placeholder="Buscar proveedor..."
                                placeholderTextColor={brandColors.textMuted}
                                selectionColor={brandColors.accent}
                                style={styles.inlineSelectSearch}
                            />
                            <ScrollView
                                style={styles.inlineSelectList}
                                showsVerticalScrollIndicator={false}
                                nestedScrollEnabled
                                keyboardShouldPersistTaps="handled"
                            >
                                <TouchableOpacity
                                    style={[
                                        styles.inlineSelectOption,
                                        !productForm.id_proveedor && styles.inlineSelectOptionActive
                                    ]}
                                    onPress={() => {
                                        setProductForm((prev) => ({ ...prev, id_proveedor: '' }));
                                        setSupplierPickerOpen(false);
                                        setSupplierFilter('');
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.inlineSelectOptionText,
                                            !productForm.id_proveedor && styles.inlineSelectOptionTextActive
                                        ]}
                                    >
                                        Sin proveedor
                                    </Text>
                                </TouchableOpacity>

                                {filteredSuppliers.map((item) => {
                                    const isActive = String(item.id_proveedor) === productForm.id_proveedor;
                                    return (
                                        <TouchableOpacity
                                            key={item.id_proveedor}
                                            style={[
                                                styles.inlineSelectOption,
                                                isActive && styles.inlineSelectOptionActive
                                            ]}
                                            onPress={() => {
                                                setProductForm((prev) => ({
                                                    ...prev,
                                                    id_proveedor: String(item.id_proveedor)
                                                }));
                                                setSupplierPickerOpen(false);
                                                setSupplierFilter('');
                                            }}
                                        >
                                            <Text
                                                style={[
                                                    styles.inlineSelectOptionText,
                                                    isActive && styles.inlineSelectOptionTextActive
                                                ]}
                                            >
                                                {item.nombreProveedor}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    ) : null}
                </View>
                <SwitchField
                    label="Es un producto pesablea"
                    value={productForm.esPesable}
                    onValueChange={(value) => setProductForm((prev) => ({ ...prev, esPesable: value }))}
                />
            </FormModal>

            <FormModal
                visible={movementVisible}
                title={movementType === 'transfer' ? 'Traslado' : 'Ingreso'}
                onClose={() => setMovementVisible(false)}
                onSubmit={submitMovement}
                submitLabel={movementSubmitting ? 'Registrando...' : 'Registrar'}
                submitDisabled={movementSubmitting}
            >
                <View style={styles.scannerInputRow}>
                    <View style={styles.flexOne}>
                        <Field
                            label="Buscar o escanear"
                            value={productPickerQuery}
                            onChangeText={searchMovementProducts}
                            placeholder="Nombre o codigo..."
                        />
                    </View>
                    <TouchableOpacity style={styles.inputScanButton} onPress={() => openScanner('movement')}>
                        <Ionicons name="barcode-outline" size={24} color={brandColors.accent} />
                    </TouchableOpacity>
                </View>

                {selectedMovementProduct ? (
                    <View style={styles.selectedProductCard}>
                        <Text style={styles.selectedProductTitle}>{selectedMovementProduct.nombreProducto}</Text>
                        <Text style={styles.selectedProductMeta}>Codigo {selectedMovementProduct.codigoBarras}</Text>
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
                            label="Nro Factura / Guia"
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

            <Modal
                visible={detailsVisible && Boolean(selectedProduct)}
                transparent
                animationType="slide"
                onRequestClose={closeDetailsModal}
                statusBarTranslucent
            >
                {selectedProduct ? (
                    <View style={styles.detailsOverlay}>
                        <Pressable style={StyleSheet.absoluteFill} onPress={closeDetailsModal} />
                        <View style={styles.detailsSheet}>
                            <View style={styles.detailsSheetHeader}>
                                <View style={styles.sheetHandle} />
                                <Text style={styles.modalTitle} allowFontScaling={false}>Detalles del Producto</Text>
                                <TouchableOpacity style={styles.detailsCloseIcon} onPress={closeDetailsModal}>
                                    <Ionicons name="close" size={22} color={brandColors.textMuted} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                                <View style={styles.detailsHeader}>
                                    <Text style={styles.categoryLabel} allowFontScaling={false}>{selectedProduct.nombreCategoria || 'Sin categoria'}</Text>
                                    <Text style={styles.detailsTitle} allowFontScaling={false}>{selectedProduct.nombreProducto}</Text>
                                    <View style={styles.codeRow}>
                                        <Ionicons name="barcode-outline" size={18} color={brandColors.textMuted} />
                                        <Text style={styles.detailsCode} allowFontScaling={false}>{selectedProduct.codigoBarras}</Text>
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
                                    <Text style={styles.infoLabel} allowFontScaling={false}>Familia promocional</Text>
                                    <Text style={styles.infoValue} allowFontScaling={false}>{selectedProduct.familiaPromo || 'Sin familia'}</Text>
                                </View>

                                <View style={styles.infoSection}>
                                    <Text style={styles.infoLabel} allowFontScaling={false}>Proveedor</Text>
                                    <Text style={styles.infoValue} allowFontScaling={false}>{selectedProduct.nombreProveedor || 'No especificado'}</Text>
                                </View>

                                {Boolean(selectedProduct.esPesable) && (
                                    <View style={styles.pesableInfo}>
                                        <Ionicons name="scale-outline" size={20} color={brandColors.danger} />
                                        <Text style={styles.pesableTextLarge} allowFontScaling={false}>Producto sujeto a pesaje (Kg)</Text>
                                    </View>
                                )}
                            </ScrollView>

                            <View style={styles.detailsActions}>
                                <TouchableOpacity
                                    style={styles.detailsActionButton}
                                    onPress={() => openProductModal(selectedProduct)}
                                    activeOpacity={0.75}
                                >
                                    <View style={styles.detailsActionIcon}>
                                        <Ionicons name="create-outline" size={24} color={brandColors.accent} />
                                    </View>
                                    <Text style={styles.detailsActionText} allowFontScaling={false}>Editar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.detailsActionButton}
                                    onPress={() => openDeleteProductModal(selectedProduct)}
                                    activeOpacity={0.75}
                                >
                                    <View style={[styles.detailsActionIcon, styles.detailsActionIconDanger]}>
                                        <Ionicons name="trash-outline" size={24} color={brandColors.danger} />
                                    </View>
                                    <Text style={[styles.detailsActionText, styles.detailsActionTextDanger]} allowFontScaling={false}>Eliminar</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.closeFullButton} onPress={closeDetailsModal}>
                                <Text style={styles.closeFullButtonText} allowFontScaling={false}>Cerrar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}
            </Modal>

            <Modal
                visible={deleteVisible}
                transparent
                animationType="fade"
                onRequestClose={closeDeleteProductModal}
                statusBarTranslucent
            >
                <View style={styles.confirmOverlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={closeDeleteProductModal} />
                    <View style={styles.confirmCard}>
                        <View style={styles.confirmIcon}>
                            <Ionicons name="trash-outline" size={28} color={brandColors.danger} />
                        </View>
                        <Text style={styles.confirmTitle} allowFontScaling={false}>Eliminar producto</Text>
                        <Text style={styles.confirmText} allowFontScaling={false}>
                            {deleteTarget?.nombreProducto || deleteTarget?.nombre || 'Este producto'} se eliminara junto a su stock, movimientos y detalle historico asociado.
                        </Text>
                        {deleteError ? (
                            <View style={styles.confirmErrorBox}>
                                <Text style={styles.confirmErrorText} allowFontScaling={false}>{deleteError}</Text>
                            </View>
                        ) : null}
                        <View style={styles.confirmActions}>
                            <SecondaryButton
                                title="Cancelar"
                                onPress={closeDeleteProductModal}
                                style={styles.flexOne}
                            />
                            <DangerButton
                                title={deleteSubmitting ? 'Eliminando...' : 'Eliminar'}
                                onPress={confirmDeleteProduct}
                                style={styles.flexOne}
                            />
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={scannerVisible} transparent animationType="slide" onRequestClose={() => setScannerVisible(false)}>
                <View style={styles.scannerBackdrop}>
                    <View style={styles.scannerCard}>
                        <View style={styles.sheetHandle} />
                        <View style={styles.scannerHeader}>
                            <View>
                                <Text style={styles.scannerTitle}>Escaner Valmu</Text>
                                <Text style={styles.scannerSubtitle}>Detectando codigo de barras o QR</Text>
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

                        <Text style={styles.scannerHelp}>Centra el codigo en el recuadro para escanear.</Text>
                    </View>
                </View>
            </Modal>
        </Screen>
    );
}

function DetailBlock({ label, value, highlight = false }) {
    return (
        <View style={styles.detailBlock}>
            <Text style={styles.detailLabel} allowFontScaling={false}>{label}</Text>
            <Text
                style={[styles.detailValue, highlight && styles.detailValueHighlight]}
                allowFontScaling={false}
                numberOfLines={2}
            >
                {value}
            </Text>
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
    searchInput: {
        flex: 1,
        height: 48,
        color: brandColors.text,
        fontSize: 14,
        fontWeight: '600',
        paddingVertical: 0,
        textAlignVertical: 'center'
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
        fontSize: 11,
        lineHeight: 15,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0,
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
    familyBadge: {
        alignSelf: 'flex-start',
        marginTop: 8,
        backgroundColor: '#FFF1E7',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999
    },
    familyBadgeText: {
        color: brandColors.accentStrong,
        fontSize: 11,
        fontWeight: '800'
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
    inlineSelectBlock: {
        marginBottom: 18
    },
    inlineSelectLabel: {
        marginBottom: 8,
        fontSize: 14,
        fontWeight: '700',
        color: brandColors.shell,
        marginLeft: 4
    },
    inlineSelectTrigger: {
        backgroundColor: brandColors.backgroundAlt,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    inlineSelectTriggerText: {
        flex: 1,
        color: brandColors.text,
        fontWeight: '600',
        fontSize: 16,
        paddingRight: 10
    },
    inlineSelectPlaceholder: {
        color: brandColors.textMuted
    },
    inlineSelectPanel: {
        backgroundColor: brandColors.backgroundAlt,
        borderRadius: 18,
        marginTop: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.8)'
    },
    inlineSelectSearch: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 14,
        color: brandColors.text,
        fontWeight: '500',
        marginBottom: 10
    },
    inlineSelectList: {
        maxHeight: 220
    },
    inlineSelectOption: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginBottom: 8
    },
    inlineSelectOptionActive: {
        backgroundColor: brandColors.accentSoft,
        borderWidth: 1,
        borderColor: brandColors.accent
    },
    inlineSelectOptionText: {
        color: brandColors.text,
        fontSize: 14,
        fontWeight: '600'
    },
    inlineSelectOptionTextActive: {
        color: brandColors.accentStrong
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
    detailsOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 40,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'flex-end'
    },
    detailsSheet: {
        backgroundColor: brandColors.surface,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        maxHeight: '90%'
    },
    detailsSheetHeader: {
        alignItems: 'center',
        paddingTop: 12,
        marginBottom: 20,
        position: 'relative'
    },
    detailsCloseIcon: {
        position: 'absolute',
        right: 0,
        top: 8,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: brandColors.backgroundAlt
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
        paddingTop: 4,
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
        fontSize: 24,
        fontWeight: '900',
        color: brandColors.text,
        textAlign: 'center'
    },
    modalBody: {
        marginBottom: 20
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 10
    },
    detailsActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 28,
        marginTop: 8,
        marginBottom: 4
    },
    detailsActionButton: {
        width: 92,
        minHeight: 88,
        alignItems: 'center',
        justifyContent: 'center'
    },
    detailsActionIcon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: brandColors.accentSoft,
        marginBottom: 8
    },
    detailsActionIconDanger: {
        backgroundColor: '#FEE2E2'
    },
    detailsActionText: {
        fontSize: 13,
        lineHeight: 17,
        fontWeight: '900',
        color: brandColors.accent,
        textAlign: 'center'
    },
    detailsActionTextDanger: {
        color: brandColors.danger
    },
    detailsHeader: {
        marginBottom: 22
    },
    detailsTitle: {
        fontSize: 25,
        lineHeight: 30,
        fontWeight: '900',
        color: brandColors.text,
        marginTop: 4
    },
    detailsCode: {
        fontSize: 17,
        lineHeight: 22,
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
        paddingVertical: 17,
        paddingHorizontal: 16,
        borderRadius: 18,
        minHeight: 78,
        justifyContent: 'center'
    },
    detailLabel: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '800',
        color: brandColors.textMuted,
        textTransform: 'uppercase',
        marginBottom: 6
    },
    detailValue: {
        fontSize: 18,
        lineHeight: 23,
        fontWeight: '900',
        color: brandColors.text
    },
    detailValueHighlight: {
        color: brandColors.accentStrong,
        fontSize: 22,
        lineHeight: 27
    },
    infoSection: {
        backgroundColor: brandColors.backgroundAlt,
        paddingVertical: 17,
        paddingHorizontal: 16,
        borderRadius: 18,
        marginBottom: 16,
        minHeight: 74,
        justifyContent: 'center'
    },
    infoLabel: {
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '800',
        color: brandColors.textMuted,
        textTransform: 'uppercase',
        marginBottom: 6
    },
    infoValue: {
        fontSize: 18,
        lineHeight: 23,
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
        fontSize: 16,
        lineHeight: 21
    },
    closeFullButton: {
        marginTop: 12,
        paddingVertical: 12,
        alignItems: 'center'
    },
    closeFullButtonText: {
        color: brandColors.textMuted,
        fontWeight: '700',
        fontSize: 16
    },
    confirmOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        justifyContent: 'center',
        padding: 22
    },
    confirmCard: {
        backgroundColor: brandColors.surface,
        borderRadius: 28,
        padding: 22,
        alignItems: 'stretch'
    },
    confirmIcon: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 14
    },
    confirmTitle: {
        fontSize: 22,
        lineHeight: 27,
        fontWeight: '900',
        color: brandColors.text,
        textAlign: 'center',
        marginBottom: 8
    },
    confirmText: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '600',
        color: brandColors.textMuted,
        textAlign: 'center'
    },
    confirmErrorBox: {
        marginTop: 14,
        padding: 12,
        borderRadius: 14,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA'
    },
    confirmErrorText: {
        color: '#991B1B',
        fontSize: 12,
        lineHeight: 17,
        fontWeight: '700'
    },
    confirmActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 18
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
