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
    KeyboardAvoidingView,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { X, Star, CheckCircle2, Circle, Square, CheckSquare, FileText, ExternalLink } from 'lucide-react-native';
import { Linking } from 'react-native';

interface Question {
    content: string;
    type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'STAR_RATING' | 'OPEN_TEXT';
    options: string[];
    isRequired: boolean;
}

interface Props {
    visible: boolean;
    survey: {
        id: string;
        title: string;
        description?: string;
        questions: Question[];
        isAnonymous: boolean;
        attachments?: string[];
    } | null;
    onClose: () => void;
    onSubmit: (surveyId: string, answers: any[]) => void;
}

export default function SurveyFormModal({ visible, survey, onClose, onSubmit }: Props) {
    const [answers, setAnswers] = useState<{ [key: number]: any }>({});
    const [currentPage, setCurrentPage] = useState(0);
    const [submitting, setSubmitting] = useState(false);

    if (!survey) return null;

    const questions = survey.questions || [];
    const totalQuestions = questions.length;

    const handleSingleChoice = (qIndex: number, option: string) => {
        setAnswers(prev => ({ ...prev, [qIndex]: option }));
    };

    const handleMultipleChoice = (qIndex: number, option: string) => {
        setAnswers(prev => {
            const current = prev[qIndex] || [];
            if (current.includes(option)) {
                return { ...prev, [qIndex]: current.filter((o: string) => o !== option) };
            }
            return { ...prev, [qIndex]: [...current, option] };
        });
    };

    const handleStarRating = (qIndex: number, rating: number) => {
        setAnswers(prev => ({ ...prev, [qIndex]: rating }));
    };

    const handleOpenText = (qIndex: number, text: string) => {
        setAnswers(prev => ({ ...prev, [qIndex]: text }));
    };

    const handleSubmit = async () => {
        // Validate required questions
        for (let i = 0; i < questions.length; i++) {
            if (questions[i].isRequired && (answers[i] === undefined || answers[i] === '' || (Array.isArray(answers[i]) && answers[i].length === 0))) {
                setCurrentPage(i);
                return;
            }
        }

        setSubmitting(true);
        const formattedAnswers = Object.entries(answers).map(([key, value]) => ({
            questionIndex: parseInt(key),
            answer: value,
        }));

        await onSubmit(survey.id, formattedAnswers);
        setSubmitting(false);
        setAnswers({});
        setCurrentPage(0);
    };

    const handleClose = () => {
        setAnswers({});
        setCurrentPage(0);
        onClose();
    };

    const progress = Object.keys(answers).length / totalQuestions;

    const renderQuestion = (question: Question, index: number) => {
        return (
            <View key={index} style={styles.questionContainer}>
                <View style={styles.questionHeader}>
                    <Text style={styles.questionNumber}>Câu {index + 1}/{totalQuestions}</Text>
                    {question.isRequired && <Text style={styles.requiredMark}>*Bắt buộc</Text>}
                </View>
                <Text style={styles.questionContent}>{question.content}</Text>

                {question.type === 'SINGLE_CHOICE' && (
                    <View style={styles.optionsContainer}>
                        {question.options.map((option, optIdx) => (
                            <TouchableOpacity
                                key={optIdx}
                                style={[
                                    styles.optionItem,
                                    answers[index] === option && styles.optionItemSelected,
                                ]}
                                onPress={() => handleSingleChoice(index, option)}
                            >
                                {answers[index] === option ? (
                                    <CheckCircle2 color={Colors.primary} size={22} />
                                ) : (
                                    <Circle color="#cbd5e1" size={22} />
                                )}
                                <Text style={[
                                    styles.optionText,
                                    answers[index] === option && styles.optionTextSelected,
                                ]}>
                                    {option}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {question.type === 'MULTIPLE_CHOICE' && (
                    <View style={styles.optionsContainer}>
                        {question.options.map((option, optIdx) => {
                            const selected = (answers[index] || []).includes(option);
                            return (
                                <TouchableOpacity
                                    key={optIdx}
                                    style={[styles.optionItem, selected && styles.optionItemSelected]}
                                    onPress={() => handleMultipleChoice(index, option)}
                                >
                                    {selected ? (
                                        <CheckSquare color={Colors.primary} size={22} />
                                    ) : (
                                        <Square color="#cbd5e1" size={22} />
                                    )}
                                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                                        {option}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                        <Text style={styles.hintText}>Có thể chọn nhiều đáp án</Text>
                    </View>
                )}

                {question.type === 'STAR_RATING' && (
                    <View style={styles.starContainer}>
                        {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity
                                key={star}
                                onPress={() => handleStarRating(index, star)}
                                style={styles.starButton}
                            >
                                <Star
                                    color={star <= (answers[index] || 0) ? '#f59e0b' : '#e2e8f0'}
                                    fill={star <= (answers[index] || 0) ? '#f59e0b' : 'transparent'}
                                    size={40}
                                />
                            </TouchableOpacity>
                        ))}
                        {answers[index] && (
                            <Text style={styles.ratingText}>
                                {answers[index] === 1 ? 'Rất không hài lòng' :
                                    answers[index] === 2 ? 'Không hài lòng' :
                                        answers[index] === 3 ? 'Bình thường' :
                                            answers[index] === 4 ? 'Hài lòng' : 'Rất hài lòng'}
                            </Text>
                        )}
                    </View>
                )}

                {question.type === 'OPEN_TEXT' && (
                    <TextInput
                        style={styles.textInput}
                        value={answers[index] || ''}
                        onChangeText={(text) => handleOpenText(index, text)}
                        placeholder="Nhập câu trả lời của bạn..."
                        placeholderTextColor="#94a3b8"
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                )}
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={handleClose}>
            <KeyboardAvoidingView
                style={styles.modalContainer}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <View style={styles.modalHeaderLeft}>
                            <Text style={styles.modalTitle} numberOfLines={1}>{survey.title}</Text>
                            {survey.isAnonymous && (
                                <Text style={styles.anonymousTag}>🔒 Khảo sát ẩn danh</Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <X color="#64748b" size={24} />
                        </TouchableOpacity>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${Math.max(progress * 100, 2)}%` }]} />
                        </View>
                        <Text style={styles.progressText}>
                            {Object.keys(answers).length}/{totalQuestions} câu đã trả lời
                        </Text>
                    </View>

                    {/* Questions */}
                    <ScrollView style={styles.questionsScroll} contentContainerStyle={styles.questionsContent}>
                        {survey.description && (
                            <View style={styles.descriptionBox}>
                                <Text style={styles.descriptionText}>{survey.description}</Text>
                            </View>
                        )}

                        {/* Attachments */}
                        {survey.attachments && survey.attachments.length > 0 && (
                            <View style={styles.attachmentsBox}>
                                <Text style={styles.attachmentsTitle}>📎 Tài liệu đính kèm</Text>
                                {survey.attachments.map((url, i) => {
                                    const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || `Tài liệu ${i + 1}`);
                                    return (
                                        <TouchableOpacity
                                            key={i}
                                            style={styles.attachmentRow}
                                            onPress={() => {
                                                if (Platform.OS === 'web') {
                                                    window.open(url, '_blank');
                                                } else {
                                                    Linking.openURL(url);
                                                }
                                            }}
                                        >
                                            <FileText color={Colors.primary} size={20} />
                                            <Text style={styles.attachmentFileName} numberOfLines={1}>{fileName}</Text>
                                            <ExternalLink color="#94a3b8" size={16} />
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        )}

                        {questions.map((q, i) => renderQuestion(q, i))}
                    </ScrollView>

                    {/* Submit Button */}
                    <View style={styles.footerContainer}>
                        <TouchableOpacity
                            style={[styles.submitButton, submitting && { opacity: 0.6 }]}
                            onPress={handleSubmit}
                            disabled={submitting}
                        >
                            <Text style={styles.submitButtonText}>
                                {submitting ? 'Đang gửi...' : 'Gửi khảo sát'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
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
        maxWidth: 650,
        maxHeight: Platform.OS === 'web' ? '90%' : '100%',
        flex: Platform.OS === 'web' ? undefined : 1,
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    modalHeaderLeft: {
        flex: 1,
        marginRight: 16,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    anonymousTag: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 4,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressContainer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
    },
    progressBar: {
        height: 6,
        backgroundColor: '#e2e8f0',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: 3,
    },
    progressText: {
        fontSize: 12,
        color: '#94a3b8',
        marginTop: 6,
        textAlign: 'right',
    },
    questionsScroll: {
        flex: 1,
    },
    questionsContent: {
        padding: 20,
        gap: 24,
    },
    descriptionBox: {
        backgroundColor: '#f0f9ff',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: Colors.primary,
    },
    descriptionText: {
        fontSize: 14,
        color: '#334155',
        lineHeight: 22,
    },
    questionContainer: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 14,
        padding: 20,
        backgroundColor: '#ffffff',
    },
    questionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    questionNumber: {
        fontSize: 13,
        fontWeight: '600',
        color: Colors.primary,
    },
    requiredMark: {
        fontSize: 12,
        color: Colors.status.error,
        fontWeight: '500',
    },
    questionContent: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0f172a',
        lineHeight: 24,
        marginBottom: 16,
    },
    optionsContainer: {
        gap: 10,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#e2e8f0',
        backgroundColor: '#fafafa',
        minHeight: 56, // Touch target height
    },
    optionItemSelected: {
        borderColor: Colors.primary,
        backgroundColor: 'rgba(8, 145, 178, 0.04)',
    },
    optionText: {
        fontSize: 15,
        color: '#334155',
        flex: 1,
    },
    optionTextSelected: {
        color: Colors.primary,
        fontWeight: '600',
    },
    hintText: {
        fontSize: 12,
        color: '#94a3b8',
        fontStyle: 'italic',
        marginTop: 4,
    },
    starContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    starButton: {
        padding: 6, // Tăng padding để bấm dễ hơn
    },
    ratingText: {
        width: '100%',
        textAlign: 'center',
        fontSize: 14,
        color: '#f59e0b',
        fontWeight: '600',
        marginTop: 8,
    },
    textInput: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 15,
        color: '#0f172a',
        minHeight: 100,
        ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
    },
    footerContainer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    submitButton: {
        backgroundColor: Colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#ffffff',
    },
    attachmentsBox: {
        backgroundColor: '#fffbeb',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#fde68a',
        gap: 10,
    },
    attachmentsTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#92400e',
        marginBottom: 4,
    },
    attachmentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#ffffff',
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    attachmentFileName: {
        flex: 1,
        fontSize: 14,
        color: Colors.primary,
        fontWeight: '500',
    },
});
