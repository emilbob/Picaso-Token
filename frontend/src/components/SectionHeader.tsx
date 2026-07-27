/**
 * The recurring BLUEPRINT rhythm: a mono label row above a hairline, then a
 * giant tight title. Opens every section.
 */
export function SectionHeader({
  index,
  label,
  meta,
  title,
}: {
  index: string;
  label: string;
  meta?: string;
  title?: string;
}) {
  return (
    <header>
      <div className="flex items-baseline justify-between gap-6">
        <span className="label">
          ({index}) {label}
        </span>
        {meta ? <span className="label text-right">{meta}</span> : null}
      </div>
      <hr className="mt-3 border-0 border-t border-line" />
      {title ? (
        <h2 className="display mt-8 text-[clamp(2.5rem,7vw,5.5rem)] text-ink">{title}</h2>
      ) : null}
    </header>
  );
}
