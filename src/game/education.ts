import { JOBS } from './catalog'
import { applyXp } from './engine'
import type { Job } from './types'

export type EducationCourseId =
  | 'course'
  | 'masterclass'
  | 'certification'
  | 'bootcamp'
  | 'university'
  | 'mba'

export interface EducationCourse {
  id: EducationCourseId
  itemId: EducationCourseId
  name: string
  studyMinutesRequired: number
  xpReward: number
  wageBonus: number
  businessLaborBonus: number
  description: string
}

export interface EducationProgress {
  courseId: EducationCourseId
  itemId: EducationCourseId
  enrolledAt: number
  studiedMinutes: number
  completedAt: number | null
}

export interface EducationCareerOutlook {
  projectedLevel: number
  projectedXp: number
  unlockedJobs: Job[]
  nextLockedJob: Job | null
  summary: string
}

export const EDUCATION_COURSES: Record<EducationCourseId, EducationCourse> = {
  course: {
    id: 'course',
    itemId: 'course',
    name: 'Online Course',
    studyMinutesRequired: 60,
    xpReward: 40,
    wageBonus: 0.01,
    businessLaborBonus: 0.02,
    description: 'One focused evening that proves school is a habit, not a receipt.',
  },
  masterclass: {
    id: 'masterclass',
    itemId: 'masterclass',
    name: 'Masterclass Series',
    studyMinutesRequired: 90,
    xpReward: 60,
    wageBonus: 0.02,
    businessLaborBonus: 0.03,
    description: 'A few serious sessions with people who already climbed.',
  },
  certification: {
    id: 'certification',
    itemId: 'certification',
    name: 'Professional Certification',
    studyMinutesRequired: 180,
    xpReward: 150,
    wageBonus: 0.04,
    businessLaborBonus: 0.05,
    description: 'Proof of skill that takes real time and unlocks better work.',
  },
  bootcamp: {
    id: 'bootcamp',
    itemId: 'bootcamp',
    name: 'Coding Bootcamp',
    studyMinutesRequired: 12 * 60,
    xpReward: 300,
    wageBonus: 0.06,
    businessLaborBonus: 0.08,
    description: 'A long focused climb into a better career lane.',
  },
  university: {
    id: 'university',
    itemId: 'university',
    name: 'University Semester',
    studyMinutesRequired: 24 * 60,
    xpReward: 700,
    wageBonus: 0.08,
    businessLaborBonus: 0.12,
    description: 'The long game, played properly across many study blocks.',
  },
  mba: {
    id: 'mba',
    itemId: 'mba',
    name: 'Executive MBA',
    studyMinutesRequired: 40 * 60,
    xpReward: 1_500,
    wageBonus: 0.09,
    businessLaborBonus: 0.15,
    description: 'Boardroom fluency earned through sustained study.',
  },
}

export const STUDY_BLOCK_MINUTES = 60

export function educationCourseById(courseId: string): EducationCourse | null {
  return (EDUCATION_COURSES as Record<string, EducationCourse | undefined>)[courseId] ?? null
}

export function educationCourseForItem(itemId: string): EducationCourse | null {
  return educationCourseById(itemId)
}

export function createEducationProgress(course: EducationCourse, now = Date.now()): EducationProgress {
  return {
    courseId: course.id,
    itemId: course.itemId,
    enrolledAt: now,
    studiedMinutes: 0,
    completedAt: null,
  }
}

export function normalizeEducationProgress(progress: Partial<EducationProgress>): EducationProgress | null {
  const course = progress.courseId ? educationCourseById(progress.courseId) : progress.itemId ? educationCourseForItem(progress.itemId) : null
  if (!course) return null
  return {
    courseId: course.id,
    itemId: course.itemId,
    enrolledAt: Number.isFinite(progress.enrolledAt) ? Number(progress.enrolledAt) : Date.now(),
    studiedMinutes: Math.max(0, Math.floor(progress.studiedMinutes ?? 0)),
    completedAt: progress.completedAt ?? null,
  }
}

export function educationRemainingMinutes(course: EducationCourse, progress: EducationProgress | null | undefined): number {
  return Math.max(0, course.studyMinutesRequired - (progress?.studiedMinutes ?? 0))
}

