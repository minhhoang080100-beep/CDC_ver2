import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { FileText, Search, Plus } from 'lucide-react-native';
import CreateDocumentModal from '../../components/CreateDocumentModal';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Document {
  id: string;
  title: string;
  category: string;
  fileSize: string;
  uploadedBy: string;
  targetDepartments: string[];
}

export default function LibraryScreen() {
  const { user, token } = useAuth();
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
      const response = await axios.get(`${EXPO_PUBLIC_BACKEND_URL}/api/documents`, {
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

  const renderDocument = ({ item }: { item: Document }) => (
    <TouchableOpacity style={styles.docCard}>
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
        <Text style={styles.docCategory}>{item.category}</Text>
        <Text style={styles.docSize}>{item.fileSize}</Text>
      </View>
    </TouchableOpacity>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>THƯ VIỆN SỐ</Text>
        {canCreateDocument && (
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
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
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Không tìm thấy tài liệu</Text>
          </View>
        }
      />
      
      <CreateDocumentModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={handleCreateSuccess}
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
    flexDirection: 'row',
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
  docCategory: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  docSize: {
    fontSize: 12,
    color: '#94a3b8',
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