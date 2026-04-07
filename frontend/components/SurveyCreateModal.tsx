import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Platform,
} from 'react-native';
import { Colors } from '../constants/Colors';
import {
    X,
    Plus,
    Trash2,
    ChevronUp,
    ChevronDown,
    Circle,
    CheckCircle2,
    Star,
    MessageSquare,
    Lock,
    Unlock,
    Paperclip,
    FileText,
    Upload,
} from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';

interface QuestionDraft {
    content: string;
    type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'STAR_RATING' | 'OPEN_TEXT';
    options: string[];
    isRequired: boolean;
}

const QUESTION_TYPES = [
    { value: 'SINGLE_CHOICE', label: '1 đáp án' },
    { value: 'MULTIPLE_CHOICE', label: 'Nhiều đáp án' },
    { value: 'STAR_RATING', label: 'Đánh giá sao' },
    { value: 'OPEN_TEXT', label: 'Câu hỏi mở' },
];

const DEPT_OPTIONS = [
    { value: 'ALL', label: 'Tất cả' },
    { value: 'VAN_PHONG_CANG', label: 'Văn phòng Cảng' },
    { value: 'CUA_LO', label: 'Cửa Lò' },
    { value: 'BEN_THUY', label: 'Bến Thủy' },
];

interface Props {
    visible: boolean;
    onClose: () => void;
    onSave: (data: any) => Promise<void>;
}