export function nextStudyBlockMinutes(course: EducationCourse, progress: EducationProgress | null | undefined): number {
  const remaining = educationRemainingMinutes(course, progress)
  return Math.min(STUDY_BLOCK_MINUTES, remaining)
}

export function educationPercent(course: EducationCourse, progress: EducationProgress | null | undefined): number {
  if (course.studyMinutesRequired <= 0) return 100
  return Math.min(100, Math.round(((progress?.studiedMinutes ?? 0) / course.studyMinutesRequired) * 100))
}

export function addStudyMinutes(
  course: EducationCourse,
  progress: EducationProgress,
  minutes: number,
  now = Date.now(),
): { progress: EducationProgress; completedNow: boolean; xpGained: number } {
  if (progress.completedAt !== null) return { progress, completedNow: false, xpGained: 0 }
  const studiedMinutes = Math.min(course.studyMinutesRequired, progress.studiedMinutes + Math.max(0, Math.floor(minutes)))
  const completedNow = studiedMinutes >= course.studyMinutesRequired
  return {
    progress: {
      ...progress,
      studiedMinutes,
      completedAt: completedNow ? now : null,
    },
    completedNow,
    xpGained: completedNow ? course.xpReward : 0,
  }
}

export function educationActionCount(progress: EducationProgress[]): number {
  return progress.filter((item) => item.studiedMinutes > 0 || item.completedAt !== null).length
}

export function completedEducationCourses(progress: EducationProgress[]): EducationCourse[] {
  return progress
    .filter((item) => item.completedAt !== null)
    .map((item) => educationCourseById(item.courseId))
    .filter((course): course is EducationCourse => course !== null)
}

function roundedRate(value: number): number {
  return Math.round(value * 1_000) / 1_000
}

export function educationWageBonusFrom(progress: EducationProgress[]): number {
  return roundedRate(completedEducationCourses(progress).reduce((sum, course) => sum + course.wageBonus, 0))
}

export function educationBusinessLaborBonusFrom(progress: EducationProgress[]): number {
  return roundedRate(completedEducationCourses(progress).reduce((sum, course) => sum + course.businessLaborBonus, 0))
}

export function educationBusinessLaborMultiplier(progress: EducationProgress[]): number {
  return roundedRate(1 + educationBusinessLaborBonusFrom(progress))
}

export function educationCareerOutlook(course: EducationCourse, level: number, xp: number): EducationCareerOutlook {
  const currentLevel = Math.max(1, Math.floor(level))
  const projected = applyXp(currentLevel, Math.max(0, Math.floor(xp)), course.xpReward)
  const unlockedJobs = JOBS
    .filter((job) => job.requiredLevel > currentLevel && job.requiredLevel <= projected.level)
    .sort((a, b) => a.requiredLevel - b.requiredLevel || b.wage - a.wage)
  const nextLockedJob = JOBS
    .filter((job) => job.requiredLevel > projected.level)
    .sort((a, b) => a.requiredLevel - b.requiredLevel || b.wage - a.wage)[0] ?? null
  const summary = unlockedJobs.length > 0
    ? `Can unlock ${jobListText(unlockedJobs)}.`
    : nextLockedJob
      ? `Moves toward ${nextLockedJob.title} at level ${nextLockedJob.requiredLevel}.`
      : 'Strengthens wages and business work after the career ladder is open.'
  return {
    projectedLevel: projected.level,
    projectedXp: projected.xp,
    unlockedJobs,
    nextLockedJob,
    summary,
  }
}

export function educationPathTextForJob(job: Job, level: number, xp: number): string {
  if (level >= job.requiredLevel) return 'Unlocked now.'
  const course = Object.values(EDUCATION_COURSES).find((candidate) =>
    educationCareerOutlook(candidate, level, xp).projectedLevel >= job.requiredLevel
  )
  return course
    ? `Study ${course.name} to reach level ${job.requiredLevel}.`
    : `Study toward level ${job.requiredLevel}.`
}

function jobListText(jobs: readonly Job[]): string {
  if (jobs.length <= 2) return jobs.map((job) => job.title).join(' and ')
  return `${jobs.slice(0, 2).map((job) => job.title).join(', ')} and ${jobs.length - 2} more`
}
