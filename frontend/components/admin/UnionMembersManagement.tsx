import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    Platform,
    TextInput,
    Alert,
    ScrollView
} from 'react-native';
import { api } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Colors } from '../../constants/Colors';
import { useResponsive } from '../../hooks/useResponsive';
import { Plus, Edit2, Trash2, Search, Download, Upload, Users, Filter, CheckSquare, Square, Folder, FolderOpen } from 'lucide-react-native';
import WebHoverCard from '../WebHoverCard';
import * as DocumentPicker from 'expo-document-picker';
import UnionMemberModal from './UnionMemberModal';

export interface UnionMember {
    id: string;
    employeeId?: string;
    fullName: string;
    gender?: string;
    department?: string;
    workUnit?: string;
    position?: string;
    phoneNumber?: string;
    unionJoinDate?: string;
    isPartyMember?: boolean;
    familyBackground?: string;
    email?: string;
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
    const [filterFamilyBg, setFilterFamilyBg] = useState(false);
    const [filterPartyMember, setFilterPartyMember] = useState(false);

    const [selectedWorkUnit, setSelectedWorkUnit] = useState<string | null>(null);
    const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

    const [selectedMember, setSelectedMember] = useState<UnionMember | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    // const [editingMember, setEditingMember] = useState<UnionMember | null>(null);

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            const response = await api.get('/api/union-members/', {
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
                type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', '.xls', '.xlsx', '*/*'],
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

    const structure = useMemo(() => {
        const tree: Record<string, { total: number, departments: Record<string, number> }> = {};
        
        members.forEach(m => {
            const wu = m.workUnit || 'Khác';
            const dp = m.department || 'Chưa phân ban';
            
            if (!tree[wu]) {
                tree[wu] = { total: 0, departments: {} };
            }
            tree[wu].total += 1;
            
            if (!tree[wu].departments[dp]) {
                tree[wu].departments[dp] = 0;
            }
            tree[wu].departments[dp] += 1;
        });
        
        return tree;
    }, [members]);

    const filteredMembers = members.filter(m => {
        if (selectedWorkUnit && (m.workUnit || 'Khác') !== selectedWorkUnit) return false;
        if (selectedDepartment && (m.department || 'Chưa phân ban') !== selectedDepartment) return false;

        const matchesSearch = m.fullName?.toLowerCase().includes(searchText.toLowerCase()) ||
            m.department?.toLowerCase().includes(searchText.toLowerCase());

        let matchesFamilyBg = true;
        if (filterFamilyBg) {
            matchesFamilyBg = !!m.familyBackground && m.familyBackground.trim() !== '' && m.familyBackground.toLowerCase() !== 'nan';
        }

        let matchesParty = true;
        if (filterPartyMember) {
            matchesParty = !!m.isPartyMember;
        }

        return matchesSearch && matchesFamilyBg && matchesParty;
    });

    const handleRowClick = (item: UnionMember) => {
        setSelectedMember(item);
        setModalVisible(true);
    };

    const renderItem = ({ item }: { item: UnionMember }) => (
        <TouchableOpacity activeOpacity={0.7} onPress={() => handleRowClick(item)}>
            <WebHoverCard style={styles.card}>
                <View style={styles.cardInfo}>
                    <Text style={styles.nameText}>{item.employeeId ? `[${item.employeeId}] ` : ''}{item.fullName}</Text>
                    <Text style={styles.subText}>{item.position || 'Chưa cập nhật CV'} • {item.department || 'Chưa cập nhật PB'}</Text>
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
        <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
            {isDesktop && (
                <View style={styles.sidebar}>
                    <Text style={styles.sidebarTitle}>Cơ cấu tổ chức</Text>
                    <ScrollView showsVerticalScrollIndicator={false} style={styles.sidebarScroll}>
                        {Object.entries(structure).map(([wu, wuData]) => {
                            const isExpanded = selectedWorkUnit === wu;
                            return (
                                <View key={wu} style={styles.treeNode}>
                                    <TouchableOpacity 
                                        style={[styles.treeWorkUnit, isExpanded && !selectedDepartment && styles.treeSelected]}
                                        onPress={() => {
                                            setSelectedWorkUnit(isExpanded && !selectedDepartment ? null : wu);
                                            setSelectedDepartment(null);
                                        }}
                                    >
                                        {isExpanded ? <FolderOpen size={16} color={Colors.primary} /> : <Folder size={16} color={Colors.text.secondary} />}
                                        <Text style={[styles.treeText, isExpanded && styles.treeTextActive, { flex: 1 }]} numberOfLines={2}>
                                            {wu}
                                        </Text>
                                        <Text style={styles.treeCount}>{wuData.total}</Text>
                                    </TouchableOpacity>
                                    
                                    {isExpanded && (
                                        <View style={styles.treeChildren}>
                                            {Object.entries(wuData.departments).map(([dp, count]) => {
                                                const isDepSelected = selectedDepartment === dp;
                                                return (
                                                    <TouchableOpacity 
                                                        key={dp} 
                                                        style={[styles.treeDepartment, isDepSelected && styles.treeSelected]}
                                                        onPress={() => setSelectedDepartment(isDepSelected ? null : dp)}
                                                    >
                                                        <View style={styles.treeLine} />
                                                        <Text style={[styles.treeText, isDepSelected && styles.treeTextActive, { flex: 1, fontSize: 13 }]} numberOfLines={2}>
                                                            {dp}
                                                        </Text>
                                                        <Text style={styles.treeCount}>{count}</Text>
                                                    </TouchableOpacity>
                                                )
                                            })}
                                        </View>
                                    )}
                                </View>
                            )
                        })}
                    </ScrollView>
                </View>
            )}

            <View style={styles.container}>
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

            {/* Background Filters */}
            <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Lọc nhanh:</Text>
                <TouchableOpacity
                    style={[styles.filterChip, filterFamilyBg && styles.filterChipActive]}
                    onPress={() => setFilterFamilyBg(!filterFamilyBg)}
                >
                    {filterFamilyBg ? <CheckSquare size={16} color={Colors.primary} /> : <Square size={16} color={Colors.text.secondary} />}
                    <Text style={[styles.filterChipText, filterFamilyBg && styles.filterChipTextActive]}>
                        Hoàn cảnh gia đình
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filterChip, filterPartyMember && styles.filterChipActive]}
                    onPress={() => setFilterPartyMember(!filterPartyMember)}
                >
                    {filterPartyMember ? <CheckSquare size={16} color={Colors.primary} /> : <Square size={16} color={Colors.text.secondary} />}
                    <Text style={[styles.filterChipText, filterPartyMember && styles.filterChipTextActive]}>
                        Đảng viên
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={styles.listContainer}>
                {isDesktop ? (
                    <View style={styles.table}>
                        <View style={styles.tableHeader}>
                            <Text style={[styles.th, { flex: 0.8 }]}>Mã NV</Text>
                            <Text style={[styles.th, { flex: 2 }]}>Họ và Tên</Text>
                            <Text style={[styles.th, { flex: 1.5 }]}>Chức vụ / PB</Text>
                            <Text style={[styles.th, { flex: 1 }]}>Điện thoại</Text>
                            <Text style={[styles.th, { width: 100, textAlign: 'center' }]}>Thao tác</Text>
                        </View>
                        <FlatList
                            data={filteredMembers}
                            keyExtractor={item => item.id}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.tr} activeOpacity={0.7} onPress={() => handleRowClick(item)}>
                                    <Text style={[styles.td, { flex: 0.8, color: Colors.text.secondary }]}>{item.employeeId || '-'}</Text>
                                    <Text style={[styles.td, { flex: 2, fontWeight: '500' }]}>{item.fullName}</Text>
                                    <Text style={[styles.td, { flex: 1.5 }]}>
                                        <Text style={{ fontWeight: '500' }}>{item.position || '-'}</Text>
                                        <Text style={{ color: Colors.text.secondary, fontSize: 13 }}>{'\n'}{item.department || '-'}</Text>
                                    </Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    mainLayout: {
        flex: 1,
        flexDirection: 'column',
    },
    mainLayoutDesktop: {
        flexDirection: 'row',
        maxWidth: 1600,
        marginHorizontal: 'auto',
        width: '100%',
        padding: 16,
        gap: 20,
    },
    sidebar: {
        width: 320,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.divider,
        maxHeight: '100%',
    },
    sidebarTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.text.primary,
        marginBottom: 16,
    },
    sidebarScroll: {
        flex: 1,
    },
    treeNode: {
        marginBottom: 4,
    },
    treeWorkUnit: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        gap: 8,
    },
    treeDepartment: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        paddingLeft: 32,
        borderRadius: 8,
        gap: 8,
    },
    treeSelected: {
        backgroundColor: Colors.primary + '15',
    },
    treeLine: {
        width: 12,
        height: 1,
        backgroundColor: Colors.divider,
        marginRight: 4,
    },
    treeText: {
        fontSize: 14,
        color: Colors.text.primary,
        fontWeight: '500',
    },
    treeTextActive: {
        color: Colors.primary,
        fontWeight: 'bold',
    },
    treeCount: {
        fontSize: 12,
        color: Colors.text.secondary,
        backgroundColor: Colors.background,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 10,
        overflow: 'hidden',
    },
    treeChildren: {
        marginTop: 4,
    },
    container: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.divider,
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
    filterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
        flexWrap: 'wrap',
    },
    filterLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: Colors.surface,
        borderWidth: 1,
        borderColor: Colors.divider,
        gap: 8,
    },
    filterChipActive: {
        borderColor: Colors.primary,
        backgroundColor: `${Colors.primary}10`,
    },
    filterChipText: {
        fontSize: 14,
        color: Colors.text.secondary,
    },
    filterChipTextActive: {
        color: Colors.primary,
        fontWeight: '500',
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
