/**
 * Translation files for multi-language support
 * Supports Turkish (tr) and English (en)
 */

export const translations = {
  tr: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.manualCheck': 'Manuel Kontrol',
    'nav.statementImport': 'Ekstre İçe Aktar',
    'nav.analytics': 'Analizler',
    'nav.automation': 'Otomasyon',
    'nav.platform': 'Platform',

    // Common
    'common.loading': 'Yükleniyor...',
    'common.error': 'Hata',
    'common.success': 'Başarılı',
    'common.save': 'Kaydet',
    'common.cancel': 'İptal',
    'common.delete': 'Sil',
    'common.edit': 'Düzenle',
    'common.search': 'Ara',
    'common.filter': 'Filtrele',
    'common.refresh': 'Yenile',
    'common.download': 'İndir',
    'common.upload': 'Yükle',
    'common.back': 'Geri',
    'common.next': 'İleri',
    'common.confirm': 'Onayla',
    'common.reject': 'Reddet',
    'common.approve': 'Onayla',
    'common.status': 'Durum',
    'common.amount': 'Tutar',
    'common.date': 'Tarih',
    'common.actions': 'İşlemler',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'PSP Yönetim Paneli',
    'dashboard.dailyVolume': 'Günlük Hacim',
    'dashboard.pending': 'Bekleyen',
    'dashboard.successRate': 'Başarı Oranı',
    'dashboard.commission': 'Komisyon Geliri',
    'dashboard.today': 'Bugün',
    'dashboard.transactions': 'işlem',
    'dashboard.live': 'Canlı',
    'dashboard.recentActivity': 'Son Aktiviteler',
    'dashboard.noActivity': 'Henüz aktivite yok',

    // Manual Check
    'manualCheck.title': 'Manuel Banka Kontrolü',
    'manualCheck.subtitle': 'Bekleyen ödemeleri kontrol et ve onayla',
    'manualCheck.banks': 'Bankalar',
    'manualCheck.transactions': 'İşlemler',
    'manualCheck.pendingPayments': 'Bekleyen İşlemler',
    'manualCheck.approveSelected': 'Seçilenleri Onayla',
    'manualCheck.selectAll': 'Tümünü Seç',
    'manualCheck.clearSelection': 'Seçimi Temizle',
    'manualCheck.timeRemaining': 'dk kaldı',
    'manualCheck.refCode': 'Ref Kod',

    // Fraud Detection
    'fraud.lowRisk': 'Düşük Risk',
    'fraud.mediumRisk': 'Orta Risk',
    'fraud.highRisk': 'Yüksek Risk',
    'fraud.criticalRisk': 'Kritik Risk',
    'fraud.riskScore': 'Risk Skoru',
    'fraud.triggeredRules': 'Tespit Edilen Kurallar',
    'fraud.recommendation': 'Öneri',
    'fraud.autoApprove': 'Otomatik Onayla',
    'fraud.autoReject': 'Otomatik Reddet',
    'fraud.manualReview': 'Manuel İnceleme',

    // Payment Status
    'status.pending': 'Bekliyor',
    'status.processing': 'İşleniyor',
    'status.approved': 'Onaylandı',
    'status.rejected': 'Reddedildi',
    'status.expired': 'Süresi Doldu',

    // Notifications
    'notif.paymentApproved': 'Ödeme onaylandı',
    'notif.paymentRejected': 'Ödeme reddedildi',
    'notif.connectionEstablished': 'Bağlantı kuruldu',
    'notif.connectionLost': 'Bağlantı kesildi',

    // Analytics
    'analytics.title': 'Gelişmiş Analizler',
    'analytics.heatmap': 'İşlem Yoğunluğu Haritası',
    'analytics.bankPerformance': 'Banka Performans Karşılaştırması',
    'analytics.fraudTrend': 'Fraud Tespit Trendi',
    'analytics.commission': 'Komisyon Dağılımı',

    // Automation
    'automation.title': 'Otomasyon Kuralları',
    'automation.newRule': 'Yeni Kural',
    'automation.ruleName': 'Kural Adı',
    'automation.conditions': 'Koşullar',
    'automation.action': 'Eylem',
    'automation.enabled': 'Aktif',
    'automation.disabled': 'Pasif',

    // Platform Dashboard
    'platform.title': 'Platform Dashboard',
    'platform.apiKey': 'API Anahtarı',
    'platform.webhookUrl': 'Webhook URL',
    'platform.testWebhook': 'Test Webhook Gönder',
    'platform.transactions': 'İşlem Geçmişi',
  },

  en: {
    // Navigation
    'nav.dashboard': 'Dashboard',
    'nav.manualCheck': 'Manual Check',
    'nav.statementImport': 'Import Statement',
    'nav.analytics': 'Analytics',
    'nav.automation': 'Automation',
    'nav.platform': 'Platform',

    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.refresh': 'Refresh',
    'common.download': 'Download',
    'common.upload': 'Upload',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.confirm': 'Confirm',
    'common.reject': 'Reject',
    'common.approve': 'Approve',
    'common.status': 'Status',
    'common.amount': 'Amount',
    'common.date': 'Date',
    'common.actions': 'Actions',

    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.subtitle': 'PSP Management Panel',
    'dashboard.dailyVolume': 'Daily Volume',
    'dashboard.pending': 'Pending',
    'dashboard.successRate': 'Success Rate',
    'dashboard.commission': 'Commission Revenue',
    'dashboard.today': 'Today',
    'dashboard.transactions': 'transactions',
    'dashboard.live': 'Live',
    'dashboard.recentActivity': 'Recent Activity',
    'dashboard.noActivity': 'No activity yet',

    // Manual Check
    'manualCheck.title': 'Manual Bank Check',
    'manualCheck.subtitle': 'Review and approve pending payments',
    'manualCheck.banks': 'Banks',
    'manualCheck.transactions': 'Transactions',
    'manualCheck.pendingPayments': 'Pending Transactions',
    'manualCheck.approveSelected': 'Approve Selected',
    'manualCheck.selectAll': 'Select All',
    'manualCheck.clearSelection': 'Clear Selection',
    'manualCheck.timeRemaining': 'min left',
    'manualCheck.refCode': 'Ref Code',

    // Fraud Detection
    'fraud.lowRisk': 'Low Risk',
    'fraud.mediumRisk': 'Medium Risk',
    'fraud.highRisk': 'High Risk',
    'fraud.criticalRisk': 'Critical Risk',
    'fraud.riskScore': 'Risk Score',
    'fraud.triggeredRules': 'Triggered Rules',
    'fraud.recommendation': 'Recommendation',
    'fraud.autoApprove': 'Auto Approve',
    'fraud.autoReject': 'Auto Reject',
    'fraud.manualReview': 'Manual Review',

    // Payment Status
    'status.pending': 'Pending',
    'status.processing': 'Processing',
    'status.approved': 'Approved',
    'status.rejected': 'Rejected',
    'status.expired': 'Expired',

    // Notifications
    'notif.paymentApproved': 'Payment approved',
    'notif.paymentRejected': 'Payment rejected',
    'notif.connectionEstablished': 'Connection established',
    'notif.connectionLost': 'Connection lost',

    // Analytics
    'analytics.title': 'Advanced Analytics',
    'analytics.heatmap': 'Transaction Intensity Heatmap',
    'analytics.bankPerformance': 'Bank Performance Comparison',
    'analytics.fraudTrend': 'Fraud Detection Trend',
    'analytics.commission': 'Commission Distribution',

    // Automation
    'automation.title': 'Automation Rules',
    'automation.newRule': 'New Rule',
    'automation.ruleName': 'Rule Name',
    'automation.conditions': 'Conditions',
    'automation.action': 'Action',
    'automation.enabled': 'Active',
    'automation.disabled': 'Inactive',

    // Platform Dashboard
    'platform.title': 'Platform Dashboard',
    'platform.apiKey': 'API Key',
    'platform.webhookUrl': 'Webhook URL',
    'platform.testWebhook': 'Send Test Webhook',
    'platform.transactions': 'Transaction History',
  },
};
