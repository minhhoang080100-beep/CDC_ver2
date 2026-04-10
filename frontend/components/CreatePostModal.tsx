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
  Switch,
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
  images: z.array(z.string()).max(10, 'Tối đa 10 ảnh').optional(),
});

type PostFormValues = z.infer<typeof postSchema>;

interface Post {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  targetDepartments: string[];
  images?: string[];
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
  const [notifyUpdate, setNotifyUpdate] = useState(false);

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
      images: [],
    },
  });

  const watchedCategory = watch('category');
  const watchedDepts = watch('targetDepartments');
  const watchedImages = watch('images') || [];

  // Pre-fill form when editing
  useEffect(() => {
    if (editPost) {
      reset({
        title: editPost.title,
        summary: editPost.summary || '',
        content: editPost.content,
        category: editPost.category || 'Thông báo',
        targetDepartments: editPost.targetDepartments || ['ALL'],
        images: editPost.images || [],
      });
      setNotifyUpdate(false);
    } else if (visible) {
      // Reset form fields without closing the modal
      reset({
        title: '',
        summary: '',
        content: '',
        category: 'Thông báo',
        targetDepartments: ['ALL'],
        images: [],
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
        allowsMultipleSelection: true,
        selectionLimit: 10 - watchedImages.length, // Only allow filling up to 10
        quality: 0.6, // Optimize size
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingImage(true);
        try {
          const validUrls: string[] = [];
          
          // Upload sequentially to prevent memory/network overload on mobile/web
          for (const asset of result.assets) {
            const base64Img = `data:image/jpeg;base64,${asset.base64}`;
            const url = await uploadSingleToCloudinary(base64Img);
            if (url) {
              validUrls.push(url);
            }
          }
          
          if (validUrls.length > 0) {
            setValue('images', [...watchedImages, ...validUrls], { shouldValidate: true });
          }
        } catch (error) {
          console.error("Lỗi upload nhiều ảnh:", error);
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast({ message: 'Không thể chọn ảnh', type: 'error' });
    }
  };

  const uploadSingleToCloudinary = async (base64Img: string): Promise<string | null> => {
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
        return data.secure_url;
      } else {
        throw new Error(data.error?.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Error uploading to Cloudinary:', error);
      showToast({ message: 'Upload ảnh thất bại. Kiểm tra kết nối hoặc size.', type: 'error' });
      return null;
    }
  };

  const onSubmit = async (data: PostFormValues) => {
    try {
      const postData = {
        ...data,
        summary: data.summary || data.title, // Fallback if summary is empty
      };

      if (editPost) {
        await api.put(`/api/posts/${editPost.id}?notify_update=${notifyUpdate}`, postData, {
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

            <Text style={styles.label}>Ảnh minh họa (Tối đa 10 ảnh)</Text>
            {watchedImages.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalImageScroll}>
                {watchedImages.map((imgUri, index) => (
                  <View key={index} style={styles.multiImagePreviewContainer}>
                    <Image source={{ uri: imgUri }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => {
                        const newImages = watchedImages.filter((_, i) => i !== index);
                        setValue('images', newImages, { shouldValidate: true });
                      }}
                      disabled={isSubmitting || uploadingImage}
                    >
                      <X color="#fff" size={20} />
                    </TouchableOpacity>
                  </View>
                ))}
                {watchedImages.length < 10 && (
                  <TouchableOpacity
                    style={[styles.imageUploadButton, styles.addMoreImageButton]}
                    onPress={pickImage}
                    disabled={isSubmitting || uploadingImage}
                  >
                    {uploadingImage ? (
                      <ActivityIndicator color={Colors.primary} />
                    ) : (
                      <ImagePlus color={Colors.primary} size={28} />
                    )}
                  </TouchableOpacity>
                )}
              </ScrollView>
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
                    <Text style={styles.imageUploadText}>Nhấn để tải ảnh lên (tối đa 10)</Text>
                    <Text style={styles.imageUploadSubText}>Hỗ trợ JPG, PNG (Tối đa 5MB/ảnh)</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {errors.images && <Text style={styles.errorText}>{errors.images.message}</Text>}

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

            {editPost && (
              <View style={styles.notifySwitchContainer}>
                <Text style={styles.notifySwitchLabel}>Gửi thông báo cập nhật cho Đoàn viên</Text>
                <Switch
                  value={notifyUpdate}
                  onValueChange={setNotifyUpdate}
                  trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                  thumbColor={notifyUpdate ? Colors.primary : '#f4f3f4'}
                />
              </View>
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
  horizontalImageScroll: {
    marginBottom: 8,
    flexDirection: 'row',
  },
  multiImagePreviewContainer: {
    width: 120,
    height: 120,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.divider,
    marginRight: 10,
  },
  addMoreImageButton: {
    width: 120,
    height: 120,
    marginBottom: 0,
    padding: 0,
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
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    width: 24,
    height: 24,
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
  notifySwitchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 16,
  },
  notifySwitchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
});