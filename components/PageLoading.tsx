import StoreHeader from "@/components/StoreHeader";

/** Shared route-level loading UI: keeps the header in place and announces progress to assistive tech. */
export default function PageLoading({ label }: { label: string }) {
  return <>
    <StoreHeader />
    <main className="commerce-page" aria-busy="true">
      <p className="sr-only" role="status">{label}</p>
      <div className="commerce-state" aria-hidden="true" style={{ justifyItems: "stretch" }}>
        <div className="skeleton-line" style={{ width: "40%", height: 18 }} />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
      </div>
    </main>
  </>;
}
