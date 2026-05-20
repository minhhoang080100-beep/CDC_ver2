import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Colors } from '../../constants/Colors';
import { X, User, Briefcase, MapPin, Phone, CheckCircle, Calendar as CalendarIcon, Users } from 'lucide-react-native';
import { useResponsive } from '../../hooks/useResponsive';

interface UnionMember {
    employeeId?: string;
    fullName: string;
    gender?: string;
    birthDate?: string;
    workUnit?: string;
    department?: string;
    position?: string;
    hometown?: string;
    permanentAddress?: string;
    email?: string;
    phoneNumber?: string;
    educationLevel?: string;
    qualification?: string;
    professionalQualification?: string;
    major?: string;
    isPartyMember?: boolean;
    partyJoinDate?: string;
    partyOfficialDate?: string;
    unionJoinDate?: string;
    idNumber?: string;
    cccdNumber?: string;
    idIssueDate?: string;
    idIssuePlace?: string;
    familyBackground?: string;
}

interface UnionMemberModalProps {
    visible: boolean;
    onClose: () => void;
    member: UnionMember | null;
}

export default function UnionMemberModal({ visible, onClose, member }: UnionMemberModalProps) {
    const { isDesktop } = useResponsive();

    if (!member) return null;

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Chưa cập nhật';
        const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? `${match[3]}/${match[2]}/${match[1]}` : dateString;
    };

    const renderField = (label: string, value?: string | boolean, icon?: React.ReactNode) => (
        <View style={styles.fieldContainer}>
            {icon && <View style={styles.iconContainer}>{icon}</View>}
            <View style={styles.fieldContent}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <Text style={styles.fieldValue}>
                    {value === true ? 'Có' : value === false ? 'Không' : (value || 'Chưa cập nhật')}
                </Text>
            </View>
        </View>
    );

    const renderSection = (title: string, children: React.ReactNode) => (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            <View style={styles.sectionContent}>
                {children}
            </View>
        </View>
    );

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <TouchableOpacity
                    activeOpacity={1}
                    style={[styles.modalContent, isDesktop && styles.modalContentDesktop]}
                >
                    <View style={styles.header}>
                        <View style={styles.headerTitleContainer}>
                            <User color={Colors.primary} size={24} />
                            <Text style={styles.headerTitle}>Hồ sơ Đoàn viên</Text>
                        </View>
                        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                            <X color={Colors.text.secondary} size={24} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                        <View style={styles.profileHeader}>
                            <View style={styles.avatarPlaceholder}>
                                <Text style={styles.avatarText}>{member.fullName.charAt(0)}</Text>
                            </View>
                            <View style={styles.profileMainInfo}>
                                <Text style={styles.profileName}>{member.fullName}</Text>
                                <Text style={styles.profileSubtitle}>{member.position ? `${member.position} • ` : ''}{member.department || 'Chưa phân ban'}</Text>
                            </View>
                        </View>

                        {renderSection("Thông tin cá nhân", (
                            <>
                                {renderField("Giới tính", member.gender, <User size={18} color={Colors.text.secondary} />)}
                                {renderField("Ngày sinh", formatDate(member.birthDate), <CalendarIcon size={18} color={Colors.text.secondary} />)}
                                {renderField("Số điện thoại", member.phoneNumber, <Phone size={18} color={Colors.text.secondary} />)}
                                {renderField("Email", member.email)}
                                {renderField("Quê quán", member.hometown, <MapPin size={18} color={Colors.text.secondary} />)}
                                {renderField("Thường trú", member.permanentAddress, <MapPin size={18} color={Colors.text.secondary} />)}
                            </>
                        ))}

                        {renderSection("Thông tin Công tác & Đảng/Đoàn", (
                            <>
                                {renderField("Mã nhân viên", member.employeeId, <Briefcase size={18} color={Colors.text.secondary} />)}
                                {renderField("Đơn vị công tác", member.workUnit, <Briefcase size={18} color={Colors.text.secondary} />)}
                                {renderField("Bộ phận", member.department, <Briefcase size={18} color={Colors.text.secondary} />)}
                                {renderField("Chức vụ", member.position)}
                                {renderField("Ngày vào Công đoàn", formatDate(member.unionJoinDate), <Users size={18} color={Colors.text.secondary} />)}
                                {renderField("Trình độ văn hóa", member.educationLevel)}
                                {renderField("Trình độ", member.qualification)}
                                {renderField("Trình độ chuyên môn", member.professionalQualification)}
                                {renderField("Chuyên ngành", member.major)}
                                {renderField("Là Đảng Viên?", member.isPartyMember, <CheckCircle size={18} color={Colors.text.secondary} />)}
                                {member.isPartyMember && (
                                    <>
                                        {renderField("Ngày vào Đảng", formatDate(member.partyJoinDate))}
                                        {renderField("Ngày chính thức", formatDate(member.partyOfficialDate))}
                                    </>
                                )}
                            </>
                        ))}

                        {renderSection("Giấy tờ & Hoàn cảnh", (
                            <>
                                {renderField("Số CMND", member.idNumber)}
                                {renderField("Số CCCD", member.cccdNumber)}
                                {renderField("Ngày cấp", formatDate(member.idIssueDate))}
                                {renderField("Nơi cấp", member.idIssuePlace)}
                                {renderField("Hoàn cảnh gia đình", member.familyBackground)}
                            </>
                        ))}
                    </ScrollView>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContent: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        width: '100%',
        maxHeight: '90%',
        ...Platform.select({
            web: {
                boxShadow: '0px 10px 30px rgba(0, 0, 0, 0.15)',
            },
            default: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
            }
        })
    },
    modalContentDesktop: {
        width: 600,
        maxHeight: '85%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    headerTitleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.text.primary,
    },
    closeButton: {
        padding: 4,
    },
    scrollContent: {
        padding: 20,
    },
    profileHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginBottom: 24,
    },
    avatarPlaceholder: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: Colors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Colors.primary,
    },
    profileMainInfo: {
        flex: 1,
    },
    profileName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.text.primary,
        marginBottom: 4,
    },
    profileSubtitle: {
        fontSize: 14,
        color: Colors.text.secondary,
    },
    section: {
        marginBottom: 24,
        backgroundColor: Colors.background,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.divider,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text.primary,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    sectionContent: {
        padding: 16,
        gap: 16,
    },
    fieldContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    iconContainer: {
        marginTop: 2,
        width: 24,
        alignItems: 'center',
    },
    fieldContent: {
        flex: 1,
    },
    fieldLabel: {
        fontSize: 13,
        color: Colors.text.secondary,
        marginBottom: 4,
    },
    fieldValue: {
        fontSize: 15,
        color: Colors.text.primary,
        fontWeight: '500',
        lineHeight: 22,
    },
});
