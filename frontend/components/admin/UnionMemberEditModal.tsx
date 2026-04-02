import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, Modal, TouchableOpacity,
    ScrollView, TextInput, Switch, ActivityIndicator
} from 'react-native';
import { Colors } from '../../constants/Colors';
import { X, Save } from 'lucide-react-native';
import { useResponsive } from '../../hooks/useResponsive';
import { api } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { UnionMember } from './UnionMembersManagement';

interface Props {
    visible: boolean;
    onClose: () => void;
    member: UnionMember | null;
    onSaved: () => void;
}

// ISO "2020-01-15T00:00:00" → "15/01/2020"
function isoToDisplay(iso?: string): string {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    } catch {
        return '';
    }
}

// "15/01/2020" → ISO string | null
function displayToIso(display: string): string | null {
    if (!display.trim()) return null;
    const parts = display.trim().split('/');
    if (parts.length === 3) {
        const [dd, mm, yyyy] = parts;
        const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        if (!isNaN(d.getTime())) return d.toISOString();
    }
    return null;
}

interface FormState {
    fullName: string;
    gender: string;
    birthDate: string;
    workUnit: string;
    department: string;
    position: string;
    phoneNumber: string;
    email: string;
    hometown: string;
    permanentAddress: string;
    educationLevel: string;
    qualification: string;
    professionalQualification: string;
    major: string;
    isPartyMember: boolean;
    unionJoinDate: string;
    partyJoinDate: string;
    partyOfficialDate: string;
    idNumber: string;
    cccdNumber: string;
    idIssueDate: string;
    idIssuePlace: string;
    familyBackground: string;
}

function initForm(member: UnionMember | null): FormState {
    return {
        fullName: member?.fullName || '',
        gender: member?.gender || '',
        birthDate: isoToDisplay(member?.birthDate),
        workUnit: member?.workUnit || '',
        department: member?.department || '',
        position: member?.position || '',
        phoneNumber: member?.phoneNumber || '',
        email: member?.email || '',
        hometown: member?.hometown || '',
        permanentAddress: member?.permanentAddress || '',
        educationLevel: member?.educationLevel || '',
        qualification: member?.qualification || '',
        professionalQualification: member?.professionalQualification || '',
        major: member?.major || '',
        isPartyMember: member?.isPartyMember || false,
        unionJoinDate: isoToDisplay(member?.unionJoinDate),
        partyJoinDate: isoToDisplay(member?.partyJoinDate),
        partyOfficialDate: isoToDisplay(member?.partyOfficialDate),
        idNumber: member?.idNumber || '',
        cccdNumber: member?.cccdNumber || '',
        idIssueDate: isoToDisplay(member?.idIssueDate),
        idIssuePlace: member?.idIssuePlace || '',
        familyBackground: member?.familyBackground || '',
    };
}

