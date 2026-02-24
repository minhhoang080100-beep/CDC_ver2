import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { ArrowLeft, Calendar, User, Tag } from 'lucide-react-native';

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
        marginBottom: 40,
    },
});
