import { useCallback, useState } from 'react';

/**
 * Lets a prop be either controlled or uncontrolled.
 *
 * When `controlledValue` is `undefined` the hook keeps the value in local state
 * (uncontrolled); otherwise the prop wins and `onChange` is the only way to
 * update it. This is what allows `<AdhdReader defaultWpm={300} />` and
 * `<AdhdReader wpm={wpm} onWpmChange={setWpm} />` to both work.
 */
export function useControllableState<T>(
  controlledValue: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void,
): [T, (value: T) => void] {
  const [uncontrolledValue, setUncontrolledValue] = useState<T>(defaultValue);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const setValue = useCallback(
    (next: T) => {
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  return [value, setValue];
}
