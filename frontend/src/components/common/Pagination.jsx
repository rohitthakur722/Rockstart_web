import { Button } from "./Button";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

export function Pagination({ pagination, onPageChange }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const { page, totalPages, hasPreviousPage, hasNextPage } = pagination;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-3 pt-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={!hasPreviousPage}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeftIcon width={16} height={16} aria-hidden="true" />
        Previous
      </Button>
      <span className="text-sm text-rockstar-text-secondary" aria-current="page">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={!hasNextPage}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        Next
        <ChevronRightIcon width={16} height={16} aria-hidden="true" />
      </Button>
    </nav>
  );
}
