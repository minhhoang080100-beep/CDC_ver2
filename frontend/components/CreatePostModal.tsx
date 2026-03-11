import React, { useEffect, useState } from 'react';
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
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Colors } from '../constants/Colors';
import { api } from '../utils/api';
import { ImagePlus, X } from 'lucide-react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const postSchema = z.object({
  title: z.string().min(5, 'Tiêu đề bài viết phải có ít nhất 5 ký tự'),
  summary: z.string().optional(),
  content: z.string().min(10, 'Nội dung bài viết quá ngắn (tối thiểu 10 ký tự)'),
  category: z.string(),
  targetDepartments: z.array(z.string()).min(1, 'Vui lòng chọn ít nhất 1 bộ phận'),
  image: z.string().nullable().optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

interface Post {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  targetDepartments: string[];
  image?: string;
}

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editPost?: Post | null;
}

export default function CreatePostModal({ visible, onClose, onSuccess, editPost }: CreatePostModalProps) {
  const { user, token } = useAuth();
  const { showToast } = useToast();
  const [uploadingImage, setUploadingImage] = useState(false);

  // Cloudinary Details
  const CLOUD_NAME = 'dljjearo2';
  const UPLOAD_PRESET = 'CDCnghetinh';

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: '',
      summary: '',
      content: '',
      category: 'Thông báo',
      targetDepartments: ['ALL'],
      image: null,
    },
  });

  const watchedCategory = watch('category');
  const watchedDepts = watch('targetDepartments');
  const watchedImage = watch('image');

  // Pre-fill form when editing
  useEffect(() => {
    if (editPost) {
      reset({
        title: editPost.title,
        summary: editPost.summary || '',
        content: editPost.content,
        category: editPost.category || 'Thông báo',
        targetDepartments: editPost.targetDepartments || ['ALL'],
        image: editPost.image || null,
      });
    } else if (visible) {
      // Reset form fields without closing the modal
      reset({
        title: '',
        summary: '',
        content: '',
        category: 'Thông báo',
        targetDepartments: ['ALL'],
        image: null,
      });
    }
  }, [editPost, visible, reset]);

  const categories = ['Chính sách', 'Hoạt động', 'Thông báo'];
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

  const pickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          showToast({ message: 'Ứng dụng cần quyền truy cập thư viện ảnh để tải ảnh lên', type: 'error' });
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // Temporarily show local image while uploading
        setValue('image', result.assets[0].uri);

        const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await uploadToCloudinary(base64Img);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast({ message: 'Không thể chọn ảnh', type: 'error' });
    }
  };

  const uploadToCloudinary = async (base64Img: string) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', base64Img);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'cong-doan-app');

      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.secure_url) {
        setValue('image', data.secure_url);
      } else {
        throw new Error(data.error?.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      showToast({ message: 'Upload ảnh thất bại. Bạn đã bật Unsigned Upload Preset chưa?', type: 'error' });
      setValue('image', null); // Reset on failure
    } finally {
      setUploadingImage(false);
    }
  };

  const onSubmit = async (data: PostFormValues) => {
    try {
      const postData = {
        ...data,
        summary: data.summary || data.title, // Fallback if summary is empty
      };

      if (editPost) {
        await api.put(`/api/posts/${editPost.id}`, postData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast({ message: 'Đã cập nhật bài viết thành công!', type: 'success' });
      } else {
        await api.post('/api/posts', postData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        showToast({ message: 'Đã đăng bài thành công!', type: 'success' });
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving post:', error);
      showToast({
        message: error.response?.data?.detail || 'Không thể lưu bài viết',
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
              {editPost ? 'Chỉnh sửa bài viết' : 'Đăng bài mới'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.label}>Tiêu đề *</Text>
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.title && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Nhập tiêu đề bài viết"
                  placeholderTextColor={Colors.text.placeholder}
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.title && <Text style={styles.errorText}>{errors.title.message}</Text>}

            <Text style={styles.label}>Tóm tắt</Text>
            <Controller
              control={control}
              name="summary"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.summary && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Nhập tóm tắt"
                  placeholderTextColor={Colors.text.placeholder}
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.summary && <Text style={styles.errorText}>{errors.summary.message}</Text>}

            <Text style={styles.label}>Nội dung *</Text>
            <Controller
              control={control}
              name="content"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, styles.textArea, errors.content && styles.inputError]}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="Nhập nội dung chi tiết"
                  placeholderTextColor={Colors.text.placeholder}
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
              )}
            />
            {errors.content && <Text style={styles.errorText}>{errors.content.message}</Text>}

            <Text style={styles.label}>Ảnh minh họa (Tùy chọn)</Text>
            {watchedImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: watchedImage }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setValue('image', null)}
                  disabled={isSubmitting || uploadingImage}
                >
                  <X color="#fff" size={20} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.imageUploadButton}
                onPress={pickImage}
                disabled={isSubmitting || uploadingImage}
              >
                {uploadingImage ? (
                  <>
                    <ActivityIndicator color={Colors.primary} style={{ marginBottom: 8 }} />
                    <Text style={styles.imageUploadText}>Đang tải ảnh lên...</Text>
                  </>
                ) : (
                  <>
                    <ImagePlus color={Colors.primary} size={32} style={{ marginBottom: 8 }} />
                    <Text style={styles.imageUploadText}>Nhấn để tải ảnh lên</Text>
                    <Text style={styles.imageUploadSubText}>Hỗ trợ JPG, PNG (Tối đa 5MB)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {errors.image && <Text style={styles.errorText}>{errors.image.message}</Text>}

            <Text style={styles.label}>Danh mục</Text>
            <View style={styles.categoryContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    watchedCategory === cat && styles.categoryButtonActive,
                  ]}
                  onPress={() => setValue('category', cat, { shouldValidate: true })}
                  disabled={isSubmitting}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      watchedCategory === cat && styles.categoryButtonTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.category && <Text style={styles.errorText}>{errors.category.message}</Text>}

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
              style={[styles.submitButton, (isSubmitting || uploadingImage) && styles.submitButtonDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting || uploadingImage}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? 'Đang lưu...' : (editPost ? 'Lưu thay đổi' : 'Đăng bài')}
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
    backgroundColor: Colors.surface,
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
    borderBottomColor: Colors.divider,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  closeButton: {
    fontSize: 24,
    color: Colors.text.secondary,
  },
  modalBody: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text.primary,
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
    height: 120,
    paddingTop: 12,
  },
  imageUploadButton: {
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  imageUploadText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  imageUploadSubText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  imagePreviewContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
    position: 'relative',
    backgroundColor: Colors.divider,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  categoryButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryButtonText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  categoryButtonTextActive: {
    color: Colors.text.light,
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
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  deptButtonActive: {
    backgroundColor: Colors.status.success,
    borderColor: Colors.status.success,
  },
  deptButtonText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  deptButtonTextActive: {
    color: Colors.text.light,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.text.placeholder,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.light,
  },
});