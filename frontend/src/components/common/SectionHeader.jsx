export function SectionHeader({ title, description, actions }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-rockstar-text-primary">{title}</h2>
        {description && <p className="text-sm text-rockstar-text-secondary">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
