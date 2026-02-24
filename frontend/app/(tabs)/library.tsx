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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { FileText, Search, Plus, Edit2, Trash2 } from 'lucide-react-native';
import CreateDocumentModal from '../../components/CreateDocumentModal';
import WebHoverCard from '../../components/WebHoverCard';
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

export default function LibraryScreen() {
  const { user, token } = useAuth();
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
      setDocuments(response.data);
      setFilteredDocs(response.data);
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
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Bạn có chắc muốn xóa tài liệu này?')) {
        try {
          await api.delete(`/api/documents/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          fetchDocuments();
        } catch (error: any) {
          console.error('Error deleting document:', error);
          window.alert(error.response?.data?.detail || 'Không thể xóa tài liệu');
        }
      }
    }
  };

  const renderDocument = ({ item }: { item: Document }) => (
    <WebHoverCard style={styles.docCard}>
      <View style={styles.docMain}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: getCategoryColor(item.category) + '20' },
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
            <Text style={styles.docMetaText}>Đăng bởi: {item.uploadedBy} • {item.createdAt ? format(new Date(item.createdAt), 'dd/MM/yyyy') : 'N/A'}</Text>
          </View>
        </View>
      </View>
      {item.fileUrl && (
        <TouchableOpacity
          style={styles.openDocButton}
          onPress={() => {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              window.open(item.fileUrl!, '_blank');
            } else {
              Linking.openURL(item.fileUrl!);
            }
          }}
        >
          <Text style={styles.openDocButtonText}>📄 Mở tài liệu</Text>
        </TouchableOpacity>
      )}
      {canEditDelete(item) && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleEdit(item)}
          >
            <Edit2 color="#3b82f6" size={18} />
            <Text style={styles.actionTextEdit}>Sửa</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDelete(item.id)}
          >
            <Trash2 color="#ef4444" size={18} />
            <Text style={styles.actionTextDelete}>Xóa</Text>
          </TouchableOpacity>
        </View>
      )}
    </WebHoverCard>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>THƯ VIỆN SỐ</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
        <Text style={styles.headerTitle}>THƯ VIỆN SỐ</Text>
        {canCreateDocument && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              setEditingDocument(null);
              setModalVisible(true);
            }}
          >
            <Plus color="#ffffff" size={24} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.searchContainer}>
        <Search color="#64748b" size={20} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Tìm kiếm tài liệu..."
          placeholderTextColor="#94a3b8"
        />
      </View>
      <FlatList
        data={filteredDocs}
        renderItem={renderDocument}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, isDesktop && { maxWidth: 1000, alignSelf: 'center' as any, width: '100%' as any }]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchDocuments}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
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
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  addButton: {
    width: 40,
    height: 40,
    backgroundColor: '#0891b2',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerDesktop: {
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#0f172a',
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
    width: '100%',
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
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
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
  openDocButton: {
    backgroundColor: '#eef2ff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  openDocButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4f46e5',
  },

});