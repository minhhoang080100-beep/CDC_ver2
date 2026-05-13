import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Modal,
    Platform,
    RefreshControl,
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
    Edit2,
    Eye,
    BarChart2,
    ClipboardList,
    X,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    Circle,
    Star,
    MessageSquare,
    Clock,
    Lock,
    Unlock,
    Upload,
    FileText,
    Trophy,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';

interface Survey {
    id: string;
    title: string;
    description?: string;
    questionCount: number;
    isAnonymous: boolean;
    deadline?: string;
    status: string;
    creatorName?: string;
    createdAt: string;
    responseCount: number;
    targetDepartments: string[];
    isQuiz?: boolean;
}

interface QuestionDraft {
    content: string;
    type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'STAR_RATING' | 'OPEN_TEXT' | 'GUESS_NUMBER';
    options: string[];
    isRequired: boolean;
    correctAnswer?: string | string[];
}

const QUESTION_TYPES = [
    { value: 'SINGLE_CHOICE', label: 'Trắc nghiệm 1 đáp án', icon: Circle },
    { value: 'MULTIPLE_CHOICE', label: 'Trắc nghiệm nhiều đáp án', icon: CheckCircle2 },
    { value: 'STAR_RATING', label: 'Đánh giá sao', icon: Star },
    { value: 'OPEN_TEXT', label: 'Câu hỏi mở', icon: MessageSquare },
    { value: 'GUESS_NUMBER', label: 'Câu hỏi số (Dự đoán)', icon: FileText },
];

const DEPT_OPTIONS = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'VAN_PHONG_CANG', label: 'Văn phòng Cảng' },
    { value: 'CUA_LO', label: 'Cửa Lò' },
    { value: 'BEN_THUY', label: 'Bến Thủy' },
];

