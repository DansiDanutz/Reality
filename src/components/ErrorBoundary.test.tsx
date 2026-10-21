import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

afterEach(() => vi.restoreAllMocks())

function caught(props: ConstructorParameters<typeof ErrorBoundary>[0]) {
  const boundary = new ErrorBoundary(props)
  boundary.state = ErrorBoundary.getDerivedStateFromError(new Error('boom'))
  return renderToStaticMarkup(<>{boundary.render()}</>)
}

describe('ErrorBoundary', () => {
  test('renders its children until something throws', () => {
    expect(renderToStaticMarkup(<ErrorBoundary><p>world</p></ErrorBoundary>)).toBe('<p>world</p>')
  })

  test('the full-screen fallback says the save is safe and offers a reload', () => {
    const html = caught({ children: null })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Reality hit a problem')
    expect(html).toContain('Your save is safe')
    expect(html).toContain('Reload')
  })

  test('a contained area names itself and offers a retry, not a reload', () => {
    const html = caught({ children: null, area: 'The market', inline: true })
    expect(html).toContain('error-fallback inline')
    expect(html).toContain('The market hit a problem')
    expect(html).toContain('Try again')
    expect(html).not.toContain('Reload')
  })

  test('a contained area that owns its own close control offers Close, so touch players are never trapped', () => {
    expect(caught({ children: null, area: 'The market', inline: true, onClose: () => {} })).toContain('>Close</button>')
    expect(caught({ children: null, area: 'The map', inline: true })).not.toContain('>Close</button>')
  })

  test('reports what broke to the beta error reporter', () => {
    const fetchMock = vi.fn(async () => new Response('{}'))
    vi.stubGlobal('fetch', fetchMock)
    const boundary = new ErrorBoundary({ children: null, area: 'The map' })
    boundary.componentDidCatch(new Error('tiles exploded'), { componentStack: '\n    at WorldMap' } as never)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String((fetchMock.mock.calls[0] as unknown[])[1] && JSON.stringify((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toContain('The map: tiles exploded')
  })
})
