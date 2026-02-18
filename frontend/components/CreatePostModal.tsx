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
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { Colors } from '../constants/Colors';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Post {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  targetDepartments: string[];
}

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editPost?: Post | null;
}

export default function CreatePostModal({ visible, onClose, onSuccess, editPost }: CreatePostModalProps) {
  const { user, token } = useAuth();
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Thông báo');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['ALL']);
  const [loading, setLoading] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (editPost) {
      setTitle(editPost.title);
      setSummary(editPost.summary);
      setContent(editPost.content);
      setCategory(editPost.category);
      setSelectedDepts(editPost.targetDepartments || ['ALL']);
    } else {
      handleReset();
    }
  }, [editPost, visible]);

  const categories = ['Chính sách', 'Hoạt động', 'Thông báo'];
  const departments = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'VAN_PHONG_CANG', label: 'Văn phòng Cảng' },
    { value: 'CUA_LO', label: 'Cửa Lò' },
    { value: 'BEN_THUY', label: 'Bến Thủy' },
  ];

  const canSelectDepts = user?.role === 'SUPER_ADMIN' || user?.role === 'BCH_VAN_PHONG';

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

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Vui lòng nhập đầy đủ thông tin');
      }
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
      };

      if (editPost) {
        // Update existing post
        await axios.put(
          `${EXPO_PUBLIC_BACKEND_URL}/api/posts/${editPost.id}`,
          postData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('Đã cập nhật bài viết thành công!');
        }
      } else {
        // Create new post
        await axios.post(
          `${EXPO_PUBLIC_BACKEND_URL}/api/posts`,
          postData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('Đã đăng bài thành công!');
        }
      }

      onSuccess();
      handleReset();
    } catch (error: any) {
      console.error('Error saving post:', error);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(error.response?.data?.detail || 'Không thể lưu bài viết');
      }
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setSummary('');
    setContent('');
    setCategory('Thông báo');
    setSelectedDepts(['ALL']);
    setLoading(false);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
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
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
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