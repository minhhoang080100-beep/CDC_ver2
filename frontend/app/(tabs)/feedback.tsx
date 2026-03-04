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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Send, MessageCircle, ChevronRight } from 'lucide-react-native';
import { format } from 'date-fns';
import { api } from '../../utils/api';
import { useResponsive } from '../../hooks/useResponsive';
import { useToast } from '../../contexts/ToastContext';

interface Feedback {
  id: string;
  subject: string;
  content: string;
  senderName?: string;
  senderDepartment?: string;
  isAnonymous: boolean;
  status: string;
  replies: Array<{
    userName: string;
    content: string;
    repliedAt: string;
  }>;
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

  useEffect(() => {
    if (activeTab === 'view') {
      fetchFeedback();
    }
  }, [activeTab]);

  const fetchFeedback = async () => {
    setListLoading(true);
    try {
      const response = await api.get('/api/feedback', {
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
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      showToast({ message: 'Cảm ơn bạn đã đóng góp ý kiến!', type: 'success' });
      setSubject('');
      setContent('');
      setIsAnonymous(false);
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
      {item.replies.length > 0 && (
        <View style={styles.replyIndicator}>
          <MessageCircle color="#0891b2" size={16} />
          <Text style={styles.replyCount}>{item.replies.length} trả lời</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LẮNG NGHE & PHẢN HỒI</Text>
      </View>

      <View style={[styles.tabContainer, isDesktop && { maxWidth: 800, alignSelf: 'center' as any, width: '100%' as any }]}>
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
          <ScrollView contentContainerStyle={styles.formContent}>
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
                trackColor={{ false: '#cbd5e1', true: '#0891b2' }}
                thumbColor={isAnonymous ? '#ffffff' : '#f4f4f5'}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
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
          contentContainerStyle={styles.listContent}
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
                  <Text style={styles.modalSender}>
                    Từ: {selectedFeedback.isAnonymous ? 'Ẩn danh' : selectedFeedback.senderName}
                  </Text>
                  <Text style={styles.modalDate}>
                    {format(new Date(selectedFeedback.createdAt), 'dd/MM/yyyy HH:mm')}
                  </Text>

                  {selectedFeedback.replies.length > 0 && (
                    <View style={styles.repliesSection}>
                      <Text style={styles.repliesTitle}>Trả lời:</Text>
                      {selectedFeedback.replies.map((reply, index) => (
                        <View key={index} style={styles.replyItem}>
                          <Text style={styles.replyAuthor}>{reply.userName}</Text>
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
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 1,
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
    backgroundColor: '#0891b2',
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
  modalSender: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
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
  replyAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0891b2',
    marginBottom: 8,
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
    backgroundColor: '#0891b2',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  replyButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});
