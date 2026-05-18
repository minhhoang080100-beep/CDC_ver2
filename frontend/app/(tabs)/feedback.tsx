import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Image,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Send, MessageCircle, ChevronRight, Paperclip, ImagePlus, FileText, X, Link as LinkIcon } from 'lucide-react-native';
import { format } from 'date-fns';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { api } from '../../utils/api';
import { useResponsive } from '../../hooks/useResponsive';
import { useToast } from '../../contexts/ToastContext';
import { Colors } from '../../constants/Colors';

interface Feedback {
  id: string;
  subject: string;
  content: string;
  senderName?: string;
  senderAvatar?: string | null;
  senderDepartment?: string;
  isAnonymous: boolean;
  status: string;
  replies: Array<{
    userName: string;
    userAvatar?: string | null;
    content: string;
    repliedAt: string;
  }>;
  attachedFiles?: string[];
  createdAt: string;
}

export default function FeedbackScreen() {
  const { user, token } = useAuth();
  const { isDesktop } = useResponsive();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'send' | 'view'>('send');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const [attachments, setAttachments] = useState<{name: string, url: string, type: 'image' | 'document'}[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const CLOUD_NAME = 'dljjearo2';
  const UPLOAD_PRESET = 'CDCnghetinh';

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
        selectionLimit: 5,
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingImage(true);
        try {
          for (const asset of result.assets) {
            const base64Img = `data:image/jpeg;base64,${asset.base64}`;
            const formData = new FormData();
            formData.append('file', base64Img);
            formData.append('upload_preset', UPLOAD_PRESET);
            formData.append('folder', 'cong-doan-feedback');

            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
              method: 'POST',
              body: formData,
            });
            const data = await response.json();
            if (data.secure_url) {
              setAttachments(prev => [...prev, { name: 'Hình ảnh đính kèm', url: data.secure_url, type: 'image' }]);
            }
          }
        } catch (error) {
          console.error("Lỗi upload nhiều ảnh:", error);
          showToast({ message: 'Lỗi tải ảnh', type: 'error' });
        } finally {
          setUploadingImage(false);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      showToast({ message: 'Không thể chọn ảnh', type: 'error' });
    }
  };

  const pickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets?.length) return;

            const file = result.assets[0];
            setUploadingDoc(true);

            const formData = new FormData();

            if (Platform.OS === 'web') {
                if ((file as any).file) {
                    formData.append('file', (file as any).file);
                } else {
                    try {
                        const res = await fetch(file.uri);
                        const blob = await res.blob();
                        formData.append('file', blob, file.name || 'document.pdf');
                    } catch {
                        formData.append('file', file.uri);
                    }
                }
            } else {
                formData.append('file', {
                    uri: file.uri,
                    name: file.name || 'document.pdf',
                    type: file.mimeType || 'application/pdf',
                } as any);
            }

            formData.append('upload_preset', UPLOAD_PRESET);
            formData.append('folder', 'cong-doan-feedback');

            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (data.secure_url) {
                setAttachments(prev => [...prev, {
                    name: file.name || 'Tài liệu đính kèm',
                    url: data.secure_url,
                    type: 'document'
                }]);
            }
        } catch (error) {
            console.error('Upload error:', error);
            showToast({ message: 'Lỗi tải tài liệu', type: 'error' });
        } finally {
            setUploadingDoc(false);
        }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    if (activeTab === 'view') {
      fetchFeedback();
    }
  }, [activeTab]);

  const fetchFeedback = async () => {
    setListLoading(true);
    try {
      const response = await api.get('/api/feedback?mine=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFeedbackList(response.data?.items || response.data || []);
    } catch (error: any) {
      console.error('Error fetching feedback:', error);
      showToast({ message: error.detail || 'Không thể tải phản hồi', type: 'error' });
    } finally {
      setListLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !content.trim()) {
      showToast({ message: 'Vui lòng nhập đầy đủ thông tin', type: 'error' });
      return;
    }

    setLoading(true);
    try {
      await api.post(
        '/api/feedback',
        {
          subject,
          content,
          isAnonymous,
          attachedFiles: attachments.map(a => a.url)
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showToast({ message: 'Cảm ơn bạn đã đóng góp ý kiến!', type: 'success' });
      setSubject('');
      setContent('');
      setIsAnonymous(false);
      setAttachments([]);
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      showToast({ message: error.detail || 'Không thể gửi ý kiến', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim()) {
      showToast({ message: 'Vui lòng nhập nội dung trả lời', type: 'error' });
      return;
    }

    try {
      await api.post(
        `/api/feedback/${selectedFeedback?.id}/reply`,
        { content: replyContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showToast({ message: 'Đã gửi trả lời', type: 'success' });
      setReplyContent('');
      setModalVisible(false);
      fetchFeedback();
    } catch (error) {
      console.error('Error replying:', error);
      showToast({ message: 'Không thể gửi trả lời', type: 'error' });
    }
  };

  const canReply = user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_');

  const renderFeedback = ({ item }: { item: Feedback }) => (
    <TouchableOpacity
      style={styles.feedbackCard}
      onPress={() => {
        setSelectedFeedback(item);
        setModalVisible(true);
      }}
    >
      <View style={styles.feedbackHeader}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: item.status === 'REPLIED' ? '#dcfce7' : '#fef3c7' },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: item.status === 'REPLIED' ? '#10b981' : '#f59e0b' },
            ]}
          >
            {item.status === 'REPLIED' ? 'Đã trả lời' : 'Chờ xử lý'}
          </Text>
        </View>
        <ChevronRight color="#94a3b8" size={20} />
      </View>
      <Text style={styles.feedbackSubject}>{item.subject}</Text>
      <Text style={styles.feedbackContent} numberOfLines={2}>
        {item.content}
      </Text>
      <View style={styles.feedbackFooter}>
        <Text style={styles.feedbackSender}>
          {item.isAnonymous ? 'Ẩn danh' : item.senderName}
        </Text>
        <Text style={styles.feedbackDate}>
          {format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm')}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {item.attachedFiles && item.attachedFiles.length > 0 && (
          <View style={styles.replyIndicator}>
            <Paperclip color="#64748b" size={16} />
            <Text style={[styles.replyCount, { color: '#64748b' }]}>{item.attachedFiles.length} đính kèm</Text>
          </View>
        )}
        {item.replies.length > 0 && (
          <View style={styles.replyIndicator}>
            <MessageCircle color="#0891b2" size={16} />
            <Text style={styles.replyCount}>{item.replies.length} trả lời</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>


      <View style={[styles.tabContainer, isDesktop && { maxWidth: 680, alignSelf: 'center' as any, width: '100%' as any }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'send' && styles.activeTab]}
          onPress={() => setActiveTab('send')}
        >
          <Text style={[styles.tabText, activeTab === 'send' && styles.activeTabText]}>
            Gửi ý kiến
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'view' && styles.activeTab]}
          onPress={() => setActiveTab('view')}
        >
          <Text style={[styles.tabText, activeTab === 'view' && styles.activeTabText]}>
            Xem ý kiến đã gửi
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'send' ? (
        <KeyboardAvoidingView
          style={styles.formContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={[styles.formContent, isDesktop && { maxWidth: 680, alignSelf: 'center', width: '100%' }]}>
            <Text style={styles.label}>Tiêu đề</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Nhập tiêu đề ý kiến"
              placeholderTextColor="#94a3b8"
            />

            <Text style={styles.label}>Nội dung</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={content}
              onChangeText={setContent}
              placeholder="Nhập nội dung ý kiến của bạn"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />

            <View style={styles.switchContainer}>
              <Text style={styles.switchLabel}>Gửi ẩn danh</Text>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: '#cbd5e1', true: Colors.primary }}
                thumbColor={isAnonymous ? '#ffffff' : '#f4f4f5'}
              />
            </View>

            <Text style={[styles.label, {marginTop: 16, marginBottom: 12}]}>Đính kèm (Tuỳ chọn)</Text>
            
            {attachments.length > 0 && (
              <ScrollView horizontal style={styles.attachmentsPreviewContainer} showsHorizontalScrollIndicator={false}>
                {attachments.map((att, index) => (
                  <View key={index} style={styles.attachmentPreview}>
                    {att.type === 'image' ? (
                      <Image source={{ uri: att.url }} style={styles.attachmentImage} />
                    ) : (
                      <View style={styles.attachmentDoc}>
                        <FileText color={Colors.primary} size={24} />
                        <Text style={styles.attachmentDocText} numberOfLines={2}>{att.name}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.removeAttachmentBtn} onPress={() => removeAttachment(index)}>
                      <X color="#fff" size={14} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}

            <View style={styles.attachmentsActionRow}>
              <TouchableOpacity style={styles.attachmentBtn} onPress={pickImage} disabled={uploadingImage || uploadingDoc}>
                {uploadingImage ? <ActivityIndicator size="small" color={Colors.primary} /> : <ImagePlus color={Colors.primary} size={20} />}
                <Text style={styles.attachmentBtnText}>Thêm hình ảnh</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.attachmentBtn} onPress={pickDocument} disabled={uploadingImage || uploadingDoc}>
                {uploadingDoc ? <ActivityIndicator size="small" color={Colors.primary} /> : <FileText color={Colors.primary} size={20} />}
                <Text style={styles.attachmentBtnText}>Thêm tài liệu</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, (loading || uploadingImage || uploadingDoc) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading || uploadingImage || uploadingDoc}
            >
              <Send color="#ffffff" size={20} />
              <Text style={styles.submitButtonText}>
                {loading ? 'Đang gửi...' : 'Gửi ý kiến'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <FlatList
          data={feedbackList}
          renderItem={renderFeedback}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, isDesktop && { maxWidth: 680, alignSelf: 'center' as any, width: '100%' as any }]}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Chưa có ý kiến nào</Text>
            </View>
          }
        />
      )}

      {/* Feedback Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết ý kiến</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedFeedback && (
                <>
                  <Text style={styles.modalSubject}>{selectedFeedback.subject}</Text>
                  <Text style={styles.modalText}>{selectedFeedback.content}</Text>
                  <View style={styles.modalSenderRow}>
                    <View style={styles.modalSenderAvatar}>
                      {selectedFeedback.senderAvatar ? (
                        <Image source={{ uri: selectedFeedback.senderAvatar }} style={styles.modalSenderAvatarImage} />
                      ) : (
                        <Text style={styles.modalSenderAvatarText}>
                          {(selectedFeedback.isAnonymous ? 'A' : selectedFeedback.senderName?.charAt(0)?.toUpperCase()) || 'U'}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.modalSender}>
                      Từ: {selectedFeedback.isAnonymous ? 'Ẩn danh' : selectedFeedback.senderName}
                    </Text>
                  </View>
                  <Text style={styles.modalDate}>
                    {format(new Date(selectedFeedback.createdAt), 'dd/MM/yyyy HH:mm')}
                  </Text>

                  {selectedFeedback.attachedFiles && selectedFeedback.attachedFiles.length > 0 && (
                    <View style={styles.modalAttachments}>
                      <Text style={styles.modalAttachmentsTitle}>Đính kèm:</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                        {selectedFeedback.attachedFiles.map((url, i) => {
                          const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.includes('/image/upload');
                          if (isImage) {
                            return (
                              <TouchableOpacity key={i} onPress={() => Linking.openURL(url)} style={styles.modalAttachmentImageContainer}>
                                <Image source={{uri: url}} style={styles.modalAttachmentImage} />
                              </TouchableOpacity>
                            );
                          }
                          return (
                            <TouchableOpacity key={i} style={styles.modalAttachmentDoc} onPress={() => Linking.openURL(url)}>
                              <LinkIcon color={Colors.primary} size={16} />
                              <Text style={styles.modalAttachmentDocText} numberOfLines={1}>Tài liệu đính kèm {i+1}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {selectedFeedback.replies.length > 0 && (
                    <View style={styles.repliesSection}>
                      <Text style={styles.repliesTitle}>Trả lời:</Text>
                      {selectedFeedback.replies.map((reply, index) => (
                        <View key={index} style={styles.replyItem}>
                          <View style={styles.replyHeader}>
                            <View style={styles.replyAvatar}>
                              {reply.userAvatar ? (
                                <Image source={{ uri: reply.userAvatar }} style={styles.replyAvatarImage} />
                              ) : (
                                <Text style={styles.replyAvatarText}>{reply.userName?.charAt(0)?.toUpperCase() || 'U'}</Text>
                              )}
                            </View>
                            <Text style={styles.replyAuthor}>{reply.userName}</Text>
                          </View>
                          <Text style={styles.replyContent}>{reply.content}</Text>
                          <Text style={styles.replyDate}>
                            {format(new Date(reply.repliedAt), 'dd/MM/yyyy HH:mm')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {canReply && (
                    <View style={styles.replyForm}>
                      <Text style={styles.replyLabel}>Trả lời ý kiến:</Text>
                      <TextInput
                        style={[styles.input, styles.replyInput]}
                        value={replyContent}
                        onChangeText={setReplyContent}
                        placeholder="Nhập nội dung trả lời"
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                      />
                      <TouchableOpacity style={styles.replyButton} onPress={handleReply}>
                        <Text style={styles.replyButtonText}>Gửi trả lời</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerDesktop: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  headerTitleFB: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#050505',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748b',
  },
  activeTabText: {
    color: '#0f172a',
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  textArea: {
    height: 150,
    paddingTop: 12,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  submitButton: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 8,
  },
  listContent: {
    padding: 16,
  },
  feedbackCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border + '40',
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  feedbackSubject: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  feedbackContent: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 12,
  },
  feedbackFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 12,
  },
  feedbackSender: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  feedbackDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  replyIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  replyCount: {
    fontSize: 13,
    color: '#0891b2',
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
  },
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
  modalSubject: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#475569',
    lineHeight: 24,
    marginBottom: 16,
  },
  modalSenderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  modalSenderAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modalSenderAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modalSenderAvatarText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '800',
  },
  modalSender: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  modalDate: {
    fontSize: 13,
    color: '#94a3b8',
  },
  repliesSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  repliesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  replyItem: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  replyAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  replyAvatarText: {
    color: '#0891b2',
    fontSize: 12,
    fontWeight: '800',
  },
  replyAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0891b2',
    flex: 1,
  },
  replyContent: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 8,
  },
  replyDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  replyForm: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  replyLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  replyInput: {
    height: 100,
    paddingTop: 12,
    marginBottom: 16,
  },
  replyButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  replyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  attachmentsPreviewContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  attachmentPreview: {
    width: 80,
    height: 80,
    marginRight: 12,
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  attachmentDoc: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  attachmentDocText: {
    fontSize: 10,
    textAlign: 'center',
    color: '#64748b',
    marginTop: 4,
  },
  removeAttachmentBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    padding: 2,
  },
  attachmentsActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  attachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    justifyContent: 'center',
    gap: 8,
  },
  attachmentBtnText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  modalAttachments: {
    marginTop: 16,
    marginBottom: 8,
  },
  modalAttachmentsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
  },
  modalAttachmentImageContainer: {
    width: 100,
    height: 100,
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalAttachmentImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  modalAttachmentDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    gap: 8,
    maxWidth: 200,
  },
  modalAttachmentDocText: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
});
