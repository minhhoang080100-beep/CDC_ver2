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
import { api } from '../utils/api';

interface Document {
  id: string;
  title: string;
  category: string;
  fileSize: string;
  fileUrl?: string;
  targetDepartments: string[];
}

interface CreateDocumentModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editDocument?: Document | null;
}

export default function CreateDocumentModal({ visible, onClose, onSuccess, editDocument }: CreateDocumentModalProps) {
  const { user, token } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Nội quy');
  const [fileSize, setFileSize] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['ALL']);
  const [loading, setLoading] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (editDocument) {
      setTitle(editDocument.title);
      setCategory(editDocument.category);
      setFileSize(editDocument.fileSize);
      setFileUrl(editDocument.fileUrl || '');
      setSelectedDepts(editDocument.targetDepartments || ['ALL']);
    } else if (visible) {
      // Reset form fields without closing the modal
      setTitle('');
      setCategory('Nội quy');
      setFileSize('');
      setFileUrl('');
      setSelectedDepts(['ALL']);
      setLoading(false);
    }
  }, [editDocument, visible]);

  const categories = ['Thỏa ước lao động', 'Nội quy', 'An toàn'];

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

  const handleSubmit = async () => {
    if (!title.trim()) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Vui lòng nhập tên tài liệu');
      }
      return;
    }

    setLoading(true);
    try {
      const documentData = {
        title,
        category,
        fileSize: fileSize || '1.0 MB',
        fileUrl: fileUrl || null,
        targetDepartments: selectedDepts,
      };

      if (editDocument) {
        // Update existing document
        await api.put(
          `/api/documents/${editDocument.id}`,
          documentData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('Đã cập nhật tài liệu thành công!');
        }
      } else {
        // Create new document
        await api.post(
          '/api/documents',
          documentData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('Đã thêm tài liệu thành công!');
        }
      }

      onSuccess();
      handleReset();
    } catch (error: any) {
      console.error('Error saving document:', error);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(error.response?.data?.detail || 'Không thể lưu tài liệu');
      }
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setCategory('Nội quy');
    setFileSize('');
    setFileUrl('');
    setSelectedDepts(['ALL']);
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
              {editDocument ? 'Chỉnh sửa tài liệu' : 'Thêm tài liệu mới'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.label}>Tên tài liệu *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Nhập tên tài liệu"
              placeholderTextColor="#94a3b8"
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

            <Text style={styles.label}>Kích thước file (VD: 2.5 MB)</Text>
            <TextInput
              style={styles.input}
              value={fileSize}
              onChangeText={setFileSize}
              placeholder="VD: 2.5 MB"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.label}>Link tài liệu (URL)</Text>
            <TextInput
              style={styles.input}
              value={fileUrl}
              onChangeText={setFileUrl}
              placeholder="VD: https://drive.google.com/..."
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="url"
            />

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

            <View style={styles.note}>
              <Text style={styles.noteText}>💡 Lưu ý: Đây là tài liệu demo. Trong phiên bản thực tế, bạn có thể upload file PDF, Word, v.v.</Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Đang thêm...' : 'Thêm tài liệu'}
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
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
  },
  categoryButtonActive: {
    backgroundColor: '#0891b2',
    borderColor: '#0891b2',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#64748b',
  },
  categoryButtonTextActive: {
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
  note: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  noteText: {
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
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