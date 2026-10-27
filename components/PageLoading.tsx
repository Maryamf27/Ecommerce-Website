import StoreHeader from "@/components/StoreHeader";

/** Shared route-level loading UI: a spinner (not placeholder bars), with the header kept in place. */
export default function PageLoading({ label }: { label: string }) {
  return <>
    <StoreHeader />
    <main className="page-loading" aria-busy="true">
      <div className="page-loading-center" role="status">
        <span className="spinner" aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </div>
    </main>
  </>;
}