export default function UnionMemberEditModal({ visible, onClose, member, onSaved }: Props) {
    const { isDesktop } = useResponsive();
    const { token } = useAuth();
    const { showToast } = useToast();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState<FormState>(initForm(null));

    useEffect(() => {
        if (visible) {
            setForm(initForm(member));
        }
    }, [member, visible]);

    const set = (key: keyof FormState) => (val: string | boolean) =>
        setForm(prev => ({ ...prev, [key]: val }));

    const handleSave = async () => {
        if (!form.fullName.trim()) {
            showToast({ message: 'Họ tên không được để trống', type: 'error' });
            return;
        }
        setSaving(true);
        try {
            const payload = {
                fullName: form.fullName.trim(),
                gender: form.gender.trim() || null,
                birthDate: displayToIso(form.birthDate),
                workUnit: form.workUnit.trim() || null,
                department: form.department.trim() || null,
                position: form.position.trim() || null,
                phoneNumber: form.phoneNumber.trim() || null,
                email: form.email.trim() || null,
                hometown: form.hometown.trim() || null,
                permanentAddress: form.permanentAddress.trim() || null,
                educationLevel: form.educationLevel.trim() || null,
                qualification: form.qualification.trim() || null,
                professionalQualification: form.professionalQualification.trim() || null,
                major: form.major.trim() || null,
                isPartyMember: form.isPartyMember,
                unionJoinDate: displayToIso(form.unionJoinDate),
                partyJoinDate: form.isPartyMember ? displayToIso(form.partyJoinDate) : null,
                partyOfficialDate: form.isPartyMember ? displayToIso(form.partyOfficialDate) : null,
                idNumber: form.idNumber.trim() || null,
                cccdNumber: form.cccdNumber.trim() || null,
                idIssueDate: displayToIso(form.idIssueDate),
                idIssuePlace: form.idIssuePlace.trim() || null,
                familyBackground: form.familyBackground.trim() || null,
            };

            if (member?.id) {
                await api.put(`/api/union-members/${member.id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                showToast({ message: 'Cập nhật hồ sơ thành công!', type: 'success' });
            } else {
                await api.post(`/api/union-members`, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                showToast({ message: 'Thêm mới đoàn viên thành công!', type: 'success' });
            }

            onSaved();
            onClose();
        } catch (error: any) {
            showToast({
                message: error.response?.data?.detail || 'Lỗi khi lưu hồ sơ',
                type: 'error',
            });
        } finally {
            setSaving(false);
        }
    };

    const Field = ({
        label, value, onChange, multiline = false, placeholder = '',
    }: {
        label: string; value: string; onChange: (v: string) => void;
        multiline?: boolean; placeholder?: string;
    }) => (
        <View style={styles.field}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
                style={[styles.input, multiline && styles.inputMultiline]}
                value={value}
                onChangeText={onChange}
                placeholder={placeholder || label}
                multiline={multiline}
                numberOfLines={multiline ? 3 : 1}
                placeholderTextColor={Colors.text.placeholder}
            />
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity
                    activeOpacity={1}
                    style={[styles.sheet, isDesktop && styles.sheetDesktop]}
                >
                    {/* ── Header ── */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>{member ? 'Chỉnh sửa hồ sơ đoàn viên' : 'Thêm mới đoàn viên'}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.headerClose}>
                            <X color={Colors.text.secondary} size={22} />
                        </TouchableOpacity>
                    </View>

                    {/* ── Body ── */}
                    <ScrollView
                        style={styles.body}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 32 }}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Thông tin cơ bản */}
                        <Text style={styles.sectionTitle}>📋 Thông tin cơ bản</Text>
                        <Field label="Họ và tên *" value={form.fullName} onChange={set('fullName')} />
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Field label="Giới tính" value={form.gender} onChange={set('gender')} placeholder="Nam / Nữ" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Field label="Ngày sinh" value={form.birthDate} onChange={set('birthDate')} placeholder="dd/MM/yyyy" />
                            </View>
                        </View>
                        <Field label="Quê quán" value={form.hometown} onChange={set('hometown')} />
                        <Field label="Địa chỉ thường trú" value={form.permanentAddress} onChange={set('permanentAddress')} />

                        {/* Công tác */}
                        <Text style={styles.sectionTitle}>💼 Thông tin Công tác</Text>
                        <Field label="Đơn vị công tác" value={form.workUnit} onChange={set('workUnit')} />
                        <Field label="Bộ phận" value={form.department} onChange={set('department')} />
                        <Field label="Chức vụ" value={form.position} onChange={set('position')} />
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Field label="Số điện thoại" value={form.phoneNumber} onChange={set('phoneNumber')} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Field label="Email" value={form.email} onChange={set('email')} />
                            </View>
                        </View>

                        {/* Trình độ */}
                        <Text style={styles.sectionTitle}>🎓 Trình độ</Text>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Field label="Trình độ văn hóa" value={form.educationLevel} onChange={set('educationLevel')} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Field label="Trình độ" value={form.qualification} onChange={set('qualification')} />
                            </View>
                        </View>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Field label="Trình độ chuyên môn" value={form.professionalQualification} onChange={set('professionalQualification')} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Field label="Chuyên ngành" value={form.major} onChange={set('major')} />
                            </View>
                        </View>

                        {/* Đảng / Đoàn */}
                        <Text style={styles.sectionTitle}>⭐ Đảng / Công đoàn</Text>
                        <View style={styles.switchRow}>
                            <Text style={styles.switchLabel}>Là Đảng viên</Text>
                            <Switch
                                value={form.isPartyMember}
                                onValueChange={v => set('isPartyMember')(v)}
                                trackColor={{ false: Colors.divider, true: Colors.primary + '80' }}
                                thumbColor={form.isPartyMember ? Colors.primary : '#f4f3f4'}
                            />
                        </View>
                        {form.isPartyMember && (
                            <View style={styles.row}>
                                <View style={{ flex: 1 }}>
                                    <Field label="Ngày vào Đảng" value={form.partyJoinDate} onChange={set('partyJoinDate')} placeholder="dd/MM/yyyy" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Field label="Ngày chính thức" value={form.partyOfficialDate} onChange={set('partyOfficialDate')} placeholder="dd/MM/yyyy" />
                                </View>
                            </View>
                        )}
                        <Field label="Ngày vào Công đoàn" value={form.unionJoinDate} onChange={set('unionJoinDate')} placeholder="dd/MM/yyyy" />

                        {/* Giấy tờ */}
                        <Text style={styles.sectionTitle}>🪪 Giấy tờ tùy thân</Text>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Field label="Số CMND" value={form.idNumber} onChange={set('idNumber')} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Field label="Số CCCD" value={form.cccdNumber} onChange={set('cccdNumber')} />
                            </View>
                        </View>
                        <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                                <Field label="Ngày cấp" value={form.idIssueDate} onChange={set('idIssueDate')} placeholder="dd/MM/yyyy" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Field label="Nơi cấp" value={form.idIssuePlace} onChange={set('idIssuePlace')} />
                            </View>
                        </View>

                        {/* Hoàn cảnh */}
                        <Text style={styles.sectionTitle}>🏠 Hoàn cảnh gia đình</Text>
                        <Field
                            label="Nội dung"
                            value={form.familyBackground}
                            onChange={set('familyBackground')}
                            multiline
                            placeholder="Mô tả hoàn cảnh gia đình..."
                        />
                    </ScrollView>

                    {/* ── Footer ── */}
                    <View style={styles.footer}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
                            <Text style={styles.cancelBtnText}>Hủy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving
                                ? <ActivityIndicator color="#fff" size="small" />
                                : <Save color="#fff" size={18} />
                            }
                            <Text style={styles.saveBtnText}>
                                {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    sheet: {
        width: '100%',
        maxHeight: '92%',
        backgroundColor: Colors.surface,
        borderRadius: 16,
        overflow: 'hidden',
    },
    sheetDesktop: {
        width: 700,
        maxHeight: '90%',
        borderRadius: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text.primary,
    },
    headerClose: { padding: 4 },
    body: { paddingHorizontal: 20, paddingTop: 8 },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: Colors.primary,
        marginTop: 20,
        marginBottom: 12,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    row: { flexDirection: 'row', gap: 12 },
    field: { marginBottom: 12 },
    fieldLabel: {
        fontSize: 13,
        color: Colors.text.secondary,
        fontWeight: '500',
        marginBottom: 6,
    },
    input: {
        height: 40,
        borderWidth: 1,
        borderColor: Colors.divider,
        borderRadius: 8,
        paddingHorizontal: 12,
        fontSize: 14,
        color: Colors.text.primary,
        backgroundColor: Colors.background,
    },
    inputMultiline: {
        height: 84,
        paddingTop: 10,
        textAlignVertical: 'top',
    },
    switchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
        marginBottom: 12,
        paddingHorizontal: 4,
        backgroundColor: Colors.background,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: Colors.divider,
        paddingRight: 12,
    },
    switchLabel: {
        fontSize: 14,
        color: Colors.text.primary,
        fontWeight: '500',
        paddingLeft: 8,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: Colors.divider,
        backgroundColor: Colors.surface,
    },
    cancelBtn: {
        flex: 1,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Colors.divider,
        borderRadius: 10,
    },
    cancelBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    saveBtn: {
        flex: 2,
        height: 44,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        backgroundColor: Colors.primary,
        borderRadius: 10,
    },
    saveBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
});
