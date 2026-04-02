import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    TextInput,
    Alert,
    Platform,
    Image,
    Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { api } from '../../utils/api';
import { ArrowLeft, Calendar, User, Tag, Heart, MessageCircle, Send, Globe } from 'lucide-react-native';

const windowWidth = Dimensions.get('window').width;

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
            const { format } = require('date-fns');
            const safeDateStr = dateString.endsWith('Z') ? dateString : dateString + 'Z';
            return format(new Date(safeDateStr), 'HH:mm • dd/MM/yyyy');
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
                contentContainerStyle={isDesktop ? { maxWidth: 700, alignSelf: 'center' as any, width: '100%' as any, paddingBottom: 40 } : undefined}
            >
                {/* Meta Info */}
                <View style={styles.postHeaderLeft}>
                  <View style={styles.authorAvatar}>
                    <User size={24} color="#bac2c9" />
                  </View>
                  <View>
                    <Text style={styles.postAuthorName}>{authorName}</Text>
                    <View style={styles.postMetaRow}>
                      <Text style={styles.postDate}>{formatDate(createdAt)} • </Text>
                      <Globe size={12} color={Colors.text.secondary} />
                      {category ? <Text style={styles.categoryTag}> • {category}</Text> : null}
                    </View>
                  </View>
                </View>

                {/* Title */}
                <Text style={styles.title}>{title}</Text>

                {/* Post Images */}
                {(() => {
                    try {
                        const imagesArray = params.images ? JSON.parse(params.images as string) : [];
                        if (imagesArray.length > 0) {
                            return (
                                <View style={styles.imagesVerticalContainer}>
                                    {imagesArray.map((img: string, idx: number) => (
                                        <Image 
                                            key={idx} 
                                            source={{ uri: img }} 
                                            style={styles.postDetailImageVertical} 
                                            resizeMode="cover"
                                        />
                                    ))}
                                </View>
                            );
                        }
                    } catch (e) {
                        console.error("Error parsing images in detail:", e);
                    }
                    return null;
                })()}

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
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
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
        color: '#050505',
        flex: 1,
        textAlign: 'center',
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
    imagesVerticalContainer: {
        width: '100%',
        marginBottom: 20,
        gap: 12,
    },
    postDetailImageVertical: {
        width: '100%',
        aspectRatio: 16 / 9,
        backgroundColor: Colors.divider,
        borderRadius: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#050505',
        lineHeight: 30,
        marginBottom: 12,
        paddingHorizontal: 16,
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
        backgroundColor: '#f0f2f5',
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
        padding: 16,
        marginHorizontal: 16,
        borderRadius: 8,
        marginBottom: 16,
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: Colors.text.secondary,
        marginBottom: 6,
        textTransform: 'uppercase',
    },
    summaryText: {
        fontSize: 15,
        color: '#050505',
        lineHeight: 22,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.divider,
        marginBottom: 16,
        marginHorizontal: 16,
    },
    content: {
        fontSize: 16,
        color: '#050505',
        lineHeight: 26,
        marginBottom: 20,
        paddingHorizontal: 16,
    },
    interactionBar: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: Colors.divider,
        paddingVertical: 8,
        marginBottom: 16,
        marginHorizontal: 16,
        justifyContent: 'space-around',
    },
    interactionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    interactionText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#65676b',
    },
    commentsSection: {
        marginBottom: 40,
        paddingHorizontal: 16,
    },
    commentsHeader: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#050505',
        marginBottom: 16,
    },
    commentBox: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    commentAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#e4e6eb',
        justifyContent: 'center',
        alignItems: 'center',
    },
    commentContent: {
        flex: 1,
        backgroundColor: '#f0f2f5',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 18,
    },
    commentAuthorRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 2,
    },
    commentAuthor: {
        fontSize: 14,
        fontWeight: '700',
        color: '#050505',
    },
    commentTime: {
        fontSize: 12,
        color: '#65676b',
        fontWeight: '500',
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
        borderWidth: 0,
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 10,
        minHeight: 40,
        maxHeight: 120,
        backgroundColor: '#f0f2f5',
        fontSize: 15,
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
