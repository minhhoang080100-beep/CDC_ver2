import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl, Image, ScrollView, Linking } from 'react-native';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useResponsive } from '../../hooks/useResponsive';
import { MessageSquare, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp, Send, Link as LinkIcon, Paperclip } from 'lucide-react-native';
import WebHoverCard from '../WebHoverCard';

interface Reply {
    userId: string;
    userName: string;
    content: string;
    repliedAt: string;
}

interface Feedback {
    id: string;
    subject: string;
    content: string;
    senderName: string | null;
    senderDepartment: string | null;
    isAnonymous: boolean;
    status: string;
    replies: Reply[];
    attachedFiles?: string[];
    createdAt: string;
}

export default function FeedbackManagement() {
    const { token, user } = useAuth();
    const { isDesktop } = useResponsive();
    const { showToast } = useToast();
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
    const [replyingId, setReplyingId] = useState<string | null>(null);

    const { data: fetchResult, refetch } = useQuery({
        queryKey: ['feedback'],
        queryFn: async () => {
            const response = await api.get('/api/feedback?limit=50', {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data?.items || response.data || [];
        },
        enabled: !!token,
    });

    useEffect(() => {
        if (fetchResult) {
            setFeedbacks(fetchResult);
            setLoading(false);
            setRefreshing(false);
        }
    }, [fetchResult]);

    const fetchFeedbacks = () => { refetch(); };

    const updateStatus = async (id: string, newStatus: string) => {
        try {
            await api.put(`/api/feedback/${id}/status`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFeedbacks(feedbacks.map(f => f.id === id ? { ...f, status: newStatus } : f));
            showToast({ message: 'Đã cập nhật trạng thái', type: 'success' });
        } catch (error) {
            console.error('Update status error:', error);
            showToast({ message: 'Không thể cập nhật trạng thái', type: 'error' });
        }
    };

    const handleReply = async (feedbackId: string) => {
        const text = replyTexts[feedbackId]?.trim();
        if (!text) {
            showToast({ message: 'Vui lòng nhập nội dung trả lời', type: 'error' });
            return;
        }

        setReplyingId(feedbackId);
        try {
            await api.post(`/api/feedback/${feedbackId}/reply`, { content: text }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Add reply to local state immediately
            const newReply: Reply = {
                userId: user?.id || '',
                userName: user?.fullName || '',
                content: text,
                repliedAt: new Date().toISOString(),
            };
            setFeedbacks(feedbacks.map(f => {
                if (f.id === feedbackId) {
                    const nextStatus = (f.status === 'RESOLVED' || f.status === 'CLOSED') ? f.status : 'REPLIED';
                    return { ...f, replies: [...f.replies, newReply], status: nextStatus };
                }
                return f;
            }));
            setReplyTexts(prev => ({ ...prev, [feedbackId]: '' }));
            showToast({ message: 'Đã gửi trả lời thành công', type: 'success' });
        } catch (error) {
            console.error('Reply error:', error);
            showToast({ message: 'Không thể gửi trả lời', type: 'error' });
        } finally {
            setReplyingId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return Colors.status.warning;
            case 'IN_PROGRESS': return Colors.primary;
            case 'REPLIED': return Colors.status.info;
            case 'RESOLVED': return Colors.status.success;
            case 'CLOSED': return Colors.text.secondary;
            default: return Colors.text.placeholder;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'PENDING': return 'Chờ xử lý';
            case 'IN_PROGRESS': return 'Đang giải quyết';
            case 'REPLIED': return 'Đã phản hồi';
            case 'RESOLVED': return 'Đã giải quyết xong';
            case 'CLOSED': return 'Đã đóng';
            default: return status;
        }
    };

    const renderFeedback = ({ item }: { item: Feedback }) => {
        const isExpanded = expandedId === item.id;
        const isReplying = replyingId === item.id;

        return (
            <WebHoverCard style={styles.card}>
                <TouchableOpacity
                    style={styles.cardHeader}
                    onPress={() => setExpandedId(isExpanded ? null : item.id)}
                    activeOpacity={0.7}
                >
                    <View style={styles.headerLeft}>
                        <MessageSquare color={Colors.primary} size={24} />
                        <View style={styles.headerTitleGroup}>
                            <Text style={styles.subject}>{item.subject}</Text>
                            <Text style={styles.sender}>
                                {item.isAnonymous ? 'Người dùng ẩn danh' : `${item.senderName} (${item.senderDepartment})`}
                                {' • '}
                                {new Date(item.createdAt).toLocaleDateString()}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.headerRight}>
                        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{getStatusText(item.status)}</Text>
                        </View>
                        {isExpanded ? <ChevronUp color="#64748b" /> : <ChevronDown color="#64748b" />}
                    </View>
                </TouchableOpacity>

                {isExpanded && (
                    <View style={styles.cardBody}>
                        <Text style={styles.contentLabel}>Nội dung góp ý:</Text>
                        <View style={styles.contentBox}>
                            <Text style={styles.content}>{item.content}</Text>
                        </View>

                        {item.attachedFiles && item.attachedFiles.length > 0 && (
                            <View style={styles.attachmentsSection}>
                                <Text style={styles.contentLabel}>Tài liệu đính kèm:</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.attachmentsScroll}>
                                    {item.attachedFiles.map((url, i) => {
                                        const isImage = url.match(/\.(jpeg|jpg|gif|png|webp)$/i) || url.includes('/image/upload');
                                        if (isImage) {
                                            return (
                                                <TouchableOpacity key={i} onPress={() => Linking.openURL(url)} style={styles.attachmentImgContainer}>
                                                    <Image source={{uri: url}} style={styles.attachmentImg} />
                                                </TouchableOpacity>
                                            );
                                        }
                                        return (
                                            <TouchableOpacity key={i} onPress={() => Linking.openURL(url)} style={styles.attachmentDoc}>
                                                <LinkIcon color={Colors.primary} size={16} />
                                                <Text style={styles.attachmentDocText} numberOfLines={1}>Tài liệu đính kèm {i + 1}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        )}

                        {item.replies && item.replies.length > 0 && (
                            <View style={styles.repliesSection}>
                                <Text style={styles.contentLabel}>Các giải đáp ({item.replies.length}):</Text>
                                {item.replies.map((reply, index) => (
                                    <View key={index} style={styles.replyBox}>
                                        <View style={styles.replyHeader}>
                                            <Text style={styles.replyAuthor}>{reply.userName}</Text>
                                            <Text style={styles.replyTime}>{new Date(reply.repliedAt).toLocaleString()}</Text>
                                        </View>
                                        <Text style={styles.replyContent}>{reply.content}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Reply Form */}
                        {item.status !== 'CLOSED' && (
                            <View style={styles.replyFormSection}>
                                <Text style={styles.contentLabel}>Trả lời góp ý:</Text>
                                <View style={styles.replyInputRow}>
                                    <TextInput
                                        style={styles.replyInput}
                                        placeholder="Nhập nội dung giải đáp..."
                                        placeholderTextColor="#94a3b8"
                                        value={replyTexts[item.id] || ''}
                                        onChangeText={(text) => setReplyTexts(prev => ({ ...prev, [item.id]: text }))}
                                        multiline
                                        maxLength={2000}
                                    />
                                    <TouchableOpacity
                                        style={[styles.sendBtn, (!replyTexts[item.id]?.trim() || isReplying) && styles.sendBtnDisabled]}
                                        onPress={() => handleReply(item.id)}
                                        disabled={!replyTexts[item.id]?.trim() || isReplying}
                                    >
                                        {isReplying ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <Send size={18} color="#fff" />
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Status Actions */}
                        <View style={styles.actionsBox}>
                            <Text style={styles.actionLabel}>Cập nhật trạng thái:</Text>
                            <View style={styles.actionButtons}>
                                {item.status === 'PENDING' && (
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { borderColor: Colors.primary }]}
                                        onPress={() => updateStatus(item.id, 'IN_PROGRESS')}
                                    >
                                        <Clock size={16} color={Colors.primary} />
                                        <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Đang giải quyết</Text>
                                    </TouchableOpacity>
                                )}
                                {item.status !== 'RESOLVED' && item.status !== 'CLOSED' && (
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { borderColor: Colors.status.success }]}
                                        onPress={() => updateStatus(item.id, 'RESOLVED')}
                                    >
                                        <CheckCircle size={16} color={Colors.status.success} />
                                        <Text style={[styles.actionBtnText, { color: Colors.status.success }]}>Giải quyết xong</Text>
                                    </TouchableOpacity>
                                )}
                                {item.status !== 'CLOSED' && (
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { borderColor: Colors.text.secondary }]}
                                        onPress={() => updateStatus(item.id, 'CLOSED')}
                                    >
                                        <XCircle size={16} color={Colors.text.secondary} />
                                        <Text style={[styles.actionBtnText, { color: Colors.text.secondary }]}>Đóng</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                )}
            </WebHoverCard>
        );
    };

    if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

    return (
        <View style={[styles.container, isDesktop && styles.containerDesktop]}>
            <FlatList
                data={feedbacks}
                renderItem={renderFeedback}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchFeedbacks} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MessageSquare color="#94a3b8" size={48} />
                        <Text style={styles.emptyText}>Chưa có góp ý nào cần xử lý.</Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    containerDesktop: {
        maxWidth: 1000,
        marginHorizontal: 'auto',
        width: '100%',
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16, paddingBottom: isDesktop ? 16 : 100 },
    card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerTitleGroup: { marginLeft: 12, flex: 1 },
    subject: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
    sender: { fontSize: 12, color: '#64748b', marginTop: 4 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 },
    statusText: { fontSize: 12, fontWeight: 'bold' },
    cardBody: { padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#f8fafc' },
    contentLabel: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 8 },
    contentBox: { backgroundColor: '#fff', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' },
    content: { fontSize: 15, color: '#334155', lineHeight: 22 },
    repliesSection: { marginTop: 20 },
    replyBox: { backgroundColor: '#e0f2fe', padding: 14, borderRadius: 10, marginTop: 8 },
    replyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    replyAuthor: { fontSize: 13, fontWeight: 'bold', color: '#0369a1' },
    replyContent: { fontSize: 14, color: '#0f172a', lineHeight: 20 },
    replyTime: { fontSize: 11, color: '#64748b' },
    replyFormSection: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    replyInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    replyInput: {
        flex: 1,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#cbd5e1',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingTop: 12,
        paddingBottom: 12,
        fontSize: 14,
        color: '#0f172a',
        minHeight: 48,
        maxHeight: 120,
        textAlignVertical: 'top',
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendBtnDisabled: {
        opacity: 0.4,
    },
    actionsBox: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    actionLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 12 },
    actionButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff' },
    actionBtnText: { fontSize: 13, fontWeight: '600' },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { textAlign: 'center', color: '#64748b', fontSize: 15 },
    attachmentsSection: { marginTop: 16 },
    attachmentsScroll: { flexDirection: 'row', marginTop: 8 },
    attachmentImgContainer: { width: 80, height: 80, borderRadius: 8, marginRight: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
    attachmentImg: { width: '100%', height: '100%', resizeMode: 'cover' },
    attachmentDoc: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#e0f2fe', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 12, borderWidth: 1, borderColor: '#bae6fd' },
    attachmentDocText: { fontSize: 13, color: Colors.primary, fontWeight: '500', marginLeft: 8, textDecorationLine: 'underline' },
});
