import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import { X, ExternalLink } from 'lucide-react-native';
import * as Linking from 'expo-linking';
import { WebView } from 'react-native-webview';

interface DocumentViewerModalProps {
    visible: boolean;
    url: string | null;
    title?: string;
    onClose: () => void;
}

export default function DocumentViewerModal({ visible, url, title, onClose }: DocumentViewerModalProps) {
    if (!url) return null;

    const isWeb = Platform.OS === 'web';
    
    // For PDFs and office documents on Mobile, we often use Google Docs viewer.
    // However, for web, iframe works nicely without relying on third parties.
    const isPDF = url.toLowerCase().includes('.pdf');
    const viewerUrl = isWeb ? url : `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;

    return (
        <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={[styles.container, isWeb && styles.containerWeb]}>
                    <View style={styles.header}>
                        <Text style={styles.title} numberOfLines={1}>{title || 'Xem tài liệu'}</Text>
                        <View style={styles.headerActions}>
                            <TouchableOpacity onPress={() => Linking.openURL(url)} style={styles.actionBtn}>
                                <ExternalLink color="#64748b" size={20} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onClose} style={styles.actionBtn}>
                                <X color="#ef4444" size={24} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    
                    <View style={styles.content}>
                        {isWeb ? (
                            <iframe 
                                src={viewerUrl} 
                                style={{ width: '100%', height: '100%', border: 'none' }}
                                title="Document Viewer"
                            />
                        ) : (
                            <WebView 
                                source={{ uri: viewerUrl }} 
                                style={{ flex: 1 }} 
                                startInLoadingState={true}
                                renderLoading={() => (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="large" color="#3b82f6" />
                                    </View>
                                )}
                            />
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        width: '100%',
        height: '100%',
        backgroundColor: '#fff',
        overflow: 'hidden',
    },
    containerWeb: {
        width: '90%',
        height: '90%',
        borderRadius: 12,
        maxWidth: 1200,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#0f172a',
        flex: 1,
        marginRight: 10,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 16,
        alignItems: 'center',
    },
    actionBtn: {
        padding: 4,
    },
    content: {
        flex: 1,
        backgroundColor: '#e2e8f0', // Slightly darker to make paper stand out
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.8)',
    }
});
