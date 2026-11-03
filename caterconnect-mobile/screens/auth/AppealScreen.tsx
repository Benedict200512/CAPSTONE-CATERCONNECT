
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronLeft,
  ShieldAlert,
  Send,
  Clock,
  AlertCircle,
  CheckCircle,
  Bell,
} from 'lucide-react-native';
import { Colors } from '../../constants/colors';
import { submitAccountAppeal } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

type Appeal = {
  id: string;
  appeal_message: string;
  evidence_url: string | null;
  status: string;
  staff_explanation: string | null;
  admin_decision: string | null;
  admin_decided_at: string | null;
  created_at: string;
};

type AppealNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

export default function AppealScreen() {
  const router = useRouter();

  const [appealMessage, setAppealMessage] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [suspensionReason, setSuspensionReason] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppealNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAppeal = useCallback(async () => {
    try {
      setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        Alert.alert(
          'Session Required',
          'Please log in again to access your appeal.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(auth)/login'),
            },
          ]
        );
        return;
      }

      // 1. Load the latest appeal
      const { data: appealData, error: appealError } = await supabase
        .from('account_appeals')
        .select(`
          id,
          appeal_message,
          evidence_url,
          status,
          staff_explanation,
          admin_decision,
          admin_decided_at,
          created_at
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (appealError) {
        throw appealError;
      }

      if (appealData) {
        setAppeal(appealData as Appeal);
        setAppealMessage(appealData.appeal_message || '');
        setEvidenceUrl(appealData.evidence_url || '');
      } else {
        setAppeal(null);
        setAppealMessage('');
        setEvidenceUrl('');
      }

      // 2. Load the suspension reason
      const { data: monitoringData, error: monitoringError } =
        await supabase
          .from('account_monitoring_cases')
          .select('reason')
          .eq('user_id', user.id)
          .eq('suspended', true)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

      if (monitoringError) {
        console.warn('Unable to load suspension reason:', monitoringError.message);
      }

      setSuspensionReason(monitoringData?.reason || null);

      // 3. Load appeal-related notifications only
      const { data: notificationData, error: notificationError } =
        await supabase
          .from('notifications')
          .select('id, title, message, type, is_read, created_at')
          .eq('user_id', user.id)
          .in('type', [
            'account_appeal_approved',
            'account_appeal_rejected',
            'account_appeal_admin_decision',
          ])
          .order('created_at', { ascending: false })
          .limit(10);

      if (notificationError) {
        console.warn(
          'Unable to load appeal notifications:',
          notificationError.message
        );
      }

      setNotifications((notificationData || []) as AppealNotification[]);
    } catch (error: any) {
      Alert.alert(
        'Unable to Load Appeal',
        error.message || 'Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadAppeal();
  }, [loadAppeal]);

  const status = String(appeal?.status || '').toLowerCase().trim();

  const adminDecision = String(appeal?.admin_decision || '')
    .toLowerCase()
    .trim();

  const isPending = status === 'pending';

  const isRejected = status === 'rejected';

  const isApprovedByStaff =
    status === 'approved' ||
    status === 'forwarded_to_admin' ||
    status === 'forwarded to admin';

  const isAccountRestored =
    status === 'account restored' ||
    adminDecision === 'unsuspend';

  const isKeptSuspended = adminDecision === 'keep suspended';

  const hasAdminDecision = isAccountRestored || isKeptSuspended;

  const canEdit = !appeal || isRejected;

  async function handleSubmitAppeal() {
    if (appealMessage.trim().length < 10) {
      Alert.alert(
        'Appeal Required',
        'Please explain your appeal using at least 10 characters.'
      );
      return;
    }

    if (appealMessage.trim().length > 5000) {
      Alert.alert(
        'Appeal Too Long',
        'Your appeal cannot exceed 5000 characters.'
      );
      return;
    }

    if (!canEdit) {
      Alert.alert(
        'Appeal Unavailable',
        'You cannot submit another appeal while your current appeal is being reviewed.'
      );
      return;
    }

    try {
      setSaving(true);

      const { error } = await submitAccountAppeal(
        appealMessage,
        evidenceUrl
      );

      if (error) {
        Alert.alert('Submission Failed', error.message);
        return;
      }

      Alert.alert(
        isRejected ? 'Appeal Resubmitted' : 'Appeal Submitted',
        isRejected
          ? 'Your revised appeal has been submitted successfully. Platform Staff will review it again. Your account will remain suspended.'
          : 'Your appeal has been submitted successfully. Platform Staff will review it. Your account will remain suspended while the appeal is being processed.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(auth)/login'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Submission Failed',
        error.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  function formatDate(date: string | null) {
    if (!date) return '';

    return new Date(date).toLocaleString();
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={Colors.orange} />
        <Text style={styles.loadingText}>Loading your appeal...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(auth)/login')}
        >
          <ChevronLeft size={20} color={Colors.orange} />
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>

        <View style={styles.iconContainer}>
          {isAccountRestored ? (
            <CheckCircle size={42} color="#16A34A" />
          ) : (
            <ShieldAlert size={42} color={Colors.orange} />
          )}
        </View>

        <Text style={styles.title}>
          {isAccountRestored ? 'Account Restored' : 'Account Appeal'}
        </Text>

        <Text style={styles.subtitle}>
          {isAccountRestored
            ? 'Your CaterConnect account has been restored.'
            : 'Request a review of your suspended CaterConnect account.'}
        </Text>

        {/* ACCOUNT STATUS */}
        <View
          style={[
            styles.notice,
            isAccountRestored && styles.restoredNotice,
          ]}
        >
          <Text
            style={[
              styles.noticeTitle,
              isAccountRestored && styles.restoredTitle,
            ]}
          >
            {isAccountRestored ? 'Account Active' : 'Account Suspended'}
          </Text>

          <Text
            style={[
              styles.noticeText,
              isAccountRestored && styles.restoredText,
            ]}
          >
            {isAccountRestored
              ? 'The System Administrator approved your appeal. You can now log in and access your account.'
              : 'Your account remains suspended. You cannot access your dashboard while your appeal is being processed.'}
          </Text>
        </View>

        {/* SUSPENSION REASON */}
        {!isAccountRestored && suspensionReason && (
          <View style={styles.reasonCard}>
            <View style={styles.statusHeader}>
              <AlertCircle size={19} color="#DC2626" />
              <Text style={styles.statusTitle}>Reason for Suspension</Text>
            </View>

            <Text style={styles.reasonText}>{suspensionReason}</Text>
          </View>
        )}

        {/* APPEAL STATUS */}
        {appeal && (
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              {isRejected || isKeptSuspended ? (
                <AlertCircle size={20} color="#DC2626" />
              ) : isAccountRestored ? (
                <CheckCircle size={20} color="#16A34A" />
              ) : (
                <Clock size={20} color={Colors.orange} />
              )}

              <Text style={styles.statusTitle}>Latest Appeal Status</Text>
            </View>

            <Text
              style={[
                styles.statusValue,
                isRejected && styles.rejectedStatus,
                isPending && styles.pendingStatus,
                isApprovedByStaff && styles.approvedStatus,
                isAccountRestored && styles.approvedStatus,
                isKeptSuspended && styles.rejectedStatus,
              ]}
            >
              {appeal.status}
            </Text>

            {isRejected && appeal.staff_explanation && (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationTitle}>
                  Staff Explanation
                </Text>

                <Text style={styles.explanationText}>
                  {appeal.staff_explanation}
                </Text>
              </View>
            )}

            {isPending && (
              <Text style={styles.statusDescription}>
                Your appeal is currently being reviewed by Platform Staff.
                Please wait for their decision.
              </Text>
            )}

            {isApprovedByStaff && !hasAdminDecision && (
              <Text style={styles.statusDescription}>
                Platform Staff approved your appeal and forwarded it to the
                System Administrator. Your account remains suspended until
                the final decision is made.
              </Text>
            )}

            {isAccountRestored && (
              <View style={styles.adminDecisionBox}>
                <Text style={styles.adminDecisionTitle}>
                  Final Admin Decision
                </Text>

                <Text style={styles.adminDecisionText}>
                  Your appeal was approved. Your account has been restored.
                  You may now log in.
                </Text>
              </View>
            )}

            {isKeptSuspended && (
              <View style={styles.explanationBox}>
                <Text style={styles.explanationTitle}>
                  Final Admin Decision
                </Text>

                <Text style={styles.explanationText}>
                  The System Administrator decided to keep your account
                  suspended after reviewing your appeal.
                </Text>
              </View>
            )}

            {appeal.admin_decided_at && (
              <Text style={styles.dateText}>
                Admin decision date: {formatDate(appeal.admin_decided_at)}
              </Text>
            )}

            {isRejected && (
              <Text style={styles.statusDescription}>
                You may edit your previous appeal and submit it again with
                additional information.
              </Text>
            )}
          </View>
        )}

        {/* APPEAL NOTIFICATIONS */}
        {notifications.length > 0 && (
          <View style={styles.notificationCard}>
            <View style={styles.statusHeader}>
              <Bell size={20} color={Colors.orange} />
              <Text style={styles.statusTitle}>Appeal Notifications</Text>
            </View>

            {notifications.map((notification, index) => (
              <View
                key={notification.id}
                style={[
                  styles.notificationItem,
                  index === notifications.length - 1 &&
                    styles.lastNotification,
                ]}
              >
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle}>
                    {notification.title}
                  </Text>

                  {!notification.is_read && (
                    <View style={styles.newBadge}>
                      <Text style={styles.newBadgeText}>NEW</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.notificationMessage}>
                  {notification.message}
                </Text>

                <Text style={styles.dateText}>
                  {formatDate(notification.created_at)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* APPEAL FORM */}
        {!isAccountRestored && (
          <View style={styles.card}>
            <Text style={styles.label}>
              {isRejected
                ? 'EDIT YOUR APPEAL EXPLANATION *'
                : 'YOUR APPEAL EXPLANATION *'}
            </Text>

            <TextInput
              style={[
                styles.messageInput,
                !canEdit && styles.readOnlyInput,
              ]}
              placeholder="Explain why you believe your account should be reviewed..."
              placeholderTextColor={Colors.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={5000}
              value={appealMessage}
              onChangeText={setAppealMessage}
              editable={canEdit}
            />

            <Text style={styles.counter}>
              {appealMessage.length}/5000 characters
            </Text>

            <Text style={styles.label}>EVIDENCE LINK (OPTIONAL)</Text>

            <TextInput
              style={[
                styles.evidenceInput,
                !canEdit && styles.readOnlyInput,
              ]}
              placeholder="Paste an evidence link if available"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              keyboardType="url"
              value={evidenceUrl}
              onChangeText={setEvidenceUrl}
              editable={canEdit}
            />

            {canEdit ? (
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  saving && styles.disabledButton,
                ]}
                onPress={handleSubmitAppeal}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={17} color="#FFFFFF" />
                    <Text style={styles.submitText}>
                      {isRejected ? 'RESUBMIT APPEAL' : 'SUBMIT APPEAL'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.waitingButton}>
                <Clock size={17} color="#FFFFFF" />
                <Text style={styles.submitText}>
                  WAITING FOR REVIEW
                </Text>
              </View>
            )}
          </View>
        )}

        {isAccountRestored && (
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={styles.submitText}>GO TO LOGIN</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadAppeal}
          disabled={loading}
        >
          <Text style={styles.refreshText}>Refresh Appeal Status</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Please provide truthful and accurate information. Submitting an
          appeal does not automatically restore your account.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  container: {
    flexGrow: 1,
    padding: 22,
    paddingTop: Platform.OS === 'ios' ? 55 : 35,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 30,
  },
  backText: {
    color: Colors.orange,
    fontWeight: '700',
    marginLeft: 5,
  },
  iconContainer: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: '#FFF0E5',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 27,
    fontWeight: '900',
    color: Colors.black,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 24,
  },
  notice: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
    borderWidth: 1,
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#C2410C',
    marginBottom: 6,
  },
  noticeText: {
    color: '#7C2D12',
    fontSize: 13,
    lineHeight: 20,
  },
  restoredNotice: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  restoredTitle: {
    color: '#15803D',
  },
  restoredText: {
    color: '#166534',
  },
  reasonCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
  },
  reasonText: {
    color: '#7F1D1D',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3E5DA',
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.black,
    flex: 1,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.textSecondary,
    marginTop: 12,
    textTransform: 'capitalize',
  },
  rejectedStatus: {
    color: '#DC2626',
  },
  pendingStatus: {
    color: '#2563EB',
  },
  approvedStatus: {
    color: '#16A34A',
  },
  explanationBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  explanationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B91C1C',
    marginBottom: 6,
  },
  explanationText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#7F1D1D',
  },
  adminDecisionBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  adminDecisionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
    marginBottom: 6,
  },
  adminDecisionText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#166534',
  },
  statusDescription: {
    color: Colors.textSecondary,
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3E5DA',
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
  },
  notificationItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3E5DA',
    paddingVertical: 14,
  },
  lastNotification: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  notificationTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: Colors.black,
  },
  notificationMessage: {
    fontSize: 12,
    lineHeight: 19,
    color: Colors.textSecondary,
    marginTop: 7,
  },
  newBadge: {
    backgroundColor: '#FFF0E5',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newBadgeText: {
    color: '#C2410C',
    fontSize: 9,
    fontWeight: '900',
  },
  dateText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 8,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F3E5DA',
    padding: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 9,
  },
  messageInput: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#E8DDD5',
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 5,
  },
  readOnlyInput: {
    backgroundColor: '#F5F5F5',
    color: Colors.textSecondary,
  },
  counter: {
    textAlign: 'right',
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 22,
  },
  evidenceInput: {
    borderWidth: 1,
    borderColor: '#E8DDD5',
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 22,
  },
  submitButton: {
    backgroundColor: Colors.orange,
    borderRadius: 30,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
  },
  waitingButton: {
    backgroundColor: '#9CA3AF',
    borderRadius: 30,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 9,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  disabledButton: {
    opacity: 0.6,
  },
  refreshButton: {
    alignSelf: 'center',
    paddingVertical: 15,
    marginTop: 8,
  },
  refreshText: {
    color: Colors.orange,
    fontSize: 13,
    fontWeight: '800',
  },
  footer: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 25,
  },
});