export default function SurveyManagement() {
    const { user, token } = useAuth();
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();
    const { isDesktop } = useResponsive();
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filterStatus, setFilterStatus] = useState<string>('');

    // Create/Edit modal
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSurvey, setEditingSurvey] = useState<any>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [isQuiz, setIsQuiz] = useState(false);
    const [deadline, setDeadline] = useState('');
    const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
    const [questions, setQuestions] = useState<QuestionDraft[]>([]);
    const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Stats modal
    const [statsModalVisible, setStatsModalVisible] = useState(false);
    const [currentStats, setCurrentStats] = useState<any>(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // Quiz Leaderboard
    const [quizLeaderboardVisible, setQuizLeaderboardVisible] = useState(false);
    const [quizLeaderboard, setQuizLeaderboard] = useState<any>(null);
    const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

    const fetchSurveys = async () => {
        try {
            const statusParam = filterStatus ? `&status=${filterStatus}` : '';
            const response = await api.get(`/api/surveys?limit=50${statusParam}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setSurveys(response.data?.items || response.data || []);
        } catch (error) {
            console.error('Error fetching surveys:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => { fetchSurveys(); }, [filterStatus]);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setIsAnonymous(false);
        setIsQuiz(false);
        setDeadline('');
        setTargetDepartments([]);
        setQuestions([]);
        setAttachments([]);
        setEditingSurvey(null);
    };

    const openCreateModal = () => {
        resetForm();
        setModalVisible(true);
    };

    const openEditModal = async (survey: Survey) => {
        try {
            const response = await api.get(`/api/surveys/${survey.id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = response.data;
            setEditingSurvey(data);
            setTitle(data.title);
            setDescription(data.description || '');
            setIsAnonymous(data.isAnonymous || false);
            setIsQuiz(data.isQuiz || false);
            setDeadline(data.deadline || '');
            setTargetDepartments(data.targetDepartments || []);
            setQuestions(data.questions || []);
            // Load existing attachments
            const existingAttachments = (data.attachments || []).map((url: string) => ({
                name: decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'Tài liệu'),
                url,
            }));
            setAttachments(existingAttachments);
            setModalVisible(true);
        } catch (error) {
            showToast({ message: 'Không thể tải khảo sát', type: 'error' });
        }
    };

    const addQuestion = () => {
        setQuestions([...questions, {
            content: '',
            type: 'SINGLE_CHOICE',
            options: ['', ''],
            isRequired: true,
        }]);
    };

    const updateQuestion = (index: number, field: string, value: any) => {
        const updated = [...questions];
        (updated[index] as any)[field] = value;
        // Reset options for star/open/guess
        if (field === 'type' && (value === 'STAR_RATING' || value === 'OPEN_TEXT' || value === 'GUESS_NUMBER')) {
            updated[index].options = [];
            delete updated[index].correctAnswer;
        } else if (field === 'type' && updated[index].options.length === 0) {
            updated[index].options = ['', ''];
            delete updated[index].correctAnswer;
        }
        setQuestions(updated);
    };

    const addOption = (qIndex: number) => {
        const updated = [...questions];
        updated[qIndex].options.push('');
        setQuestions(updated);
    };

    const updateOption = (qIndex: number, optIndex: number, value: string) => {
        const updated = [...questions];
        updated[qIndex].options[optIndex] = value;
        setQuestions(updated);
    };

    const removeOption = (qIndex: number, optIndex: number) => {
        const updated = [...questions];
        updated[qIndex].options.splice(optIndex, 1);
        setQuestions(updated);
    };

    const removeQuestion = (index: number) => {
        setQuestions(questions.filter((_, i) => i !== index));
    };

    const moveQuestion = (index: number, direction: 'up' | 'down') => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= questions.length) return;
        const updated = [...questions];
        [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
        setQuestions(updated);
    };

    const handlePickDocument = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/pdf'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets?.length) return;

            const file = result.assets[0];
            setUploading(true);

            const formData = new FormData();

            if (Platform.OS === 'web') {
                if ((file as any).file) {
                    formData.append('file', (file as any).file);
                } else {
                    try {
                        const res = await fetch(file.uri);
                        const blob = await res.blob();
                        formData.append('file', blob, file.name || 'document.pdf');
                    } catch {
                        formData.append('file', file.uri);
                    }
                }
            } else {
                formData.append('file', {
                    uri: file.uri,
                    name: file.name || 'document.pdf',
                    type: file.mimeType || 'application/pdf',
                } as any);
            }

            formData.append('upload_preset', 'CDCnghetinh');
            formData.append('folder', 'cong-doan-survey-attachments');

            const response = await fetch('https://api.cloudinary.com/v1_1/dljjearo2/auto/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (data.secure_url) {
                setAttachments(prev => [...prev, {
                    name: file.name || 'Tài liệu PDF',
                    url: data.secure_url,
                }]);
            }
        } catch (error) {
            console.error('Upload error:', error);
            showToast({ message: 'Lỗi tải tài liệu', type: 'error' });
        } finally {
            setUploading(false);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!title.trim()) {
            showToast({ message: 'Vui lòng nhập tiêu đề khảo sát', type: 'error' });
            return;
        }
        if (questions.length === 0) {
            showToast({ message: 'Vui lòng thêm ít nhất một câu hỏi', type: 'error' });
            return;
        }
        // Validate questions
        for (let i = 0; i < questions.length; i++) {
            if (!questions[i].content.trim()) {
                showToast({ message: `Câu hỏi ${i + 1} chưa có nội dung`, type: 'error' });
                return;
            }
            if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(questions[i].type)) {
                const validOptions = questions[i].options.filter(o => o.trim());
                if (validOptions.length < 2) {
                    showToast({ message: `Câu hỏi ${i + 1} cần ít nhất 2 lựa chọn`, type: 'error' });
                    return;
                }
            }
        }

        setSaving(true);
        try {
            const payload = {
                title: title.trim(),
                description: description.trim() || null,
                isAnonymous,
                isQuiz,
                deadline: deadline || null,
                targetDepartments,
                attachments: attachments.map(a => a.url),
                questions: questions.map(q => {
                    const cleaned: any = {
                        content: q.content,
                        type: q.type,
                        options: q.options.filter(o => o.trim()),
                        isRequired: q.isRequired,
                    };
                    if (isQuiz && q.correctAnswer !== undefined) {
                        cleaned.correctAnswer = q.correctAnswer;
                    }
                    return cleaned;
                }),
            };

            if (editingSurvey) {
                await api.put(`/api/surveys/${editingSurvey.id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                showToast({ message: 'Cập nhật khảo sát thành công', type: 'success' });
            } else {
                await api.post('/api/surveys', payload, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                showToast({ message: 'Tạo khảo sát thành công', type: 'success' });
            }

            setModalVisible(false);
            resetForm();
            fetchSurveys();
        } catch (error: any) {
            showToast({ message: error.response?.data?.detail || 'Lỗi lưu khảo sát', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (survey: Survey) => {
        showConfirm({
            title: 'Xóa khảo sát',
            message: `Bạn có chắc muốn xóa "${survey.title}"? Tất cả câu trả lời sẽ bị xóa.`,
            type: 'danger',
            confirmText: 'Xóa',
            onConfirm: async () => {
                try {
                    await api.delete(`/api/surveys/${survey.id}`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    showToast({ message: 'Đã xóa khảo sát', type: 'success' });
                    fetchSurveys();
                } catch (error) {
                    showToast({ message: 'Không thể xóa khảo sát', type: 'error' });
                }
            },
        });
    };

    const handleToggleStatus = async (survey: Survey) => {
        const newStatus = survey.status === 'ACTIVE' ? 'CLOSED' : 'ACTIVE';
        try {
            await api.put(`/api/surveys/${survey.id}`, { status: newStatus }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            showToast({ message: newStatus === 'ACTIVE' ? 'Đã mở khảo sát' : 'Đã đóng khảo sát', type: 'success' });
            fetchSurveys();
        } catch (error) {
            showToast({ message: 'Không thể thay đổi trạng thái', type: 'error' });
        }
    };

    const handleViewStats = async (survey: Survey) => {
        setLoadingStats(true);
        setStatsModalVisible(true);
        try {
            const response = await api.get(`/api/surveys/${survey.id}/stats`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setCurrentStats(response.data);
        } catch (error) {
            showToast({ message: 'Không thể tải thống kê', type: 'error' });
            setStatsModalVisible(false);
        } finally {
            setLoadingStats(false);
        }
    };

    const handleViewQuizLeaderboard = async (survey: Survey) => {
        setLoadingLeaderboard(true);
        setQuizLeaderboardVisible(true);
        try {
            const response = await api.get(`/api/surveys/${survey.id}/quiz-leaderboard`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setQuizLeaderboard(response.data);
        } catch (error) {
            showToast({ message: 'Không thể tải bảng xếp hạng', type: 'error' });
            setQuizLeaderboardVisible(false);
        } finally {
            setLoadingLeaderboard(false);
        }
    };

    const getDeptName = (dept: string) => {
        switch (dept) {
            case 'VAN_PHONG_CANG': return 'VP Cảng';
            case 'CUA_LO': return 'Cửa Lò';
            case 'BEN_THUY': return 'Bến Thủy';
            case 'ALL': return 'Tất cả';
            default: return dept;
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('vi-VN');
        } catch { return dateStr; }
    };

    const renderSurveyItem = ({ item }: { item: Survey }) => (
        <View style={styles.surveyItem}>
            <View style={styles.surveyItemInfo}>
                <View style={styles.surveyItemHeader}>
                    <Text style={styles.surveyItemTitle} numberOfLines={1}>{item.title}</Text>
                    <View style={[
                        styles.statusBadge,
                        item.status === 'ACTIVE' && styles.statusActive,
                        item.status === 'CLOSED' && styles.statusClosed,
                        item.status === 'DRAFT' && styles.statusDraft,
                    ]}>
                        <Text style={[
                            styles.statusText,
                            item.status === 'ACTIVE' && { color: '#10b981' },
                            item.status === 'CLOSED' && { color: '#ef4444' },
                            item.status === 'DRAFT' && { color: '#f59e0b' },
                        ]}>
                            {item.status === 'ACTIVE' ? 'Đang mở' : item.status === 'CLOSED' ? 'Đã đóng' : 'Nháp'}
                        </Text>
                    </View>
                </View>
                <View style={styles.surveyItemMeta}>
                    <Text style={styles.metaText}>{item.questionCount} câu hỏi</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Text style={styles.metaText}>{item.responseCount} lượt trả lời</Text>
                    {item.isAnonymous && (
                        <>
                            <Text style={styles.metaDot}>•</Text>
                            <Text style={styles.metaText}>Ẩn danh</Text>
                        </>
                    )}
                    {item.deadline && (
                        <>
                            <Text style={styles.metaDot}>•</Text>
                            <Text style={styles.metaText}>Đến {formatDate(item.deadline)}</Text>
                        </>
                    )}
                </View>
            </View>
            <View style={styles.surveyItemActions}>
                {item.isQuiz && (
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}
                        onPress={() => handleViewQuizLeaderboard(item)}
                    >
                        <Trophy color="#f59e0b" size={18} />
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}
                    onPress={() => handleViewStats(item)}
                >
                    <BarChart2 color="#3b82f6" size={18} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: item.status === 'ACTIVE' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }]}
                    onPress={() => handleToggleStatus(item)}
                >
                    {item.status === 'ACTIVE' ? <Lock color="#ef4444" size={18} /> : <Unlock color="#10b981" size={18} />}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: 'rgba(8, 145, 178, 0.1)' }]}
                    onPress={() => openEditModal(item)}
                >
                    <Edit2 color={Colors.primary} size={18} />
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}
                    onPress={() => handleDelete(item)}
                >
                    <Trash2 color="#ef4444" size={18} />
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderStatsBar = (label: string, count: number, total: number, color: string) => {
        const pct = total > 0 ? (count / total * 100) : 0;
        return (
            <View style={styles.statBarContainer} key={label}>
                <View style={styles.statBarLabel}>
                    <Text style={styles.statBarText} numberOfLines={1}>{label}</Text>
                    <Text style={styles.statBarCount}>{count} ({Math.round(pct)}%)</Text>
                </View>
                <View style={styles.statBarTrack}>
                    <View style={[styles.statBarFill, { width: `${Math.max(pct, 1)}%`, backgroundColor: color }]} />
                </View>
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, isDesktop && styles.containerDesktop]}>
            {/* Header Actions */}
            <View style={styles.headerBar}>
                <View style={styles.filterRow}>
                    {['', 'ACTIVE', 'CLOSED', 'DRAFT'].map(status => (
                        <TouchableOpacity
                            key={status || 'all'}
                            style={[styles.filterChip, filterStatus === status && styles.filterChipActive]}
                            onPress={() => setFilterStatus(status)}
                        >
                            <Text style={[styles.filterChipText, filterStatus === status && styles.filterChipTextActive]}>
                                {status === '' ? 'Tất cả' : status === 'ACTIVE' ? 'Đang mở' : status === 'CLOSED' ? 'Đã đóng' : 'Nháp'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
                    <Plus color="#ffffff" size={20} />
                    <Text style={styles.createButtonText}>Tạo khảo sát</Text>
                </TouchableOpacity>
            </View>

            {/* Survey List */}
            <FlatList
                data={surveys}
                renderItem={renderSurveyItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSurveys(); }} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <ClipboardList color="#cbd5e1" size={48} />
                        <Text style={styles.emptyText}>Chưa có khảo sát nào</Text>
                    </View>
                }
            />

            {/* Create/Edit Modal */}
            <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingSurvey ? 'Sửa khảo sát' : 'Tạo khảo sát mới'}</Text>
                            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }} style={styles.closeBtn}>
                                <X color="#64748b" size={24} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
                            {/* Title */}
                            <Text style={styles.label}>Tiêu đề *</Text>
                            <TextInput
                                style={styles.input}
                                value={title}
                                onChangeText={setTitle}
                                placeholder="VD: Khảo sát mức độ hài lòng Q1/2026"
                                placeholderTextColor="#94a3b8"
                            />

                            {/* Description */}
                            <Text style={styles.label}>Mô tả</Text>
                            <TextInput
                                style={[styles.input, { minHeight: 80 }]}
                                value={description}
                                onChangeText={setDescription}
                                placeholder="Mô tả mục đích khảo sát..."
                                placeholderTextColor="#94a3b8"
                                multiline
                                textAlignVertical="top"
                            />

                            {/* Settings Row */}
                            <View style={styles.settingsRow}>
                                <TouchableOpacity
                                    style={[styles.settingToggle, isAnonymous && styles.settingToggleActive]}
                                    onPress={() => setIsAnonymous(!isAnonymous)}
                                >
                                    {isAnonymous ? <Lock color={Colors.primary} size={16} /> : <Unlock color="#94a3b8" size={16} />}
                                    <Text style={[styles.settingToggleText, isAnonymous && { color: Colors.primary }]}>
                                        {isAnonymous ? 'Ẩn danh' : 'Công khai'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.settingToggle, isQuiz && styles.settingToggleActive]}
                                    onPress={() => setIsQuiz(!isQuiz)}
                                >
                                    {isQuiz ? <Trophy color={Colors.primary} size={16} /> : <Trophy color="#94a3b8" size={16} />}
                                    <Text style={[styles.settingToggleText, isQuiz && { color: Colors.primary }]}>
                                        {isQuiz ? 'Chế độ Trắc nghiệm' : 'Khảo sát thường'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Deadline */}
                            <Text style={styles.label}>Hạn chót (tuỳ chọn)</Text>
                            <TextInput
                                style={styles.input}
                                value={deadline}
                                onChangeText={setDeadline}
                                placeholder="VD: 2026-03-31"
                                placeholderTextColor="#94a3b8"
                            />

                            {/* Target Departments */}
                            <Text style={styles.label}>Đối tượng</Text>
                            <View style={styles.deptRow}>
                                {DEPT_OPTIONS.map(dept => (
                                    <TouchableOpacity
                                        key={dept.value}
                                        style={[styles.deptChip, targetDepartments.includes(dept.value) && styles.deptChipActive]}
                                        onPress={() => {
                                            if (dept.value === 'ALL') {
                                                setTargetDepartments(targetDepartments.includes('ALL') ? [] : ['ALL']);
                                            } else {
                                                setTargetDepartments(prev =>
                                                    prev.includes(dept.value)
                                                        ? prev.filter(d => d !== dept.value)
                                                        : [...prev.filter(d => d !== 'ALL'), dept.value]
                                                );
                                            }
                                        }}
                                    >
                                        <Text style={[styles.deptChipText, targetDepartments.includes(dept.value) && styles.deptChipTextActive]}>
                                            {dept.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Attachments */}
                            <Text style={styles.label}>📎 Tài liệu đính kèm</Text>
                            {attachments.map((att, i) => (
                                <View key={i} style={styles.attachmentItem}>
                                    <FileText color={Colors.primary} size={18} />
                                    <Text style={styles.attachmentName} numberOfLines={1}>{att.name}</Text>
                                    <TouchableOpacity onPress={() => removeAttachment(i)} style={styles.removeOptBtn}>
                                        <X color="#ef4444" size={16} />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity
                                style={[styles.uploadBtn, uploading && { opacity: 0.6 }]}
                                onPress={handlePickDocument}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <Text style={styles.uploadBtnText}>Đang tải lên...</Text>
                                ) : (
                                    <>
                                        <Upload color={Colors.primary} size={16} />
                                        <Text style={styles.uploadBtnText}>Chọn tài liệu PDF</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            {/* Questions */}
                            <View style={styles.questionsHeader}>
                                <Text style={styles.label}>Câu hỏi ({questions.length})</Text>
                                <TouchableOpacity style={styles.addQuestionBtn} onPress={addQuestion}>
                                    <Plus color="#ffffff" size={16} />
                                    <Text style={styles.addQuestionText}>Thêm câu hỏi</Text>
                                </TouchableOpacity>
                            </View>

                            {questions.map((q, qIdx) => (
                                <View key={qIdx} style={styles.questionCard}>
                                    <View style={styles.questionCardHeader}>
                                        <Text style={styles.questionIndex}>Câu {qIdx + 1}</Text>
                                        <View style={styles.questionActions}>
                                            {qIdx > 0 && (
                                                <TouchableOpacity onPress={() => moveQuestion(qIdx, 'up')}>
                                                    <ChevronUp color="#64748b" size={20} />
                                                </TouchableOpacity>
                                            )}
                                            {qIdx < questions.length - 1 && (
                                                <TouchableOpacity onPress={() => moveQuestion(qIdx, 'down')}>
                                                    <ChevronDown color="#64748b" size={20} />
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity onPress={() => removeQuestion(qIdx)}>
                                                <Trash2 color="#ef4444" size={18} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <TextInput
                                        style={styles.input}
                                        value={q.content}
                                        onChangeText={(v) => updateQuestion(qIdx, 'content', v)}
                                        placeholder="Nội dung câu hỏi..."
                                        placeholderTextColor="#94a3b8"
                                    />

                                    {/* Question Type */}
                                    <View style={styles.typeRow}>
                                        {QUESTION_TYPES.map(qt => (
                                            <TouchableOpacity
                                                key={qt.value}
                                                style={[styles.typeChip, q.type === qt.value && styles.typeChipActive]}
                                                onPress={() => updateQuestion(qIdx, 'type', qt.value)}
                                            >
                                                <Text style={[styles.typeChipText, q.type === qt.value && styles.typeChipTextActive]} numberOfLines={1}>
                                                    {qt.label}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    {/* Options (for choice types) */}
                                    {['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(q.type) && (
                                        <View style={styles.optionsEditor}>
                                            {q.options.map((opt, optIdx) => {
                                                const isCorrect = Array.isArray(q.correctAnswer) ? q.correctAnswer.includes(opt) : q.correctAnswer === opt;
                                                return (
                                                <View key={optIdx} style={styles.optionRow}>
                                                    <TextInput
                                                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                                        value={opt}
                                                        onChangeText={(v) => updateOption(qIdx, optIdx, v)}
                                                        placeholder={`Lựa chọn ${optIdx + 1}`}
                                                        placeholderTextColor="#94a3b8"
                                                    />
                                                    {isQuiz && opt.trim() !== '' && (
                                                        <TouchableOpacity 
                                                            style={[styles.correctAnswerBtn, isCorrect && styles.correctAnswerBtnActive]}
                                                            onPress={() => {
                                                                if (q.type === 'SINGLE_CHOICE') {
                                                                    updateQuestion(qIdx, 'correctAnswer', opt);
                                                                } else {
                                                                    const currentArr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
                                                                    if (isCorrect) {
                                                                        updateQuestion(qIdx, 'correctAnswer', currentArr.filter(o => o !== opt));
                                                                    } else {
                                                                        updateQuestion(qIdx, 'correctAnswer', [...currentArr, opt]);
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <CheckCircle2 color={isCorrect ? '#10b981' : '#cbd5e1'} size={20} />
                                                        </TouchableOpacity>
                                                    )}
                                                    {q.options.length > 2 && (
                                                        <TouchableOpacity onPress={() => removeOption(qIdx, optIdx)} style={styles.removeOptBtn}>
                                                            <X color="#ef4444" size={18} />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            )})}
                                            <TouchableOpacity style={styles.addOptionBtn} onPress={() => addOption(qIdx)}>
                                                <Plus color={Colors.primary} size={16} />
                                                <Text style={styles.addOptionText}>Thêm lựa chọn</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    {q.type === 'STAR_RATING' && (
                                        <View style={styles.previewBox}>
                                            <Text style={styles.previewLabel}>Xem trước:</Text>
                                            <View style={{ flexDirection: 'row', gap: 4 }}>
                                                {[1, 2, 3, 4, 5].map(s => (
                                                    <Star key={s} color="#f59e0b" fill="#f59e0b" size={24} />
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    {q.type === 'OPEN_TEXT' && (
                                        <View style={styles.previewBox}>
                                            <Text style={styles.previewLabel}>Người dùng sẽ nhập câu trả lời tự do</Text>
                                        </View>
                                    )}

                                    {q.type === 'GUESS_NUMBER' && (
                                        <View style={styles.previewBox}>
                                            <Text style={styles.previewLabel}>Người dùng sẽ nhập một số (Dự đoán)</Text>
                                        </View>
                                    )}
                                </View>
                            ))}

                            {questions.length === 0 && (
                                <View style={styles.emptyQuestions}>
                                    <ClipboardList color="#cbd5e1" size={40} />
                                    <Text style={styles.emptyQText}>Chưa có câu hỏi nào</Text>
                                    <Text style={styles.emptyQSubtext}>Nhấn "Thêm câu hỏi" để bắt đầu</Text>
                                </View>
                            )}
                        </ScrollView>

                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={[styles.saveButton, saving && { opacity: 0.6 }]}
                                onPress={handleSave}
                                disabled={saving}
                            >
                                <Text style={styles.saveButtonText}>
                                    {saving ? 'Đang lưu...' : editingSurvey ? 'Cập nhật khảo sát' : 'Tạo & Mở khảo sát'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Stats Modal */}
            <Modal visible={statsModalVisible} animationType="fade" transparent onRequestClose={() => setStatsModalVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>📊 Thống kê khảo sát</Text>
                            <TouchableOpacity onPress={() => setStatsModalVisible(false)} style={styles.closeBtn}>
                                <X color="#64748b" size={24} />
                            </TouchableOpacity>
                        </View>

                        {loadingStats ? (
                            <View style={[styles.centerContainer, { padding: 40 }]}>
                                <ActivityIndicator size="large" color={Colors.primary} />
                            </View>
                        ) : currentStats ? (
                            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
                                <View style={styles.statsOverview}>
                                    <Text style={styles.statsTitle}>{currentStats.title}</Text>
                                    <Text style={styles.statsTotal}>Tổng lượt trả lời: {currentStats.totalResponses}</Text>
                                </View>

                                {/* Department Breakdown */}
                                {Object.keys(currentStats.departmentBreakdown || {}).length > 0 && (
                                    <View style={styles.statsSection}>
                                        <Text style={styles.statsSectionTitle}>Phân bổ theo phòng ban</Text>
                                        {Object.entries(currentStats.departmentBreakdown).map(([dept, count]) =>
                                            renderStatsBar(getDeptName(dept), count as number, currentStats.totalResponses, Colors.primary)
                                        )}
                                    </View>
                                )}

                                {/* Question Stats */}
                                {(currentStats.questionStats || []).map((qs: any, i: number) => (
                                    <View key={i} style={styles.statsSection}>
                                        <Text style={styles.statsSectionTitle}>Câu {i + 1}: {qs.content}</Text>
                                        <Text style={styles.statsAnswerCount}>{qs.totalAnswers} câu trả lời</Text>

                                        {qs.optionCounts && Object.entries(qs.optionCounts).map(([opt, count]) => {
                                            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                                            const colorIdx = Object.keys(qs.optionCounts).indexOf(opt) % colors.length;
                                            return renderStatsBar(opt, count as number, qs.totalAnswers, colors[colorIdx]);
                                        })}

                                        {qs.averageRating !== undefined && (
                                            <View style={styles.ratingDisplay}>
                                                <View style={{ flexDirection: 'row', gap: 4 }}>
                                                    {[1, 2, 3, 4, 5].map(s => (
                                                        <Star
                                                            key={s}
                                                            color="#f59e0b"
                                                            fill={s <= Math.round(qs.averageRating) ? '#f59e0b' : 'transparent'}
                                                            size={28}
                                                        />
                                                    ))}
                                                </View>
                                                <Text style={styles.ratingValue}>{qs.averageRating}/5</Text>
                                            </View>
                                        )}

                                        {qs.textResponses && qs.textResponses.length > 0 && (
                                            <View style={styles.textResponses}>
                                                {qs.textResponses.slice(0, 10).map((tr: any, j: number) => (
                                                    <View key={j} style={styles.textResponseItem}>
                                                        <Text style={styles.textResponseContent}>"{tr.text}"</Text>
                                                        {tr.userName && (
                                                            <Text style={styles.textResponseUser}>— {tr.userName}</Text>
                                                        )}
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </ScrollView>
                        ) : null}
                    </View>
                </View>
            </Modal>

            {/* Quiz Leaderboard Modal */}
            <Modal visible={quizLeaderboardVisible} animationType="fade" transparent onRequestClose={() => setQuizLeaderboardVisible(false)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>🏆 Bảng xếp hạng</Text>
                            <TouchableOpacity onPress={() => setQuizLeaderboardVisible(false)} style={styles.closeBtn}>
                                <X color="#64748b" size={24} />
                            </TouchableOpacity>
                        </View>
                        {loadingLeaderboard ? (
                            <View style={[styles.centerContainer, { padding: 40 }]}>
                                <ActivityIndicator size="large" color={Colors.primary} />
                            </View>
                        ) : quizLeaderboard ? (
                            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
                                <View style={styles.statsOverview}>
                                    <Text style={styles.statsTitle}>Điểm tối đa: {quizLeaderboard.maxScore}</Text>
                                    <Text style={styles.statsTotal}>Số người đạt điểm tối đa: {quizLeaderboard.actualCount}</Text>
                                </View>
                                
                                {quizLeaderboard.leaderboard.map((user: any, index: number) => (
                                    <View key={index} style={[styles.statsSection, index === 0 && { borderColor: '#f59e0b', borderWidth: 2, backgroundColor: '#fffbeb' }]}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <View>
                                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: index === 0 ? '#f59e0b' : '#0f172a' }}>
                                                    #{user.rank} {user.userName}
                                                </Text>
                                                <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{getDeptName(user.department)}</Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={{ fontSize: 16, fontWeight: 'bold', color: Colors.primary }}>{user.score} điểm</Text>
                                                {user.guess !== null && (
                                                    <Text style={{ fontSize: 13, color: '#10b981', marginTop: 4 }}>Dự đoán: {user.guess}</Text>
                                                )}
                                                {user.score === quizLeaderboard.maxScore && user.guess !== null && (
                                                    <Text style={{ fontSize: 12, color: '#ef4444', marginTop: 2 }}>Lệch: {user.difference}</Text>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </ScrollView>
                        ) : null}
                    </View>
                </View>
            </Modal>
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
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexWrap: 'wrap',
        gap: 12,
    },
    filterRow: { flexDirection: 'row', gap: 8 },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    filterChipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    filterChipTextActive: { color: '#ffffff' },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    createButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 14 },
    listContent: { padding: 16, gap: 10 },
    surveyItem: {
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    surveyItemInfo: { flex: 1 },
    surveyItemHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
    surveyItemTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', flex: 1 },
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        backgroundColor: '#f1f5f9',
    },
    statusActive: { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
    statusClosed: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
    statusDraft: { backgroundColor: 'rgba(245, 158, 11, 0.1)' },
    statusText: { fontSize: 12, fontWeight: '600' },
    surveyItemMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
    metaText: { fontSize: 13, color: '#94a3b8' },
    metaDot: { color: '#cbd5e1' },
    surveyItemActions: { flexDirection: 'row', gap: 6 },
    actionBtn: {
        width: 36,
        height: 36,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { fontSize: 16, color: '#94a3b8', fontWeight: '500' },
    // Modal
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Platform.OS === 'web' ? 20 : 0,
    },
    modalContent: {
        backgroundColor: '#ffffff',
        borderRadius: Platform.OS === 'web' ? 16 : 0,
        width: '100%',
        maxWidth: 700,
        maxHeight: Platform.OS === 'web' ? '92%' : '100%',
        flex: Platform.OS === 'web' ? undefined : 1,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalBody: { flex: 1, padding: 20 },
    modalFooter: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    label: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 8, marginTop: 16 },
    input: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0f172a',
        marginBottom: 8,
    },
    settingsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
    settingToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    settingToggleActive: { borderColor: Colors.primary, backgroundColor: 'rgba(8, 145, 178, 0.05)' },
    settingToggleText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    deptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    deptChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    deptChipActive: { borderColor: Colors.primary, backgroundColor: 'rgba(8, 145, 178, 0.08)' },
    deptChipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    deptChipTextActive: { color: Colors.primary },
    questionsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 24,
    },
    addQuestionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    addQuestionText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
    questionCard: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        marginTop: 12,
        backgroundColor: '#fafafa',
    },
    questionCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    questionIndex: { fontSize: 14, fontWeight: '700', color: Colors.primary },
    questionActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    typeChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#ffffff',
    },
    typeChipActive: { borderColor: Colors.primary, backgroundColor: 'rgba(8, 145, 178, 0.08)' },
    typeChipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    typeChipTextActive: { color: Colors.primary },
    optionsEditor: { marginTop: 12, gap: 8 },
    optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    removeOptBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    correctAnswerBtn: { padding: 8, borderRadius: 8, backgroundColor: '#f8fafc' },
    correctAnswerBtnActive: { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
    addOptionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 8,
    },
    addOptionText: { color: Colors.primary, fontSize: 13, fontWeight: '500' },
    previewBox: {
        backgroundColor: '#f0f9ff',
        borderRadius: 8,
        padding: 12,
        marginTop: 10,
        alignItems: 'center',
    },
    previewLabel: { fontSize: 12, color: '#64748b', marginBottom: 6 },
    emptyQuestions: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyQText: { fontSize: 15, color: '#94a3b8', fontWeight: '500' },
    emptyQSubtext: { fontSize: 13, color: '#cbd5e1' },
    saveButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 10,
        alignItems: 'center',
    },
    saveButtonText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
    // Stats
    statsOverview: { padding: 16, backgroundColor: '#f0f9ff', borderRadius: 12, marginBottom: 20 },
    statsTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a', marginBottom: 6 },
    statsTotal: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
    statsSection: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    statsSectionTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a', marginBottom: 12 },
    statsAnswerCount: { fontSize: 13, color: '#94a3b8', marginBottom: 10 },
    statBarContainer: { marginBottom: 10 },
    statBarLabel: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    statBarText: { fontSize: 13, color: '#334155', flex: 1 },
    statBarCount: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
    statBarTrack: {
        height: 8,
        backgroundColor: '#e2e8f0',
        borderRadius: 4,
        overflow: 'hidden',
    },
    statBarFill: { height: '100%', borderRadius: 4 },
    ratingDisplay: { alignItems: 'center', gap: 8, paddingVertical: 12 },
    ratingValue: { fontSize: 24, fontWeight: 'bold', color: '#f59e0b' },
    textResponses: { gap: 8, marginTop: 8 },
    textResponseItem: {
        backgroundColor: '#f8fafc',
        borderRadius: 8,
        padding: 12,
        borderLeftWidth: 3,
        borderLeftColor: Colors.primary,
    },
    textResponseContent: { fontSize: 14, color: '#334155', fontStyle: 'italic', lineHeight: 20 },
    textResponseUser: { fontSize: 12, color: '#94a3b8', marginTop: 6 },
    attachmentItem: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12,
        marginBottom: 8, borderWidth: 1, borderColor: '#bfdbfe',
    },
    attachmentName: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '500' },
    uploadBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
        borderRadius: 10, paddingVertical: 14, marginTop: 4,
        backgroundColor: 'rgba(8, 102, 255, 0.03)',
    },
    uploadBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
});
