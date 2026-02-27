import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Platform, RefreshControl } from 'react-native';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { MessageSquare, CheckCircle, Clock, XCircle, ChevronDown, ChevronUp } from 'lucide-react-native';
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
    createdAt: string;
}

export default function FeedbackManagement() {
    const { token, user } = useAuth();
    const { showToast } = useToast();
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const fetchFeedbacks = async () => {
        try {
            const response = await api.get('/api/feedbacks?limit=50', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFeedbacks(response.data);
        } catch (error) {
            console.error('Lỗi khi tải phản hồi:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const updateStatus = async (id: string, newStatus: string) => {
        try {
            await api.put(`/api/feedbacks/${id}/status`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFeedbacks(feedbacks.map(f => f.id === id ? { ...f, status: newStatus } : f));
            showToast({ message: 'Đã cập nhật trạng thái', type: 'success' });
        } catch (error) {
            console.error('Update status error:', error);
            showToast({ message: 'Không thể cập nhật trạng thái', type: 'error' });
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
                        <Text style={styles.contentLabel}>Nội dung:</Text>
                        <Text style={styles.content}>{item.content}</Text>

                        {item.replies && item.replies.length > 0 && (
                            <View style={styles.repliesSection}>
                                <Text style={styles.contentLabel}>Các phản hồi:</Text>
                                {item.replies.map((reply, index) => (
                                    <View key={index} style={styles.replyBox}>
                                        <Text style={styles.replyAuthor}>{reply.userName}</Text>
                                        <Text style={styles.replyContent}>{reply.content}</Text>
                                        <Text style={styles.replyTime}>{new Date(reply.repliedAt).toLocaleString()}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

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
                                        <Text style={[styles.actionBtnText, { color: Colors.text.secondary }]}>Đóng khiếu nại</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <Text style={styles.hintText}>* Tính năng trả lời chi tiết Feedback đang được cập nhật ở tính năng Bình luận/Comment sau.</Text>
                        </View>
                    </View>
                )}
            </WebHoverCard>
        );
    };

    if (loading) return <View style={styles.center}><Text>Đang tải...</Text></View>;

    return (
        <View style={styles.container}>
            <FlatList
                data={feedbacks}
                renderItem={renderFeedback}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchFeedbacks} />}
                ListEmptyComponent={<Text style={styles.emptyText}>Chưa có khiếu nại nào cần xử lý.</Text>}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16 },
    card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, alignItems: 'center' },
    headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    headerTitleGroup: { marginLeft: 12, flex: 1 },
    subject: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
    sender: { fontSize: 12, color: '#64748b', marginTop: 4 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 },
    statusText: { fontSize: 12, fontWeight: 'bold' },
    cardBody: { padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', backgroundColor: '#f8fafc' },
    contentLabel: { fontSize: 14, fontWeight: 'bold', color: '#1e293b', marginBottom: 6 },
    content: { fontSize: 15, color: '#334155', lineHeight: 22 },
    repliesSection: { marginTop: 16 },
    replyBox: { backgroundColor: '#e0f2fe', padding: 12, borderRadius: 8, marginTop: 8 },
    replyAuthor: { fontSize: 13, fontWeight: 'bold', color: '#0369a1' },
    replyContent: { fontSize: 14, color: '#0f172a', marginVertical: 4 },
    replyTime: { fontSize: 11, color: '#64748b' },
    actionsBox: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    actionLabel: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 12 },
    actionButtons: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff' },
    actionBtnText: { fontSize: 13, fontWeight: '600' },
    hintText: { fontSize: 12, fontStyle: 'italic', color: '#94a3b8', marginTop: 12 },
    emptyText: { textAlign: 'center', color: '#64748b', marginTop: 40, fontSize: 15 }
});
