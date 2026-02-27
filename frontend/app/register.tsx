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
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { api } from '../utils/api';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '../contexts/ToastContext';

const registerSchema = z.object({
    fullName: z.string().min(2, 'Họ và tên quá ngắn').max(100, 'Họ và tên quá dài'),
    unionId: z.string().min(3, 'Mã đoàn viên không hợp lệ').max(50, 'Mã đoàn viên quá dài'),
    username: z.string()
        .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
        .regex(/^[a-zA-Z0-9_]+$/, 'Tài khoản không được chứa khoảng trắng và ký tự đặc biệt'),
    password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
    department: z.string(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const DEPARTMENTS = [
    { id: 'VAN_PHONG_CANG', name: 'Văn phòng Cảng' },
    { id: 'CUA_LO', name: 'Cảng Cửa Lò' },
    { id: 'BEN_THUY', name: 'Cảng Bến Thủy' }
];

export default function RegisterScreen() {
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const { showToast } = useToast();

    const {
        control,
        handleSubmit,
        setValue,
        watch,
        formState: { errors },
    } = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            fullName: '',
            unionId: '',
            username: '',
            password: '',
            department: 'VAN_PHONG_CANG',
        },
    });

    const watchedDepartment = watch('department');

    const onSubmit = async (data: RegisterFormValues) => {
        setIsLoading(true);
        try {
            const response = await api.post('/api/auth/register', {
                ...data,
                role: 'MEMBER'
            });

            showToast({
                message: response.data.message || 'Đăng ký thành công',
                type: 'success'
            });

            setTimeout(() => {
                router.replace('/login');
            }, 1000);

        } catch (error: any) {
            showToast({
                message: error.response?.data?.detail || 'Vui lòng kiểm tra lại thông tin',
                type: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <LinearGradient colors={Colors.gradients.auth} style={styles.container}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
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
                            <Controller
                                control={control}
                                name="fullName"
                                render={({ field: { onChange, onBlur, value } }) => (
                                    <TextInput
                                        style={[styles.input, errors.fullName && styles.inputError]}
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
                                        placeholder="VD: Nguyễn Văn A"
                                        placeholderTextColor="#94a3b8"
                                        editable={!isLoading}
                                    />
                                )}
                            />
                            {errors.fullName && <Text style={styles.errorText}>{errors.fullName.message}</Text>}

                            <Text style={styles.label}>Mã Đoàn viên</Text>
                            <Controller
                                control={control}
                                name="unionId"
                                render={({ field: { onChange, onBlur, value } }) => (
                                    <TextInput
                                        style={[styles.input, errors.unionId && styles.inputError]}
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
                                        placeholder="Nhập mã ĐV của bạn"
                                        placeholderTextColor="#94a3b8"
                                        editable={!isLoading}
                                    />
                                )}
                            />
                            {errors.unionId && <Text style={styles.errorText}>{errors.unionId.message}</Text>}

                            <Text style={styles.label}>Tên đăng nhập (Tài khoản)</Text>
                            <Controller
                                control={control}
                                name="username"
                                render={({ field: { onChange, onBlur, value } }) => (
                                    <TextInput
                                        style={[styles.input, errors.username && styles.inputError]}
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
                                        placeholder="Nhập tên đăng nhập"
                                        placeholderTextColor="#94a3b8"
                                        autoCapitalize="none"
                                        editable={!isLoading}
                                    />
                                )}
                            />
                            {errors.username && <Text style={styles.errorText}>{errors.username.message}</Text>}

                            <Text style={styles.label}>Mật khẩu</Text>
                            <Controller
                                control={control}
                                name="password"
                                render={({ field: { onChange, onBlur, value } }) => (
                                    <TextInput
                                        style={[styles.input, errors.password && styles.inputError]}
                                        value={value}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
                                        placeholder="Ít nhất 6 ký tự"
                                        placeholderTextColor="#94a3b8"
                                        secureTextEntry
                                        editable={!isLoading}
                                    />
                                )}
                            />
                            {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}

                            <Text style={styles.label}>Phòng ban / Đơn vị</Text>
                            <View style={styles.departmentContainer}>
                                {DEPARTMENTS.map(dept => (
                                    <TouchableOpacity
                                        key={dept.id}
                                        style={[
                                            styles.deptChip,
                                            watchedDepartment === dept.id && styles.deptChipActive
                                        ]}
                                        onPress={() => setValue('department', dept.id)}
                                        disabled={isLoading}
                                    >
                                        <Text style={[
                                            styles.deptChipText,
                                            watchedDepartment === dept.id && styles.deptChipTextActive
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
                                onPress={handleSubmit(onSubmit)}
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
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
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
        borderRadius: 24,
        padding: 32,
        ...Colors.shadows.lg,
    },
    label: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.text.primary,
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        height: 54,
        borderWidth: 1.5,
        borderColor: Colors.border,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 15,
        color: Colors.text.primary,
        backgroundColor: Colors.surfaceLight,
    },
    departmentContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 8,
    },
    deptChip: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: Colors.surfaceLight,
        borderWidth: 1.5,
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
        height: 54,
        backgroundColor: Colors.status.success,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 32,
        ...Colors.shadows.md,
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
    },
    inputError: {
        borderColor: Colors.status?.error || '#ef4444',
    },
    errorText: {
        color: Colors.status?.error || '#ef4444',
        fontSize: 12,
        marginTop: 4,
    }
});
