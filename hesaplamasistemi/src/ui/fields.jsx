import { useId, useRef } from 'react'
import { MoneyInput } from '../domain/Money.js'
import { Icon } from './Icon.jsx'

/** Etiket + ipucu + hata mesajı sarmalayıcısı. */
export function Field({ id, label, hint, error, children }) {
  return (
    <div className="alan">
      <label className="alan__etiket" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="alan__ipucu" id={`${id}-ipucu`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="alan__hata" id={`${id}-hata`} role="alert">
          <Icon name="alert" size={16} />
          {error}
        </p>
      )}
    </div>
  )
}

function describedBy(id, error, hint) {
  if (error) return `${id}-hata`
  if (hint) return `${id}-ipucu`
  return undefined
}

/**
 * Türk lirası girdisi.
 *
 * Yazarken binlik ayırıcıları otomatik yerleştirir ve imleci doğru basamakta
 * tutar; nokta/virgüle basıldığında imleç kaymaz.
 */
export function MoneyField({ label, hint, error, value, onValueChange, id, ...rest }) {
  const fallbackId = useId()
  const fieldId = id ?? fallbackId
  const inputRef = useRef(null)

  function caretAfterMask(raw, caret, masked) {
    const before = raw.slice(0, caret)
    const commaIndex = before.lastIndexOf(',')

    if (commaIndex >= 0 && masked.includes(',')) {
      const decimals = before.slice(commaIndex + 1).replace(/\D/g, '').slice(0, 2).length
      return masked.indexOf(',') + 1 + decimals
    }

    const digitsBefore = before.replace(/\D/g, '').length
    if (digitsBefore === 0) return 0

    let seen = 0
    for (let index = 0; index < masked.length; index += 1) {
      if (/\d/.test(masked[index])) seen += 1
      if (seen === digitsBefore) return index + 1
    }
    return masked.length
  }

  function apply(raw, caret) {
    const masked = MoneyInput.mask(raw)
    if (masked === null) return
    const nextCaret = caretAfterMask(raw, caret, masked)
    onValueChange(masked)
    window.requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(nextCaret, nextCaret)
    })
  }

  /** Ayırıcı üzerinde silme yapıldığında bir önceki rakamı siler. */
  function skipSeparator(raw, caret, inputType) {
    const backspace = inputType === 'deleteContentBackward'
    const forward = inputType === 'deleteContentForward'
    if ((!backspace && !forward) || raw.replace(/\D/g, '') !== value.replace(/\D/g, '')) {
      return { raw, caret }
    }

    const separator = value[caret]
    if (separator !== '.' && separator !== ',') return { raw, caret }

    let index = backspace ? caret - 1 : caret + 1
    while (index >= 0 && index < value.length && !/\d/.test(value[index])) {
      index += backspace ? -1 : 1
    }
    if (index < 0 || index >= value.length) return { raw: value, caret }

    return {
      raw: value.slice(0, index) + value.slice(index + 1),
      caret: backspace ? index : caret,
    }
  }

  return (
    <Field id={fieldId} label={label} hint={hint} error={error}>
      <div className={`girdi-sarmal ${error ? 'girdi-sarmal--hatali' : ''}`}>
        <input
          {...rest}
          ref={inputRef}
          id={fieldId}
          className="girdi girdi--para"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(fieldId, error, hint)}
          onChange={(event) => {
            const raw = event.target.value
            const caret = event.target.selectionStart ?? raw.length
            const adjusted = skipSeparator(raw, caret, event.nativeEvent.inputType)
            apply(adjusted.raw, adjusted.caret)
          }}
          onBlur={(event) => {
            const parsed = MoneyInput.parse(event.target.value)
            if (parsed !== null) onValueChange(MoneyInput.toText(parsed))
            rest.onBlur?.(event)
          }}
        />
        <span className="girdi-sarmal__ek" aria-hidden="true">
          TL
        </span>
      </div>
    </Field>
  )
}

export function PercentField({ label, hint, error, value, onValueChange, id, ...rest }) {
  const fallbackId = useId()
  const fieldId = id ?? fallbackId

  return (
    <Field id={fieldId} label={label} hint={hint} error={error}>
      <div className={`girdi-sarmal ${error ? 'girdi-sarmal--hatali' : ''}`}>
        <input
          {...rest}
          id={fieldId}
          className="girdi"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(fieldId, error, hint)}
          onChange={(event) => onValueChange(event.target.value)}
        />
        <span className="girdi-sarmal__ek" aria-hidden="true">
          %
        </span>
      </div>
    </Field>
  )
}

export function NumberField({ label, hint, error, value, onValueChange, suffix, id, ...rest }) {
  const fallbackId = useId()
  const fieldId = id ?? fallbackId

  return (
    <Field id={fieldId} label={label} hint={hint} error={error}>
      <div className={`girdi-sarmal ${error ? 'girdi-sarmal--hatali' : ''}`}>
        <input
          {...rest}
          id={fieldId}
          className="girdi"
          type="number"
          inputMode="numeric"
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy(fieldId, error, hint)}
          onChange={(event) => onValueChange(event.target.value)}
        />
        {suffix && (
          <span className="girdi-sarmal__ek" aria-hidden="true">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  )
}

export function SelectField({ label, hint, error, id, children, ...rest }) {
  const fallbackId = useId()
  const fieldId = id ?? fallbackId

  return (
    <Field id={fieldId} label={label} hint={hint} error={error}>
      <select
        {...rest}
        id={fieldId}
        className="secim"
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(fieldId, error, hint)}
      >
        {children}
      </select>
    </Field>
  )
}

/** Kartlar hâlinde tek seçimli grup. */
export function ChoiceGroup({ legend, options, value, onChange }) {
  return (
    <fieldset className="secim-kutusu">
      <legend>{legend}</legend>
      <div className="secenek-izgara">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="secenek-kart"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            <strong>{option.label}</strong>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
