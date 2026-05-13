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
import { useAuth } from '../contexts/AuthContext';
import { Colors } from '../constants/Colors';
import { useResponsive } from '../hooks/useResponsive';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '../contexts/ToastContext';

const loginSchema = z.object({
  username: z.string()
    .min(3, 'Tên đăng nhập phải có ít nhất 3 ký tự')
    .regex(/^[a-zA-Z0-9_]+$/, 'Tài khoản không được chứa khoảng trắng và ký tự đặc biệt'),
  password: z.string()
    .min(1, 'Vui lòng nhập mật khẩu'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      await login(data.username, data.password);
      router.replace('/(tabs)');
    } catch (error: any) {
      showToast({
        message: error.message || 'Vui lòng kiểm tra lại thông tin đăng nhập',
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
                source={require('../assets/images/CNTVIEN.png')}
                style={styles.logo}
              />
              <Text style={styles.title}>CÔNG ĐOÀN</Text>
              <Text style={styles.subtitle}>CẢNG NGHỆ TĨNH</Text>
              <View style={styles.divider} />
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Tên đăng nhập</Text>
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
                    placeholder="Nhập mật khẩu"
                    placeholderTextColor="#94a3b8"
                    secureTextEntry
                    editable={!isLoading}
                  />
                )}
              />
              {errors.password && <Text style={styles.errorText}>{errors.password.message}</Text>}

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSubmit(onSubmit)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>ĐĂNG NHẬP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.registerButton}
                onPress={() => router.push('/register')}
                disabled={isLoading}
              >
                <Text style={styles.registerButtonText}>Chưa có tài khoản? Đăng ký ngay</Text>
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
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 260,
    height: 164,
    marginBottom: 16,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text.light,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f59e0b',
    marginTop: 8,
    letterSpacing: 1,
  },
  divider: {
    width: 100,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginTop: 16,
    borderRadius: 2,
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 32,
    ...Colors.shadows.lg,
  },
  label: {
    fontSize: 16,
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
    fontSize: 16,
    color: Colors.text.primary,
    backgroundColor: Colors.surfaceLight,
  },
  button: {
    height: 54,
    backgroundColor: Colors.primary,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.light,
    letterSpacing: 1,
  },
  registerButton: {
    marginTop: 20,
    alignItems: 'center',
    padding: 8,
  },
  registerButtonText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  demoInfo: {
    marginTop: 24,
    padding: 16,
    backgroundColor: Colors.background,
    borderRadius: 8,
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  demoText: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  inputError: {
    borderColor: Colors.status.error || '#ef4444',
  },
  errorText: {
    color: Colors.status.error || '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
});
