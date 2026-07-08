import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test } from 'vitest'
import { TelegramLinkStatusContent } from './ProfilePanel'

describe('ProfilePanel Telegram link status', () => {
  test('shows the default Telegram linking guidance before a session is detected', () => {
    const html = renderToStaticMarkup(
      <TelegramLinkStatusContent citizen={null} telegramLinkError={null} />,
    )

    expect(html).toContain('Telegram Mini App sign-in will link automatically when Reality opens inside Telegram.')
    expect(html).not.toContain('Telegram bot accounts cannot sign in to Reality.')
  })

  test('shows Telegram auth failures while the account is still unlinked', () => {
    const html = renderToStaticMarkup(
      <TelegramLinkStatusContent
        citizen={null}
        telegramLinkError="Telegram bot accounts cannot sign in to Reality."
      />,
    )

    expect(html).toContain('Telegram bot accounts cannot sign in to Reality.')
    expect(html).toContain('Telegram Mini App sign-in will link automatically when Reality opens inside Telegram.')
  })
})
