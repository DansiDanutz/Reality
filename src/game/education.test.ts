import { describe, expect, test } from 'vitest'
import {
  addStudyMinutes,
  completedEducationCourses,
  createEducationProgress,
  educationActionCount,
  educationBusinessLaborMultiplier,
  educationPercent,
  educationRemainingMinutes,
  educationWageBonusFrom,
  nextStudyBlockMinutes,
  EDUCATION_COURSES,
} from './education'

describe('education progress', () => {
  test('starts enrolled courses at zero progress', () => {
    const progress = createEducationProgress(EDUCATION_COURSES.course, 1_000)

    expect(progress).toMatchObject({
      courseId: 'course',
      studiedMinutes: 0,
      completedAt: null,
    })
    expect(educationPercent(EDUCATION_COURSES.course, progress)).toBe(0)
    expect(educationRemainingMinutes(EDUCATION_COURSES.course, progress)).toBe(60)
  })

  test('caps each study block at the remaining course minutes', () => {
    const course = EDUCATION_COURSES.masterclass
    const progress = { ...createEducationProgress(course), studiedMinutes: 45 }

    expect(nextStudyBlockMinutes(course, progress)).toBe(45)
  })

  test('only grants XP when the required study time is complete', () => {
    const course = EDUCATION_COURSES.certification
    const enrolled = createEducationProgress(course)

    const first = addStudyMinutes(course, enrolled, 60, 2_000)
    expect(first.completedNow).toBe(false)
    expect(first.xpGained).toBe(0)
    expect(first.progress.completedAt).toBeNull()

    const final = addStudyMinutes(course, first.progress, 120, 3_000)
    expect(final.completedNow).toBe(true)
    expect(final.xpGained).toBe(course.xpReward)
    expect(final.progress.completedAt).toBe(3_000)

    const duplicate = addStudyMinutes(course, final.progress, 60, 4_000)
    expect(duplicate.xpGained).toBe(0)
    expect(duplicate.progress.completedAt).toBe(3_000)
  })

  test('counts education actions only after real study progress exists', () => {
    const course = EDUCATION_COURSES.course
    const enrolled = createEducationProgress(course)
    const studied = addStudyMinutes(course, enrolled, 30).progress

    expect(educationActionCount([enrolled])).toBe(0)
    expect(educationActionCount([studied])).toBe(1)
  })

  test('completed courses grant career and business labor advantages', () => {
    const course = {
      ...createEducationProgress(EDUCATION_COURSES.course),
      studiedMinutes: EDUCATION_COURSES.course.studyMinutesRequired,
      completedAt: 2_000,
    }
    const certification = {
      ...createEducationProgress(EDUCATION_COURSES.certification),
      studiedMinutes: EDUCATION_COURSES.certification.studyMinutesRequired,
      completedAt: 3_000,
    }
    const unfinishedBootcamp = {
      ...createEducationProgress(EDUCATION_COURSES.bootcamp),
      studiedMinutes: 60,
    }

    expect(completedEducationCourses([course, certification, unfinishedBootcamp]).map((item) => item.id)).toEqual(['course', 'certification'])
    expect(educationWageBonusFrom([course, certification, unfinishedBootcamp])).toBeCloseTo(0.05)
    expect(educationBusinessLaborMultiplier([course, certification, unfinishedBootcamp])).toBeCloseTo(1.07)
  })
})
