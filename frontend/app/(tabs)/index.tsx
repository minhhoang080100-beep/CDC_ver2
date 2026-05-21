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
  TextInput,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import { useResponsive } from '../../hooks/useResponsive';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../../contexts/ToastContext';
import { format } from 'date-fns';
import { Plus, Edit2, Trash2, Heart, MessageCircle, Search, User, Image as ImageIcon, Share2, Globe, MoreHorizontal } from 'lucide-react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import CreatePostModal from '../../components/CreatePostModal';
import PostDetailModal from '../../components/PostDetailModal';
import WebHoverCard from '../../components/WebHoverCard';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';

interface Post {
  id: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  images?: string[];
  videoUrl?: string;
  authorId: string;
  authorName: string;
  authorDepartment: string;
  authorAvatar?: string | null;
  targetDepartments: string[];
  likes?: string[];
  comments?: any[];
  createdAt: string;
  updatedAt: string;
}

const ImageGrid = ({ images, isDesktop }: { images: string[]; isDesktop?: boolean }) => {
  if (!images || images.length === 0) return null;

  if (images.length === 1) {
    return (
      <Image source={{ uri: images[0] }} style={styles.postImage} />
    );
  }

  if (images.length === 2) {
    return (
      <View style={styles.imageGrid}>
        <Image source={{ uri: images[0] }} style={styles.gridImageHalf} />
        <View style={styles.gridSpace} />
        <Image source={{ uri: images[1] }} style={styles.gridImageHalf} />
      </View>
    );
  }
  
  if (images.length === 3) {
    return (
      <View style={styles.imageGrid}>
        <Image source={{ uri: images[0] }} style={styles.gridImageHalf} />
        <View style={styles.gridSpace} />
        <View style={styles.gridColumnHalf}>
          <Image source={{ uri: images[1] }} style={styles.gridImageQuarter} />
          <View style={styles.gridSpaceH} />
          <Image source={{ uri: images[2] }} style={styles.gridImageQuarter} />
        </View>
      </View>
    );
  }

  if (images.length === 4) {
    return (
      <View style={styles.imageGrid}>
        <View style={styles.gridColumnHalf}>
          <Image source={{ uri: images[0] }} style={styles.gridImageQuarter} />
          <View style={styles.gridSpaceH} />
          <Image source={{ uri: images[2] }} style={styles.gridImageQuarter} />
        </View>
        <View style={styles.gridSpace} />
        <View style={styles.gridColumnHalf}>
          <Image source={{ uri: images[1] }} style={styles.gridImageQuarter} />
          <View style={styles.gridSpaceH} />
          <Image source={{ uri: images[3] }} style={styles.gridImageQuarter} />
        </View>
      </View>
    );
  }

  // 5 or more images: keep the feed preview stable and show the rest in detail.
  return (
    <View style={styles.imageGrid}>
      <View style={styles.gridColumnHalf}>
        <Image source={{ uri: images[0] }} style={styles.gridImageQuarter} />
        <View style={styles.gridSpaceH} />
        <Image source={{ uri: images[2] }} style={styles.gridImageQuarter} />
      </View>
      <View style={styles.gridSpace} />
      <View style={styles.gridColumnHalf}>
        <Image source={{ uri: images[1] }} style={styles.gridImageQuarter} />
        <View style={styles.gridSpaceH} />
        <View style={styles.gridImageQuarterContainer}>
          <Image source={{ uri: images[3] }} style={styles.gridImageQuarter} />
          <View style={styles.moreImagesOverlay}>
            <Text style={styles.moreImagesText}>+{images.length - 4}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const getEmbedUrl = (url: string) => {
  if (!url) return '';
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))((\w|-){11})/);
  return match && match[1] ? `https://www.youtube.com/embed/${match[1]}?autoplay=0&rel=0` : url;
};

