import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

// Keeps catalog filter/sort/search/page state in the URL so it survives
// refresh, works with Back/Forward, and is shareable — rather than hiding it
// only in component state.
export function useCatalogParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => {
    const result = {};
    for (const key of Object.keys(defaults)) {
      result[key] = searchParams.get(key) ?? defaults[key];
    }
    result.page = Number(searchParams.get("page")) || 1;
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const updateParams = useCallback(
    (updates, { resetPage = true } = {}) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(updates).forEach(([key, value]) => {
          if (value === undefined || value === null || value === "") next.delete(key);
          else next.set(key, String(value));
        });
        if (resetPage) next.set("page", "1");
        return next;
      });
    },
    [setSearchParams]
  );

  const setPage = useCallback(
    (page) => updateParams({ page }, { resetPage: false }),
    [updateParams]
  );

  return { params, updateParams, setPage };
}
