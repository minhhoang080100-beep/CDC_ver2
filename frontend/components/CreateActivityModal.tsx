import React, { useEffect } from 'react';
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
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Colors } from '../constants/Colors';

const activitySchema = z.object({
  name: z.string().min(3, 'Tên hoạt động phải có ít nhất 3 ký tự'),
  description: z.string().optional(),
  time: z.string().min(5, 'Vui lòng nhập thời gian hợp lệ'),
  location: z.string().min(2, 'Vui lòng nhập địa điểm'),
  type: z.enum(['TRAINING', 'SPORTS', 'VACATION']),
  targetDepartments: z.array(z.string()).min(1, 'Vui lòng chọn ít nhất 1 bộ phận'),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

interface Activity {
  id: string;
  name: string;
  description: string;
  time: string;
  location: string;
  type: string;
  targetDepartments: string[];
}

interface CreateActivityModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editActivity?: Activity | null;
}

export default function CreateActivityModal({ visible, onClose, onSuccess, editActivity }: CreateActivityModalProps) {
  const { user, token } = useAuth();
  const { showToast } = useToast();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      name: '',
      description: '',
      time: '',
      location: '',
      type: 'TRAINING',
      targetDepartments: ['ALL'],
    },
  });

  const watchedType = watch('type');
  const watchedDepts = watch('targetDepartments');

  // Pre-fill form when editing
  useEffect(() => {
    if (editActivity) {
      reset({
        name: editActivity.name,
        description: editActivity.description || '',
        time: editActivity.time,
        location: editActivity.location,
        type: editActivity.type as 'TRAINING' | 'SPORTS' | 'VACATION',
        targetDepartments: editActivity.targetDepartments || ['ALL'],
      });
    } else if (visible) {
      // Reset form fields when opening modal for creating new
      reset({
        name: '',
        description: '',
        time: '',
        location: '',
        type: 'TRAINING',
        targetDepartments: ['ALL'],
      });
    }
  }, [editActivity, visible, reset]);

  const types = [
    { value: 'TRAINING', label: 'Tập huấn' },
    { value: 'SPORTS', label: 'Thể thao' },
    { value: 'VACATION', label: 'Nghỉ mát' },
  ];

  const departments = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'VAN_PHONG_CANG', label: 'Văn phòng Cảng' },
    { value: 'CUA_LO', label: 'Cửa Lò' },
    { value: 'BEN_THUY', label: 'Bến Thủy' },
  ];

  const canSelectDepts = user?.role === 'SUPER_ADMIN' || user?.role === 'BCH_VANPHONG';

  const toggleDept = (dept: string) => {
    if (dept === 'ALL') {
      setValue('targetDepartments', ['ALL']);
    } else {
      const newDepts = watchedDepts.filter((d) => d !== 'ALL');
      if (newDepts.includes(dept)) {
        setValue('targetDepartments', newDepts.filter((d) => d !== dept), { shouldValidate: true });
      } else {
        setValue('targetDepartments', [...newDepts, dept], { shouldValidate: true });
      }
    }
  };

  const onSubmit = async (data: ActivityFormValues) => {
    try {
      if (editActivity) {
        // Update existing activity
        await api.put(`/api/activities/${editActivity.id}`, data, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast({ message: 'Đã cập nhật hoạt động thành công!', type: 'success' });
      } else {
        // Create new activity
        await api.post('/api/activities', data, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast({ message: 'Đã tạo hoạt động thành công!', type: 'success' });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving activity:', error);
      showToast({
        message: error.response?.data?.detail || 'Không thể lưu hoạt động',
        type: 'error',
      });
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editActivity ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động mới'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.label}>Tên hoạt động *</Text>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Nhập tên hoạt động"
                  placeholderTextColor="#94a3b8"
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name.message}</Text>}

            <Text style={styles.label}>Mô tả</Text>
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, styles.textArea, errors.description && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Nhập mô tả hoạt động"
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.description && <Text style={styles.errorText}>{errors.description.message}</Text>}

            <Text style={styles.label}>Thời gian *</Text>
            <Controller
              control={control}
              name="time"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.time && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="VD: 15/08/2025 08:00"
                  placeholderTextColor="#94a3b8"
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.time && <Text style={styles.errorText}>{errors.time.message}</Text>}

            <Text style={styles.label}>Địa điểm *</Text>
            <Controller
              control={control}
              name="location"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.location && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Nhập địa điểm"
                  placeholderTextColor="#94a3b8"
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.location && <Text style={styles.errorText}>{errors.location.message}</Text>}

            <Text style={styles.label}>Loại hoạt động</Text>
            <View style={styles.typeContainer}>
              {types.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.typeButton,
                    watchedType === t.value && styles.typeButtonActive,
                  ]}
                  onPress={() => setValue('type', t.value as any, { shouldValidate: true })}
                  disabled={isSubmitting}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      watchedType === t.value && styles.typeButtonTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.type && <Text style={styles.errorText}>{errors.type.message}</Text>}

            {canSelectDepts && (
              <>
                <Text style={styles.label}>Bộ phận được xem</Text>
                <View style={styles.deptContainer}>
                  {departments.map((dept) => (
                    <TouchableOpacity
                      key={dept.value}
                      style={[
                        styles.deptButton,
                        watchedDepts.includes(dept.value) && styles.deptButtonActive,
                      ]}
                      onPress={() => toggleDept(dept.value)}
                      disabled={isSubmitting}
                    >
                      <Text
                        style={[
                          styles.deptButtonText,
                          watchedDepts.includes(dept.value) && styles.deptButtonTextActive,
                        ]}
                      >
                        {dept.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.targetDepartments && <Text style={styles.errorText}>{errors.targetDepartments.message}</Text>}
              </>
            )}

            <TouchableOpacity
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Đang lưu...' : (editActivity ? 'Lưu thay đổi' : 'Tạo hoạt động')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
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
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
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
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  closeButton: {
    fontSize: 24,
    color: '#64748b',
  },
  modalBody: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  inputError: {
    borderColor: Colors.status.error || '#ef4444',
  },
  errorText: {
    color: Colors.status.error || '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  typeButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#64748b',
  },
  typeButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  deptContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  deptButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  deptButtonActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  deptButtonText: {
    fontSize: 13,
    color: '#64748b',
  },
  deptButtonTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0891b2',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});