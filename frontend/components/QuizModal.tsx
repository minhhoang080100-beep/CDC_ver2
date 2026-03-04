import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    ScrollView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Colors } from '../constants/Colors';
import { api } from '../utils/api';
import {
    X,
    Clock,
    CheckCircle2,
    XCircle,
    Award,
    ChevronRight,
} from 'lucide-react-native';

interface Question {
    content: string;
    type: string;
    options: string[];
}

interface Quiz {
    id: string;
    title: string;
    description?: string;
    questions: Question[];
    timeLimit?: number;
    passingScore: number;
}

interface QuizResult {
    score: number;
    correct: number;
    total: number;
    passed: boolean;
    message: string;
}

interface Props {
    visible: boolean;
    courseId: string;
    onClose: () => void;
}

export default function QuizModal({ visible, courseId, onClose }: Props) {
    const { token } = useAuth();
    const { showToast } = useToast();
    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState<number[]>([]);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<QuizResult | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const timerRef = useRef<any>(null);

    useEffect(() => {
        if (visible && courseId) {
            fetchQuiz();
        } else {
            resetState();
        }
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [visible, courseId]);

    // Timer
    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0) return;
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev !== null && prev <= 1) {
                    clearInterval(timerRef.current);
                    handleSubmit();
                    return 0;
                }
                return prev !== null ? prev - 1 : null;
            });
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [timeLeft]);

    const resetState = () => {
        setQuiz(null);
        setLoading(true);
        setAnswers([]);
        setCurrentQuestion(0);
        setResult(null);
        setTimeLeft(null);
    };

    const fetchQuiz = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/api/elearning/quizzes/by-course/${courseId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const q = res.data;
            setQuiz(q);
            setAnswers(new Array(q.questions.length).fill(-1));
            if (q.timeLimit) {
                setTimeLeft(q.timeLimit * 60);
            }
        } catch (error: any) {
            showToast({ message: error.response?.data?.detail || 'Chưa có đề thi', type: 'error' });
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const selectAnswer = (questionIndex: number, optionIndex: number) => {
        const newAnswers = [...answers];
        newAnswers[questionIndex] = optionIndex;
        setAnswers(newAnswers);
    };

    const handleSubmit = async () => {
        if (!quiz) return;
        if (timerRef.current) clearInterval(timerRef.current);

        const unanswered = answers.filter(a => a === -1).length;
        if (unanswered > 0 && timeLeft !== 0) {
            showToast({ message: `Còn ${unanswered} câu chưa trả lời`, type: 'error' });
            return;
        }

        setSubmitting(true);
        try {
            const res = await api.post(`/api/elearning/quizzes/${quiz.id}/submit`, {
                answers: answers.map(a => a === -1 ? 0 : a),
            }, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setResult(res.data);
        } catch (error: any) {
            showToast({ message: error.response?.data?.detail || 'Lỗi nộp bài', type: 'error' });
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        onClose();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} animationType="fade" transparent onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    {loading ? (
                        <View style={styles.center}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                        </View>
                    ) : result ? (
                        /* Result Screen */
                        <View style={styles.resultContainer}>
                            <View style={[styles.resultCircle, { borderColor: result.passed ? '#10b981' : '#ef4444' }]}>
                                {result.passed ? (
                                    <Award color="#10b981" size={48} />
                                ) : (
                                    <XCircle color="#ef4444" size={48} />
                                )}
                            </View>
                            <Text style={styles.resultTitle}>
                                {result.passed ? '🎉 Chúc mừng!' : '😔 Chưa đạt'}
                            </Text>
                            <Text style={styles.resultScore}>{result.score}%</Text>
                            <Text style={styles.resultDetail}>
                                {result.correct}/{result.total} câu đúng
                            </Text>
                            <Text style={styles.resultMessage}>{result.message}</Text>
                            <TouchableOpacity style={styles.closeResultBtn} onPress={handleClose}>
                                <Text style={styles.closeResultBtnText}>Đóng</Text>
                            </TouchableOpacity>
                        </View>
                    ) : quiz ? (
                        /* Quiz UI */
                        <>
                            <View style={styles.quizHeader}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.quizTitle} numberOfLines={1}>{quiz.title}</Text>
                                    <Text style={styles.quizProgress}>
                                        Câu {currentQuestion + 1}/{quiz.questions.length}
                                    </Text>
                                </View>
                                {timeLeft !== null && (
                                    <View style={[styles.timerBadge, timeLeft < 60 && { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                                        <Clock color={timeLeft < 60 ? '#ef4444' : Colors.primary} size={16} />
                                        <Text style={[styles.timerText, timeLeft < 60 && { color: '#ef4444' }]}>
                                            {formatTime(timeLeft)}
                                        </Text>
                                    </View>
                                )}
                                <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <X color="#64748b" size={22} />
                                </TouchableOpacity>
                            </View>

                            {/* Progress dots */}
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dotsScroll} contentContainerStyle={styles.dotsContainer}>
                                {quiz.questions.map((_, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={[
                                            styles.dot,
                                            i === currentQuestion && styles.dotActive,
                                            answers[i] !== -1 && styles.dotAnswered,
                                        ]}
                                        onPress={() => setCurrentQuestion(i)}
                                        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                                    />
                                ))}
                            </ScrollView>

                            <ScrollView style={styles.questionBody}>
                                <Text style={styles.questionText}>
                                    {quiz.questions[currentQuestion].content}
                                </Text>

                                {quiz.questions[currentQuestion].type === 'TRUE_FALSE' ? (
                                    <View style={styles.optionsContainer}>
                                        {['Đúng', 'Sai'].map((opt, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                style={[styles.option, answers[currentQuestion] === idx && styles.optionSelected]}
                                                onPress={() => selectAnswer(currentQuestion, idx)}
                                            >
                                                {answers[currentQuestion] === idx ? (
                                                    <CheckCircle2 color={Colors.primary} size={22} />
                                                ) : (
                                                    <View style={styles.optionCircle} />
                                                )}
                                                <Text style={[styles.optionText, answers[currentQuestion] === idx && styles.optionTextSelected]}>
                                                    {opt}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.optionsContainer}>
                                        {quiz.questions[currentQuestion].options.map((opt, idx) => (
                                            <TouchableOpacity
                                                key={idx}
                                                style={[styles.option, answers[currentQuestion] === idx && styles.optionSelected]}
                                                onPress={() => selectAnswer(currentQuestion, idx)}
                                            >
                                                {answers[currentQuestion] === idx ? (
                                                    <CheckCircle2 color={Colors.primary} size={22} />
                                                ) : (
                                                    <View style={styles.optionCircle} />
                                                )}
                                                <Text style={[styles.optionText, answers[currentQuestion] === idx && styles.optionTextSelected]}>
                                                    {opt}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </ScrollView>

                            <View style={styles.quizFooter}>
                                {currentQuestion > 0 && (
                                    <TouchableOpacity
                                        style={styles.navBtn}
                                        onPress={() => setCurrentQuestion(prev => prev - 1)}
                                    >
                                        <Text style={styles.navBtnText}>← Trước</Text>
                                    </TouchableOpacity>
                                )}
                                <View style={{ flex: 1 }} />
                                {currentQuestion < quiz.questions.length - 1 ? (
                                    <TouchableOpacity
                                        style={[styles.navBtn, styles.navBtnPrimary]}
                                        onPress={() => setCurrentQuestion(prev => prev + 1)}
                                    >
                                        <Text style={styles.navBtnPrimaryText}>Tiếp →</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
                                        onPress={handleSubmit}
                                        disabled={submitting}
                                    >
                                        <Text style={styles.submitBtnText}>
                                            {submitting ? 'Đang chấm...' : 'Nộp bài'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </>
                    ) : null}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center',
        padding: Platform.OS === 'web' ? 20 : 0,
    },
    modal: {
        backgroundColor: '#fff', borderRadius: Platform.OS === 'web' ? 16 : 0,
        width: '100%', maxWidth: 650,
        maxHeight: Platform.OS === 'web' ? '92%' : '100%',
        flex: Platform.OS === 'web' ? undefined : 1, overflow: 'hidden',
    },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    // Quiz Header
    quizHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
    },
    quizTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    quizProgress: { fontSize: 13, color: '#64748b', marginTop: 2 },
    timerBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: 'rgba(8,145,178,0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    },
    timerText: { fontSize: 14, fontWeight: '700', color: Colors.primary },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
    // Dots
    dotsScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    dotsContainer: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
    dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#e2e8f0' },
    dotActive: { backgroundColor: Colors.primary, transform: [{ scale: 1.3 }] },
    dotAnswered: { backgroundColor: '#10b981' },
    // Question
    questionBody: { flex: 1, padding: 16 },
    questionText: { fontSize: 16, fontWeight: '600', color: '#0f172a', lineHeight: 24, marginBottom: 20 },
    optionsContainer: { gap: 10 },
    option: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        padding: 14, borderRadius: 12, borderWidth: 2,
        borderColor: '#e2e8f0', backgroundColor: '#fafafa',
        minHeight: 56, // Tăng minHeight cho chuẩn touch target
    },
    optionSelected: { borderColor: Colors.primary, backgroundColor: 'rgba(8,145,178,0.04)' },
    optionCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#cbd5e1' },
    optionText: { fontSize: 15, color: '#334155', flex: 1 },
    optionTextSelected: { color: Colors.primary, fontWeight: '600' },
    // Footer
    quizFooter: {
        flexDirection: 'row', alignItems: 'center', gap: 10,
        paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#e2e8f0',
    },
    navBtn: {
        paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10,
        borderWidth: 1, borderColor: '#e2e8f0', minHeight: 48, // Tăng touch target
        justifyContent: 'center',
    },
    navBtnText: { fontSize: 14, color: '#64748b', fontWeight: '600' },
    navBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    navBtnPrimaryText: { fontSize: 14, color: '#fff', fontWeight: '600' },
    submitBtn: { backgroundColor: '#10b981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10, minHeight: 48, justifyContent: 'center' },
    submitBtnText: { fontSize: 15, fontWeight: 'bold', color: '#fff' },
    // Result
    resultContainer: { alignItems: 'center', justifyContent: 'center', padding: 24, flex: 1 },
    resultCircle: {
        width: 100, height: 100, borderRadius: 50, borderWidth: 4,
        justifyContent: 'center', alignItems: 'center', marginBottom: 20,
    },
    resultTitle: { fontSize: 24, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 },
    resultScore: { fontSize: 48, fontWeight: '800', color: Colors.primary, marginBottom: 4 },
    resultDetail: { fontSize: 16, color: '#64748b', marginBottom: 8 },
    resultMessage: { fontSize: 15, color: '#475569', textAlign: 'center', marginBottom: 24 },
    closeResultBtn: {
        backgroundColor: Colors.primary, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 10,
    },
    closeResultBtnText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
});
