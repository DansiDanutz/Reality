import type {
  RealityFounderCovenantOperatorQueueRequest,
  RealityFounderCovenantReviewQueueDashboard,
} from '../../lib/realityArea'

export function founderCovenantOperatorQueueRequest(
  operatorToken: string,
  limit: number,
  pages: number,
  cursor: string | null = null,
): RealityFounderCovenantOperatorQueueRequest {
  const normalizedCursor = cursor?.trim()
  return {
    operatorToken,
    limit,
    pages,
    ...(normalizedCursor ? { cursor: normalizedCursor } : {}),
  }
}

export function founderCovenantOperatorQueueRefreshCursor(
  queue: RealityFounderCovenantReviewQueueDashboard | null,
  scanCursor: string | null,
): string | null {
  const queueCursor = queue?.cursor?.trim()
  if (queueCursor) return queueCursor
  const localCursor = scanCursor?.trim()
  return localCursor || null
}
