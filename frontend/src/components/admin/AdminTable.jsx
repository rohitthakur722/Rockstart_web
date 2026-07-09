// Responsive scroll container shared by every admin table — the table
// itself scrolls horizontally on narrow viewports instead of the page.
export function AdminTable({ children, caption }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-rockstar-border">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function AdminTableHeadCell({ children }) {
  return (
    <th scope="col" className="border-b border-rockstar-border bg-rockstar-surface px-4 py-3 font-medium text-rockstar-text-secondary">
      {children}
    </th>
  );
}

export function AdminTableCell({ children, className = "" }) {
  return <td className={`border-b border-rockstar-border px-4 py-3 align-middle ${className}`}>{children}</td>;
}
