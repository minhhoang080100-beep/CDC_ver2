import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
  Linking,
  RefreshControl,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { FileText, Search, Plus, Edit2, Trash2, Download, User } from 'lucide-react-native';
import CreateDocumentModal from '../../components/CreateDocumentModal';
import WebHoverCard from '../../components/WebHoverCard';
import { useConfirm } from '../../contexts/ConfirmContext';
import { format } from 'date-fns';
import { api } from '../../utils/api';

interface Document {
  id: string;
  title: string;
  category: string;
  fileSize: string;
  fileUrl?: string;
  uploadedBy: string;
  targetDepartments: string[];
  createdAt: string;
}

const SkeletonLoader = ({ isDesktop, gridColumns }: { isDesktop: boolean; gridColumns: number }) => {
  const animatedValue = React.useRef(new Animated.Value(0.5)).current;

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0.5,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const renderSkeletonItem = (item: number) => (
    <Animated.View style={[styles.docCard, isDesktop && styles.docCardDesktop, { opacity: animatedValue, marginBottom: isDesktop ? 16 : 12 }]} key={item}>
      <View style={[styles.docMain, isDesktop && { flex: 1 }]}>
        <View style={[styles.iconContainer, { backgroundColor: Colors.divider }]} />
        <View style={styles.docContent}>
          <View style={{ width: '80%', height: 20, backgroundColor: Colors.divider, borderRadius: 4, marginBottom: 8 }} />
          <View style={{ width: '60%', height: 16, backgroundColor: Colors.divider, borderRadius: 4, marginBottom: 8 }} />
          <View style={{ width: '90%', height: 16, backgroundColor: Colors.divider, borderRadius: 4 }} />
        </View>
      </View>
      {isDesktop && (
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginLeft: 16 }}>
          <View style={{ width: 100, height: 36, backgroundColor: Colors.divider, borderRadius: 20 }} />
          <View style={{ width: 32, height: 32, backgroundColor: Colors.divider, borderRadius: 16 }} />
          <View style={{ width: 32, height: 32, backgroundColor: Colors.divider, borderRadius: 16 }} />
        </View>
      )}
    </Animated.View>
  );

  return (
    <View style={[styles.listContent, isDesktop && { maxWidth: 680, alignSelf: 'center', width: '100%' }]}>
      <View style={{ flexDirection: 'column', gap: 16 }}>
        {[1, 2, 3, 4].map(renderSkeletonItem)}
      </View>
    </View>
  );
};