const VideoPlayer = ({ url, style }: { url: string; style?: any }) => {
  const embedUrl = getEmbedUrl(url);
  if (!embedUrl) return null;

  if (Platform.OS === 'web') {
    return (
      <iframe
        src={embedUrl}
        style={{ width: '100%', height: '100%', border: 'none' } as any}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  const WebView = require('react-native-webview').WebView;
  return (
    <WebView
      source={{ uri: embedUrl }}
      style={style || { flex: 1 }}
      allowsFullscreenVideo
      javaScriptEnabled
      domStorageEnabled
    />
  );
};

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
    <Animated.View style={[styles.postCard, { opacity: animatedValue }, { marginBottom: 12, maxWidth: 680, alignSelf: 'center', width: '100%' }]} key={item}>
      <View style={[styles.postImage, { backgroundColor: Colors.divider }]} />
      <View style={{ flex: 1, padding: 14, justifyContent: 'center' }}>
        <View style={{ width: 80, height: 24, backgroundColor: Colors.divider, borderRadius: 12, marginBottom: 12 }} />
        <View style={{ width: '80%', height: 20, backgroundColor: Colors.divider, borderRadius: 4, marginBottom: 8 }} />
        <View style={{ width: '100%', height: 16, backgroundColor: Colors.divider, borderRadius: 4, marginBottom: 4 }} />
        <View style={{ width: '60%', height: 16, backgroundColor: Colors.divider, borderRadius: 4 }} />
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
  const { showConfirm } = useConfirm();
  const { showToast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { gridColumns, isDesktop } = useResponsive();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPostView, setSelectedPostView] = useState<Post | null>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    isRefetching
  } = useInfiniteQuery({
    queryKey: ['posts'],
    queryFn: async ({ pageParam }) => {
      const response = await api.get(`/api/posts?skip=${(pageParam as number) * 20}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage: any, allPages) => {
      return lastPage.hasMore ? allPages.length : undefined;
    },
    enabled: !!token,
  });

  const posts = data?.pages.flatMap((page: any) => page.items) || [];

  const onRefresh = () => {
    refetch();
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
    queryClient.invalidateQueries({ queryKey: ['posts'] });
  };

  const handleEdit = (post: Post) => {
    setEditingPost(post);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    showConfirm({
      title: 'Xóa bài viết',
      message: 'Bạn có chắc chắn muốn xóa bài viết này không? Bài viết sẽ bị gỡ xuống khỏi bảng tin.',
      type: 'danger',
      confirmText: 'Xóa bài viết',
      onConfirm: async () => {
        try {
          await api.delete(`/api/posts/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          showToast({ message: 'Đã xóa bài viết thành công', type: 'success' });
          queryClient.invalidateQueries({ queryKey: ['posts'] }); // Refresh list after deletion
        } catch (error) {
          console.error('Error deleting post:', error);
          showToast({ message: 'Không thể xóa bài viết. Vui lòng thử lại.', type: 'error' });
        }
      }
    });
  };

  const navigateToPost = (item: Post) => {
    setSelectedPostView(item);
  };

  const handleToggleLike = async (post: Post) => {
    try {
      await api.post(`/api/posts/${post.id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    } catch (error) {
      console.error('Lỗi khi thả tim:', error);
      showToast({ message: 'Không thể tải thao tác thả tim.', type: 'error' });
    }
  };

  const handleShare = async (post: Post) => {
    try {
      await Share.share({
        message: `${post.title}\nXem chi tiết tại hệ thống nội bộ CDC.`,
        title: post.title,
      });
    } catch (error) {
      console.error('Lỗi khi chia sẻ:', error);
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <View style={{ flex: 1, marginBottom: 8, maxWidth: 680, alignSelf: 'center', width: '100%' }}>
      <WebHoverCard style={styles.postCard}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => navigateToPost(item)}
        >
          {/* Header */}
          <View style={styles.postHeader}>
            <View style={styles.postHeaderLeft}>
              <View style={styles.authorAvatar}>
                {item.authorAvatar ? (
                  <Image source={{ uri: item.authorAvatar }} style={styles.authorAvatarImage} />
                ) : (
                  <User size={24} color="#bac2c9" />
                )}
              </View>
              <View>
                <Text style={styles.postAuthorName}>{item.authorName}</Text>
                <View style={styles.postMetaRow}>
                  <Text style={styles.postDate}>{item.createdAt ? format(new Date(item.createdAt.endsWith('Z') ? item.createdAt : item.createdAt + 'Z'), 'HH:mm • dd/MM/yyyy') : ''} • </Text>
                  <Globe size={12} color={Colors.text.secondary} />
                  <Text style={styles.categoryTag}> • {item.category}</Text>
                </View>
              </View>
            </View>

            {canEditDelete(item) && (
               <View style={{flexDirection: 'row', gap: 16, alignItems: 'center'}}>
                 <TouchableOpacity onPress={() => handleEdit(item)}>
                   <Edit2 color={Colors.text.secondary} size={18} />
                 </TouchableOpacity>
                 <TouchableOpacity onPress={() => handleDelete(item.id)}>
                   <Trash2 color={Colors.text.secondary} size={18} />
                 </TouchableOpacity>
               </View>
            )}
          </View>

          {/* Content Text */}
          <View style={styles.postTextContent}>
            <Text style={styles.postTitle}>{item.title}</Text>
            {item.summary && item.summary !== item.title ? (
                <Text style={styles.postSummary} numberOfLines={3}>{item.summary}</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        {/* Video */}
        {item.videoUrl ? (
          <View style={styles.videoContainer}>
            <VideoPlayer url={item.videoUrl} style={styles.webview} />
          </View>
        ) : null}

        <TouchableOpacity activeOpacity={0.9} onPress={() => navigateToPost(item)}>
          {/* Images */}
          <ImageGrid images={item.images || []} isDesktop={isDesktop} />
        </TouchableOpacity>

        {/* Stats */}
        <View style={styles.postStats}>
          <View style={styles.statsLeft}>
             <View style={styles.likeIconCircle}>
                <Heart size={10} color="#fff" fill="#fff" />
             </View>
             <Text style={styles.statsText}>{item.likes?.length || 0}</Text>
          </View>
          <View style={styles.statsRight}>
             <Text style={styles.statsText}>{item.comments?.length || 0} bình luận</Text>
          </View>
        </View>

        <View style={styles.postActionDivider} />

        {/* Actions */}
        <View style={styles.postActions}>
           <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggleLike(item)}>
              <Heart size={20} color={item.likes?.includes(user?.id || '') ? Colors.primary : Colors.text.secondary} fill={item.likes?.includes(user?.id || '') ? Colors.primary : 'transparent'} />
              <Text style={[styles.actionBtnText, item.likes?.includes(user?.id || '') && {color: Colors.primary}]}>Thích</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.actionBtn} onPress={() => navigateToPost(item)}>
              <MessageCircle size={20} color={Colors.text.secondary} />
              <Text style={styles.actionBtnText}>Bình luận</Text>
           </TouchableOpacity>
           <TouchableOpacity style={styles.actionBtn} onPress={() => handleShare(item)}>
              <Share2 size={20} color={Colors.text.secondary} />
              <Text style={styles.actionBtnText}>Chia sẻ</Text>
           </TouchableOpacity>
        </View>
      </WebHoverCard>
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

  const filteredPosts = posts.filter(post =>
    (post.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (post.summary || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>

        <SkeletonLoader isDesktop={isDesktop} gridColumns={gridColumns} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>




      <FlatList
        data={filteredPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, isDesktop && { maxWidth: 680, alignSelf: 'center' as any, width: '100%' as any }, !isDesktop && { paddingBottom: 110 }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={['#0891b2']}
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
                  placeholder="Tìm kiếm bài viết..."
                  placeholderTextColor={Colors.text.placeholder}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            {/* What's on your mind? */}
            {canCreatePost && (
              <View style={{ paddingTop: 8 }}>
                <TouchableOpacity 
                  style={[styles.createPostCard, isDesktop && { borderWidth: 1, borderColor: Colors.border + '40', borderRadius: 8 }]}
                  onPress={() => setModalVisible(true)}
                >
                  <View style={styles.createPostTop}>
                    <View style={styles.authorAvatar}>
                       {user?.avatar ? (
                         <Image source={{ uri: user.avatar }} style={styles.authorAvatarImage} />
                       ) : (
                         <User size={24} color="#bac2c9" />
                       )}
                    </View>
                    <View style={styles.createPostInput}>
                      <Text style={styles.createPostInputText}>Bạn đang nghĩ gì vậy?</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </>
        }
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : null
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

      <PostDetailModal 
        visible={!!selectedPostView}
        post={selectedPostView}
        onClose={() => setSelectedPostView(null)}
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
    marginBottom: 8,
  },
  postCardDesktop: {
    flexDirection: 'row',
    height: 180,
  },
  postImage: {
    width: '100%',
    aspectRatio: 4/3,
    backgroundColor: Colors.divider,
  },
  postImageDesktop: {
    width: 160,
    height: 180,
    resizeMode: 'cover',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e4e6eb',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  authorAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    marginBottom: 8,
  },
  webview: {
    flex: 1,
  },
  postAuthorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#050505',
    marginBottom: 2,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTag: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  postTextContent: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  postStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  likeIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsText: {
    fontSize: 13,
    color: '#65676b',
  },
  statsRight: {},
  postActionDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: 16,
  },
  postActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#65676b',
  },
  headerTitleFB: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButtonCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e4e6eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPostCard: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  createPostTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createPostInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f0f2f5',
    borderRadius: 20,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  createPostInputText: {
    fontSize: 15,
    color: '#65676b',
  },
  createPostDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginTop: 12,
    marginBottom: 8,
  },
  createPostActionsTop: {
    flexDirection: 'row',
  },
  createPostActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  createPostActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#65676b',
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
  actionIconBtnEdit: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBtnDelete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
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
  imageGrid: {
    width: '100%',
    aspectRatio: 4/3,
    flexDirection: 'row',
  },
  imageGridDesktop: {
    width: 240,
    height: 180,
    marginBottom: 0,
    marginRight: 12,
  },
  gridImageHalf: {
    flex: 1,
    height: '100%',
    backgroundColor: Colors.divider,
    resizeMode: 'cover',
  },
  gridSpace: {
    width: 2,
    height: '100%',
    backgroundColor: Colors.background,
  },
  gridColumnHalf: {
    flex: 1,
    height: '100%',
  },
  gridImageQuarter: {
    flex: 1,
    width: '100%',
    backgroundColor: Colors.divider,
    resizeMode: 'cover',
  },
  gridSpaceH: {
    width: '100%',
    height: 2,
    backgroundColor: Colors.background,
  },
  gridImageQuarterContainer: {
    flex: 1,
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.divider,
  },
  moreImagesOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
  },
  moreImagesText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    includeFontPadding: false,
  },
});
