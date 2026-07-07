const WORKER_HOUR_CHOICES = [1, 2, 4, 6, 8]

export function workerHourChoices(maxHours: number): number[] {
  const cap = Math.max(1, Math.floor(maxHours))
  return WORKER_HOUR_CHOICES.filter((hours) => hours <= cap)
}

export function selectedWorkerHours(selection: Record<string, number>, workerId: string, maxHours: number): number {
  const choices = workerHourChoices(maxHours)
  const selected = selection[workerId]
  return choices.includes(selected) ? selected : choices[0]
}
