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
