import "./CatalogSkeleton.css";

const CatalogSkeleton = ({ count = 8, round = false, rows = false }) => {
  if (rows) {
    return (
      <div className="sw-skeleton-rows" aria-label="Loading music">
        {Array.from({ length: count }).map((_, index) => (
          <div className="sw-skeleton-row" key={index}>
            <span className="sw-skeleton-block art" />
            <span className="sw-skeleton-copy">
              <i className="sw-skeleton-block line" />
              <i className="sw-skeleton-block line short" />
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="sw-skeleton-grid" aria-label="Loading music">
      {Array.from({ length: count }).map((_, index) => (
        <div className="sw-skeleton-card" key={index}>
          <span className={`sw-skeleton-block cover ${round ? "round" : ""}`} />
          <span className="sw-skeleton-block line" />
          <span className="sw-skeleton-block line short" />
        </div>
      ))}
    </div>
  );
};

export default CatalogSkeleton;
