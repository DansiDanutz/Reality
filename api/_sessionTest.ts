type RequestLike = { headers?: Record<string, string | string[] | undefined> }

/**
 * Adapt legacy handler regressions to the browser session boundary.
 * Explicit headers remain untouched so CSRF-negative, unauthenticated, and
 * machine-to-machine bearer cases continue to exercise their real boundary.
 */
export function withCitizenSessionHandler<Req extends RequestLike, Res>(
  handler: (req: Req, res: Res) => unknown,
  citizenId: string,
  token: string,
): (req: Req, res: Res) => unknown {
  return (req, res) => handler(req.headers ? req : {
    ...req,
    headers: {
      cookie: `reality_session=${citizenId}.${token}; reality_csrf=test-csrf`,
      'x-reality-csrf': 'test-csrf',
    },
  }, res)
}
