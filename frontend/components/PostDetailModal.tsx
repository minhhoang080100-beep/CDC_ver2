import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Image,
    Modal,
    KeyboardAvoidingView,
    Platform,
    TouchableWithoutFeedback,
} from 'react-native';
import { X, User, Heart, MessageCircle, Send, Globe } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { api } from '../utils/api';
import { useResponsive } from '../hooks/useResponsive';
import { useQueryClient } from '@tanstack/react-query';

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
  targetDepartments: string[];
  likes?: string[];
  comments?: any[];
  createdAt: string;
  updatedAt: string;
}

// Component tự đo kích thước ảnh và hiển thị đúng tỷ lệ gốc
const AutoHeightImage = ({ uri }: { uri: string }) => {
    const [aspectRatio, setAspectRatio] = React.useState(16 / 9); // default fallback

    React.useEffect(() => {
        Image.getSize(
            uri,
            (width, height) => {
                if (width && height) {
                    setAspectRatio(width / height);
                }
            },
            (error) => {
                console.error('Error getting image size:', error);
            }
        );
    }, [uri]);

    return (
        <Image
            source={{ uri }}
            style={{ width: '100%', aspectRatio, backgroundColor: '#f0f2f5' }}
            resizeMode="cover"
        />
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

  // Native (iOS/Android)
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

interface PostDetailModalProps {
    visible: boolean;
    post: Post | null;
    onClose: () => void;
}

export default function PostDetailModal({ visible, post, onClose }: PostDetailModalProps) {
    const { isDesktop } = useResponsive();
    const { token, user } = useAuth();
    const { showToast } = useToast();
    const queryClient = useQueryClient();

    const [likes, setLikes] = useState<string[]>([]);
    const [comments, setComments] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (post) {
            setLikes(post.likes || []);
            setComments(post.comments || []);
            setCommentText('');
        }
    }, [post, visible]);

    if (!post) return null;

    const handleToggleLike = async () => {
        if (!post) return;
        try {
            const res = await api.post(`/api/posts/${post.id}/like`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLikes(res.data.likes);
            queryClient.invalidateQueries({ queryKey: ['posts'] });
        } catch (error) {
            console.error('Lỗi khi like:', error);
        }
    };

    const handleAddComment = async () => {
        if (!commentText.trim() || !post) return;
        setIsSubmitting(true);
        try {
            const res = await api.post(`/api/posts/${post.id}/comments`, { content: commentText.trim() }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setComments([...comments, res.data.comment]);
            setCommentText('');
            queryClient.invalidateQueries({ queryKey: ['posts'] });
        } catch (error) {
            console.error('Lỗi khi bình luận:', error);
            showToast({ message: 'Không thể gửi bình luận', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const isLiked = likes.includes(user?.id || '');

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={[styles.overlay, isDesktop && styles.overlayDesktop]}>
                    <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                        <KeyboardAvoidingView 
                            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                            style={[styles.modalContainer, isDesktop && styles.modalContainerDesktop]}
                        >
                            {/* Header */}
                            <View style={styles.header}>
                                <Text style={styles.headerTitle} numberOfLines={1}>Chi tiết bài viết</Text>
                                <View style={styles.headerRight}>
                                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                                        <X color={Colors.text.primary} size={24} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                                {/* Meta Info */}
                                <View style={styles.postHeaderLeft}>
                                  <View style={styles.authorAvatar}>
                                    <User size={24} color="#bac2c9" />
                                  </View>
                                  <View>
                                    <Text style={styles.postAuthorName}>{post.authorName}</Text>
                                    <View style={styles.postMetaRow}>
                                      <Text style={styles.postDate}>{formatDate(post.createdAt)} • </Text>
                                      <Globe size={12} color={Colors.text.secondary} />
                                      {post.category ? <Text style={styles.categoryTag}> • {post.category}</Text> : null}
                                    </View>
                                  </View>
                                </View>

                                {/* Title */}
                                <Text style={styles.title}>{post.title}</Text>

                                {/* Video */}
                                {post.videoUrl ? (
                                    <View style={styles.videoContainer}>
                                        <VideoPlayer url={post.videoUrl} style={styles.webview} />
                                    </View>
                                ) : null}

                                {/* Post Images */}
                                {post.images && post.images.length > 0 && (
                                    <View style={styles.imagesVerticalContainer}>
                                        {post.images.map((img: string, idx: number) => (
                                            <AutoHeightImage key={idx} uri={img} />
                                        ))}
                                    </View>
                                )}

                                {/* Summary */}
                                {post.summary && post.summary !== post.title && (
                                    <View style={styles.summaryBox}>
                                        <Text style={styles.summaryLabel}>Tóm tắt</Text>
                                        <Text style={styles.summaryText}>{post.summary}</Text>
                                    </View>
                                )}

                                {/* Content */}
                                <Text style={styles.content}>{post.content}</Text>

                                {/* interactions */}
                                <View style={styles.interactionBar}>
                                    <TouchableOpacity style={styles.interactionBtn} onPress={handleToggleLike}>
                                        <Heart
                                            size={20}
                                            color={isLiked ? Colors.primary : Colors.text.secondary}
                                            fill={isLiked ? Colors.primary : 'transparent'}
                                        />
                                        <Text style={[styles.interactionText, { color: isLiked ? Colors.primary : Colors.text.secondary }]}>
                                            {likes.length} Thích
                                        </Text>
                                    </TouchableOpacity>
                                    <View style={styles.interactionBtn}>
                                        <MessageCircle size={20} color={Colors.text.secondary} />
                                        <Text style={styles.interactionText}>{comments.length} Bình luận</Text>
                                    </View>
                                </View>

                                {/* Comments Section */}
                                <View style={styles.commentsSection}>
                                    {comments.map((cmt: any, idx: number) => (
                                        <View key={idx} style={styles.commentBox}>
                                            <View style={styles.commentAvatar}>
                                                <User size={16} color="#64748b" />
                                            </View>
                                            <View style={styles.commentContent}>
                                                <View style={styles.commentAuthorRow}>
                                                    <Text style={styles.commentAuthor}>{cmt.userName}</Text>
                                                    <Text style={styles.commentTime}>{formatDate(cmt.createdAt)}</Text>
                                                </View>
                                                <Text style={styles.commentText}>{cmt.content}</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>

                            <View style={styles.commentInputContainer}>
                                <TextInput
                                    style={styles.commentInput}
                                    placeholder="Viết bình luận..."
                                    placeholderTextColor={Colors.text.placeholder}
                                    value={commentText}
                                    onChangeText={setCommentText}
                                    multiline
                                    maxLength={500}
                                />
                                <TouchableOpacity
                                    style={[styles.sendButton, !commentText.trim() && { opacity: 0.5 }]}
                                    onPress={handleAddComment}
                                    disabled={!commentText.trim() || isSubmitting}
                                >
                                    <Send size={18} color="#ffffff" />
                                </TouchableOpacity>
                            </View>

                        </KeyboardAvoidingView>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'flex-end', // On mobile, modal comes from bottom
    },
    overlayDesktop: {
        justifyContent: 'center', // On desktop, center it
        alignItems: 'center',
    },
    modalContainer: {
        width: '100%',
        height: '92%', // Mobile modal height
        backgroundColor: '#ffffff',
        flexDirection: 'column',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        overflow: 'hidden',
    },
    modalContainerDesktop: {
        width: '90%',
        maxWidth: 900,
        height: '90%',
        maxHeight: 900,
        borderRadius: 12, // Desktop full rounded corners
        boxShadow: '0 10px 25px rgba(0,0,0,0.2)' as any,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
        backgroundColor: '#ffffff',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#050505',
        textAlign: 'center',
        flex: 1,
    },
    headerRight: {
        position: 'absolute',
        right: 16,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        flex: 1,
    },
    postHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 16,
        marginBottom: 12,
    },
    authorAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#e4e6eb',
        justifyContent: 'center',
        alignItems: 'center',
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
    postDate: {
        fontSize: 13,
        color: '#65676b',
    },
    categoryTag: {
        fontSize: 13,
        color: '#65676b',
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#050505',
        paddingHorizontal: 16,
        marginVertical: 8,
        lineHeight: 30,
    },
    imagesVerticalContainer: {
        width: '100%',
        gap: 4,
        marginVertical: 12,
    },
    postDetailImageVertical: {
        width: '100%',
        minHeight: 200,
        maxHeight: 600,
        backgroundColor: '#f0f2f5',
        resizeMode: 'contain',
    },
    videoContainer: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: '#000',
        marginBottom: 12,
    },
    webview: {
        flex: 1,
    },
    summaryBox: {
        backgroundColor: '#f8f9fa',
        padding: 16,
        marginHorizontal: 16,
        borderRadius: 8,
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
        marginBottom: 16,
    },
    summaryLabel: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Colors.primary,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    summaryText: {
        fontSize: 16,
        lineHeight: 24,
        color: '#050505',
        fontStyle: 'italic',
    },
    content: {
        fontSize: 16,
        lineHeight: 26,
        color: '#050505',
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    interactionBar: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: Colors.divider,
    },
    interactionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        justifyContent: 'center',
    },
    interactionText: {
        fontSize: 15,
        fontWeight: '600',
    },
    commentsSection: {
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
    },
    commentBox: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    commentAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#e2e8f0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    commentContent: {
        flex: 1,
        backgroundColor: '#f0f2f5',
        padding: 12,
        borderRadius: 12,
    },
    commentAuthorRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    commentAuthor: {
        fontWeight: '600',
        fontSize: 14,
        color: '#050505',
    },
    commentTime: {
        fontSize: 12,
        color: Colors.text.placeholder,
    },
    commentText: {
        fontSize: 14,
        color: '#050505',
        lineHeight: 20,
    },
    commentInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.divider,
        backgroundColor: '#ffffff',
    },
    commentInput: {
        flex: 1,
        backgroundColor: '#f0f2f5',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        maxHeight: 100,
        color: '#050505',
    },
    sendButton: {
        marginLeft: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
