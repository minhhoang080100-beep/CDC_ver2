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
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Colors } from '../constants/Colors';
import { api } from '../utils/api';
import * as DocumentPicker from 'expo-document-picker';
import { FileUp, X, FileText, CheckCircle } from 'lucide-react-native';

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
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Nội quy');
  const [fileSize, setFileSize] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['ALL']);
  const [loading, setLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const CLOUD_NAME = 'dljjearo2';
  const UPLOAD_PRESET = 'CDCnghetinh';

  // Pre-fill form when editing
  useEffect(() => {
    if (editDocument) {
      setTitle(editDocument.title);
      setCategory(editDocument.category);
      setFileSize(editDocument.fileSize);
      setFileUrl(editDocument.fileUrl || '');
      setFileName(editDocument.title || ''); // Fallback for name
      setSelectedDepts(editDocument.targetDepartments || ['ALL']);
    } else if (visible) {
      // Reset form fields without closing the modal
      setTitle('');
      setCategory('Nội quy');
      setFileSize('');
      setFileUrl('');
      setFileName('');
      setSelectedDepts(['ALL']);
      setLoading(false);
      setUploadingFile(false);
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

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*', // Allow all files, or specify pdf/doc etc.
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setFileName(file.name);

        // Convert the bytes to MB or KB
        if (file.size) {
          const mbSize = (file.size / (1024 * 1024)).toFixed(2);
          setFileSize(`${mbSize} MB`);
        }

        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, "")); // Strip extension for title default
        }

        await uploadToCloudinary(file);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      showToast({ message: 'Lỗi khi chọn tài liệu', type: 'error' });
    }
  };

  const uploadToCloudinary = async (fileObj: any) => {
    setUploadingFile(true);
    try {
      const formData = new FormData();

      if (Platform.OS === 'web' && fileObj.file) {
        // On web, fileObj.file is the actual HTML5 DOM File. This preserves bytes 100% perfectly.
        formData.append('file', fileObj.file);
      } else if (Platform.OS === 'web') {
        // Fallback: send the base64 data URI string directly to Cloudinary
        formData.append('file', fileObj.uri);
      } else {
        // React Native mobile approach
        formData.append('file', {
          uri: fileObj.uri,
          type: fileObj.mimeType || 'application/pdf',
          name: fileObj.name,
        } as any);
      }

      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'cong-doan-docs');

      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.secure_url) {
        setFileUrl(data.secure_url);
        showToast({ message: 'Tải tài liệu lên thành công!', type: 'success' });
      } else {
        throw new Error(data.error?.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Error uploading document to Cloudinary:', error);
      showToast({ message: 'Upload tài liệu thất bại', type: 'error' });
      setFileUrl('');
      setFileName('');
      setFileSize('');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast({ message: 'Vui lòng nhập tên tài liệu', type: 'error' });
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
        showToast({ message: 'Đã cập nhật tài liệu thành công!', type: 'success' });
      } else {
        // Create new document
        await api.post(
          '/api/documents',
          documentData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        showToast({ message: 'Đã thêm tài liệu thành công!', type: 'success' });
      }

      onSuccess();
      handleReset();
    } catch (error: any) {
      console.error('Error saving document:', error);
      showToast({
        message: error.response?.data?.detail || 'Không thể lưu tài liệu',
        type: 'error'
      });
      setLoading(false);
    }
  };

  const handleReset = () => {
    setTitle('');
    setCategory('Nội quy');
    setFileSize('');
    setFileUrl('');
    setFileName('');
    setSelectedDepts(['ALL']);
    setLoading(false);
    setUploadingFile(false);
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

            <Text style={styles.label}>Tệp Đính Kèm (Upload) *</Text>
            {fileUrl ? (
              <View style={styles.filePreviewContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                  <FileText color={Colors.status.success} size={32} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fileNameText} numberOfLines={1}>{fileName || 'Đã đính kèm tệp'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <CheckCircle color={Colors.status.success} size={14} />
                      <Text style={{ fontSize: 13, color: Colors.text.secondary, marginLeft: 4 }}>Đã tải lên • {fileSize}</Text>
                    </View>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.removeFileButton}
                  onPress={() => {
                    setFileUrl('');
                    setFileName('');
                    setFileSize('');
                  }}
                >
                  <X color={Colors.text.secondary} size={20} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.fileUploadButton}
                onPress={pickDocument}
                disabled={uploadingFile}
              >
                {uploadingFile ? (
                  <>
                    <ActivityIndicator color={Colors.primary} style={{ marginBottom: 8 }} />
                    <Text style={styles.fileUploadText}>Đang tải tệp lên máy chủ...</Text>
                  </>
                ) : (
                  <>
                    <FileUp color={Colors.primary} size={32} style={{ marginBottom: 8 }} />
                    <Text style={styles.fileUploadText}>Nhấn để chọn và tải tệp lên</Text>
                    <Text style={styles.fileUploadSubText}>Hỗ trợ PDF, Word, Excel, PPT...</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

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
              <Text style={styles.noteText}>💡 Tính năng hỗ trợ tải trực tiếp tài liệu lên Cloud. Sau khi lưu, tài liệu có thể được xem hoặc tải xuống trên mọi thiết bị.</Text>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, (loading || uploadingFile || !fileUrl) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading || uploadingFile || !fileUrl}
            >
              <Text style={styles.submitButtonText}>
                {loading ? 'Đang lưu...' : (editDocument ? 'Cập nhật tài liệu' : 'Thêm tài liệu')}
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
    color: '#ffffff',
  },
  fileUploadButton: {
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
  fileUploadText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  fileUploadSubText: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  filePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  fileNameText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  removeFileButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: Colors.divider,
  },
});