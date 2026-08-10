import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/Colors';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '../contexts/ToastContext';
import { ChevronLeft } from 'lucide-react-native';
import { api } from '../utils/api';

const cccdSchema = z.object({
  cccdNumber: z.string()
    .min(9, 'Số CCCD/CMND phải có ít nhất 9 số')
    .max(12, 'Số CCCD/CMND không quá 12 số')
    .regex(/^\d+$/, 'Chỉ được nhập số'),
});

const passwordSchema = z.object({
  password: z.string()
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  confirmPassword: z.string()
    .min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

type CccdFormValues = z.infer<typeof cccdSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  
  const { showToast } = useToast();
  const router = useRouter();

  const cccdForm = useForm<CccdFormValues>({
    resolver: zodResolver(cccdSchema),
    defaultValues: { cccdNumber: '' },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onVerifyCCCD = async (data: CccdFormValues) => {
    setIsLoading(true);
    try {
      const result = await api.post('/api/auth/verify-cccd', {
        cccdNumber: data.cccdNumber,
      });

      setResetToken(result.data.resetToken);
      setStep(2);
      showToast({ message: 'Xác thực thành công, vui lòng nhập mật khẩu mới', type: 'success' });
    } catch (error: any) {
      showToast({
        message: error.detail || error.message || 'Lỗi kết nối máy chủ',
        type: 'error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPassword = async (data: PasswordFormValues) => {
    if (!resetToken) return;
    
    setIsLoading(true);
    try {
      await api.post('/api/auth/reset-password-with-token', {
        resetToken,
        newPassword: data.password,
      });

      showToast({ message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.', type: 'success' });
      router.replace('/login');
    } catch (error: any) {
      showToast({
        message: error.detail || error.message || 'Lỗi kết nối máy chủ',
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formWrapper}>
            <View style={styles.header}>
              <Image
                source={require('../assets/images/CNTVIEN.png')}
                style={styles.logo}
              />
              <Text style={styles.title}>QUÊN MẬT KHẨU</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.form}>
              <TouchableOpacity style={styles.backButton} onPress={() => router.back()} disabled={isLoading}>
                <ChevronLeft size={24} color={Colors.text.secondary} />
                <Text style={styles.backButtonText}>Quay lại</Text>
              </TouchableOpacity>

              {step === 1 ? (
                <View key="step-cccd">
                  <Text style={styles.description}>
                    Vui lòng nhập số Căn cước công dân (hoặc CMND) đã đăng ký để lấy lại mật khẩu.
                  </Text>
                  
                  <Text style={styles.label}>Số CCCD / CMND</Text>
                  <Controller
                    control={cccdForm.control}
                    name="cccdNumber"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        style={[styles.input, cccdForm.formState.errors.cccdNumber && styles.inputError]}
                        value={value}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="Nhập số CCCD"
                        placeholderTextColor="#94a3b8"
                        keyboardType="numeric"
                        editable={!isLoading}
                      />
                    )}
                  />
                  {cccdForm.formState.errors.cccdNumber && (
                    <Text style={styles.errorText}>{cccdForm.formState.errors.cccdNumber.message}</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.button, isLoading && styles.buttonDisabled]}
                    onPress={cccdForm.handleSubmit(onVerifyCCCD)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.buttonText}>TIẾP TỤC</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View key="step-password">
                  <Text style={styles.description}>
                    Vui lòng nhập mật khẩu mới cho tài khoản của bạn.
                  </Text>
                  
                  <Text style={styles.label}>Mật khẩu mới</Text>
                  <Controller
                    control={passwordForm.control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        key="input-new-password"
                        style={[styles.input, passwordForm.formState.errors.password && styles.inputError]}
                        value={value || ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="Nhập mật khẩu mới"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={true}
                        editable={!isLoading}
                      />
                    )}
                  />
                  {passwordForm.formState.errors.password && (
                    <Text style={styles.errorText}>{passwordForm.formState.errors.password.message}</Text>
                  )}

                  <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
                  <Controller
                    control={passwordForm.control}
                    name="confirmPassword"
                    render={({ field: { onChange, onBlur, value } }) => (
                      <TextInput
                        key="input-confirm-password"
                        style={[styles.input, passwordForm.formState.errors.confirmPassword && styles.inputError]}
                        value={value || ''}
                        onChangeText={onChange}
                        onBlur={onBlur}
                        placeholder="Nhập lại mật khẩu mới"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={true}
                        editable={!isLoading}
                      />
                    )}
                  />
                  {passwordForm.formState.errors.confirmPassword && (
                    <Text style={styles.errorText}>{passwordForm.formState.errors.confirmPassword.message}</Text>
                  )}

                  <TouchableOpacity
                    style={[styles.button, isLoading && styles.buttonDisabled]}
                    onPress={passwordForm.handleSubmit(onResetPassword)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.buttonText}>ĐẶT LẠI MẬT KHẨU</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  formWrapper: { width: '100%', maxWidth: 440 },
  header: { alignItems: 'center', marginBottom: 48 },
  logo: { width: 180, height: 114, marginBottom: 16, resizeMode: 'contain' },
  title: { fontSize: 26, fontWeight: 'bold', color: Colors.text.light, letterSpacing: 1 },
  divider: { width: 80, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', marginTop: 16, borderRadius: 2 },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    ...Colors.shadows.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginLeft: -8,
  },
  backButtonText: {
    fontSize: 15,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  description: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  label: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginBottom: 8, marginTop: 16 },
  input: {
    height: 54, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 12,
    paddingHorizontal: 16, fontSize: 16, color: Colors.text.primary, backgroundColor: Colors.surfaceLight,
  },
  inputError: { borderColor: Colors.status.error || '#ef4444' },
  errorText: { color: Colors.status.error || '#ef4444', fontSize: 12, marginTop: 4 },
  button: {
    height: 54, backgroundColor: Colors.primary, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center', marginTop: 32, ...Colors.shadows.md,
  },
  buttonDisabled: { backgroundColor: Colors.text.secondary },
  buttonText: { fontSize: 18, fontWeight: 'bold', color: Colors.text.light, letterSpacing: 1 },
});
