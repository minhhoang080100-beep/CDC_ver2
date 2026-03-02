import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Platform,
    TextInput,
    Alert
} from 'react-native';
import { api } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { Plus, Edit2, Trash2, Search, Download, Upload, Users } from 'lucide-react-native';
import WebHoverCard from '../WebHoverCard';
import * as DocumentPicker from 'expo-document-picker';
import UnionMemberModal from './UnionMemberModal';

export interface UnionMember {
    id: string;
    fullName: string;
    gender?: string;
    department?: string;
    workUnit?: string;
    phoneNumber?: string;
    unionJoinDate?: string;
    isPartyMember?: boolean;
}

export default function UnionMembersManagement() {
    const { token } = useAuth();
    const { isDesktop } = useResponsive();
    const { showToast } = useToast();
    const { showConfirm } = useConfirm();

    const [members, setMembers] = useState<UnionMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedMember, setSelectedMember] = useState<UnionMember | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    // const [editingMember, setEditingMember] = useState<UnionMember | null>(null);

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const response = await api.get('/api/union-members', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMembers(response.data);
        } catch (error) {
            console.error('Error fetching members:', error);
            showToast({ message: 'Không thể tải danh sách đoàn viên', type: 'error' });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchMembers();
    };

    const handleDelete = (id: string) => {
        showConfirm({
            title: 'Xóa đoàn viên',
            message: 'Bạn có chắc chắn muốn xóa hồ sơ đoàn viên này?',
            type: 'danger',
            confirmText: 'Xóa',
            onConfirm: async () => {
                try {
                    await api.delete(`/api/union-members/${id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    showToast({ message: 'Đã xóa đoàn viên', type: 'success' });
                    fetchMembers();
                } catch (error) {
                    showToast({ message: 'Lỗi khi xóa', type: 'error' });
                }
            }
        });
    };

    const handleImportExcel = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
                copyToCacheDirectory: true,
            });

            if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
            }

            const file = result.assets[0];

            showToast({ message: 'Đang tải lên và xử lý dữ liệu...', type: 'info' });

            const formData = new FormData();

            if (Platform.OS === 'web') {
                const res = await fetch(file.uri);
                const blob = await res.blob();
                formData.append('file', blob, file.name);
            } else {
                formData.append('file', {
                    uri: file.uri,
                    name: file.name,
                    type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                } as any);
            }

            const response = await api.post('/api/union-members/import', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    Authorization: `Bearer ${token}`,
                },
            });

            showToast({ message: response.data.message || 'Nhập dữ liệu thành công!', type: 'success' });

            if (response.data.errors && response.data.errors.length > 0) {
                console.warn('Import errors:', response.data.errors);
                // On web alert might be simpler
                if (Platform.OS === 'web') {
                    window.alert(`Có ${response.data.errors.length} lỗi xảy ra trong quá trình nhập. Vui lòng nhấn F12 kiểm tra Console.`);
                } else {
                    Alert.alert('Cảnh báo ghép dữ liệu', `Có ${response.data.errors.length} lỗi xảy ra trong quá trình nhập. Kiểm tra console hoặc báo cáo cho kỹ thuật.`);
                }
            }

            fetchMembers();
        } catch (error: any) {
            console.error('Lỗi import:', error);
            showToast({
                message: error.response?.data?.detail || 'Lỗi nhập dữ liệu từ file Excel. Vui lòng kiểm tra lại định dạng file',
                type: 'error'
            });
        }
    };

    const filteredMembers = members.filter(m =>
        m.fullName?.toLowerCase().includes(searchText.toLowerCase()) ||
        m.department?.toLowerCase().includes(searchText.toLowerCase())
    );

    const handleRowClick = (item: UnionMember) => {
        setSelectedMember(item);
        setModalVisible(true);
    };

    const renderItem = ({ item }: { item: UnionMember }) => (
        <TouchableOpacity activeOpacity={0.7} onPress={() => handleRowClick(item)}>
            <WebHoverCard style={styles.card}>
                <View style={styles.cardInfo}>
                    <Text style={styles.nameText}>{item.fullName}</Text>
                    <Text style={styles.subText}>{item.department || 'Chưa cập nhật PB'}</Text>
                    <Text style={styles.subText}>{item.phoneNumber || 'Không có SĐT'}</Text>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.editBtn]}
                        onPress={(e) => {
                            e.stopPropagation();
                            // setEditingMember(item);
                            // setModalVisible(true);
                            showToast({ message: 'Chức năng Edit đang hoàn thiện', type: 'info' })
                        }}
                    >
                        <Edit2 color={Colors.primary} size={18} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, styles.deleteBtn]}
                        onPress={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                        }}
                    >
                        <Trash2 color={Colors.status.error} size={18} />
                    </TouchableOpacity>
                </View>
            </WebHoverCard>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, isDesktop && styles.containerDesktop]}>
            <View style={styles.toolbar}>
                <View style={styles.searchBar}>
                    <Search color={Colors.text.placeholder} size={20} style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Tìm theo tên, phòng ban..."
                        value={searchText}
                        onChangeText={setSearchText}
                    />
                </View>
                <View style={styles.toolbarActions}>
                    <TouchableOpacity
                        style={[styles.btn, styles.outlineBtn]}
                        onPress={handleImportExcel}
                    >
                        <Upload color={Colors.text.primary} size={18} />
                        {isDesktop && <Text style={styles.outlineBtnText}>Import Excel</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.btn}
                        onPress={() => {
                            // setEditingMember(null);
                            // setModalVisible(true);
                            showToast({ message: 'Tính năng Thêm đang phát triển', type: 'info' })
                        }}
                    >
                        <Plus color="#fff" size={18} />
                        {isDesktop && <Text style={styles.btnText}>Thêm mới</Text>}
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.listContainer}>
                {isDesktop ? (
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { flex: 2 }]}>Họ và Tên</Text>
                            <Text style={[styles.th, { flex: 1.5 }]}>Phòng Ban</Text>
                            <Text style={[styles.th, { flex: 1 }]}>Điện thoại</Text>
                            <Text style={[styles.th, { width: 100, textAlign: 'center' }]}>Thao tác</Text>
                        </View>
                        <FlatList
                            data={filteredMembers}
                            keyExtractor={item => item.id}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.tr} activeOpacity={0.7} onPress={() => handleRowClick(item)}>
                                    <Text style={[styles.td, { flex: 2, fontWeight: '500' }]}>{item.fullName}</Text>
                                    <Text style={[styles.td, { flex: 1.5 }]}>{item.department || '-'}</Text>
                                    <Text style={[styles.td, { flex: 1 }]}>{item.phoneNumber || '-'}</Text>
                                    <View style={{ width: 100, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                                        <TouchableOpacity onPress={(e) => {
                                            e.stopPropagation();
                                            showToast({ message: 'Đang phát triển', type: 'info' });
                                        }}>
                                            <Edit2 color={Colors.primary} size={16} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={(e) => {
                                            e.stopPropagation();
                                            handleDelete(item.id);
                                        }}>
                                            <Trash2 color={Colors.status.error} size={16} />
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                !loading ? (
                                    <View style={styles.empty}>
                                        <Text style={styles.emptyText}>Không có dữ liệu đoàn viên</Text>
                                    </View>
                                ) : null
                            }
                        />
                    </View>
                ) : (
                    <FlatList
                        data={filteredMembers}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                        renderItem={renderItem}
                        ListEmptyComponent={
                            !loading ? (
                                <View style={styles.empty}>
                                    <Text style={styles.emptyText}>Không có dữ liệu đoàn viên</Text>
                                </View>
                            ) : null
                        }
                    />
                )}
            </View>

            {/* Union Member Details Modal */}
            <UnionMemberModal
                visible={modalVisible}
                onClose={() => {
                    setModalVisible(false);
                    // delay clearing selected member slightly for smooth fade out
                    setTimeout(() => setSelectedMember(null), 300);
                }}
                member={selectedMember}
            />
            {/* Modal for Edit/Add will go here */}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    containerDesktop: {
        maxWidth: 1000,
        marginHorizontal: 'auto',
        width: '100%',
    },
    toolbar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
        marginBottom: 16,
        flexWrap: 'wrap',
    },
    searchBar: {
        flex: 1,
        minWidth: 250,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.divider,
        borderRadius: 8,
        paddingHorizontal: 12,
        height: 44,
    },
    searchInput: {
        flex: 1,
        height: '100%',
        color: Colors.text.primary,
    },
    toolbarActions: {
        flexDirection: 'row',
        gap: 12,
    },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary,
        paddingHorizontal: 16,
        height: 44,
        borderRadius: 8,
        gap: 8,
    },
    btnText: {
        color: '#fff',
        fontWeight: '600',
    },
    outlineBtn: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.divider,
    },
    outlineBtnText: {
        color: Colors.text.primary,
        fontWeight: '600',
    },
    listContainer: {
        flex: 1,
    },
    // Mobile Card Styles
    card: {
        backgroundColor: Colors.surface,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.divider,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    cardInfo: {
        flex: 1,
        gap: 4,
    },
    nameText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    subText: {
        fontSize: 14,
        color: Colors.text.secondary,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionBtn: {
        padding: 8,
        borderRadius: 8,
    },
    editBtn: {
        backgroundColor: `${Colors.primary}10`,
    },
    deleteBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    // Desktop Table Styles
    table: {
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.divider,
        borderRadius: 12,
        overflow: 'hidden',
        flex: 1,
    },
    tableHeader: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: Colors.background,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    th: {
        fontWeight: '600',
        color: Colors.text.secondary,
        fontSize: 13,
        textTransform: 'uppercase',
    },
    tr: {
        flexDirection: 'row',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
        alignItems: 'center',
    },
    td: {
        color: Colors.text.primary,
        fontSize: 14,
    },
    empty: {
        padding: 32,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.text.secondary,
        fontStyle: 'italic',
    }
});
