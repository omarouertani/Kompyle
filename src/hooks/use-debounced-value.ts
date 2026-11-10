import { useEffect, useState } from "react";

/** Returns `value` once it has stopped changing for `ms` milliseconds.
 *  The state is set from the timer callback, never synchronously in the
 *  effect (react-hooks `set-state-in-effect`). */
export function useDebouncedValue<T>(value: T, ms = 600): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
