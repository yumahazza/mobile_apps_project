import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { APP_COLORS, APP_FONTS, APP_SPACING } from '@/constants/theme';

export interface DonutChartProps {
  percentage: number;
  hadir: number;
  izin: number;
  alfa: number;
  size?: number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  percentage,
  hadir,
  izin,
  alfa,
  size = 130,
}) => {
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const safePercentage = Number.isFinite(percentage)
    ? Math.max(0, Math.min(100, percentage))
    : 0;

  const strokeDashoffset =
    circumference * (1 - safePercentage / 100);

  const ringColor =
    safePercentage >= 75
      ? APP_COLORS.opened
      : safePercentage >= 50
      ? APP_COLORS.warning
      : APP_COLORS.danger;

  return (
    <View style={styles.container}>
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={APP_COLORS.neutral100}
            strokeWidth={strokeWidth}
            fill="none"
          />

          {safePercentage > 0 && (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={ringColor}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${center} ${center})`}
            />
          )}
        </Svg>

        <View pointerEvents="none" style={styles.percentOverlay}>
          <Text style={styles.percentText}>
            {Math.round(safePercentage)}%
          </Text>
        </View>
      </View>

      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: APP_COLORS.opened }]} />
          <Text style={styles.legendLabel}>Hadir</Text>
          <Text style={styles.legendValue}>{hadir}</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: APP_COLORS.warning }]} />
          <Text style={styles.legendLabel}>Izin</Text>
          <Text style={styles.legendValue}>{izin}</Text>
        </View>

        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: APP_COLORS.danger }]} />
          <Text style={styles.legendLabel}>Alfa</Text>
          <Text style={styles.legendValue}>{alfa}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: APP_SPACING.md,
    paddingHorizontal: APP_SPACING.md,
    backgroundColor: APP_COLORS.white,
    borderRadius: 12,
  },
  percentOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontFamily: APP_FONTS.bold,
    fontSize: 22,
    color: APP_COLORS.inkPrimary,
  },
  legendContainer: {
    justifyContent: 'center',
    gap: APP_SPACING.md,
    minWidth: 110,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendLabel: {
    flex: 1,
    fontFamily: APP_FONTS.medium,
    fontSize: 13,
    color: APP_COLORS.textSecondary,
  },
  legendValue: {
    fontFamily: APP_FONTS.bold,
    fontSize: 14,
    color: APP_COLORS.inkPrimary,
    marginLeft: 12,
  },
});

export default DonutChart;
