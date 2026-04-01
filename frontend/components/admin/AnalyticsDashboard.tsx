import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { Users, FileText, Calendar, MessageSquare, CheckCircle, Clock } from 'lucide-react-native';

interface AnalyticsData {
    summary: {
        totalUsers: number;
        activeUsers: number;
        totalActivities: number;
        totalRegistrations: number;
        totalCheckins: number;
        totalPosts: number;
        totalFeedbacks: number;
        resolvedFeedbacks: number;
        pendingFeedbacks: number;
    };
    charts: {
        postsByCategory: { name: string, count: number }[];
        usersByDepartment: { name: string, count: number }[];
    }
}

export default function AnalyticsDashboard() {
    const { token } = useAuth();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await api.get('/api/analytics', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res.data);
        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    if (loading || !data) {
        return <View style={styles.center}><Text>Đang tải dữ liệu...</Text></View>;
    }

    const { summary, charts } = data;

    const renderBarChart = (title: string, dataPoints: { name: string, count: number }[], maxVal: number) => {
        return (
            <View style={styles.chartCard}>
                <Text style={styles.chartTitle}>{title}</Text>
                <View style={styles.chartBody}>
                    {dataPoints.map((point, index) => {
                        const widthPct = maxVal > 0 ? (point.count / maxVal) * 100 : 0;
                        return (
                            <View key={index} style={styles.barRow}>
                                <Text style={styles.barLabel} numberOfLines={1}>{point.name || 'Khác'}</Text>
                                <View style={styles.barContainer}>
                                    <View style={[styles.barFill, { width: `${widthPct}%` }]} />
                                </View>
                                <Text style={styles.barValue}>{point.count}</Text>
                            </View>
                        );
                    })}
                </View>
            </View>
        );
    };

    const maxPosts = Math.max(...charts.postsByCategory.map(p => p.count), 1);
    const maxUsers = Math.max(...charts.usersByDepartment.map(u => u.count), 1);

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
        >
            <Text style={styles.sectionTitle}>Tổng quan hệ thống</Text>

            <View style={styles.grid}>
                <View style={[styles.statCard, { borderLeftColor: '#3b82f6' }]}>
                    <Users color="#3b82f6" size={24} />
                    <View style={styles.statInfo}>
                        <Text style={styles.statValue}>{summary.totalUsers}</Text>
                        <Text style={styles.statLabel}>Tài khoản</Text>
                    </View>
                </View>

                <View style={[styles.statCard, { borderLeftColor: '#22c55e' }]}>
                    <FileText color="#22c55e" size={24} />
                    <View style={styles.statInfo}>
                        <Text style={styles.statValue}>{summary.totalPosts}</Text>
                        <Text style={styles.statLabel}>Bài viết</Text>
                    </View>
                </View>

                <View style={[styles.statCard, { borderLeftColor: '#f59e0b' }]}>
                    <Calendar color="#f59e0b" size={24} />
                    <View style={styles.statInfo}>
                        <Text style={styles.statValue}>{summary.totalActivities}</Text>
                        <Text style={styles.statLabel}>Hoạt động</Text>
                    </View>
                </View>

                <View style={[styles.statCard, { borderLeftColor: '#ef4444' }]}>
                    <MessageSquare color="#ef4444" size={24} />
                    <View style={styles.statInfo}>
                        <Text style={styles.statValue}>{summary.totalFeedbacks}</Text>
                        <Text style={styles.statLabel}>Góp ý & Giải đáp</Text>
                    </View>
                </View>
            </View>

            <View style={styles.grid}>
                <View style={styles.detailedCard}>
                    <Text style={styles.dCardTitle}>Trạng thái Tài khoản</Text>
                    <View style={styles.dCardRow}>
                        <CheckCircle color={Colors.status.success} size={16} /><Text style={styles.dCardText}>{summary.activeUsers} Đang hoạt động</Text>
                    </View>
                    <View style={styles.dCardRow}>
                        <Clock color={Colors.text.placeholder} size={16} /><Text style={styles.dCardText}>{summary.totalUsers - summary.activeUsers} Chưa kích hoạt/Khóa</Text>
                    </View>
                </View>

                <View style={styles.detailedCard}>
                    <Text style={styles.dCardTitle}>Tương tác Hoạt động</Text>
                    <View style={styles.dCardRow}>
                        <Text style={styles.dCardTextBold}>{summary.totalRegistrations}</Text><Text style={styles.dCardText}>Lượt đăng ký tham gia</Text>
                    </View>
                    <View style={styles.dCardRow}>
                        <Text style={styles.dCardTextBold}>{summary.totalCheckins}</Text><Text style={styles.dCardText}>Lượt điểm danh</Text>
                    </View>
                </View>

                <View style={styles.detailedCard}>
                    <Text style={styles.dCardTitle}>Xử lý Khiếu nại</Text>
                    <View style={styles.dCardRow}>
                        <CheckCircle color={Colors.status.success} size={16} /><Text style={styles.dCardText}>{summary.resolvedFeedbacks} Đã giải quyết</Text>
                    </View>
                    <View style={styles.dCardRow}>
                        <Clock color={Colors.status.warning} size={16} /><Text style={styles.dCardText}>{summary.pendingFeedbacks} Đang chờ xử lý</Text>
                    </View>
                </View>
            </View>

            <Text style={styles.sectionTitle}>Biểu đồ phân bổ</Text>

            <View style={styles.chartsWrapper}>
                {renderBarChart('Bài viết theo Chuyên mục', charts.postsByCategory, maxPosts)}
                {renderBarChart('Tài khoản theo Đơn vị', charts.usersByDepartment, maxUsers)}
            </View>

            <View style={{ height: 40 }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    content: { padding: 20 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 16, marginTop: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
    statCard: {
        flex: 1,
        minWidth: 150,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    statInfo: { flex: 1 },
    statValue: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
    statLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },

    detailedCard: {
        flex: 1,
        minWidth: 250,
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    dCardTitle: { fontSize: 14, fontWeight: 'bold', color: '#475569', marginBottom: 12 },
    dCardRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    dCardText: { fontSize: 13, color: '#334155' },
    dCardTextBold: { fontSize: 14, fontWeight: 'bold', color: Colors.primary, width: 24, textAlign: 'center' },

    chartsWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
    chartCard: {
        flex: 1,
        minWidth: 300,
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    chartTitle: { fontSize: 15, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
    chartBody: { gap: 16 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    barLabel: { width: 100, fontSize: 13, color: '#475569' },
    barContainer: { flex: 1, height: 24, backgroundColor: '#f1f5f9', borderRadius: 12, overflow: 'hidden' },
    barFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 12 },
    barValue: { width: 30, fontSize: 13, fontWeight: 'bold', color: '#0f172a', textAlign: 'right' },
});
