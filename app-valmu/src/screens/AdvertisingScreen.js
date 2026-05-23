import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Switch,
    Platform
} from 'react-native';
import { Modal, Portal, TextInput, Button as PaperButton } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest, multipartApiRequest } from '../services/api';
import {
    Card,
    Screen,
    SectionHeader,
    EmptyState
} from '../components/UI';
import { brandColors } from '../theme';
import { API_BASE_URL } from '../config/api';

import * as ImagePicker from 'expo-image-picker';

export default function AdvertisingScreen({ token }) {
    const [loading, setLoading] = useState(true);
    const [ads, setAds] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [newAd, setNewAd] = useState({ titulo: '' });
    const [selectedImage, setSelectedImage] = useState(null);

    const fetchAds = async () => {
        setLoading(true);
        try {
            const response = await apiRequest({ endpoint: '/publicidad', token });
            if (response.ok) {
                setAds(Array.isArray(response.data) ? response.data : []);
            }
        } catch (error) {
            console.error('Error fetching ads:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAds();
    }, []);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permiso denegado', 'Necesitamos acceso a tus fotos para subir publicidad.');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.7,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0]);
        }
    };

    const toggleAdStatus = async (ad, value) => {
        try {
            const response = await apiRequest({
                endpoint: `/publicidad/${ad.id_publicidad}/estado`,
                method: 'PUT',
                body: { activa: value ? 1 : 0 },
                token
            });

            if (response.ok) {
                setAds(ads.map(item => 
                    item.id_publicidad === ad.id_publicidad ? { ...item, activa: value } : item
                ));
            } else {
                Alert.alert('Error', 'No se pudo actualizar el estado');
            }
        } catch (error) {
            Alert.alert('Error', 'Hubo un fallo en la conexión');
        }
    };

    const handleAddAd = async () => {
        if (!newAd.titulo) return Alert.alert('Error', 'Ingresa un título');
        if (!selectedImage) return Alert.alert('Error', 'Selecciona una imagen primero');
        
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('titulo', newAd.titulo || 'Sin título');
            
            // Adjuntar el archivo real
            const localUri = selectedImage.uri;
            const filename = localUri.split('/').pop() || 'upload.jpg';
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : `image/jpeg`;

            formData.append('imagen', {
                uri: Platform.OS === 'ios' ? localUri.replace('file://', '') : localUri,
                name: filename,
                type: type
            });

            const response = await multipartApiRequest({
                endpoint: '/publicidad',
                method: 'POST',
                body: formData,
                token
            });

            if (response.ok) {
                setShowModal(false);
                setNewAd({ titulo: '' });
                setSelectedImage(null);
                fetchAds();
            } else {
                Alert.alert('Error', response.error || 'Asegúrate de que el servidor tenga el código de Publicidad instalado.');
            }
        } catch (error) {
            console.error('Upload error:', error);
            Alert.alert('Error', 'Fallo al conectar con el servidor');
        } finally {
            setSubmitting(false);
        }
    };

    const deleteAd = async (ad) => {
        Alert.alert(
            'Confirmar eliminación',
            `¿Estás seguro de que quieres borrar "${ad.titulo || 'esta publicidad'}"`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await apiRequest({
                                endpoint: `/publicidad/${ad.id_publicidad}`,
                                method: 'DELETE',
                                token
                            });

                            if (response.ok) {
                                setAds(ads.filter(item => item.id_publicidad !== ad.id_publicidad));
                            } else {
                                Alert.alert('Error', 'No se pudo eliminar. El servidor debe tener el endpoint DELETE /publicidad/:id.');
                            }
                        } catch (error) {
                            Alert.alert('Error', 'Error de conexión');
                        }
                    }
                }
            ]
        );
    };

    const getImageUrl = (path) => {
        if (!path) return 'https://via.placeholder.com/150';
        if (path.startsWith('http')) return path;
        const origin = API_BASE_URL.replace(/\/api\/a$/, '');
        return `${origin}${path}`;
    };

    const renderItem = ({ item }) => (
        <Card style={styles.adCard}>
            <View style={styles.cardMain}>
                <Image
                    source={{ uri: getImageUrl(item.rutaImagen) }}
                    style={styles.adThumb}
                    resizeMode="cover"
                />
                <View style={styles.adInfo}>
                    <Text style={styles.adTitle} numberOfLines={1}>{item.titulo || 'Sin título'}</Text>
                    <View style={styles.statusRow}>
                        <View style={[styles.statusIndicator, { backgroundColor: item.activa ? brandColors.success : brandColors.textMuted }]} />
                        <Text style={[styles.statusLabel, { color: item.activa ? brandColors.success : brandColors.textMuted }]}>
                            {item.activa ? 'Activa' : 'Inactiva'}
                        </Text>
                    </View>
                </View>
                <View style={styles.adActions}>
                    <Switch
                        value={!!item.activa}
                        onValueChange={(val) => toggleAdStatus(item, val)}
                        trackColor={{ false: brandColors.outline, true: brandColors.accentSoft }}
                        thumbColor={item.activa ? brandColors.accent : '#f4f3f4'}
                        style={Platform.OS === 'ios' ? { transform: [{ scale: 0.8 }] } : {}}
                    />
                    <TouchableOpacity onPress={() => deleteAd(item)} style={styles.deleteBtn}>
                        <Ionicons name="trash-outline" size={20} color={brandColors.danger} />
                    </TouchableOpacity>
                </View>
            </View>
        </Card>
    );

    return (
        <Screen statusBarColor={brandColors.surface}>
            <View style={styles.headerRow}>
                <SectionHeader
                    title="Publicidad"
                    subtitle="Gestión de anuncios"
                    icon="megaphone-outline"
                />
                <TouchableOpacity style={styles.addBtnCircle} onPress={() => setShowModal(true)}>
                    <Ionicons name="add-circle" size={36} color={brandColors.accent} />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loaderArea}>
                    <ActivityIndicator size="large" color={brandColors.accent} />
                    <Text style={styles.loaderText}>Cargando anuncios...</Text>
                </View>
            ) : (
                <FlatList
                    data={ads}
                    keyExtractor={(item) => String(item.id_publicidad)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <EmptyState
                            title="Sin publicidad"
                            message="No hay anuncios registrados. Agrega uno nuevo para comenzar."
                            icon="images-outline"
                        />
                    }
                    onRefresh={fetchAds}
                    refreshing={loading}
                />
            )}

            <Portal>
                <Modal 
                    visible={showModal} 
                    onDismiss={() => setShowModal(false)} 
                    contentContainerStyle={styles.modalFull}
                >
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Nueva Publicidad</Text>
                        <TouchableOpacity onPress={() => setShowModal(false)}>
                            <Ionicons name="close" size={24} color={brandColors.textMuted} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.modalBody}>
                        <TextInput
                            label="Título del anuncio"
                            value={newAd.titulo}
                            onChangeText={(text) => setNewAd(prev => ({ ...prev, titulo: text }))}
                            mode="outlined"
                            outlineColor={brandColors.outline}
                            activeOutlineColor={brandColors.accent}
                            style={styles.modalInput}
                        />
                        
                        <TouchableOpacity style={styles.photoSelector} onPress={pickImage}>
                            {selectedImage ? (
                                <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />
                            ) : (
                                <View style={styles.photoPlaceholder}>
                                    <Ionicons name="camera" size={32} color={brandColors.textMuted} />
                                    <Text style={styles.photoText}>Seleccionar Foto</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {selectedImage && (
                            <TouchableOpacity onPress={() => setSelectedImage(null)}>
                                <Text style={styles.changePhotoText}>Cambiar foto</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.modalFooter}>
                        <PaperButton 
                            mode="contained" 
                            onPress={handleAddAd} 
                            loading={submitting}
                            disabled={submitting || !newAd.titulo}
                            style={styles.saveBtn}
                            contentStyle={{ height: 48 }}
                        >
                            Crear Publicidad
                        </PaperButton>
                    </View>
                </Modal>
            </Portal>
        </Screen>
    );
}

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingRight: 16
    },
    addBtnCircle: {
        marginTop: 10
    },
    listContent: {
        padding: 16,
        paddingBottom: 120
    },
    adCard: {
        marginBottom: 12,
        padding: 12,
        borderRadius: 20
    },
    cardMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    adThumb: {
        width: 80,
        height: 56,
        borderRadius: 12,
        backgroundColor: brandColors.backgroundAlt
    },
    adInfo: {
        flex: 1,
        justifyContent: 'center'
    },
    adTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: brandColors.text,
        marginBottom: 4
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    statusIndicator: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    statusLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    adActions: {
        alignItems: 'flex-end',
        gap: 8
    },
    deleteBtn: {
        padding: 6,
        borderRadius: 10,
        backgroundColor: '#FEF2F2'
    },
    loaderArea: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 40
    },
    loaderText: {
        marginTop: 12,
        color: brandColors.textMuted,
        fontWeight: '700'
    },
    modalFull: {
        backgroundColor: brandColors.surface,
        margin: 20,
        borderRadius: 24,
        padding: 20,
        elevation: 10
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: brandColors.text
    },
    modalBody: {
        gap: 16
    },
    photoSelector: {
        width: '100%',
        height: 160,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: brandColors.outline,
        borderStyle: 'dashed',
        backgroundColor: brandColors.background,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10
    },
    previewImage: {
        width: '100%',
        height: '100%'
    },
    photoPlaceholder: {
        alignItems: 'center',
        gap: 8
    },
    photoText: {
        fontSize: 14,
        fontWeight: '700',
        color: brandColors.textMuted
    },
    changePhotoText: {
        textAlign: 'center',
        color: brandColors.accent,
        fontWeight: '700',
        marginTop: 8
    },
    modalFooter: {
        marginTop: 24
    },
    saveBtn: {
        borderRadius: 12,
        backgroundColor: brandColors.accent
    }
});
