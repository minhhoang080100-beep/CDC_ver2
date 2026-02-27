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
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useResponsive } from '../../hooks/useResponsive';
import { format } from 'date-fns';
import { Plus, Edit2, Trash2, Heart, MessageCircle } from 'lucide-react-native';
import CreatePostModal from '../../components/CreatePostModal';
import WebHoverCard from '../../components/WebHoverCard';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';

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
  likes?: string[];
  comments?: any[];
  createdAt: string;
  updatedAt: string;
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
    <Animated.View style={[styles.postCard, { opacity: animatedValue }, isDesktop && styles.postCardDesktop, { marginBottom: isDesktop ? 16 : 12 }]} key={item}>
      <View style={[styles.postImage, isDesktop && styles.postImageDesktop, { backgroundColor: Colors.divider }]} />
      <View style={[styles.postContent, isDesktop && styles.postContentDesktop]}>
        <View style={{ width: 80, height: 24, backgroundColor: Colors.divider, borderRadius: 12, marginBottom: 12 }} />
        <View style={{ width: '80%', height: 20, backgroundColor: Colors.divider, borderRadius: 4, marginBottom: 8 }} />
        <View style={{ width: '100%', height: 16, backgroundColor: Colors.divider, borderRadius: 4, marginBottom: 4 }} />
        <View style={{ width: '90%', height: 16, backgroundColor: Colors.divider, borderRadius: 4, marginBottom: 16 }} />
        <View style={{ width: 120, height: 16, backgroundColor: Colors.divider, borderRadius: 4 }} />
      </View>
    </Animated.View>
  );

  return (
    <View style={[styles.listContent, isDesktop && { maxWidth: 1000, alignSelf: 'center', width: '100%' }]}>
      <View style={{ flexDirection: isDesktop || gridColumns > 1 ? 'row' : 'column', flexWrap: 'wrap', gap: 16 }}>
        {[1, 2, 3, 4].map(renderSkeletonItem)}
      </View>
    </View>
  );
};

export default function HomeScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const { gridColumns, isDesktop } = useResponsive();
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
      const response = await api.get('/api/posts', {
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
          await api.delete(`/api/posts/${id}`, {
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
    <TouchableOpacity
      style={{ flex: 1 }}
      activeOpacity={0.7}
      onPress={() => {
        router.push({
          pathname: '/(tabs)/post-detail' as any,
          params: {
            title: item.title,
            content: item.content,
            summary: item.summary,
            category: item.category,
            authorName: item.authorName,
            createdAt: item.createdAt,
            image: item.image,
            id: item.id,
            likes: item.likes ? JSON.stringify(item.likes) : '[]',
            comments: item.comments ? JSON.stringify(item.comments) : '[]',
          },
        });
      }}
    >
      <WebHoverCard style={[styles.postCard, isDesktop && styles.postCardDesktop]}>
        {item.image && (
          <Image source={{ uri: item.image }} style={[styles.postImage, isDesktop && styles.postImageDesktop]} />
        )}
        <View style={[styles.postContent, isDesktop && styles.postContentDesktop]}>
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
          <Text style={[styles.postTitle, isDesktop && styles.postTitleDesktop]} numberOfLines={2}>{item.title}</Text>
          <Text style={[styles.postSummary, isDesktop && { marginBottom: 4 }]} numberOfLines={isDesktop ? 1 : 3}>{item.summary}</Text>
          <View style={[styles.postFooter, isDesktop && styles.postFooterDesktop]}>
            <Text style={styles.postAuthor} numberOfLines={1}>
              {item.authorName} - {getDepartmentName(item.authorDepartment)}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Heart size={16} color={item.likes?.includes(user?.id || '') ? Colors.status.error : Colors.text.secondary} fill={item.likes?.includes(user?.id || '') ? Colors.status.error : 'transparent'} />
                <Text style={{ fontSize: 13, color: Colors.text.secondary, fontWeight: '500' }}>{item.likes?.length || 0}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MessageCircle size={16} color={Colors.text.secondary} />
                <Text style={{ fontSize: 13, color: Colors.text.secondary, fontWeight: '500' }}>{item.comments?.length || 0}</Text>
              </View>
            </View>

            {isDesktop && canEditDelete(item) && (
              <View style={styles.actionsRowInline}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEdit(item)}
                >
                  <Edit2 color="#3b82f6" size={16} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDelete(item.id)}
                >
                  <Trash2 color="#ef4444" size={16} />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {(!isDesktop) && canEditDelete(item) && (
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
        </View>
      </WebHoverCard>
    </TouchableOpacity>
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
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
          <Text style={styles.headerTitle}>BẢNG TIN CÔNG ĐOÀN</Text>
        </View>
        <SkeletonLoader isDesktop={isDesktop} gridColumns={gridColumns} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, isDesktop && styles.headerDesktop]}>
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
        key={gridColumns}
        numColumns={gridColumns}
        columnWrapperStyle={gridColumns > 1 ? { gap: 16 } : undefined}
        contentContainerStyle={[styles.listContent, isDesktop && { maxWidth: 1000, alignSelf: 'center' as any, width: '100%' as any }]}
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
  headerDesktop: {
    paddingVertical: 10,
    paddingHorizontal: 24,
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
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    ...Colors.shadows.md,
    borderWidth: 1,
    borderColor: Colors.border + '40',
    overflow: 'hidden',
  },
  postCardDesktop: {
    flexDirection: 'row',
    height: 180,
  },
  postImage: {
    width: '100%',
    height: 160,
    backgroundColor: Colors.divider,
  },
  postImageDesktop: {
    width: 160,
    height: 180,
    resizeMode: 'cover',
  },
  postContent: {
    padding: 14,
  },
  postContentDesktop: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
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
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 6,
    lineHeight: 22,
  },
  postTitleDesktop: {
    fontSize: 15,
  },
  postSummary: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 19,
    marginBottom: 10,
  },
  postFooter: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: 8,
  },
  postFooterDesktop: {
    borderTopWidth: 0,
    paddingTop: 0,
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  actionsRowInline: {
    flexDirection: 'row',
    gap: 8,
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