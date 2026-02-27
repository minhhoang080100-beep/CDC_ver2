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
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Colors } from '../constants/Colors';
import { api } from '../utils/api';
import { ImagePlus, X } from 'lucide-react-native';

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
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Thông báo');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['ALL']);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);

  // Cloudinary Details
  const CLOUD_NAME = 'dljjearo2';
  // Note: This upload preset needs to be created in Cloudinary settings -> Upload -> Add upload preset (Signing Mode: Unsigned)
  const UPLOAD_PRESET = 'CDCnghetinh'; // Replace with your actual unsigned preset name if different

  // Pre-fill form when editing
  useEffect(() => {
    if (editPost) {
      setTitle(editPost.title);
      setSummary(editPost.summary);
      setContent(editPost.content);
      setCategory(editPost.category);
      setSelectedDepts(editPost.targetDepartments || ['ALL']);
      setImageUri(editPost.image || null);
    } else if (visible) {
      // Reset form fields without closing the modal
      setTitle('');
      setSummary('');
      setContent('');
      setCategory('Thông báo');
      setSelectedDepts(['ALL']);
      setImageUri(null);
      setLoading(false);
    }
  }, [editPost, visible]);

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
      setSelectedDepts(['ALL']);
    } else {
      const newDepts = selectedDepts.filter(d => d !== 'ALL');
      if (newDepts.includes(dept)) {
        setSelectedDepts(newDepts.filter(d => d !== dept));
      } else {
        setSelectedDepts([...newDepts, dept]);
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
        base64: true, // We need base64 for ImgBB upload
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        // We temporarily store the local URI for preview
        // We will upload the base64 data to Cloudinary when picked
        setImageUri(result.assets[0].uri);

        // Cloudinary requires a specific content type prefix for base64
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
      formData.append('folder', 'cong-doan-app'); // Optional: organize uploads into a folder

      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.secure_url) {
        // Overwrite the local URI with the remote Cloudinary URL
        setImageUri(data.secure_url);
      } else {
        throw new Error(data.error?.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      showToast({ message: 'Upload ảnh thất bại. Bạn đã bật Unsigned Upload Preset chưa?', type: 'error' });
      setImageUri(null); // Reset on failure
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      showToast({ message: 'Vui lòng nhập đầy đủ thông tin bắt buộc', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      const postData = {
        title,
        summary: summary || title,
        content,
        category,
        targetDepartments: selectedDepts,
        image: imageUri,
      };

      if (editPost) {
        // Update existing post
        await api.put(
          `/api/posts/${editPost.id}`,
          postData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showToast({ message: 'Đã cập nhật bài viết thành công!', type: 'success' });
      } else {
        // Create new post
        await api.post(
          '/api/posts',
          postData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showToast({ message: 'Đã đăng bài thành công!', type: 'success' });
      }

      onSuccess();
      handleReset();
    } catch (error: any) {
      console.error('Error saving post:', error);
      showToast({
        message: error.response?.data?.detail || 'Không thể lưu bài viết',
        type: 'error'
      });
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setSummary('');
    setContent('');
    setCategory('Thông báo');
    setSelectedDepts(['ALL']);
    setImageUri(null);
    setLoading(false);
    onClose();
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
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Nhập tiêu đề bài viết"
              placeholderTextColor={Colors.text.placeholder}
            />

            <Text style={styles.label}>Tóm tắt</Text>
            <TextInput
              style={styles.input}
              value={summary}
              onChangeText={setSummary}
              placeholder="Nhập tóm tắt"
              placeholderTextColor={Colors.text.placeholder}
            />

            <Text style={styles.label}>Nội dung *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={content}
              onChangeText={setContent}
              placeholder="Nhập nội dung chi tiết"
              placeholderTextColor={Colors.text.placeholder}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Ảnh minh họa (Tùy chọn)</Text>
            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setImageUri(null)}
                >
                  <X color="#fff" size={20} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.imageUploadButton}
                onPress={pickImage}
                disabled={uploadingImage}
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

            <Text style={styles.label}>Danh mục</Text>
            <View style={styles.categoryContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text
                    style={[
                      styles.categoryButtonText,
                      category === cat && styles.categoryButtonTextActive,
                    ]}
                  >
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {canSelectDepts && (
              <>
                <Text style={styles.label}>Bộ phận được xem</Text>
                <View style={styles.deptContainer}>
                  {departments.map((dept) => (
                    <TouchableOpacity
                      key={dept.value}
                      style={[
                        styles.deptButton,
                        selectedDepts.includes(dept.value) && styles.deptButtonActive,
                      ]}
                      onPress={() => toggleDept(dept.value)}
                    >
                      <Text
                        style={[
                          styles.deptButtonText,
                          selectedDepts.includes(dept.value) && styles.deptButtonTextActive,
                        ]}
                      >
                        {dept.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.submitButton, (loading || uploadingImage) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading || uploadingImage}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Đang đăng...' : 'Đăng bài'}
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