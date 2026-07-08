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
  return {
    operatorToken,
    limit,
    pages,
    ...(cursor ? { cursor } : {}),
  }
}

export function founderCovenantOperatorQueueRefreshCursor(
  queue: RealityFounderCovenantReviewQueueDashboard | null,
  scanCursor: string | null,
): string | null {
  return queue?.cursor ?? scanCursor ?? null
}
