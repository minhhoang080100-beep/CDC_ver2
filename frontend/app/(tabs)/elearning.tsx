import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    ScrollView,
    Modal,
    Platform,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { api } from '../../utils/api';
import {
    BookOpen,
    Play,
    FileText,
    Type,
    CheckCircle2,
    Circle,
    Clock,
    Award,
    X,
    ChevronRight,
    AlertCircle,
} from 'lucide-react-native';
import { useFocusEffect } from 'expo-router';
import QuizModal from '../../components/QuizModal';

interface Lesson {
    title: string;
    type: string;
    url?: string;
    content?: string;
    duration?: number;
}

interface MyCourse {
    id: string;
    title: string;
    description?: string;
    category?: string;
    courseType: string;
    lessons: Lesson[];
    progress: number;
    completedLessons: number[];
    hasQuiz: boolean;
    quizResult?: { score: number; passed: boolean; correct: number; total: number } | null;
    enrolled: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
    'An toàn lao động': '🛡️',
    'Nghiệp vụ': '📋',
    'Kỹ năng mềm': '🤝',
    'Quy định': '📜',
};

export default function ElearningScreen() {
    const { token } = useAuth();
    const { showToast } = useToast();
    const { isDesktop } = useResponsive();
    const [courses, setCourses] = useState<MyCourse[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState<MyCourse | null>(null);
    const [courseDetailVisible, setCourseDetailVisible] = useState(false);
    const [quizModalVisible, setQuizModalVisible] = useState(false);
    const [quizCourseId, setQuizCourseId] = useState('');
    const [viewingLessonIdx, setViewingLessonIdx] = useState<number | null>(null);

    const fetchCourses = async () => {
        try {
            const res = await api.get('/api/elearning/my-courses', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setCourses(res.data || []);
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchCourses(); }, []));

    const onRefresh = () => { setRefreshing(true); fetchCourses(); };

    const openCourse = (course: MyCourse) => {
        setSelectedCourse(course);
        setCourseDetailVisible(true);
    };

    const handleCompleteLesson = async (courseId: string, lessonIndex: number) => {
        try {
            await api.post(`/api/elearning/${courseId}/complete-lesson?lessonIndex=${lessonIndex}`, {}, {
                headers: { Authorization: `Bearer ${token}` },
            });
            // Update local state
            setCourses(prev => prev.map(c => {
                if (c.id === courseId) {
                    const newCompleted = [...c.completedLessons];
                    if (!newCompleted.includes(lessonIndex)) {
                        newCompleted.push(lessonIndex);
                    }
                    return {
                        ...c,
                        completedLessons: newCompleted,
                        progress: Math.round(newCompleted.length / c.lessons.length * 100),
                    };
                }
                return c;
            }));
            if (selectedCourse && selectedCourse.id === courseId) {
                setSelectedCourse(prev => {
                    if (!prev) return null;
                    const newCompleted = [...prev.completedLessons];
                    if (!newCompleted.includes(lessonIndex)) newCompleted.push(lessonIndex);
                    return {
                        ...prev,
                        completedLessons: newCompleted,
                        progress: Math.round(newCompleted.length / prev.lessons.length * 100),
                    };
                });
            }
            showToast({ message: 'Đã hoàn thành bài học!', type: 'success' });
        } catch (error) {
            showToast({ message: 'Lỗi cập nhật', type: 'error' });
        }
    };

    const getEmbedUrl = (url: string, type: string): string | null => {
        if (type === 'VIDEO') {
            // YouTube
            const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
            if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
            // Google Drive
            const driveMatch = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
            if (driveMatch) return `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
            return url; // direct video URL
        }
        if (type === 'PDF') {
            // Use Google Docs viewer for PDFs
            return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
        }
        return null;
    };

    const openLesson = async (course: MyCourse, lesson: Lesson, index: number) => {
        // Auto-mark as completed when opened
        handleCompleteLesson(course.id, index);

        // Toggle inline viewer for all types
        setViewingLessonIdx(viewingLessonIdx === index ? null : index);
    };

    const startQuiz = (courseId: string) => {
        setQuizCourseId(courseId);
        setQuizModalVisible(true);
    };

    const getLessonIcon = (type: string) => {
        switch (type) {
            case 'VIDEO': return <Play color={Colors.primary} size={18} />;
            case 'PDF': return <FileText color="#ef4444" size={18} />;
            case 'TEXT': return <Type color="#f59e0b" size={18} />;
            default: return <BookOpen color={Colors.primary} size={18} />;
        }
    };

    const getProgressColor = (progress: number) => {
        if (progress >= 100) return '#10b981';
        if (progress >= 50) return '#f59e0b';
        return Colors.primary;
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>

                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>


            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[
                    styles.scrollContent,
                    isDesktop && { maxWidth: 680, alignSelf: 'center' as any, width: '100%' as any },
                    !isDesktop && { paddingBottom: 110 } // Tăng padding bottom cho mobile
                ]}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {courses.length === 0 ? (
                    <View style={styles.empty}>
                        <BookOpen color="#cbd5e1" size={64} />
                        <Text style={styles.emptyTitle}>Chưa có khóa học</Text>
                        <Text style={styles.emptySub}>Các khóa học sẽ xuất hiện tại đây khi được phân công</Text>
                    </View>
                ) : (
                    courses.map(course => (
                        <TouchableOpacity key={course.id} style={styles.courseCard} onPress={() => openCourse(course)} activeOpacity={0.7}>
                            <View style={styles.courseCardHeader}>
                                <View style={styles.categoryBadge}>
                                    <Text style={styles.categoryEmoji}>
                                        {CATEGORY_ICONS[course.category || ''] || '📚'}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={styles.courseCardTitleRow}>
                                        <Text style={styles.courseTitle} numberOfLines={2}>{course.title}</Text>
                                        {course.courseType === 'MANDATORY' && (
                                            <View style={styles.mandatoryBadge}>
                                                <AlertCircle color="#ef4444" size={12} />
                                                <Text style={styles.mandatoryText}>Bắt buộc</Text>
                                            </View>
                                        )}
                                    </View>
                                    {course.description && (
                                        <Text style={styles.courseDesc} numberOfLines={2}>{course.description}</Text>
                                    )}
                                    <View style={styles.courseMetaRow}>
                                        <Text style={styles.courseMeta}>
                                            📝 {course.lessons.length} bài học
                                        </Text>
                                        {course.hasQuiz && (
                                            <Text style={styles.courseMeta}>📋 Có bài thi</Text>
                                        )}
                                    </View>
                                </View>
                                <ChevronRight color="#94a3b8" size={22} />
                            </View>

                            {/* Progress Bar */}
                            <View style={styles.progressContainer}>
                                <View style={styles.progressBar}>
                                    <View style={[
                                        styles.progressFill,
                                        {
                                            width: `${course.progress}%` as any,
                                            backgroundColor: getProgressColor(course.progress),
                                        }
                                    ]} />
                                </View>
                                <Text style={[styles.progressText, { color: getProgressColor(course.progress) }]}>
                                    {course.progress}%
                                </Text>
                            </View>

                            {/* Quiz result */}
                            {course.quizResult && (
                                <View style={[styles.quizResultBadge, { backgroundColor: course.quizResult.passed ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                                    <Award color={course.quizResult.passed ? '#10b981' : '#ef4444'} size={14} />
                                    <Text style={{ color: course.quizResult.passed ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: '600' }}>
                                        Điểm thi: {course.quizResult.score}% {course.quizResult.passed ? '(Đạt)' : '(Chưa đạt)'}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>

            {/* Course Detail Modal */}
            <Modal visible={courseDetailVisible} animationType="fade" transparent onRequestClose={() => setCourseDetailVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle} numberOfLines={1}>📖 {selectedCourse?.title}</Text>
                            <TouchableOpacity onPress={() => setCourseDetailVisible(false)} style={styles.closeBtn}>
                                <X color="#64748b" size={24} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody}>
                            {selectedCourse?.description && (
                                <Text style={styles.detailDesc}>{selectedCourse.description}</Text>
                            )}

                            {/* Progress */}
                            <View style={styles.detailProgress}>
                                <Text style={styles.detailProgressLabel}>
                                    Tiến độ: {selectedCourse?.completedLessons.length}/{selectedCourse?.lessons.length} bài
                                </Text>
                                <View style={styles.progressBar}>
                                    <View style={[styles.progressFill, {
                                        width: `${selectedCourse?.progress || 0}%` as any,
                                        backgroundColor: getProgressColor(selectedCourse?.progress || 0),
                                    }]} />
                                </View>
                            </View>

                            {/* Lessons */}
                            <Text style={styles.sectionLabel}>Bài học</Text>
                            {selectedCourse?.lessons.map((lesson, idx) => {
                                const isCompleted = selectedCourse.completedLessons.includes(idx);
                                return (
                                    <TouchableOpacity
                                        key={idx}
                                        style={[styles.lessonItem, isCompleted && styles.lessonItemCompleted]}
                                        onPress={() => openLesson(selectedCourse, lesson, idx)}
                                    >
                                        <View style={styles.lessonIcon}>
                                            {isCompleted ? (
                                                <CheckCircle2 color="#10b981" size={20} />
                                            ) : (
                                                <Circle color="#94a3b8" size={20} />
                                            )}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.lessonTitle, isCompleted && { color: '#10b981' }]}>
                                                {lesson.title}
                                            </Text>
                                            <View style={styles.lessonMeta}>
                                                {getLessonIcon(lesson.type)}
                                                <Text style={styles.lessonType}>
                                                    {lesson.type === 'VIDEO' ? 'Video' : lesson.type === 'PDF' ? 'PDF' : 'Bài đọc'}
                                                </Text>
                                                {lesson.duration && (
                                                    <>
                                                        <Clock color="#94a3b8" size={14} />
                                                        <Text style={styles.lessonDuration}>{lesson.duration} phút</Text>
                                                    </>
                                                )}
                                            </View>
                                            {lesson.type === 'TEXT' && lesson.content && (
                                                <Text style={styles.lessonContent} numberOfLines={viewingLessonIdx === idx ? undefined : 4}>{lesson.content}</Text>
                                            )}
                                            {/* Inline Video/PDF Embed */}
                                            {viewingLessonIdx === idx && lesson.url && (lesson.type === 'VIDEO' || lesson.type === 'PDF') && Platform.OS === 'web' && (
                                                <View style={styles.embedContainer}>
                                                    {lesson.type === 'VIDEO' && !lesson.url.includes('youtube') && !lesson.url.includes('youtu.be') && !lesson.url.includes('drive.google.com') ? (
                                                        <video
                                                            src={lesson.url}
                                                            controls
                                                            playsInline
                                                            style={{ width: '100%', height: 340, borderRadius: 8, backgroundColor: '#000' } as any}
                                                        />
                                                    ) : (
                                                        <iframe
                                                            src={getEmbedUrl(lesson.url, lesson.type) || ''}
                                                            style={{ width: '100%', height: lesson.type === 'VIDEO' ? 340 : 500, border: 'none', borderRadius: 8 } as any}
                                                            allowFullScreen
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        />
                                                    )}
                                                </View>
                                            )}
                                            {viewingLessonIdx === idx && lesson.url && (lesson.type === 'VIDEO' || lesson.type === 'PDF') && Platform.OS !== 'web' && (
                                                <TouchableOpacity
                                                    style={styles.openExternalBtn}
                                                    onPress={() => Linking.openURL(lesson.url!)}
                                                >
                                                    <Text style={styles.openExternalText}>Mở {lesson.type === 'VIDEO' ? 'video' : 'PDF'} ↗</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}

                            {/* Quiz Button */}
                            {selectedCourse?.hasQuiz && (
                                <View style={styles.quizSection}>
                                    <Text style={styles.sectionLabel}>📋 Bài kiểm tra</Text>
                                    {selectedCourse.quizResult ? (
                                        <View style={[styles.quizResultCard, { borderColor: selectedCourse.quizResult.passed ? '#10b981' : '#ef4444' }]}>
                                            <Award color={selectedCourse.quizResult.passed ? '#10b981' : '#ef4444'} size={28} />
                                            <View>
                                                <Text style={styles.quizResultScore}>
                                                    Điểm: {selectedCourse.quizResult.score}%
                                                </Text>
                                                <Text style={styles.quizResultDetail}>
                                                    {selectedCourse.quizResult.correct}/{selectedCourse.quizResult.total} câu đúng
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                style={styles.retakeBtn}
                                                onPress={() => { setCourseDetailVisible(false); startQuiz(selectedCourse.id); }}
                                            >
                                                <Text style={styles.retakeBtnText}>Làm lại</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            style={styles.startQuizBtn}
                                            onPress={() => { setCourseDetailVisible(false); startQuiz(selectedCourse.id); }}
                                        >
                                            <Award color="#fff" size={20} />
                                            <Text style={styles.startQuizText}>Làm bài kiểm tra</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Quiz Modal */}
            <QuizModal
                visible={quizModalVisible}
                courseId={quizCourseId}
                onClose={() => { setQuizModalVisible(false); fetchCourses(); }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    headerDesktop: {
        paddingVertical: 10,
        paddingHorizontal: 24,
    },
    headerTitleFB: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#050505',
    },
    scrollContent: { padding: Platform.select({ ios: 12, android: 12, default: 16 }), gap: 14 },
    empty: { alignItems: 'center', paddingVertical: 80, gap: 12 },
    emptyTitle: { fontSize: 18, fontWeight: '600', color: '#94a3b8' },
    emptySub: { fontSize: 14, color: '#cbd5e1', textAlign: 'center' },
    // Course Card
    courseCard: {
        backgroundColor: '#fff', borderRadius: 8, padding: 16,
        borderWidth: 1, borderColor: Colors.border + '40',
        marginBottom: 12,
    },
    courseCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    categoryBadge: {
        width: 44, height: 44, borderRadius: 12,
        backgroundColor: '#f0f9ff', justifyContent: 'center', alignItems: 'center',
    },
    categoryEmoji: { fontSize: 22 },
    courseCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    courseTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
    mandatoryBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(239,68,68,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    },
    mandatoryText: { fontSize: 11, color: '#ef4444', fontWeight: '600' },
    courseDesc: { fontSize: 14, color: '#64748b', lineHeight: 20, marginTop: 4 },
    courseMetaRow: { flexDirection: 'row', gap: 14, marginTop: 8 },
    courseMeta: { fontSize: 13, color: '#94a3b8' },
    progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
    progressBar: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    progressText: { fontSize: 13, fontWeight: '700', minWidth: 36, textAlign: 'right' },
    quizResultBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginTop: 10, alignSelf: 'flex-start',
    },
    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
        padding: Platform.OS === 'web' ? 20 : 0,
    },
    modalContent: {
        backgroundColor: '#fff', borderRadius: Platform.OS === 'web' ? 16 : 0,
        width: '100%', maxWidth: 650,
        maxHeight: Platform.OS === 'web' ? '92%' : '100%',
        flex: Platform.OS === 'web' ? undefined : 1, overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 20, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', flex: 1 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    modalBody: { flex: 1, padding: 20 },
    detailDesc: { fontSize: 15, color: '#475569', lineHeight: 22, marginBottom: 16 },
    detailProgress: { marginBottom: 20 },
    detailProgressLabel: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
    sectionLabel: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginTop: 16, marginBottom: 10 },
    // Lesson items
    lessonItem: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        padding: Platform.OS === 'web' ? 14 : 12, borderRadius: 10, backgroundColor: '#f8fafc',
        borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8,
        minHeight: 52,
    },
    lessonItemCompleted: { backgroundColor: 'rgba(16,185,129,0.04)', borderColor: '#10b981' },
    lessonIcon: { paddingTop: 2 },
    lessonTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 4 },
    lessonMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    lessonType: { fontSize: 12, color: '#64748b' },
    lessonDuration: { fontSize: 12, color: '#94a3b8' },
    lessonContent: { fontSize: 13, color: '#475569', lineHeight: 20, marginTop: 8, backgroundColor: '#f0f9ff', padding: 10, borderRadius: 8, maxHeight: 200 },
    // Quiz
    quizSection: { marginTop: 10, marginBottom: 20 },
    quizResultCard: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 16, borderRadius: 12, borderWidth: 2, backgroundColor: '#fafafa',
    },
    quizResultScore: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    quizResultDetail: { fontSize: 13, color: '#64748b' },
    retakeBtn: {
        marginLeft: 'auto', backgroundColor: Colors.primary,
        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    },
    retakeBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    startQuizBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 10,
    },
    startQuizText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    // Embed
    embedContainer: {
        marginTop: 10, borderRadius: 8, overflow: 'hidden',
        backgroundColor: '#000', borderWidth: 1, borderColor: '#e2e8f0',
    },
    openExternalBtn: {
        marginTop: 8, backgroundColor: Colors.primary,
        paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, alignSelf: 'flex-start',
        minHeight: 44, justifyContent: 'center', // Touch target
    },
    openExternalText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});
