import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';
import { ArrowLeft, Calendar, User, Tag, Heart, MessageCircle, Send } from 'lucide-react-native';

export default function PostDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { isDesktop } = useResponsive();

    const title = params.title as string || '';
    const content = params.content as string || '';
    const summary = params.summary as string || '';
    const category = params.category as string || '';
    const authorName = params.authorName as string || 'Không rõ';
    const createdAt = params.createdAt as string || '';
    const postId = params.id as string;

    const { token, user } = useAuth();
    const { showToast } = useToast();
    const [likes, setLikes] = useState<string[]>([]);
    const [comments, setComments] = useState<any[]>([]);
    const [commentText, setCommentText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    React.useEffect(() => {
        try {
            if (params.likes) setLikes(JSON.parse(params.likes as string));
            if (params.comments) setComments(JSON.parse(params.comments as string));
        } catch (e) {
            console.error('Error parsing likes/comments', e);
        }
    }, [params.likes, params.comments]);

    const handleToggleLike = async () => {
        if (!postId) return;
        try {
            const res = await api.post(`/api/posts/${postId}/like`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLikes(res.data.likes);
        } catch (error) {
            console.error('Lỗi khi like:', error);
        }
    };

    const handleAddComment = async () => {
        if (!commentText.trim() || !postId) return;
        setIsSubmitting(true);
        try {
            const res = await api.post(`/api/posts/${postId}/comments`, { content: commentText.trim() }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setComments([...comments, res.data.comment]);
            setCommentText('');
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

    const getCategoryColor = (cat: string) => {
        switch (cat) {
            case 'Chính sách': return Colors.status.error;
            case 'Hoạt động': return Colors.status.success;
            case 'Thông báo': return Colors.status.info;
            default: return Colors.primary;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft color={Colors.header.text} size={24} />
                </TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={1}>Chi tiết bài viết</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}
                contentContainerStyle={isDesktop ? { maxWidth: 700, alignSelf: 'center' as any, width: '100%' as any } : undefined}
            >
                {/* Category Badge */}
                {category ? (
                    <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(category) }]}>
                        <Tag color="#ffffff" size={14} />
                        <Text style={styles.categoryText}>{category}</Text>
                    </View>
                ) : null}

                {/* Title */}
                <Text style={styles.title}>{title}</Text>

                {/* Meta Info */}
                <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                        <User color={Colors.text.secondary} size={16} />
                        <Text style={styles.metaText}>{authorName}</Text>
                    </View>
                    {createdAt ? (
                        <View style={styles.metaItem}>
                            <Calendar color={Colors.text.secondary} size={16} />
                            <Text style={styles.metaText}>{formatDate(createdAt)}</Text>
                        </View>
                    ) : null}
                </View>

                {/* Summary */}
                {summary && summary !== title ? (
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>Tóm tắt</Text>
                        <Text style={styles.summaryText}>{summary}</Text>
                    </View>
                ) : null}

                {/* Divider */}
                <View style={styles.divider} />

                {/* Content */}
                <Text style={styles.content}>{content}</Text>

                {/* Interactions */}
                <View style={styles.interactionBar}>
                    <TouchableOpacity style={styles.interactionBtn} onPress={handleToggleLike}>
                        <Heart
                            size={20}
                            color={likes.includes(user?.id || '') ? Colors.status.error : Colors.text.secondary}
                            fill={likes.includes(user?.id || '') ? Colors.status.error : 'transparent'}
                        />
                        <Text style={[styles.interactionText, { color: likes.includes(user?.id || '') ? Colors.status.error : Colors.text.secondary }]}>
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
                    <Text style={styles.commentsHeader}>Bình luận</Text>
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
                </View>
            </ScrollView>
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
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.header.background,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.header.text,
        flex: 1,
        textAlign: 'center',
    },
    scrollContent: {
        flex: 1,
        padding: 20,
    },
    categoryBadge: {
        flexDirection: 'row',
        alignSelf: 'flex-start',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 20,
        marginBottom: 16,
    },
    categoryText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#ffffff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.text.primary,
        lineHeight: 32,
        marginBottom: 16,
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 20,
        marginBottom: 20,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaText: {
        fontSize: 14,
        color: Colors.text.secondary,
    },
    summaryBox: {
        backgroundColor: '#f0f9ff',
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
        padding: 16,
        borderRadius: 8,
        marginBottom: 20,
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.primary,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    summaryText: {
        fontSize: 15,
        color: Colors.text.primary,
        lineHeight: 22,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.divider,
        marginBottom: 20,
    },
    content: {
        fontSize: 16,
        color: Colors.text.primary,
        lineHeight: 26,
        marginBottom: 20,
    },
    interactionBar: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: Colors.divider,
        paddingVertical: 12,
        marginBottom: 24,
        gap: 24,
    },
    interactionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    interactionText: {
        fontSize: 15,
        fontWeight: '500',
    },
    commentsSection: {
        marginBottom: 40,
    },
    commentsHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text.primary,
        marginBottom: 16,
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
        backgroundColor: '#f1f5f9',
        padding: 12,
        borderRadius: 12,
        borderTopLeftRadius: 4,
    },
    commentAuthorRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    commentAuthor: {
        fontSize: 13,
        fontWeight: 'bold',
        color: Colors.text.primary,
    },
    commentTime: {
        fontSize: 11,
        color: Colors.text.secondary,
    },
    commentText: {
        fontSize: 14,
        color: Colors.text.primary,
        lineHeight: 20,
    },
    commentInputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 12,
        marginTop: 8,
    },
    commentInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.divider,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        minHeight: 40,
        maxHeight: 120,
        backgroundColor: '#fff',
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
