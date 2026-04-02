import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { Colors } from '../constants/Colors';

interface User {
    id: string;
    username: string;
    fullName: string;
    role: string;
    department: string;
    status: string;
    cccdNumber?: string;
}

interface UserModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editUser?: User | null;
}

export default function UserModal({ visible, onClose, onSuccess, editUser }: UserModalProps) {
    const { token, user } = useAuth();
    const { showToast } = useToast();

    // Form fields
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('MEMBER');
    const [department, setDepartment] = useState('VAN_PHONG_CANG');
    const [status, setStatus] = useState('active');
    const [cccdNumber, setCccdNumber] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (editUser) {
            setUsername(editUser.username);
            setFullName(editUser.fullName);
            setRole(editUser.role);
            setDepartment(editUser.department);
            setStatus(editUser.status);
            setCccdNumber(editUser.cccdNumber || '');
            setPassword('');
            setLoading(false);
        } else if (visible) {
            setUsername('');
            setPassword('');
            setFullName('');
            setCccdNumber('');
            setStatus('active');
            setLoading(false);

            // Default values based on manager role
            if (user?.role?.startsWith('BCH_')) {
                setRole('MEMBER');
                if (user?.role === 'BCH_VANPHONG') setDepartment('VAN_PHONG_CANG');
                else if (user?.role === 'BCH_CUALO') setDepartment('CUA_LO');
                else if (user?.role === 'BCH_BENTHUY') setDepartment('BEN_THUY');
            } else {
                setRole('MEMBER');
                setDepartment('VAN_PHONG_CANG');
            }
        }
    }, [editUser, visible, user]);

    const roles = [
        { value: 'SUPER_ADMIN', label: 'Quản trị viên (Super Admin)' },
        { value: 'BCH_VANPHONG', label: 'BCH Văn phòng Cảng' },
        { value: 'BCH_CUALO', label: 'BCH Cửa Lò' },
        { value: 'BCH_BENTHUY', label: 'BCH Bến Thủy' },
        { value: 'MEMBER', label: 'Đoàn viên' },
    ];

    const departments = [
        { value: 'VAN_PHONG_CANG', label: 'Văn phòng Cảng' },
        { value: 'CUA_LO', label: 'Cảng Cửa Lò' },
        { value: 'BEN_THUY', label: 'Cảng Bến Thủy' },
    ];

    const statuses = [
        { value: 'active', label: 'Hoạt động' },
        { value: 'locked', label: 'Đã khóa' },
    ];

    const handleSubmit = async () => {
        if (!editUser && (!username || !password || !fullName || !cccdNumber)) {
            showToast({ message: 'Vui lòng nhập đầy đủ thông tin bắt buộc (kể cả CCCD)', type: 'error' });
            return;
        }

        if (editUser && !fullName) {
            showToast({ message: 'Họ tên không được để trống', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            if (editUser) {
                // Update user
                const updateData = {
                    fullName,
                    role,
                    department,
                    status,
                    cccdNumber: cccdNumber.trim() || null
                };
                await api.put(`/api/users/${editUser.id}`, updateData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                showToast({ message: 'Cập nhật thành công!', type: 'success' });
            } else {
                // Create user
                const createData = {
                    username,
                    password,
                    fullName,
                    role,
                    department,
                    cccdNumber: cccdNumber.trim()
                };
                await api.post('/api/users', createData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                showToast({ message: 'Tạo người dùng thành công!', type: 'success' });
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Lỗi khi lưu người dùng:', error);
            showToast({
                message: error.response?.data?.detail || 'Đã có lỗi xảy ra',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const renderSelect = (
        label: string,
        value: string,
        options: { value: string, label: string }[],
        onChange: (val: string) => void
    ) => (
        <View style={styles.inputContainer}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.selectGroup}>
                {options.map((opt) => (
                    <TouchableOpacity
                        key={opt.value}
                        style={[styles.selectOption, value === opt.value && styles.selectOptionActive]}
                        onPress={() => onChange(opt.value)}
                    >
                        <Text style={[styles.selectOptionText, value === opt.value && styles.selectOptionTextActive]}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView
                style={styles.modalContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>
                            {editUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng mới'}
                        </Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
                        {!editUser && (
                            <>
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Tên đăng nhập *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={username}
                                        onChangeText={setUsername}
                                        placeholder="VD: nv_a"
                                        autoCapitalize="none"
                                    />
                                </View>

                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Mật khẩu *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={password}
                                        onChangeText={setPassword}
                                        placeholder="Ít nhất 6 ký tự"
                                        secureTextEntry
                                    />
                                </View>
                            </>
                        )}

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Họ và tên *</Text>
                            <TextInput
                                style={styles.input}
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="VD: Nguyễn Văn A"
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Số CCCD *</Text>
                            <TextInput
                                style={styles.input}
                                value={cccdNumber}
                                onChangeText={setCccdNumber}
                                placeholder="Nhập 9 hoặc 12 số CCCD/CMND"
                                keyboardType="numeric"
                                maxLength={12}
                            />
                            <Text style={{ fontSize: 12, color: Colors.text.placeholder, marginTop: 4 }}>
                                * Dùng để liên kết tự động với hồ sơ Đoàn viên tương ứng.
                            </Text>
                        </View>

                        {user?.role === 'SUPER_ADMIN' && (
                            <>
                                {renderSelect('Vai trò', role, roles, setRole)}
                                {renderSelect('Phòng ban', department, departments, setDepartment)}
                            </>
                        )}
                        {/* Manager sees read-only info about role and department */}
                        {user?.role !== 'SUPER_ADMIN' && user?.role?.startsWith('BCH_') && (
                            <>
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Vai trò</Text>
                                    <TextInput style={[styles.input, { backgroundColor: '#e2e8f0', color: '#64748b' }]} value="Đoàn viên" editable={false} />
                                </View>
                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Phòng ban</Text>
                                    <TextInput
                                        style={[styles.input, { backgroundColor: '#e2e8f0', color: '#64748b' }]}
                                        value={departments.find(d => d.value === department)?.label || department}
                                        editable={false}
                                    />
                                </View>
                            </>
                        )}

                        {editUser && renderSelect('Trạng thái', status, statuses, setStatus)}
                    </ScrollView>

                    <View style={styles.modalFooter}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={loading}>
                            <Text style={styles.cancelButtonText}>Hủy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#ffffff" size="small" />
                            ) : (
                                <Text style={styles.submitButtonText}>{editUser ? 'Lưu thay đổi' : 'Tạo mới'}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: 16,
        width: '100%',
        maxWidth: 600,
        maxHeight: '90%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text.primary,
    },
    closeButton: {
        padding: 8,
    },
    closeButtonText: {
        fontSize: 20,
        color: Colors.text.secondary,
        fontWeight: 'bold',
    },
    formContainer: {
        padding: 20,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text.primary,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: Colors.text.primary,
        backgroundColor: '#f8fafc',
    },
    selectGroup: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    selectOption: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    selectOptionActive: {
        backgroundColor: Colors.primary,
        borderColor: Colors.primary,
    },
    selectOptionText: {
        color: Colors.text.secondary,
        fontSize: 14,
        fontWeight: '500',
    },
    selectOptionTextActive: {
        color: '#ffffff',
    },
    modalFooter: {
        flexDirection: 'row',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: Colors.divider,
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
    },
    cancelButtonText: {
        color: Colors.text.secondary,
        fontSize: 16,
        fontWeight: '600',
    },
    submitButton: {
        flex: 1,
        backgroundColor: Colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitButtonDisabled: {
        opacity: 0.7,
    },
    submitButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