export default function LibraryScreen() {
  const { user, token } = useAuth();
  const { showConfirm } = useConfirm();
  const { showToast } = useToast();
  const { gridColumns, isDesktop } = useResponsive();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    filterDocuments();
  }, [searchQuery, documents]);

  const fetchDocuments = async () => {
    try {
      const response = await api.get('/api/documents', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const docs = response.data?.items || response.data || [];
      setDocuments(docs);
      setFilteredDocs(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSuccess = () => {
    fetchDocuments();
  };

  const filterDocuments = () => {
    if (!searchQuery) {
      setFilteredDocs(documents);
      return;
    }
    const filtered = documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredDocs(filtered);
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Thỏa ước lao động':
        return '#ef4444';
      case 'Nội quy':
        return '#f59e0b';
      case 'An toàn':
        return '#10b981';
      default:
        return '#6366f1';
    }
  };

  const canCreateDocument = user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_');

  // Permission check: SUPER_ADMIN can edit/delete any doc, others can only edit/delete their own
  const canEditDelete = (doc: Document) => {
    return user?.role === 'SUPER_ADMIN' || doc.uploadedBy === user?.id;
  };

  const handleEdit = (doc: Document) => {
    setEditingDocument(doc);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    showConfirm({
      title: 'Xóa tài liệu',
      message: 'Tài liệu này sẽ bị xóa khỏi hệ thống. Bạn có chắc chắn muốn tiếp tục không?',
      type: 'danger',
      confirmText: 'Xóa tài liệu',
      onConfirm: async () => {
        try {
          await api.delete(`/api/documents/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          showToast({ message: 'Tài liệu đã được xóa', type: 'success' });
          fetchDocuments(); // Refresh list after deletion
        } catch (error) {
          console.error('Error deleting document:', error);
          showToast({ message: 'Không thể xóa tài liệu. Thử lại sau.', type: 'error' });
        }
      }
    });
  };

  const handleDownload = (url: string, title: string) => {
    let downloadUrl = url;
    // Add fl_attachment to force download on cloudinary
    if (url.includes('cloudinary.com') && url.includes('/upload/')) {
      downloadUrl = url.replace('/upload/', '/upload/fl_attachment/');
    }
    
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.setAttribute('download', title);
        a.click();
    } else {
        Linking.openURL(downloadUrl);
    }
  };

  const renderDocument = ({ item }: { item: Document }) => (
    <View style={{ flex: 1 }}>
      <WebHoverCard style={[styles.docCard, isDesktop && styles.docCardDesktop]}>
        <View style={[styles.docMain, isDesktop && { flex: 1 }]}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: getCategoryColor(item.category) + '15' },
            ]}
          >
            <FileText color={getCategoryColor(item.category)} size={32} />
          </View>
          <View style={styles.docContent}>
            <Text style={styles.docTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <View style={styles.docMetaRow}>
              <Text style={styles.docMetaText}>{item.category} • {item.fileSize}</Text>
            </View>
            <View style={styles.docMetaRow}>
              <Text style={styles.docMetaText} numberOfLines={1}>Đăng bởi: {item.uploadedBy} • {item.createdAt ? format(new Date(item.createdAt), 'dd/MM/yyyy') : 'N/A'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.cardFooter, isDesktop && styles.cardFooterDesktop]}>
          <View style={[styles.actionsRowInline, isDesktop && styles.actionsRowInlineDesktop]}>
            {item.fileUrl && (
              isDesktop ? (
                <>
                  <TouchableOpacity
                    style={styles.actionIconBtnOpen}
                    onPress={() => {
                      if (Platform.OS === 'web' && typeof window !== 'undefined') {
                        window.open(item.fileUrl!, '_blank');
                      } else {
                        Linking.openURL(item.fileUrl!);
                      }
                    }}
                  >
                    <FileText color={Colors.primary} size={16} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionIconBtnDownload}
                    onPress={() => handleDownload(item.fileUrl!, item.title)}
                  >
                    <Download color="#10b981" size={16} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      if (Platform.OS === 'web' && typeof window !== 'undefined') {
                        window.open(item.fileUrl!, '_blank');
                      } else {
                        Linking.openURL(item.fileUrl!);
                      }
                    }}
                  >
                    <FileText color={Colors.primary} size={16} />
                    <Text style={styles.actionTextOpen}>Mở</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDownload(item.fileUrl!, item.title)}
                  >
                    <Download color="#10b981" size={16} />
                    <Text style={{ fontSize: 14, color: '#10b981', fontWeight: '600' }}>Tải</Text>
                  </TouchableOpacity>
                </>
              )
            )}

            {canEditDelete(item) && (
              isDesktop ? (
                <>
                  <TouchableOpacity
                    style={styles.actionIconBtnEdit}
                    onPress={() => handleEdit(item)}
                  >
                    <Edit2 color="#3b82f6" size={16} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionIconBtnDelete}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Trash2 color="#ef4444" size={16} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleEdit(item)}
                  >
                    <Edit2 color="#3b82f6" size={16} />
                    <Text style={styles.actionTextEdit}>Sửa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDelete(item.id)}
                  >
                    <Trash2 color="#ef4444" size={16} />
                    <Text style={styles.actionTextDelete}>Xóa</Text>
                  </TouchableOpacity>
                </>
              )
            )}
          </View>
        </View>
      </WebHoverCard>
    </View>
  );
  // Replaced by renderDocument content above

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.searchContainer, isDesktop && { maxWidth: 680, alignSelf: 'center', width: '100%', marginTop: 8 }]}>
          <Search color={Colors.text.placeholder} size={20} />
          <TextInput style={styles.searchInput} placeholder="Tìm kiếm tài liệu..." editable={false} />
        </View>
        <SkeletonLoader isDesktop={isDesktop} gridColumns={gridColumns} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>

      <FlatList
        data={filteredDocs}
        renderItem={renderDocument}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, isDesktop && { maxWidth: 680, alignSelf: 'center' as any, width: '100%' as any }, !isDesktop && { paddingBottom: 110 }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchDocuments}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        ListHeaderComponent={
          <>
            {/* Search Bar */}
            <View style={[styles.searchContainer, isDesktop && { marginTop: 8 }]}>
              <View style={styles.searchInputWrapper}>
                <Search color={Colors.text.placeholder} size={20} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Tìm kiếm tài liệu..."
                  placeholderTextColor={Colors.text.placeholder}
                />
              </View>
            </View>

            {canCreateDocument && (
              <View style={[isDesktop && { paddingTop: 8 }, !isDesktop && { paddingTop: 8, paddingHorizontal: 0 }]}>
                <TouchableOpacity 
                  style={[styles.createPostBox, isDesktop && { borderWidth: 1, borderColor: Colors.border + '40', borderRadius: 8 }]}
                  onPress={() => {
                    setEditingDocument(null);
                    setModalVisible(true);
                  }}
                >
                  <View pointerEvents="none" style={styles.createPostHeader}>
                    <View style={styles.avatarMini}>
                      <User size={24} color="#bac2c9" />
                    </View>
                    <View style={styles.createPostInput}>
                      <Text style={styles.createPostPlaceholder}>Thêm tài liệu mới...</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Không tìm thấy tài liệu</Text>
          </View>
        }
      />

      <CreateDocumentModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingDocument(null);
        }}
        onSuccess={handleCreateSuccess}
        editDocument={editingDocument}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  createPostBox: { backgroundColor: '#ffffff', padding: 16, marginBottom: 8 },
  createPostHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarMini: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e4e6eb', justifyContent: 'center', alignItems: 'center' },
  avatarMiniText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  createPostInput: { flex: 1, backgroundColor: '#f0f2f5', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
  createPostPlaceholder: { color: '#65676B', fontSize: 16 },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border + '40',
    ...Colors.shadows.sm,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
  },
  listContent: {
    padding: 16,
  },
  docCard: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  docCardDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  docMain: {
    flexDirection: 'row',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  docContent: {
    flex: 1,
    justifyContent: 'center',
  },
  docTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  docMetaText: {
    fontSize: 13,
    color: '#64748b',
  },
  cardFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  cardFooterDesktop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 0,
    paddingTop: 0,
    borderTopWidth: 0,
    marginLeft: 16,
    gap: 12,
  },
  actionsRowInline: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  actionsRowInlineDesktop: {
    marginTop: 0,
  },
  actionIconBtnOpen: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(8, 145, 178, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBtnDownload: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBtnEdit: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBtnDelete: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  actionTextOpen: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  actionTextEdit: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  actionTextDelete: {
    fontSize: 14,
    color: '#ef4444',
    fontWeight: '600',
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
});