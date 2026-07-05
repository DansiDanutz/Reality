import { useEffect } from 'react'
import { useFocusTrap } from '../../lib/useFocusTrap'

/**
 * A reusable in-app confirmation dialog — replaces window.confirm, which is
 * jarring (browser chrome, blocks the page) and breaks immersion. A top game
 * confirms destructive actions with its own UI that matches the rest.
 *
 * Renders nothing when `open` is false. When open, traps focus, closes on
 * Escape, and calls onConfirm/onCancel. The dialog uses the existing drawer
 * aesthetic so it feels native to Reality.
 */
export interface ConfirmDialogProps {
  open: boolean
  title: string
  body?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Visual tone of the confirm button. Defaults to 'danger' (red). */
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useFocusTrap<HTMLDivElement>(open)

  // Escape cancels — matches the rest of the app's Escape behavior.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="confirm-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        ref={dialogRef}
      >
        <h3 className="confirm-title">{title}</h3>
        {body && <p className="confirm-body">{body}</p>}
        <div className="confirm-actions">
          <button className="btn ghost" onClick={onCancel} autoFocus>
            {cancelLabel}
          </button>
          <button
            className={tone === 'danger' ? 'btn danger' : 'btn primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
