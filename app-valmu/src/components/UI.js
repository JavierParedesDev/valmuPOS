import React, { useMemo, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

export function Screen({ children }) {
    return <View style={styles.screen}>{children}</View>;
}

export function SectionHeader({ title, subtitle, actions }) {
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionTextBlock}>
                <Text style={styles.sectionTitle}>{title}</Text>
                <Text style={styles.sectionSubtitle}>{subtitle}</Text>
            </View>
            {actions ? <View style={styles.sectionActions}>{actions}</View> : null}
        </View>
    );
}

export function Card({ children }) {
    return <View style={styles.card}>{children}</View>;
}

export function Field({ label, multiline = false, ...props }) {
    return (
        <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
                style={[styles.input, multiline && styles.inputMultiline]}
                placeholderTextColor="#94a3b8"
                multiline={multiline}
                numberOfLines={multiline ? 4 : 1}
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
            <TouchableOpacity style={styles.selectTrigger} onPress={() => setOpen(true)} activeOpacity={0.85}>
                <Text style={[styles.selectTriggerText, !selectedOption && styles.selectPlaceholder]}>
                    {selectedOption?.label || emptyLabel}
                </Text>
                <Text style={styles.selectChevron}>▼</Text>
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <TouchableOpacity style={styles.selectBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
                    <View style={styles.selectSheet}>
                        <Text style={styles.selectTitle}>{label}</Text>
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
            <Text style={styles.fieldLabel}>{label}</Text>
            <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#cbd5e1', true: '#f58233' }} />
        </View>
    );
}

export function FormModal({ visible, title, onClose, onSubmit, submitLabel, children }) {
    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <ScrollView style={styles.modalBody}>{children}</ScrollView>
                    <View style={styles.modalActions}>
                        <SecondaryButton title="Cancelar" onPress={onClose} />
                        <PrimaryButton title={submitLabel} onPress={onSubmit} />
                    </View>
                </View>
            </View>
        </Modal>
    );
}

export function PrimaryButton({ title, onPress, disabled = false, compact = false }) {
    return (
        <TouchableOpacity
            style={[styles.primaryButton, compact && styles.compactButton, disabled && styles.buttonDisabled]}
            onPress={onPress}
            disabled={disabled}
        >
            <Text style={styles.primaryButtonText}>{title}</Text>
        </TouchableOpacity>
    );
}

export function SecondaryButton({ title, onPress }) {
    return (
        <TouchableOpacity style={styles.secondaryButton} onPress={onPress}>
            <Text style={styles.secondaryButtonText}>{title}</Text>
        </TouchableOpacity>
    );
}

export function DangerButton({ title, onPress }) {
    return (
        <TouchableOpacity style={styles.dangerButton} onPress={onPress}>
            <Text style={styles.dangerButtonText}>{title}</Text>
        </TouchableOpacity>
    );
}

export function EmptyState({ text }) {
    return (
        <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{text}</Text>
        </View>
    );
}

export function Badge({ label }) {
    return (
        <View style={styles.badge}>
            <Text style={styles.badgeText}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1 },
    flexOne: { flex: 1 },
    sectionHeader: {
        marginBottom: 16
    },
    sectionTextBlock: {
        marginBottom: 12
    },
    sectionActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8
    },
    sectionTitle: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1e293b'
    },
    sectionSubtitle: {
        marginTop: 4,
        color: '#64748b',
        lineHeight: 20
    },
    card: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 18,
        marginBottom: 14,
        shadowColor: '#0f172a',
        shadowOpacity: 0.06,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3
    },
    fieldGroup: { marginBottom: 14 },
    fieldLabel: {
        marginBottom: 8,
        fontWeight: '600',
        color: '#334155'
    },
    input: {
        borderWidth: 1,
        borderColor: '#dbe4ee',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#0f172a',
        backgroundColor: '#f8fafc'
    },
    inputMultiline: {
        minHeight: 96,
        textAlignVertical: 'top'
    },
    selectTrigger: {
        borderWidth: 1,
        borderColor: '#dbe4ee',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    selectTriggerText: {
        color: '#0f172a',
        fontWeight: '600',
        flex: 1,
        paddingRight: 12
    },
    selectPlaceholder: {
        color: '#94a3b8'
    },
    selectChevron: {
        color: '#64748b',
        fontSize: 12,
        fontWeight: '800'
    },
    selectBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'center',
        padding: 20
    },
    selectSheet: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 18,
        maxHeight: '70%'
    },
    selectTitle: {
        color: '#1e293b',
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 12
    },
    selectOptions: {
        gap: 8
    },
    selectOption: {
        borderWidth: 1,
        borderColor: '#dbe4ee',
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 14
    },
    selectOptionActive: {
        backgroundColor: '#fff3ea',
        borderColor: '#f58233'
    },
    selectOptionText: {
        color: '#334155',
        fontWeight: '600'
    },
    selectOptionTextActive: {
        color: '#c2410c'
    },
    switchField: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        justifyContent: 'flex-end'
    },
    modalCard: {
        maxHeight: '88%',
        backgroundColor: '#ffffff',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        padding: 20
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 12
    },
    modalBody: { marginBottom: 12 },
    modalActions: {
        flexDirection: 'row',
        gap: 10
    },
    primaryButton: {
        backgroundColor: '#f58233',
        paddingHorizontal: 16,
        paddingVertical: 13,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 110,
        alignSelf: 'flex-start'
    },
    compactButton: { minWidth: 0 },
    primaryButtonText: {
        color: '#ffffff',
        fontWeight: '700'
    },
    secondaryButton: {
        borderWidth: 1,
        borderColor: '#cbd5e1',
        paddingHorizontal: 14,
        paddingVertical: 13,
        borderRadius: 16,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start'
    },
    secondaryButtonText: {
        color: '#334155',
        fontWeight: '700'
    },
    dangerButton: {
        backgroundColor: '#fee2e2',
        paddingHorizontal: 14,
        paddingVertical: 13,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start'
    },
    dangerButtonText: {
        color: '#b91c1c',
        fontWeight: '700'
    },
    buttonDisabled: { opacity: 0.7 },
    emptyState: {
        marginTop: 40,
        alignItems: 'center'
    },
    emptyStateText: {
        color: '#64748b'
    },
    badge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: '#ffedd5'
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#c2410c'
    }
});
