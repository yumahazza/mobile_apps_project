import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { APP_COLORS, APP_FONTS, APP_RADIUS, APP_SPACING } from '@/constants/theme';

export interface SummaryMetricsProps {
  hadir: number;
  izin?: number;
  alfa?: number;
  total: number;
}

export const SummaryTile: React.FC<SummaryMetricsProps> = ({
  hadir,
  izin = 0,
  alfa = 0,
  total,
}) => {
  return (
    <View style={styles.grid}>
      <View style={[styles.tile, styles.tileHadir]}>
        <Text style={[styles.label, { color: APP_COLORS.opened }]}>Hadir</Text>
        <Text style={[styles.value, { color: APP_COLORS.opened }]}>{hadir}</Text>
      </View>

      <View style={[styles.tile, styles.tileIzin]}>
        <Text style={[styles.label, { color: APP_COLORS.warning }]}>Izin</Text>
        <Text style={[styles.value, { color: APP_COLORS.warning }]}>{izin}</Text>
      </View>

      <View style={[styles.tile, styles.tileAlfa]}>
        <Text style={[styles.label, { color: APP_COLORS.dangerText }]}>Alfa</Text>
        <Text style={[styles.value, { color: APP_COLORS.dangerText }]}>{alfa}</Text>
      </View>

      <View style={[styles.tile, styles.tileTotal]}>
        <Text style={[styles.label, { color: APP_COLORS.textSecondary }]}>Total</Text>
        <Text style={[styles.value, { color: APP_COLORS.inkPrimary }]}>{total}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: APP_SPACING.sm,
    width: '100%',
    marginVertical: APP_SPACING.sm,
  },
  tile: {
    flex: 1,
    paddingVertical: APP_SPACING.md,
    paddingHorizontal: APP_SPACING.xs,
    borderRadius: APP_RADIUS.card,
    backgroundColor: APP_COLORS.white,
    borderWidth: 1,
    borderColor: APP_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileHadir: {
    backgroundColor: APP_COLORS.openedSoft,
    borderColor: '#BBF7D0',
  },
  tileIzin: {
    backgroundColor: APP_COLORS.notOpenedSoft,
    borderColor: '#FDE68A',
  },
  tileAlfa: {
    backgroundColor: APP_COLORS.dangerSoft,
    borderColor: '#FECACA',
  },
  tileTotal: {
    backgroundColor: APP_COLORS.white,
    borderColor: APP_COLORS.border,
  },
  label: {
    fontFamily: APP_FONTS.semiBold,
    fontSize: 12,
    marginBottom: 4,
  },
  value: {
    fontFamily: APP_FONTS.bold,
    fontSize: 18,
  },
});

export default SummaryTile;
