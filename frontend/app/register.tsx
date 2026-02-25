import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { api } from '../utils/api';

const DEPARTMENTS = [
    { id: 'VAN_PHONG_CANG', name: 'Văn phòng Cảng' },
    { id: 'CUA_LO', name: 'Cảng Cửa Lò' },
    { id: 'BEN_THUY', name: 'Cảng Bến Thủy' }
];

export default function RegisterScreen() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [unionId, setUnionId] = useState('');
    const [department, setDepartment] = useState('VAN_PHONG_CANG');
    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();

    const handleRegister = async () => {
        if (!username || !password || !fullName || !unionId) {
            Alert.alert('Lỗi', 'Vui lòng nhập đầy đủ thông tin');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Lỗi', 'Mật khẩu phải có ít nhất 6 ký tự');
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.post('/api/auth/register', {
                username,
                password,
                fullName,
                unionId,
                department,
                role: 'MEMBER'
            });

            Alert.alert('Thành công', response.data.message, [
                { text: 'Về trang Đăng nhập', onPress: () => router.replace('/login') }
            ]);
        } catch (error: any) {
            Alert.alert('Đăng ký thất bại', error.response?.data?.detail || 'Vui lòng kiểm tra lại thông tin');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.formWrapper}>
                    <View style={styles.header}>
                        <Image
                            source={require('../assets/images/logo.png')}
                            style={styles.logo}
                        />
                        <Text style={styles.title}>ĐĂNG KÝ</Text>
                        <Text style={styles.subtitle}>TÀI KHOẢN MỚI</Text>
                        <View style={styles.divider} />
                    </View>

                    <View style={styles.form}>
                        <Text style={styles.label}>Họ và tên</Text>
                        <TextInput
                            style={styles.input}
                            value={fullName}
                            onChangeText={setFullName}
                            placeholder="VD: Nguyễn Văn A"
                            placeholderTextColor="#94a3b8"
                            editable={!isLoading}
                        />

                        <Text style={styles.label}>Mã Đoàn viên</Text>
                        <TextInput
                            style={styles.input}
                            value={unionId}
                            onChangeText={setUnionId}
                            placeholder="Nhập mã ĐV của bạn"
                            placeholderTextColor="#94a3b8"
                            editable={!isLoading}
                        />

                        <Text style={styles.label}>Tên đăng nhập (Tài khoản)</Text>
                        <TextInput
                            style={styles.input}
                            value={username}
                            onChangeText={setUsername}
                            placeholder="Nhập tên đăng nhập"
                            placeholderTextColor="#94a3b8"
                            autoCapitalize="none"
                            editable={!isLoading}
                        />

                        <Text style={styles.label}>Mật khẩu</Text>
                        <TextInput
                            style={styles.input}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Ít nhất 6 ký tự"
                            placeholderTextColor="#94a3b8"
                            secureTextEntry
                            editable={!isLoading}
                        />

                        <Text style={styles.label}>Phòng ban / Đơn vị</Text>
                        <View style={styles.departmentContainer}>
                            {DEPARTMENTS.map(dept => (
                                <TouchableOpacity
                                    key={dept.id}
                                    style={[
                                        styles.deptChip,
                                        department === dept.id && styles.deptChipActive
                                    ]}
                                    onPress={() => setDepartment(dept.id)}
                                    disabled={isLoading}
                                >
                                    <Text style={[
                                        styles.deptChipText,
                                        department === dept.id && styles.deptChipTextActive
                                    ]}>
                                        {dept.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <Text style={{ fontSize: 12, color: Colors.text.secondary, marginTop: 8, fontStyle: 'italic' }}>
                            * Quản trị viên có thể phân bổ lại đơn vị của bạn sau khi duyệt.
                        </Text>

                        <TouchableOpacity
                            style={[styles.button, isLoading && styles.buttonDisabled]}
                            onPress={handleRegister}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#ffffff" />
                            ) : (
                                <Text style={styles.buttonText}>ĐĂNG KÝ TÀI KHOẢN</Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.replace('/login')}
                            disabled={isLoading}
                        >
                            <Text style={styles.backButtonText}>Đã có tài khoản? Đăng nhập ngay</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.header.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    formWrapper: {
        width: '100%',
        maxWidth: 440,
        marginVertical: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logo: {
        width: 140,
        height: 70,
        marginBottom: 8,
        resizeMode: 'contain',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: Colors.text.light,
        letterSpacing: 2,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.secondary,
        marginTop: 4,
        letterSpacing: 1,
    },
    divider: {
        width: 60,
        height: 4,
        backgroundColor: Colors.primary,
        marginTop: 12,
        borderRadius: 2,
    },
    form: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text.primary,
        marginBottom: 6,
        marginTop: 12,
    },
    input: {
        height: 46,
        borderWidth: 2,
        borderColor: Colors.border,
        borderRadius: 8,
        paddingHorizontal: 16,
        fontSize: 15,
        color: Colors.text.primary,
        backgroundColor: Colors.background,
    },
    departmentContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    deptChip: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    deptChipActive: {
        backgroundColor: 'rgba(14, 165, 233, 0.1)',
        borderColor: Colors.primary,
    },
    deptChipText: {
        fontSize: 14,
        color: Colors.text.secondary,
        fontWeight: '500',
    },
    deptChipTextActive: {
        color: Colors.primary,
        fontWeight: 'bold',
    },
    button: {
        height: 50,
        backgroundColor: Colors.status.success,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
        shadowColor: Colors.status.success,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        backgroundColor: Colors.text.secondary,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text.light,
        letterSpacing: 1,
    },
    backButton: {
        marginTop: 20,
        alignItems: 'center',
        padding: 8,
    },
    backButtonText: {
        color: Colors.primary,
        fontSize: 15,
        fontWeight: '600',
    }
});
