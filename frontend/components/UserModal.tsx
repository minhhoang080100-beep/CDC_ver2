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
import { api } from '../utils/api';
import { Colors } from '../constants/Colors';

interface User {
    id: string;
    username: string;
    fullName: string;
    unionId: string;
    role: string;
    department: string;
    status: string;
}

interface UserModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editUser?: User | null;
}

export default function UserModal({ visible, onClose, onSuccess, editUser }: UserModalProps) {
    const { token } = useAuth();

    // Form fields
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [unionId, setUnionId] = useState('');
    const [role, setRole] = useState('MEMBER');
    const [department, setDepartment] = useState('VAN_PHONG_CANG');
    const [status, setStatus] = useState('active');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (editUser) {
            setUsername(editUser.username);
            setFullName(editUser.fullName);
            setUnionId(editUser.unionId);
            setRole(editUser.role);
            setDepartment(editUser.department);
            setStatus(editUser.status);
            setPassword('');
            setLoading(false);
        } else if (visible) {
            setUsername('');
            setPassword('');
            setFullName('');
            setUnionId('');
            setRole('MEMBER');
            setDepartment('VAN_PHONG_CANG');
            setStatus('active');
            setLoading(false);
        }
    }, [editUser, visible]);

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
        if (!editUser && (!username || !password || !fullName || !unionId)) {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.alert('Vui lòng nhập đầy đủ thông tin bắt buộc');
            }
            return;
        }

        if (editUser && !fullName) {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.alert('Họ tên không được để trống');
            }
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
                    status
                };
                await api.put(`/api/users/${editUser.id}`, updateData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.alert('Cập nhật thành công!');
                }
            } else {
                // Create user
                const createData = {
                    username,
                    password,
                    fullName,
                    unionId,
                    role,
                    department
                };
                await api.post('/api/users', createData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                    window.alert('Tạo người dùng thành công!');
                }
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Lỗi khi lưu người dùng:', error);
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.alert(error.response?.data?.detail || 'Đã có lỗi xảy ra');
            }
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

                                <View style={styles.inputContainer}>
                                    <Text style={styles.label}>Mã đoàn viên *</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={unionId}
                                        onChangeText={setUnionId}
                                        placeholder="VD: VD12345"
                                        autoCapitalize="characters"
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

                        {renderSelect('Vai trò', role, roles, setRole)}
                        {renderSelect('Phòng ban', department, departments, setDepartment)}

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
