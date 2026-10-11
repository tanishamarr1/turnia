export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex min-h-11 min-w-11 items-center justify-center disabled:opacity-50"
    >
      <span
        className={`relative h-6 w-11 rounded-full border transition-colors motion-reduce:transition-none ${
          checked ? 'border-clay-strong bg-clay-strong' : 'border-line-strong bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 size-4.5 rounded-full bg-white shadow-sm transition-all motion-reduce:transition-none ${
            checked ? 'left-[1.4rem]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}
