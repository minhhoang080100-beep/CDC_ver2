import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useResponsive } from '../../hooks/useResponsive';
import { Colors } from '../../constants/Colors';
import { api } from '../../utils/api';
import {
    Plus,
    Trash2,
    Eye,
    BookOpen,
    FileText,
    Play,
    Type,
    X,
    ChevronDown,
    ChevronUp,
    BarChart2,
    AlertCircle,
    Edit,
    UploadCloud,
    CheckCircle2,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';

const DEPT_LABELS: Record<string, string> = {
    VAN_PHONG_CANG: 'VP Cảng', CUA_LO: 'Cửa Lò', BEN_THUY: 'Bến Thủy',
};

const CATEGORIES = ['An toàn lao động', 'Nghiệp vụ', 'Kỹ năng mềm', 'Quy định'];

export default function ElearningManagement() {
    const { token } = useAuth();
    const { isDesktop } = useResponsive();
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();
    const [courses, setCourses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Course modal
    const [courseModalVisible, setCourseModalVisible] = useState(false);
    const [courseTitle, setCourseTitle] = useState('');
    const [courseDesc, setCourseDesc] = useState('');
    const [courseCategory, setCourseCategory] = useState('');
    const [courseType, setCourseType] = useState<'OPTIONAL' | 'MANDATORY'>('OPTIONAL');
    const [courseDepts, setCourseDepts] = useState<string[]>([]);
    const [lessons, setLessons] = useState<any[]>([]);
    const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
    const [uploadingLessonIdx, setUploadingLessonIdx] = useState<number | null>(null);

    const CLOUD_NAME = 'dljjearo2';
    const UPLOAD_PRESET = 'CDCnghetinh';

    // Quiz modal
    const [quizModalVisible, setQuizModalVisible] = useState(false);
    const [quizCourseId, setQuizCourseId] = useState('');
    const [quizTitle, setQuizTitle] = useState('');
    const [quizTimeLimit, setQuizTimeLimit] = useState('');
    const [quizPassingScore, setQuizPassingScore] = useState('70');
    const [questions, setQuestions] = useState<any[]>([]);

    // Stats
    const [statsModalVisible, setStatsModalVisible] = useState(false);
    const [stats, setStats] = useState<any>(null);

    const [submitting, setSubmitting] = useState(false);

    useEffect(() => { fetchCourses(); }, []);

    const fetchCourses = async () => {
        try {
            const res = await api.get('/api/elearning', { headers: { Authorization: `Bearer ${token}` } });
            setCourses(res.data?.items || res.data || []);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    // ─── Course CRUD ─────────────────────

    const openNewCourse = () => {
        setEditingCourseId(null);
        setCourseTitle(''); setCourseDesc(''); setCourseCategory('');
        setCourseType('OPTIONAL'); setCourseDepts([]); setLessons([]);
        setCourseModalVisible(true);
    };

    const openEditCourse = async (courseId: string) => {
        try {
            const res = await api.get(`/api/elearning/${courseId}`, { headers: { Authorization: `Bearer ${token}` } });
            const c = res.data;
            setEditingCourseId(c.id);
            setCourseTitle(c.title || '');
            setCourseDesc(c.description || '');
            setCourseCategory(c.category || '');
            setCourseType(c.courseType || 'OPTIONAL');
            setCourseDepts(c.targetDepartments || []);
            setLessons(c.lessons || []);
            setCourseModalVisible(true);
        } catch (e: any) {
            showToast({ message: e.response?.data?.detail || 'Lỗi tải chi tiết khóa học', type: 'error' });
        }
    };

    const pickLessonDocument = async (idx: number) => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: '*/*',
                copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                await uploadLessonToCloudinary(file, idx);
            }
        } catch (error) {
            console.error('Error picking document:', error);
            showToast({ message: 'Lỗi khi chọn tài liệu', type: 'error' });
        }
    };

    const uploadLessonToCloudinary = async (fileObj: any, idx: number) => {
        setUploadingLessonIdx(idx);
        try {
            const formData = new FormData();
            if (Platform.OS === 'web') {
                if (fileObj.file) {
                    formData.append('file', fileObj.file);
                } else {
                    try {
                        const res = await fetch(fileObj.uri);
                        const blob = await res.blob();
                        formData.append('file', blob, fileObj.name || 'lesson.file');
                    } catch (e) {
                        formData.append('file', fileObj.uri);
                    }
                }
            } else {
                formData.append('file', {
                    uri: fileObj.uri,
                    type: fileObj.mimeType || 'application/pdf',
                    name: fileObj.name,
                } as any);
            }
            formData.append('upload_preset', UPLOAD_PRESET);
            formData.append('folder', 'elearning-assets');

            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (response.ok && data.secure_url) {
                updateLesson(idx, 'url', data.secure_url);
                showToast({ message: 'Tải tài liệu lên thành công!', type: 'success' });
            } else {
                throw new Error(data.error?.message || 'Upload failed');
            }
        } catch (error: any) {
            console.error('Error uploading lesson to Cloudinary:', error);
            showToast({ message: error.message || 'Upload tài liệu thất bại', type: 'error' });
        } finally {
            setUploadingLessonIdx(null);
        }
    };

    const addLesson = () => {
        setLessons(prev => [...prev, { title: '', type: 'TEXT', url: '', content: '', duration: '' }]);
    };

    const updateLesson = (idx: number, field: string, value: string) => {
        setLessons(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
    };

    const removeLesson = (idx: number) => {
        setLessons(prev => prev.filter((_, i) => i !== idx));
    };

    const handleCreateCourse = async () => {
        if (!courseTitle.trim()) {
            showToast({ message: 'Vui lòng nhập tên khóa học', type: 'error' }); return;
        }

        const hasEmptyLessonTitle = lessons.some(l => !l.title || !l.title.trim());
        if (hasEmptyLessonTitle) {
            showToast({ message: 'Vui lòng nhập tên cho tất cả các bài học', type: 'error' }); return;
        }

        setSubmitting(true);
        try {
            const payload = {
                title: courseTitle.trim(),
                description: courseDesc.trim() || null,
                category: courseCategory || null,
                courseType,
                targetDepartments: courseDepts,
                lessons: lessons.map(l => ({
                    title: l.title.trim(),
                    type: l.type,
                    url: l.url?.trim() || null,
                    content: l.content?.trim() || null,
                    duration: l.duration ? parseInt(l.duration) : null,
                })),
            };

            if (editingCourseId) {
                await api.put(`/api/elearning/${editingCourseId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
                showToast({ message: 'Cập nhật khóa học thành công!', type: 'success' });
            } else {
                await api.post('/api/elearning', payload, { headers: { Authorization: `Bearer ${token}` } });
                showToast({ message: 'Tạo khóa học thành công!', type: 'success' });
            }

            setCourseModalVisible(false);
            fetchCourses();
        } catch (e: any) {
            showToast({ message: e.response?.data?.detail || 'Lỗi lưu khóa học', type: 'error' });
        } finally { setSubmitting(false); }
    };

    const handleDeleteCourse = (courseId: string, title: string) => {
        showConfirm({
            title: 'Xóa khóa học',
            message: `Xóa "${title}"? Tất cả đề thi và tiến độ sẽ bị mất.`,
            onConfirm: async () => {
                try {
                    await api.delete(`/api/elearning/${courseId}`, { headers: { Authorization: `Bearer ${token}` } });
                    showToast({ message: 'Đã xóa', type: 'success' });
                    fetchCourses();
                } catch (e) { showToast({ message: 'Lỗi xóa', type: 'error' }); }
            },
        });
    };

    // ─── Quiz CRUD ───────────────────────

    const openNewQuiz = (courseId: string) => {
        setQuizCourseId(courseId);
        setQuizTitle(''); setQuizTimeLimit(''); setQuizPassingScore('70');
        setQuestions([]);
        setQuizModalVisible(true);
    };

    const addQuestion = () => {
        setQuestions(prev => [...prev, { content: '', type: 'MULTIPLE_CHOICE', options: ['', '', '', ''], correctAnswer: 0 }]);
    };

    const updateQuestion = (idx: number, field: string, value: any) => {
        setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
    };

    const updateOption = (qIdx: number, oIdx: number, value: string) => {
        setQuestions(prev => prev.map((q, i) => {
            if (i !== qIdx) return q;
            const opts = [...q.options];
            opts[oIdx] = value;
            return { ...q, options: opts };
        }));
    };

    const removeQuestion = (idx: number) => {
        setQuestions(prev => prev.filter((_, i) => i !== idx));
    };

    const handleCreateQuiz = async () => {
        if (!quizTitle.trim() || questions.length === 0) {
            showToast({ message: 'Nhập tiêu đề và ít nhất 1 câu hỏi', type: 'error' }); return;
        }
        setSubmitting(true);
        try {
            await api.post('/api/elearning/quizzes', {
                courseId: quizCourseId,
                title: quizTitle.trim(),
                questions: questions.map(q => ({
                    content: q.content.trim(),
                    type: q.type,
                    options: q.type === 'TRUE_FALSE' ? ['Đúng', 'Sai'] : q.options.filter((o: string) => o.trim()),
                    correctAnswer: q.correctAnswer,
                })),
                timeLimit: quizTimeLimit ? parseInt(quizTimeLimit) : null,
                passingScore: parseInt(quizPassingScore) || 70,
            }, { headers: { Authorization: `Bearer ${token}` } });
            showToast({ message: 'Tạo đề thi thành công!', type: 'success' });
            setQuizModalVisible(false);
            fetchCourses();
        } catch (e: any) {
            showToast({ message: e.response?.data?.detail || 'Lỗi tạo đề thi', type: 'error' });
        } finally { setSubmitting(false); }
    };

    // ─── Stats ───────────────────────────

    const viewStats = async (courseId: string) => {
        try {
            const res = await api.get(`/api/elearning/${courseId}/stats`, { headers: { Authorization: `Bearer ${token}` } });
            setStats(res.data);
            setStatsModalVisible(true);
        } catch (e: any) {
            showToast({ message: e.response?.data?.detail || 'Lỗi tải thống kê', type: 'error' });
        }
    };

    const toggleDept = (dept: string) => {
        setCourseDepts(prev => prev.includes(dept) ? prev.filter(d => d !== dept) : [...prev, dept]);
    };

    if (loading) return <ActivityIndicator style={{ marginTop: 40 }} size="large" color={Colors.primary} />;

    return (
        <ScrollView style={[styles.container, isDesktop && styles.containerDesktop]}>
            {/* Top Actions */}
            <View style={styles.topBar}>
                <Text style={styles.title}>📚 Quản lý E-learning</Text>
                <TouchableOpacity style={styles.addBtn} onPress={openNewCourse}>
                    <Plus color="#fff" size={18} />
                    <Text style={styles.addBtnText}>Tạo khóa học</Text>
                </TouchableOpacity>
            </View>

            {/* Course List */}
            {courses.length === 0 ? (
                <View style={styles.empty}>
                    <BookOpen color="#cbd5e1" size={48} />
                    <Text style={styles.emptyText}>Chưa có khóa học</Text>
                </View>
            ) : (
                courses.map(c => (
                    <View key={c.id} style={styles.courseCard}>
                        <View style={styles.courseRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.courseName}>{c.title}</Text>
                                <Text style={styles.courseMeta}>
                                    {c.category || 'Chung'} • {c.lessonCount} bài học • {c.quizCount} đề thi • {c.enrollmentCount} học viên
                                </Text>
                                <View style={styles.badgeRow}>
                                    <View style={[styles.badge, { backgroundColor: c.status === 'PUBLISHED' ? '#ecfdf5' : '#fef9c3' }]}>
                                        <Text style={{ fontSize: 12, color: c.status === 'PUBLISHED' ? '#10b981' : '#f59e0b', fontWeight: '600' }}>
                                            {c.status === 'PUBLISHED' ? 'Đã xuất bản' : c.status}
                                        </Text>
                                    </View>
                                    {c.courseType === 'MANDATORY' && (
                                        <View style={[styles.badge, { backgroundColor: '#fef2f2' }]}>
                                            <AlertCircle color="#ef4444" size={12} />
                                            <Text style={{ fontSize: 12, color: '#ef4444', fontWeight: '600' }}>Bắt buộc</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            <View style={styles.actionRow}>
                                <TouchableOpacity style={styles.iconBtn} onPress={() => viewStats(c.id)}>
                                    <BarChart2 color="#3b82f6" size={18} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.iconBtn} onPress={() => openNewQuiz(c.id)}>
                                    <FileText color="#f59e0b" size={18} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.iconBtn} onPress={() => openEditCourse(c.id)}>
                                    <Edit color="#8b5cf6" size={18} />
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.iconBtn} onPress={() => handleDeleteCourse(c.id, c.title)}>
                                    <Trash2 color="#ef4444" size={18} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ))
            )}

            {/* ═══ Create Course Modal ═══ */}
            <Modal visible={courseModalVisible} animationType="fade" transparent onRequestClose={() => setCourseModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingCourseId ? '✏️ Chỉnh sửa khóa học' : '📚 Tạo khóa học mới'}</Text>
                            <TouchableOpacity onPress={() => setCourseModalVisible(false)} style={styles.closeBtn}>
                                <X color="#64748b" size={24} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.label}>Tên khóa học *</Text>
                            <TextInput style={styles.input} value={courseTitle} onChangeText={setCourseTitle}
                                placeholder="VD: An toàn lao động cảng biển" placeholderTextColor="#94a3b8" />

                            <Text style={styles.label}>Mô tả</Text>
                            <TextInput style={[styles.input, { minHeight: 60 }]} value={courseDesc} onChangeText={setCourseDesc}
                                placeholder="Mô tả ngắn..." placeholderTextColor="#94a3b8" multiline textAlignVertical="top" />

                            <Text style={styles.label}>Danh mục</Text>
                            <View style={styles.chipRow}>
                                {CATEGORIES.map(cat => (
                                    <TouchableOpacity key={cat}
                                        style={[styles.chip, courseCategory === cat && styles.chipActive]}
                                        onPress={() => setCourseCategory(courseCategory === cat ? '' : cat)}>
                                        <Text style={[styles.chipText, courseCategory === cat && styles.chipTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Loại khóa học</Text>
                            <View style={styles.chipRow}>
                                <TouchableOpacity style={[styles.chip, courseType === 'OPTIONAL' && styles.chipActive]}
                                    onPress={() => setCourseType('OPTIONAL')}>
                                    <Text style={[styles.chipText, courseType === 'OPTIONAL' && styles.chipTextActive]}>Tự do</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.chip, courseType === 'MANDATORY' && styles.chipActive]}
                                    onPress={() => setCourseType('MANDATORY')}>
                                    <Text style={[styles.chipText, courseType === 'MANDATORY' && styles.chipTextActive]}>Bắt buộc</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.label}>Phân công phòng ban (bỏ trống = tất cả)</Text>
                            <View style={styles.chipRow}>
                                {Object.entries(DEPT_LABELS).map(([key, label]) => (
                                    <TouchableOpacity key={key}
                                        style={[styles.chip, courseDepts.includes(key) && styles.chipActive]}
                                        onPress={() => toggleDept(key)}>
                                        <Text style={[styles.chipText, courseDepts.includes(key) && styles.chipTextActive]}>{label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Lessons Builder */}
                            <View style={styles.sectionHeader}>
                                <Text style={styles.label}>Bài học</Text>
                                <TouchableOpacity style={styles.addSmallBtn} onPress={addLesson}>
                                    <Plus color={Colors.primary} size={16} />
                                    <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 13 }}>Thêm bài</Text>
                                </TouchableOpacity>
                            </View>

                            {lessons.map((lesson, idx) => (
                                <View key={idx} style={styles.lessonBuilder}>
                                    <View style={styles.lessonBuilderHeader}>
                                        <Text style={styles.lessonBuilderNum}>Bài {idx + 1}</Text>
                                        <TouchableOpacity onPress={() => removeLesson(idx)}>
                                            <Trash2 color="#ef4444" size={16} />
                                        </TouchableOpacity>
                                    </View>
                                    <TextInput style={[styles.inputSmall, !lesson.title.trim() && { borderColor: '#fca5a5', borderWidth: 1 }]} value={lesson.title}
                                        onChangeText={v => updateLesson(idx, 'title', v)}
                                        placeholder="Tên bài học (* Bắt buộc)" placeholderTextColor="#f87171" />
                                    {!lesson.title.trim() && (
                                        <Text style={{ fontSize: 11, color: '#ef4444', marginBottom: 6, marginTop: -4, marginLeft: 2 }}>
                                            * Bạn phải nhập tên cho bài học này
                                        </Text>
                                    )}
                                    <View style={styles.chipRow}>
                                        {[
                                            { key: 'TEXT', label: 'Bài đọc', icon: <Type color={lesson.type === 'TEXT' ? Colors.primary : '#64748b'} size={14} /> },
                                            { key: 'VIDEO', label: 'Video', icon: <Play color={lesson.type === 'VIDEO' ? Colors.primary : '#64748b'} size={14} /> },
                                            { key: 'PDF', label: 'PDF', icon: <FileText color={lesson.type === 'PDF' ? Colors.primary : '#64748b'} size={14} /> },
                                        ].map(t => (
                                            <TouchableOpacity key={t.key}
                                                style={[styles.chipSmall, lesson.type === t.key && styles.chipActive]}
                                                onPress={() => updateLesson(idx, 'type', t.key)}>
                                                {t.icon}
                                                <Text style={[styles.chipSmallText, lesson.type === t.key && styles.chipTextActive]}>{t.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    {(lesson.type === 'VIDEO' || lesson.type === 'PDF') && (
                                        <View>
                                            {lesson.url && lesson.url.includes('api.cloudinary') ? null : (
                                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                                                    <TextInput style={[styles.inputSmall, { flex: 1, marginBottom: 0 }]} value={lesson.url}
                                                        onChangeText={v => updateLesson(idx, 'url', v)}
                                                        placeholder="Nhập URL hoặc tải file =>" placeholderTextColor="#94a3b8" />
                                                    <TouchableOpacity style={styles.uploadBtn} onPress={() => pickLessonDocument(idx)} disabled={uploadingLessonIdx === idx}>
                                                        {uploadingLessonIdx === idx ? <ActivityIndicator size="small" color="#fff" /> : <UploadCloud color="#fff" size={16} />}
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                            {lesson.url && (
                                                <View style={styles.uploadedFileBadge}>
                                                    <CheckCircle2 color="#10b981" size={14} />
                                                    <Text style={styles.uploadedFileText} numberOfLines={1}>{lesson.url}</Text>
                                                    <TouchableOpacity onPress={() => updateLesson(idx, 'url', '')}>
                                                        <X color="#ef4444" size={16} />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                    {lesson.type === 'TEXT' && (
                                        <TextInput style={[styles.inputSmall, { minHeight: 60 }]} value={lesson.content}
                                            onChangeText={v => updateLesson(idx, 'content', v)}
                                            placeholder="Nội dung bài học..." placeholderTextColor="#94a3b8" multiline textAlignVertical="top" />
                                    )}
                                    <TextInput style={styles.inputSmall} value={lesson.duration}
                                        onChangeText={v => updateLesson(idx, 'duration', v)}
                                        placeholder="Thời lượng (phút)" placeholderTextColor="#94a3b8" keyboardType="numeric" />
                                </View>
                            ))}
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                                onPress={handleCreateCourse} disabled={submitting}>
                                <Text style={styles.submitBtnText}>{submitting ? 'Đang lưu...' : (editingCourseId ? 'Cập nhật' : 'Tạo khóa học')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ═══ Create Quiz Modal ═══ */}
            <Modal visible={quizModalVisible} animationType="fade" transparent onRequestClose={() => setQuizModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>📋 Tạo đề thi</Text>
                            <TouchableOpacity onPress={() => setQuizModalVisible(false)} style={styles.closeBtn}>
                                <X color="#64748b" size={24} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            <Text style={styles.label}>Tiêu đề đề thi *</Text>
                            <TextInput style={styles.input} value={quizTitle} onChangeText={setQuizTitle}
                                placeholder="VD: Bài kiểm tra An toàn lao động" placeholderTextColor="#94a3b8" />

                            <View style={styles.rowInputs}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Thời gian (phút)</Text>
                                    <TextInput style={styles.input} value={quizTimeLimit} onChangeText={setQuizTimeLimit}
                                        placeholder="VD: 15" placeholderTextColor="#94a3b8" keyboardType="numeric" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Điểm đạt (%)</Text>
                                    <TextInput style={styles.input} value={quizPassingScore} onChangeText={setQuizPassingScore}
                                        placeholder="70" placeholderTextColor="#94a3b8" keyboardType="numeric" />
                                </View>
                            </View>

                            <View style={styles.sectionHeader}>
                                <Text style={styles.label}>Câu hỏi</Text>
                                <TouchableOpacity style={styles.addSmallBtn} onPress={addQuestion}>
                                    <Plus color={Colors.primary} size={16} />
                                    <Text style={{ color: Colors.primary, fontWeight: '600', fontSize: 13 }}>Thêm câu</Text>
                                </TouchableOpacity>
                            </View>

                            {questions.map((q, qIdx) => (
                                <View key={qIdx} style={styles.questionBuilder}>
                                    <View style={styles.lessonBuilderHeader}>
                                        <Text style={styles.lessonBuilderNum}>Câu {qIdx + 1}</Text>
                                        <TouchableOpacity onPress={() => removeQuestion(qIdx)}>
                                            <Trash2 color="#ef4444" size={16} />
                                        </TouchableOpacity>
                                    </View>
                                    <TextInput style={[styles.inputSmall, { minHeight: 50 }]} value={q.content}
                                        onChangeText={v => updateQuestion(qIdx, 'content', v)}
                                        placeholder="Nội dung câu hỏi" placeholderTextColor="#94a3b8" multiline textAlignVertical="top" />

                                    <View style={styles.chipRow}>
                                        <TouchableOpacity style={[styles.chipSmall, q.type === 'MULTIPLE_CHOICE' && styles.chipActive]}
                                            onPress={() => updateQuestion(qIdx, 'type', 'MULTIPLE_CHOICE')}>
                                            <Text style={[styles.chipSmallText, q.type === 'MULTIPLE_CHOICE' && styles.chipTextActive]}>Trắc nghiệm</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.chipSmall, q.type === 'TRUE_FALSE' && styles.chipActive]}
                                            onPress={() => updateQuestion(qIdx, 'type', 'TRUE_FALSE')}>
                                            <Text style={[styles.chipSmallText, q.type === 'TRUE_FALSE' && styles.chipTextActive]}>Đúng/Sai</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {q.type === 'MULTIPLE_CHOICE' ? (
                                        <View style={{ gap: 6 }}>
                                            {q.options.map((opt: string, oIdx: number) => (
                                                <View key={oIdx} style={styles.optionRow}>
                                                    <TouchableOpacity
                                                        style={[styles.correctBtn, q.correctAnswer === oIdx && styles.correctBtnActive]}
                                                        onPress={() => updateQuestion(qIdx, 'correctAnswer', oIdx)}>
                                                        <Text style={{ fontSize: 10, color: q.correctAnswer === oIdx ? '#fff' : '#94a3b8' }}>
                                                            {q.correctAnswer === oIdx ? '✓' : String.fromCharCode(65 + oIdx)}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TextInput style={[styles.inputSmall, { flex: 1, marginBottom: 0 }]}
                                                        value={opt} onChangeText={v => updateOption(qIdx, oIdx, v)}
                                                        placeholder={`Đáp án ${String.fromCharCode(65 + oIdx)}`} placeholderTextColor="#94a3b8" />
                                                </View>
                                            ))}
                                        </View>
                                    ) : (
                                        <View style={{ gap: 6 }}>
                                            {['Đúng', 'Sai'].map((opt, oIdx) => (
                                                <TouchableOpacity key={oIdx} style={styles.optionRow}
                                                    onPress={() => updateQuestion(qIdx, 'correctAnswer', oIdx)}>
                                                    <View style={[styles.correctBtn, q.correctAnswer === oIdx && styles.correctBtnActive]}>
                                                        <Text style={{ fontSize: 10, color: q.correctAnswer === oIdx ? '#fff' : '#94a3b8' }}>
                                                            {q.correctAnswer === oIdx ? '✓' : ''}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.tfText}>{opt}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            ))}
                        </ScrollView>
                        <View style={styles.modalFooter}>
                            <TouchableOpacity style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                                onPress={handleCreateQuiz} disabled={submitting}>
                                <Text style={styles.submitBtnText}>{submitting ? 'Đang tạo...' : 'Tạo đề thi'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ═══ Stats Modal ═══ */}
            <Modal visible={statsModalVisible} animationType="fade" transparent onRequestClose={() => setStatsModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>📊 Thống kê: {stats?.title}</Text>
                            <TouchableOpacity onPress={() => setStatsModalVisible(false)} style={styles.closeBtn}>
                                <X color="#64748b" size={24} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalBody}>
                            {stats && (
                                <>
                                    <View style={styles.statsGrid}>
                                        <View style={styles.statBox}>
                                            <Text style={styles.statNum}>{stats.totalEnrolled}</Text>
                                            <Text style={styles.statLabel}>Học viên</Text>
                                        </View>
                                        <View style={styles.statBox}>
                                            <Text style={styles.statNum}>{stats.completedCount}</Text>
                                            <Text style={styles.statLabel}>Hoàn thành</Text>
                                        </View>
                                        <View style={styles.statBox}>
                                            <Text style={styles.statNum}>{stats.quizPassed}/{stats.quizTaken}</Text>
                                            <Text style={styles.statLabel}>Đạt bài thi</Text>
                                        </View>
                                        <View style={styles.statBox}>
                                            <Text style={styles.statNum}>{stats.averageScore}%</Text>
                                            <Text style={styles.statLabel}>Điểm TB</Text>
                                        </View>
                                    </View>

                                    <Text style={[styles.label, { marginTop: 20 }]}>Chi tiết học viên</Text>
                                    {stats.enrollments?.map((e: any, idx: number) => (
                                        <View key={idx} style={styles.enrollmentRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.enrollName}>{e.userName}</Text>
                                                <Text style={styles.enrollDept}>{DEPT_LABELS[e.department] || e.department}</Text>
                                            </View>
                                            <View style={styles.enrollProgress}>
                                                <Text style={styles.enrollProgressText}>{e.progress}%</Text>
                                                <View style={styles.enrollBar}>
                                                    <View style={[styles.enrollFill, { width: `${e.progress}%` as any, backgroundColor: e.progress >= 100 ? '#10b981' : Colors.primary }]} />
                                                </View>
                                            </View>
                                            {e.quizResult && (
                                                <View style={[styles.quizBadge, { backgroundColor: e.quizResult.passed ? '#ecfdf5' : '#fef2f2' }]}>
                                                    <Text style={{ fontSize: 11, color: e.quizResult.passed ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                                                        {e.quizResult.score}%
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    ))}

                                    {stats.enrollments?.length === 0 && (
                                        <Text style={styles.emptyText}>Chưa có học viên nào</Text>
                                    )}
                                </>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 16 },
    containerDesktop: {
        maxWidth: 1000,
        marginHorizontal: 'auto',
        width: '100%',
    },
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
    addBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    },
    addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
    empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
    emptyText: { fontSize: 15, color: '#94a3b8' },
    // Course Card
    courseCard: {
        backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    courseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    courseName: { fontSize: 15, fontWeight: '700', color: '#0f172a', marginBottom: 4 },
    courseMeta: { fontSize: 13, color: '#64748b', marginBottom: 8 },
    badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    actionRow: { flexDirection: 'row', gap: 6 },
    iconBtn: {
        width: 34, height: 34, borderRadius: 8, backgroundColor: '#f8fafc',
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0',
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
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    modalBody: { flex: 1, padding: 20 },
    modalFooter: { padding: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
    label: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 8, marginTop: 14 },
    input: {
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0f172a',
    },
    inputSmall: {
        backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
        borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#0f172a', marginBottom: 6,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
    },
    chipActive: { borderColor: Colors.primary, backgroundColor: 'rgba(8,145,178,0.08)' },
    chipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    chipTextActive: { color: Colors.primary },
    chipSmall: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16,
        borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
    },
    chipSmallText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
    addSmallBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    submitBtn: {
        backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
    },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    // Lesson builder
    lessonBuilder: {
        backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 10,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    lessonBuilderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    lessonBuilderNum: { fontSize: 13, fontWeight: '700', color: Colors.primary },
    // Question builder
    questionBuilder: {
        backgroundColor: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 10,
        borderWidth: 1, borderColor: '#e2e8f0',
    },
    optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    correctBtn: {
        width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: '#cbd5e1',
        justifyContent: 'center', alignItems: 'center', backgroundColor: '#f1f5f9',
    },
    correctBtnActive: { backgroundColor: '#10b981', borderColor: '#10b981' },
    tfText: { fontSize: 14, color: '#334155', fontWeight: '500' },
    rowInputs: { flexDirection: 'row', gap: 12 },
    // Stats
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    statBox: {
        flex: 1, minWidth: 120, backgroundColor: '#f8fafc', borderRadius: 12, padding: 16,
        alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0',
    },
    statNum: { fontSize: 24, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
    statLabel: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    enrollmentRow: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
    },
    enrollName: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
    enrollDept: { fontSize: 12, color: '#64748b' },
    enrollProgress: { alignItems: 'flex-end', minWidth: 80 },
    enrollProgressText: { fontSize: 13, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
    enrollBar: { width: 80, height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden' },
    enrollFill: { height: '100%', borderRadius: 2 },
    quizBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    uploadBtn: {
        backgroundColor: Colors.primary, width: 40, height: 40, borderRadius: 8,
        justifyContent: 'center', alignItems: 'center',
    },
    uploadedFileBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: '#ecfdf5', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8,
        borderWidth: 1, borderColor: '#a7f3d0', marginBottom: 6,
    },
    uploadedFileText: { fontSize: 12, color: '#047857', flex: 1 },
});
