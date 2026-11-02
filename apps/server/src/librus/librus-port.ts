import type { AttendanceEntry, Grade } from '@libly/core'

export interface LibrusPort {
  getAttendance(): Promise<readonly AttendanceEntry[]>
  getGrades(): Promise<readonly Grade[]>
}
