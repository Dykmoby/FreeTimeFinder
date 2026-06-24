import { useCallback, useEffect, useState } from 'react';

/**
 * useState that mirrors its value into localStorage, so a preference survives
 * reloads. Stores JSON; falls back to `initial` if nothing is saved yet or the
 * stored value can't be parsed (e.g. cleared cache, private mode).
 */
export function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable — keep working in-memory */
    }
  }, [key, value]);

  // A stable Set-backed helper for the common "toggle an id" case.
  const toggleInArray = useCallback((id) => {
    setValue((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    });
  }, []);

  return [value, setValue, toggleInArray];
}
