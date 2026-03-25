import React, { useMemo, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Platform
} from 'react-native';
import { brandColors } from '../theme';

export function Screen({ children }) {
    return <View style={styles.screen}>{children}</View>;
}

export function SectionHeader({ title, subtitle, actions }) {
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionTextBlock}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
            </View>
            {actions ? <View style={styles.sectionActions}>{actions}</View> : null}
        </View>
    );
}

export function Card({ children, style }) {
    return <View style={[styles.card, style]}>{children}</View>;
}

export function Field({ label, multiline = false, ...props }) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
                style={[styles.input, multiline && styles.inputMultiline]}
                placeholderTextColor={brandColors.textMuted}
                multiline={multiline}
                numberOfLines={multiline ? 4 : 1}
                selectionColor={brandColors.accent}
                {...props}
            />
        </View>
    );
}

export function PickerField({ label, value, onChange, options, emptyLabel = 'Seleccionar' }) {
    const [open, setOpen] = useState(false);
    const selectedOption = useMemo(
        () => options.find((option) => option.value === value),
        [options, value]
    );

    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TouchableOpacity style={styles.selectTrigger} onPress={() => setOpen(true)} activeOpacity={0.7}>
                <Text style={[styles.selectTriggerText, !selectedOption && styles.selectPlaceholder]}>
                    {selectedOption?.label || emptyLabel}
                </Text>
                <Text style={styles.selectChevron}>▼</Text>
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <TouchableOpacity style={styles.selectBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
                    <View style={styles.selectSheet}>
                        <View style={styles.sheetHeader}>
                            <View style={styles.sheetHandle} />
                            <Text style={styles.selectTitle}>{label}</Text>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.selectOptions}>
                            <TouchableOpacity
                                style={[styles.selectOption, !value && styles.selectOptionActive]}
                                onPress={() => {
                                    onChange('');
                                    setOpen(false);
                                }}
                            >
                                <Text style={[styles.selectOptionText, !value && styles.selectOptionTextActive]}>
                                    {emptyLabel}
                                </Text>
                            </TouchableOpacity>
                            {options.map((option) => (
                                <TouchableOpacity
                                    key={option.value}
                                    style={[styles.selectOption, value === option.value && styles.selectOptionActive]}
                                    onPress={() => {
                                        onChange(option.value);
                                        setOpen(false);
                                    }}
                                >
                                    <Text style={[styles.selectOptionText, value === option.value && styles.selectOptionTextActive]}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

export function SwitchField({ label, value, onValueChange }) {
    return (
        <View style={styles.switchField}>
            <Text style={styles.fieldLabelInline}>{label}</Text>
            <Switch
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: brandColors.outline, true: brandColors.accent }}
                thumbColor={Platform.OS === 'ios' ? undefined : '#ffffff'}
            />
        </View>
    );
}

export function FormModal({ visible, title, onClose, onSubmit, submitLabel, children }) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <View style={styles.modalHeader}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.modalTitle}>{title}</Text>
                    </View>
                    <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                        {children}
                    </ScrollView>
                    <View style={styles.modalActions}>
                        <SecondaryButton title="Cancelar" onPress={onClose} style={styles.modalButton} />
                        <PrimaryButton title={submitLabel} onPress={onSubmit} style={styles.modalButton} />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export function PrimaryButton({ title, onPress, disabled = false, compact = false, style }) {
    return (
        <TouchableOpacity
            style={[
                styles.primaryButton,
                compact && styles.compactButton,
                disabled && styles.buttonDisabled,
                style
            ]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.8}
        >
            <Text style={styles.primaryButtonText}>{title}</Text>
        </TouchableOpacity>
    );
}

export function SecondaryButton({ title, onPress, style }) {
    return (
        <TouchableOpacity style={[styles.secondaryButton, style]} onPress={onPress} activeOpacity={0.7}>
            <Text style={styles.secondaryButtonText}>{title}</Text>
        </TouchableOpacity>
    );
}

export function DangerButton({ title, onPress, style }) {
    return (
        <TouchableOpacity style={[styles.dangerButton, style]} onPress={onPress} activeOpacity={0.7}>
            <Text style={styles.dangerButtonText}>{title}</Text>
        </TouchableOpacity>
    );
}

export function EmptyState({ text }) {
    return (
        <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
                <Text style={styles.emptyIcon}>📦</Text>
            </View>
            <Text style={styles.emptyStateText}>{text}</Text>
        </View>
    );
}

export function Badge({ label, type = 'default' }) {
    return (
        <View style={[styles.badge, styles[`badge_${type}`]]}>
            <Text style={[styles.badgeText, styles[`badgeText_${type}`]]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: brandColors.background
    },
    sectionHeader: {
        marginBottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    sectionTextBlock: {
        flex: 1
    },
    sectionTitle: {
        fontSize: 32,
        fontWeight: '900',
        color: brandColors.text,
        letterSpacing: -1
    },
    sectionSubtitle: {
        marginTop: 4,
        fontSize: 14,
        color: brandColors.textMuted,
        fontWeight: '500'
    },
    sectionActions: {
        flexDirection: 'row',
        gap: 8
    },
    card: {
        backgroundColor: brandColors.surface,
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        ...Platform.select({
            web: {
                boxShadow: '0 10px 15px rgba(15, 23, 42, 0.05)'
            },
            ios: {
                shadowColor: brandColors.shell,
                shadowOpacity: 0.05,
                shadowRadius: 15,
                shadowOffset: { width: 0, height: 10 }
            },
            android: {
                elevation: 4
            }
        }),
        borderWidth: 1,
        borderColor: 'rgba(226, 232, 240, 0.5)'
    },
    fieldGroup: {
        marginBottom: 18
    },
    fieldLabel: {
        marginBottom: 8,
        fontSize: 14,
        fontWeight: '700',
        color: brandColors.shell,
        marginLeft: 4
    },
    fieldLabelInline: {
        fontSize: 16,
        fontWeight: '700',
        color: brandColors.shell
    },
    input: {
        backgroundColor: brandColors.backgroundAlt,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: brandColors.text,
        fontWeight: '500',
        borderWidth: 1,
        borderColor: 'transparent'
    },
    inputMultiline: {
        minHeight: 100,
        textAlignVertical: 'top',
        paddingTop: 14
    },
    selectTrigger: {
        backgroundColor: brandColors.backgroundAlt,
        borderRadius: 16,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    selectTriggerText: {
        color: brandColors.text,
        fontWeight: '600',
        fontSize: 16,
        flex: 1
    },
    selectPlaceholder: {
        color: brandColors.textMuted
    },
    selectChevron: {
        color: brandColors.textMuted,
        fontSize: 12
    },
    selectBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end'
    },
    selectSheet: {
        backgroundColor: brandColors.surface,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        paddingHorizontal: 20,
        paddingBottom: 40,
        maxHeight: '80%'
    },
    sheetHeader: {
        alignItems: 'center',
        paddingVertical: 16
    },
    sheetHandle: {
        width: 40,
        height: 5,
        backgroundColor: brandColors.outline,
        borderRadius: 999,
        marginBottom: 16
    },
    selectTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: brandColors.text,
        textAlign: 'center'
    },
    selectOptions: {
        gap: 10,
        paddingTop: 10
    },
    selectOption: {
        backgroundColor: brandColors.backgroundAlt,
        borderRadius: 18,
        padding: 16
    },
    selectOptionActive: {
        backgroundColor: brandColors.accentSoft,
        borderWidth: 1,
        borderColor: brandColors.accent
    },
    selectOptionText: {
        fontSize: 16,
        color: brandColors.text,
        fontWeight: '600'
    },
    selectOptionTextActive: {
        color: brandColors.accentStrong
    },
    switchField: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
        backgroundColor: brandColors.backgroundAlt,
        padding: 16,
        borderRadius: 18
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
    modalTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: brandColors.text
    },
    modalBody: {
        marginBottom: 20
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12
    },
    modalButton: {
        flex: 1,
        alignSelf: 'auto'
    },
    primaryButton: {
        backgroundColor: brandColors.accent,
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        ...Platform.select({
            web: {
                boxShadow: '0 4px 10px rgba(255, 107, 0, 0.3)'
            },
            ios: {
                shadowColor: brandColors.accent,
                shadowOpacity: 0.3,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 4 }
            },
            android: {
                elevation: 4
            }
        })
    },
    compactButton: {
        paddingVertical: 12,
        paddingHorizontal: 16
    },
    primaryButtonText: {
        color: '#ffffff',
        fontWeight: '800',
        fontSize: 16
    },
    secondaryButton: {
        backgroundColor: brandColors.backgroundAlt,
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center'
    },
    secondaryButtonText: {
        color: brandColors.shell,
        fontWeight: '700',
        fontSize: 16
    },
    dangerButton: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center'
    },
    dangerButtonText: {
        color: brandColors.danger,
        fontWeight: '700',
        fontSize: 16
    },
    buttonDisabled: {
        opacity: 0.5,
        shadowOpacity: 0
    },
    emptyState: {
        marginTop: 60,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: brandColors.backgroundAlt,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20
    },
    emptyIcon: {
        fontSize: 32
    },
    emptyStateText: {
        color: brandColors.textMuted,
        fontSize: 16,
        textAlign: 'center',
        fontWeight: '500',
        lineHeight: 24
    },
    badge: {
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
        alignSelf: 'flex-start'
    },
    badge_default: {
        backgroundColor: brandColors.backgroundAlt
    },
    badge_success: {
        backgroundColor: '#D1FAE5'
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    badgeText_default: {
        color: brandColors.textMuted
    },
    badgeText_success: {
        color: brandColors.success
    }
});

