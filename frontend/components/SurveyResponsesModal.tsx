import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Platform,
    ActivityIndicator,
    ScrollView,
    FlatList,
} from 'react-native';
import { X, Users, MessageSquare, Briefcase } from 'lucide-react-native';
import { Colors } from '../constants/Colors';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';

interface SurveyResponsesModalProps {
    visible: boolean;
    survey: any;
    onClose: () => void;
}

export default function SurveyResponsesModal({ visible, survey, onClose }: SurveyResponsesModalProps) {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [responses, setResponses] = useState<any[]>([]);

    useEffect(() => {
        if (visible && survey) {
            fetchResponses();
        } else {
            setResponses([]);
        }
    }, [visible, survey]);

    const fetchResponses = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/api/surveys/${survey.id}/responses?limit=100`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setResponses(res.data?.items || []);
        } catch (error) {
            console.error('Error fetching survey responses:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!visible) return null;

    const renderItem = ({ item }: { item: any }) => {
        const date = item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
        const name = item.userName || 'Người dùng ẩn danh';

        return (
            <View style={styles.responseCard}>
                <View style={styles.responseHeader}>
                    <View style={styles.userInfo}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View>
                            <Text style={styles.userName}>{name}</Text>
                            <View style={styles.deptRow}>
                                <Briefcase color="#94a3b8" size={12} />
                                <Text style={styles.deptText}>{item.department === 'ALL' ? 'Chung' : item.department}</Text>
                            </View>
                        </View>
                    </View>
                    <Text style={styles.dateText}>{date}</Text>
                </View>
                <View style={styles.answersContainer}>
                    {item.answers && item.answers.map((ans: any, idx: number) => {
                        const questionStr = survey?.questions?.[ans.questionIndex]?.content || `Câu ${ans.questionIndex + 1}`;
                        let ansStr = '';
                        if (Array.isArray(ans.answer)) {
                            ansStr = ans.answer.join(', ');
                        } else {
                            ansStr = String(ans.answer || '');
                        }

                        return (
                            <View key={idx} style={styles.answerItem}>
                                <Text style={styles.qText}>Q: {questionStr}</Text>
                                <Text style={styles.aText}>A: {ansStr}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <Users color={Colors.primary} size={24} />
                            <Text style={styles.title} numberOfLines={1}>Danh sách trả lời: {survey?.title}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <X color="#64748b" size={24} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {loading ? (
                            <View style={styles.center}>
                                <ActivityIndicator size="large" color={Colors.primary} />
                                <Text style={{ marginTop: 10, color: '#64748b' }}>Đang tải dữ liệu...</Text>
                            </View>
                        ) : responses.length === 0 ? (
                            <View style={styles.center}>
                                <MessageSquare color="#cbd5e1" size={48} />
                                <Text style={styles.emptyText}>Chưa có ai trả lời khảo sát này</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={responses}
                                keyExtractor={(item) => item.id}
                                renderItem={renderItem}
                                contentContainerStyle={{ padding: 20, gap: 12 }}
                            />
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Platform.select({ web: 20, default: 0 }),
    },
    modalContainer: {
        backgroundColor: '#fff',
        borderRadius: Platform.select({ web: 16, default: 0 }),
        width: '100%',
        maxWidth: 700,
        height: Platform.select({ web: '85%', default: '100%' }),
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#0f172a',
        flex: 1,
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#94a3b8',
        marginTop: 12,
        fontWeight: '500',
    },
    responseCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    responseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        paddingBottom: 12,
        marginBottom: 12,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(124, 58, 237, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.primary,
    },
    userName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#0f172a',
    },
    deptRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    deptText: {
        fontSize: 12,
        color: '#64748b',
    },
    dateText: {
        fontSize: 12,
        color: '#94a3b8',
    },
    answersContainer: {
        gap: 12,
    },
    answerItem: {
        backgroundColor: '#f8fafc',
        padding: 10,
        borderRadius: 8,
    },
    qText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
        marginBottom: 4,
    },
    aText: {
        fontSize: 14,
        color: '#0f172a',
        fontWeight: '600',
        paddingLeft: 8,
        borderLeftWidth: 2,
        borderLeftColor: Colors.primary,
    },
});
