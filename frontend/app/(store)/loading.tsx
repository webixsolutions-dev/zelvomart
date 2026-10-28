export default function Loading() {
  return (
    <main
      className="container store-loading"
      role="status"
      aria-label="Loading page"
      aria-busy="true"
    >
      <span className="store-loading-line store-loading-title" />
      <span className="store-loading-line" />
      <section className="store-loading-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span className="store-loading-card" key={index} />
        ))}
      </section>
    </main>
  );
}