export default function SurveyCreateModal({ visible, onClose, onSave }: Props) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [deadline, setDeadline] = useState('');
    const [targetDepartments, setTargetDepartments] = useState<string[]>([]);
    const [questions, setQuestions] = useState<QuestionDraft[]>([]);
    const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setIsAnonymous(false);
        setDeadline('');
        setTargetDepartments([]);
        setQuestions([]);
        setAttachments([]);
    };

    const handleClose = () => {
        resetForm();
        onClose();
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
        if (field === 'type' && (value === 'STAR_RATING' || value === 'OPEN_TEXT')) {
            updated[index].options = [];
        } else if (field === 'type' && updated[index].options.length === 0) {
            updated[index].options = ['', ''];
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

            // Upload to Cloudinary
            const formData = new FormData();

            if (Platform.OS === 'web') {
                if ((file as any).file) {
                    formData.append('file', (file as any).file);
                } else {
                    try {
                        const res = await fetch(file.uri);
                        const blob = await res.blob();
                        formData.append('file', blob, file.name || 'document');
                    } catch {
                        formData.append('file', file.uri);
                    }
                }
            } else {
                formData.append('file', {
                    uri: file.uri,
                    name: file.name || 'document',
                    type: file.mimeType || 'application/octet-stream',
                } as any);
            }

            formData.append('upload_preset', 'CDCnghetinh');
            formData.append('folder', 'cong-doan-survey-attachments');

            const cloudName = 'dljjearo2';
            const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (data.secure_url) {
                setAttachments(prev => [...prev, {
                    name: file.name || 'Tài liệu',
                    url: data.secure_url,
                }]);
            }
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setUploading(false);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (!title.trim()) return;
        if (questions.length === 0) return;
        for (const q of questions) {
            if (!q.content.trim()) return;
            if (['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(q.type)) {
                if (q.options.filter(o => o.trim()).length < 2) return;
            }
        }

        setSaving(true);
        try {
            await onSave({
                title: title.trim(),
                description: description.trim() || null,
                isAnonymous,
                deadline: deadline || null,
                targetDepartments,
                attachments: attachments.map(a => a.url),
                questions: questions.map(q => ({
                    ...q,
                    options: q.options.filter(o => o.trim()),
                })),
            });
            resetForm();
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Tạo khảo sát mới</Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                            <X color="#64748b" size={24} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }}>
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

                        {/* Anonymous toggle */}
                        <View style={styles.settingsRow}>
                            <TouchableOpacity
                                style={[styles.toggle, isAnonymous && styles.toggleActive]}
                                onPress={() => setIsAnonymous(!isAnonymous)}
                            >
                                {isAnonymous ? <Lock color={Colors.primary} size={16} /> : <Unlock color="#94a3b8" size={16} />}
                                <Text style={[styles.toggleText, isAnonymous && { color: Colors.primary }]}>
                                    {isAnonymous ? 'Ẩn danh' : 'Công khai'}
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
                        <View style={styles.chipRow}>
                            {DEPT_OPTIONS.map(dept => (
                                <TouchableOpacity
                                    key={dept.value}
                                    style={[styles.chip, targetDepartments.includes(dept.value) && styles.chipActive]}
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
                                    <Text style={[styles.chipText, targetDepartments.includes(dept.value) && styles.chipTextActive]}>
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
                                <TouchableOpacity onPress={() => removeAttachment(i)} style={styles.removeAttBtn}>
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

                                {/* Options */}
                                {['SINGLE_CHOICE', 'MULTIPLE_CHOICE'].includes(q.type) && (
                                    <View style={styles.optionsEditor}>
                                        {q.options.map((opt, optIdx) => (
                                            <View key={optIdx} style={styles.optionRow}>
                                                <TextInput
                                                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                                    value={opt}
                                                    onChangeText={(v) => updateOption(qIdx, optIdx, v)}
                                                    placeholder={`Lựa chọn ${optIdx + 1}`}
                                                    placeholderTextColor="#94a3b8"
                                                />
                                                {q.options.length > 2 && (
                                                    <TouchableOpacity onPress={() => removeOption(qIdx, optIdx)} style={styles.removeOptBtn}>
                                                        <X color="#ef4444" size={18} />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        ))}
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
                            </View>
                        ))}

                        {questions.length === 0 && (
                            <View style={styles.emptyQuestions}>
                                <Text style={styles.emptyQText}>Chưa có câu hỏi nào</Text>
                                <Text style={styles.emptyQSub}>Nhấn "Thêm câu hỏi" để bắt đầu</Text>
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.saveButton, saving && { opacity: 0.6 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            <Text style={styles.saveButtonText}>
                                {saving ? 'Đang tạo...' : 'Tạo & Mở khảo sát'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Platform.OS === 'web' ? 20 : 0,
    },
    modal: {
        backgroundColor: '#ffffff',
        borderRadius: Platform.OS === 'web' ? 16 : 0,
        width: '100%',
        maxWidth: 700,
        maxHeight: Platform.OS === 'web' ? '92%' : '100%',
        flex: Platform.OS === 'web' ? undefined : 1,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#0f172a' },
    closeBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center', alignItems: 'center',
    },
    body: { flex: 1, paddingHorizontal: 16, paddingVertical: 8 },
    footer: {
        paddingHorizontal: 16, paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
    },
    label: { fontSize: 14, fontWeight: '600', color: '#0f172a', marginBottom: 8, marginTop: 16 },
    input: {
        backgroundColor: '#f8fafc',
        borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12,
        fontSize: 15, color: '#0f172a', marginBottom: 8,
    },
    settingsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
    toggle: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
    },
    toggleActive: { borderColor: Colors.primary, backgroundColor: 'rgba(8, 145, 178, 0.05)' },
    toggleText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc',
    },
    chipActive: { borderColor: Colors.primary, backgroundColor: 'rgba(8, 145, 178, 0.08)' },
    chipText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
    chipTextActive: { color: Colors.primary },
    questionsHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginTop: 24,
    },
    addQuestionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: Colors.primary,
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
        minHeight: 40,
    },
    addQuestionText: { color: '#ffffff', fontSize: 13, fontWeight: '600' },
    questionCard: {
        borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12,
        padding: 16, marginTop: 12, backgroundColor: '#fafafa',
    },
    questionCardHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 10,
    },
    questionIndex: { fontSize: 14, fontWeight: '700', color: Colors.primary },
    questionActions: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    typeChip: {
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6,
        borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff',
    },
    typeChipActive: { borderColor: Colors.primary, backgroundColor: 'rgba(8, 145, 178, 0.08)' },
    typeChipText: { fontSize: 12, color: '#64748b', fontWeight: '500' },
    typeChipTextActive: { color: Colors.primary },
    optionsEditor: { marginTop: 12, gap: 8 },
    optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    removeOptBtn: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        justifyContent: 'center', alignItems: 'center',
    },
    addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
    addOptionText: { color: Colors.primary, fontSize: 13, fontWeight: '500' },
    previewBox: {
        backgroundColor: '#f0f9ff', borderRadius: 8,
        padding: 12, marginTop: 10, alignItems: 'center',
    },
    previewLabel: { fontSize: 12, color: '#64748b', marginBottom: 6 },
    emptyQuestions: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyQText: { fontSize: 15, color: '#94a3b8', fontWeight: '500' },
    emptyQSub: { fontSize: 13, color: '#cbd5e1' },
    saveButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16, borderRadius: 10, alignItems: 'center',
    },
    saveButtonText: { fontSize: 16, fontWeight: 'bold', color: '#ffffff' },
    attachmentItem: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: '#f0f9ff', borderRadius: 10, padding: 12,
        marginBottom: 8, borderWidth: 1, borderColor: '#bfdbfe',
    },
    attachmentName: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '500' },
    removeAttBtn: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        justifyContent: 'center', alignItems: 'center',
    },
    uploadBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
        borderRadius: 10, paddingVertical: 14, marginTop: 4,
        backgroundColor: 'rgba(8, 102, 255, 0.03)',
    },
    uploadBtnText: { fontSize: 14, color: Colors.primary, fontWeight: '500' },
});
