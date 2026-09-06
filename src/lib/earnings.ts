import type { AppSettings } from './settings';
import type { GroupedEntry } from './grouping';

// Single source of truth for pay math. The Dashboard tile and the Earnings page used to compute
// this separately and disagreed — notably both ignored the "fixed daily rate" pay model.

export function activePaySchedule(settings: AppSettings): string {
  return settings.isEmployee ? (settings.employeePaySchedule || 'monthly') : settings.paySchedule;
}

// What one pay period is worth. Employees earn their salary per period regardless of hours;
// students earn either per hour logged or per day attended, depending on their pay model.
export function periodEarnings(settings: AppSettings, group: GroupedEntry): number {
  if (settings.isEmployee) {
    const monthly = settings.monthlyRate || 0;
    return activePaySchedule(settings) === 'semi-monthly' ? monthly / 2 : monthly;
  }

  const rate = settings.hourlyRate || 0;
  return settings.payType === 'daily'
    ? group.daysWorked * rate
    : (group.totalSeconds / 3600) * rate;
}

export function totalEarnings(settings: AppSettings, groups: GroupedEntry[]): number {
  return groups.reduce((sum, group) => sum + periodEarnings(settings, group), 0);
}

export function totalDaysWorked(groups: GroupedEntry[]): number {
  return groups.reduce((sum, group) => sum + group.daysWorked, 0);
}

export interface PeriodRow {
  label: string;
  rendered: number;
  daysWorked: number;
  calculated: number;
  totalExpected: number;
  actualReceived: number;
  carryOverIn: number;
  carryOverOut: number;
  isAdjusted: boolean;
}

// One row per pay period, oldest first, carrying any under/overpayment forward: whatever a period
// was short by is added to what the next period expects.
export function buildPeriodBreakdown(
  settings: AppSettings,
  groups: GroupedEntry[],
  adjustments: Record<string, number>,
): PeriodRow[] {
  let carryOver = 0;

  return groups.map(group => {
    const calculated = periodEarnings(settings, group);
    const totalExpected = calculated + carryOver;
    const isAdjusted = adjustments[group.label] !== undefined;
    const actualReceived = isAdjusted ? adjustments[group.label] : totalExpected;
    const carryOverIn = carryOver;

    carryOver = totalExpected - actualReceived;

    return {
      label: group.label,
      rendered: group.totalSeconds / 3600,
      daysWorked: group.daysWorked,
      calculated,
      totalExpected,
      actualReceived,
      carryOverIn,
      carryOverOut: carryOver,
      isAdjusted,
    };
  });
}
