/**
 * Custom Dropdown used inside the mobile popup sheet on the 3D Shot
 * Chart tool. Native <select> elements look out-of-place against the
 * portfolio palette, and they don't allow re-selecting the same option
 * (which the Camera "preset" picker needs). This component:
 *
 *   - Matches the page's button + card styling
 *   - Closes on click-outside, Escape, or after an option is chosen
 *   - Always fires onChange when an option is tapped — even if the same
 *     option was already selected — so action-style dropdowns (Camera)
 *     can re-fire the same preset.
 */
import { useEffect, useRef, useState } from 'react'

export type DropdownOption = { value: string; label: string }

export function Dropdown({
  value,
  options,
  onChange,
  ariaLabel,
  /** Used when value doesn't match any option (e.g. action-style picker). */
  placeholder,
}: {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  ariaLabel?: string
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value)

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return
    function handlePointer(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('touchstart', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('touchstart', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div className="sct__dd" ref={rootRef}>
      <button
        type="button"
        className={`sct__dd-trigger${open ? ' sct__dd-trigger--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className="sct__dd-text">{selected?.label ?? placeholder ?? '–'}</span>
        <span className="sct__dd-chev" aria-hidden="true" />
      </button>
      {open && (
        <ul className="sct__dd-panel" role="listbox">
          {options.map((o) => {
            const isActive = o.value === value
            return (
              <li key={o.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`sct__dd-opt${isActive ? ' sct__dd-opt--active' : ''}`}
                  onClick={() => {
                    onChange(o.value)
                    setOpen(false)
                  }}
                >
                  {o.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
