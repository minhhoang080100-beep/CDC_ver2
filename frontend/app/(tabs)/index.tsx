import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { format } from 'date-fns';
import { Plus, Edit2, Trash2 } from 'lucide-react-native';
import CreatePostModal from '../../components/CreatePostModal';
import { Colors } from '../../constants/Colors';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Post {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  image?: string;
  authorId: string;
  authorName: string;
  authorDepartment: string;
  targetDepartments: string[];
  createdAt: string;
  updatedAt: string;
}

export default function HomeScreen() {
  const { user, token } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const response = await axios.get(`${EXPO_PUBLIC_BACKEND_URL}/api/posts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPosts(response.data);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchPosts();
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Chính sách':
        return Colors.status.error;
      case 'Hoạt động':
        return Colors.status.success;
      case 'Thông báo':
        return Colors.status.warning;
      default:
        return Colors.status.info;
    }
  };

  const canCreatePost = user?.role === 'SUPER_ADMIN' || user?.role?.startsWith('BCH_');

  const canEditDelete = (post: Post) => {
    return user?.role === 'SUPER_ADMIN' || post.authorId === user?.id;
  };

  const handleCreateSuccess = () => {
    fetchPosts();
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Bạn có chắc muốn xóa bài viết này?')) {
        try {
          await axios.delete(`${EXPO_PUBLIC_BACKEND_URL}/api/posts/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          fetchPosts();
        } catch (error) {
          console.error('Error deleting post:', error);
          window.alert('Không thể xóa bài viết');
        }
      }
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      {item.image && (
        <Image source={{ uri: item.image }} style={styles.postImage} />
      )}
      <View style={styles.postContent}>
        <View style={styles.postHeader}>
          <View
            style={[
              styles.categoryBadge,
              { backgroundColor: getCategoryColor(item.category) },
            ]}
          >
            <Text style={styles.categoryText}>{item.category}</Text>
          </View>
          <Text style={styles.postDate}>
            {format(new Date(item.createdAt), 'dd/MM/yyyy')}
          </Text>
        </View>
        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postSummary}>{item.summary}</Text>
        <View style={styles.postFooter}>
          <Text style={styles.postAuthor}>
            {item.authorName} - {getDepartmentName(item.authorDepartment)}
          </Text>
        </View>
        {canEditDelete(item) && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleEdit(item)}
            >
              <Edit2 color="#3b82f6" size={20} />
              <Text style={styles.actionTextEdit}>Sửa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleDelete(item.id)}
            >
              <Trash2 color="#ef4444" size={20} />
              <Text style={styles.actionTextDelete}>Xóa</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );

  const getDepartmentName = (dept: string) => {
    switch (dept) {
      case 'VAN_PHONG_CANG':
        return 'Văn phòng Cảng';
      case 'CUA_LO':
        return 'Cửa Lò';
      case 'BEN_THUY':
        return 'Bến Thủy';
      default:
        return dept;
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>BẢNG TIN CÔNG ĐOÀN</Text>
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
        <Text style={styles.headerTitle}>BẢNG TIN CÔNG ĐOÀN</Text>
        {canCreatePost && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <Plus color={Colors.text.light} size={24} />
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0891b2']}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Chưa có bài viết nào</Text>
          </View>
        }
      />

      <CreatePostModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setEditingPost(null);
        }}
        onSuccess={handleCreateSuccess}
        editPost={editingPost}
      />
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
    backgroundColor: Colors.header.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.header.text,
    letterSpacing: 1,
  },
  addButton: {
    width: 40,
    height: 40,
    backgroundColor: Colors.primary,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  listContent: {
    padding: 16,
  },
  postCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  postImage: {
    width: '100%',
    height: 200,
    backgroundColor: Colors.divider,
  },
  postContent: {
    padding: 16,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text.light,
  },
  postDate: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  postTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  postSummary: {
    fontSize: 14,
    color: Colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  postFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 12,
  },
  postAuthor: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.placeholder,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
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
    color: Colors.status.info,
    fontWeight: '600',
  },
  actionTextDelete: {
    fontSize: 14,
    color: Colors.status.error,
    fontWeight: '600',
  },
});