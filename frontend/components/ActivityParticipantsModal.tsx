import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, Platform, Image } from 'react-native';
import { Colors } from '../constants/Colors';
import { X, User, CheckCircle } from 'lucide-react-native';
import { format } from 'date-fns';

interface ActivityParticipantsModalProps {
  visible: boolean;
  onClose: () => void;
  activity: any;
}

export default function ActivityParticipantsModal({ visible, onClose, activity }: ActivityParticipantsModalProps) {
  const [activeTab, setActiveTab] = useState<'registered' | 'attended'>('registered');

  if (!activity) return null;

  const renderItem = ({ item }: { item: any }) => {
    let timeString = null;
    if (activeTab === 'registered' && item.registeredAt) {
        timeString = item.registeredAt;
    } else if (activeTab === 'attended' && item.checkedInAt) {
        timeString = item.checkedInAt;
    }
    
    // Ensure accurate UTC matching if string doesn't have Z attached
    let safeTimeString = timeString;
    if (timeString && !timeString.endsWith('Z')) {
        safeTimeString = timeString + 'Z';
    }

    const formattedTime = safeTimeString ? format(new Date(safeTimeString), 'HH:mm - dd/MM/yyyy') : 'Lúc xác nhận';

    return (
      <View style={styles.userRow}>
        <View style={styles.avatar}>
          {item.userAvatar ? (
            <Image source={{ uri: item.userAvatar }} style={styles.avatarImage} />
          ) : (
            <User color="#fff" size={20} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>{item.userName || item.fullName || 'Người dùng'}</Text>
          <Text style={styles.userTime}>{formattedTime}</Text>
        </View>
        {activeTab === 'attended' && <CheckCircle color={Colors.status.success} size={20} />}
      </View>
    );
  };

  const currentList = activeTab === 'registered' ? (activity.registrations || []) : (activity.attendances || []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>Danh sách tham gia</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={Colors.text.secondary} size={24} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabsContainer}>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'registered' && styles.activeTab]}
              onPress={() => setActiveTab('registered')}
            >
              <Text style={[styles.tabText, activeTab === 'registered' && styles.activeTabText]}>
                Đăng ký ({activity.registrations?.length || 0})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tab, activeTab === 'attended' && styles.activeTab]}
              onPress={() => setActiveTab('attended')}
            >
              <Text style={[styles.tabText, activeTab === 'attended' && styles.activeTabText]}>
                Điểm danh ({activity.attendances?.length || 0})
              </Text>
            </TouchableOpacity>
          </View>

          <FlatList
             data={currentList}
             renderItem={renderItem}
             keyExtractor={(item, index) => item.userId || String(index)}
             contentContainerStyle={{ padding: 16 }}
             ListEmptyComponent={
               <View style={styles.emptyContainer}>
                 <Text style={styles.emptyText}>Chưa có thông tin danh sách tại mục này</Text>
               </View>
             }
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  activeTabText: {
    color: Colors.primary,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  userName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  userTime: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: Colors.text.placeholder,
    fontSize: 14,
  },
});
