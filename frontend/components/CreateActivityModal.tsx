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

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState('TRAINING');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['ALL']);
  const [loading, setLoading] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (editActivity) {
      setName(editActivity.name);
      setDescription(editActivity.description);
      setTime(editActivity.time);
      setLocation(editActivity.location);
      setType(editActivity.type);
      setSelectedDepts(editActivity.targetDepartments || ['ALL']);
    } else {
      handleReset();
    }
  }, [editActivity, visible]);

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
    if (!name.trim() || !time.trim() || !location.trim()) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Vui lòng nhập đầy đủ thông tin');
      }
      return;
    }

    setLoading(true);
    try {
      const activityData = {
        name,
        description,
        time,
        location,
        type,
        targetDepartments: selectedDepts,
      };

      if (editActivity) {
        // Update existing activity
        await axios.put(
          `${EXPO_PUBLIC_BACKEND_URL}/api/activities/${editActivity.id}`,
          activityData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('Đã cập nhật hoạt động thành công!');
        }
      } else {
        // Create new activity
        await axios.post(
          `${EXPO_PUBLIC_BACKEND_URL}/api/activities`,
          activityData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('Đã tạo hoạt động thành công!');
        }
      }
      
      onSuccess();
      handleReset();
    } catch (error: any) {
      console.error('Error saving activity:', error);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(error.response?.data?.detail || 'Không thể lưu hoạt động');
      }
      setLoading(false);
    }
  };

  const handleReset = () => {
    setName('');
    setDescription('');
    setTime('');
    setLocation('');
    setType('TRAINING');
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
              {editActivity ? 'Chỉnh sửa hoạt động' : 'Tạo hoạt động mới'}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.label}>Tên hoạt động *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Nhập tên hoạt động"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.label}>Mô tả</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Nhập mô tả hoạt động"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <Text style={styles.label}>Thời gian *</Text>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder="VD: 15/08/2025 08:00"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.label}>Địa điểm *</Text>
            <TextInput
              style={styles.input}
              value={location}
              onChangeText={setLocation}
              placeholder="Nhập địa điểm"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.label}>Loại hoạt động</Text>
            <View style={styles.typeContainer}>
              {types.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.typeButton,
                    type === t.value && styles.typeButtonActive,
                  ]}
                  onPress={() => setType(t.value)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      type === t.value && styles.typeButtonTextActive,
                    ]}
                  >
                    {t.label}
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
                {loading ? 'Đang tạo...' : 'Tạo hoạt động'}
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
    backgroundColor: '#ffffff',
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