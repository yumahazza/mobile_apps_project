
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { ResponsiveContainer } from '@/components/ResponsiveContainer';
import { CustomButton } from '@/components/CustomButton';
import { useAslabDashboard } from '@/hooks/useAslabDashboard';
import type { NavigationProp } from '@/navigation/navigationTypes';
import { APP_COLORS, APP_FONTS, APP_SPACING } from '@/constants/theme';

interface Props {
  navigation: NavigationProp;
}

type Period = 'day' | 'week' | 'month';

const rupiah = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0);

export const AslabDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const courseId = String(navigation.params?.courseId ?? '');
  const [period, setPeriod] = useState<Period>('week');
  const [date] = useState(new Date().toISOString().slice(0, 10));

  const { data, loading, refreshing, error, refresh } =
    useAslabDashboard(courseId, period, date);

  const metrics = data
    ? [
        {
          label: 'Total Laboratorium',
          value: data.totalLaboratories,
        },
        {
          label: 'Praktikan Aktif',
          value: data.totalActiveStudents,
        },
        {
          label: 'Sesi Berlangsung',
          value: data.activeSessions,
        },
        {
          label: 'Sesi Mendatang',
          value: data.upcomingSessions,
        },
      ]
    : [];

  return (
    <View style={styles.root}>
      <AppHeader
        title="Dashboard Aslab"
        subtitle="Operasional laboratorium dan keuangan"
        onBack={() => navigation.goBack()}
      />

      <ResponsiveContainer>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.period}>
            {(['day', 'week', 'month'] as const).map((item) => (
              <Pressable
                key={item}
                onPress={() => setPeriod(item)}
                style={[
                  styles.periodBtn,
                  period === item && styles.selected,
                ]}
              >
                <Text
                  style={[
                    styles.periodText,
                    period === item && styles.selectedText,
                  ]}
                >
                  {item === 'day'
                    ? 'Hari'
                    : item === 'week'
                      ? 'Minggu'
                      : 'Bulan'}
                </Text>
              </Pressable>
            ))}
          </View>

          {loading && !data ? (
            <ActivityIndicator
              size="large"
              color={APP_COLORS.primary}
            />
          ) : error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.error}>{error}</Text>
              <CustomButton
                title="Coba Lagi"
                onPress={() => void refresh()}
              />
            </View>
          ) : data ? (
            <>
              <View style={styles.metrics}>
                {metrics.map((item) => (
                  <View key={item.label} style={styles.metric}>
                    <Text style={styles.metricValue}>
                      {item.value}
                    </Text>
                    <Text style={styles.metricLabel}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>

              <Text style={styles.heading}>
                Status Laboratorium
              </Text>

              {data.sessions.length === 0 ? (
                <Text style={styles.muted}>
                  Belum ada sesi pada periode ini.
                </Text>
              ) : (
                data.sessions.map((session) => (
                  <View key={session.id} style={styles.card}>
                    <Text style={styles.cardTitle}>
                      {session.laboratoryName}
                    </Text>

                    <Text style={styles.muted}>
                      {session.courseName} · {session.className}
                    </Text>

                    <Text style={styles.muted}>
                      {[session.building, session.floor]
                        .filter(Boolean)
                        .join(' · ')}
                      {session.startAt
                        ? ` · ${session.startAt}`
                        : ' · Waktu belum ditentukan'}
                    </Text>

                    <Text style={styles.status}>
                      {session.status === 'DIBUKA'
                        ? 'Sedang berlangsung'
                        : session.status === 'SELESAI'
                          ? 'Selesai'
                          : 'Akan datang'}
                    </Text>
                  </View>
                ))
              )}

              <Text style={styles.heading}>
                Ringkasan Keuangan
              </Text>

              <View style={styles.finance}>
                <View style={styles.financeItem}>
                  <Text style={styles.muted}>
                    Pemasukan terverifikasi
                  </Text>
                  <Text style={styles.money}>
                    {rupiah(data.finance.paidTotal)}
                  </Text>
                </View>

                <View style={styles.financeItem}>
                  <Text style={styles.muted}>
                    Tagihan belum lunas
                  </Text>
                  <Text style={styles.money}>
                    {rupiah(data.finance.outstandingTotal)}
                  </Text>
                </View>
              </View>

              <Text style={styles.muted}>
                Pembayaran sukses: {data.finance.paidCount}
                {' · '}
                Belum lunas: {data.finance.unpaidCount}
              </Text>

              {data.finance.payments.map((payment) => (
                <View key={payment.id} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {payment.studentName}
                    {payment.nim ? ` · ${payment.nim}` : ''}
                  </Text>

                  <Text style={styles.muted}>
                    {payment.sessionName} · {payment.laboratoryName}
                  </Text>

                  <View style={styles.between}>
                    <Text style={styles.money}>
                      {rupiah(payment.amount)}
                    </Text>

                    <Text style={styles.status}>
                      {payment.status === 'paid'
                        ? 'Lunas'
                        : payment.status === 'waived'
                          ? 'Dibebaskan'
                          : 'Belum lunas'}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <Text style={styles.muted}>
              Belum ada data dashboard.
            </Text>
          )}

          <CustomButton
            title={refreshing ? 'Memuat...' : 'Perbarui Dashboard'}
            variant="outline"
            onPress={() => void refresh()}
            disabled={refreshing}
          />
        </ScrollView>
      </ResponsiveContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_COLORS.background,
  },
  content: {
    padding: APP_SPACING.lg,
    gap: 14,
    paddingBottom: 40,
  },
  period: {
    flexDirection: 'row',
    gap: 8,
  },
  periodBtn: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: APP_COLORS.surface,
  },
  selected: {
    backgroundColor: APP_COLORS.primary,
  },
  periodText: {
    color: APP_COLORS.textPrimary,
    fontFamily: APP_FONTS.medium,
  },
  selectedText: {
    color: '#FFFFFF',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metric: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: APP_COLORS.surface,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  metricValue: {
    fontSize: 23,
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.textPrimary,
  },
  metricLabel: {
    fontSize: 11,
    color: APP_COLORS.textSecondary,
  },
  heading: {
    fontSize: 17,
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.textPrimary,
    marginTop: 6,
  },
  card: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    gap: 4,
  },
  cardTitle: {
    fontFamily: APP_FONTS.semiBold,
    color: APP_COLORS.textPrimary,
  },
  muted: {
    fontSize: 12,
    color: APP_COLORS.textSecondary,
  },
  status: {
    fontSize: 12,
    color: APP_COLORS.success,
    fontFamily: APP_FONTS.medium,
  },
  finance: {
    flexDirection: 'row',
    gap: 10,
  },
  financeItem: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: APP_COLORS.surface,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
  },
  money: {
    fontSize: 16,
    fontFamily: APP_FONTS.bold,
    color: APP_COLORS.textPrimary,
  },
  between: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  errorContainer: {
    gap: 10,
  },
  error: {
    color: APP_COLORS.dangerText,
  },
});
