import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { FavoriteButton } from "../components/Favorite";
import { type Bathroom, floors } from "../domain/bathroom";
import { getBuildingStatus } from "../services/building";
export function Overview({
  favorite,
  onFavoriteChange,
  onContribute,
}: {
  favorite: Bathroom | null;
  onFavoriteChange: (value: Bathroom | null) => void;
  onContribute: (bathroom: Bathroom) => void;
}) {
  const query = useQuery({
    queryKey: ["building", "HH5"],
    queryFn: getBuildingStatus,
    retry: false,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  return (
    <main className="overview-layout">
      <section className="overview-intro">
        <span className="eyebrow">Live building utility</span>
        <h1>HH5 overview</h1>
        <p>Check each floor. Location is only needed when you contribute.</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh status
        </button>
        {query.data && (
          <p className="report-time">
            Updated at{" "}
            {new Date(query.data.generatedAt).toLocaleTimeString("en-GB")}
          </p>
        )}
      </section>
      {query.isPending && <p role="status">Loading building status…</p>}
      {query.isError && (
        <p role="alert" className="overview-warning">
          Could not refresh. Information may be out of date. Try refreshing.
        </p>
      )}
      {query.data &&
        floors.map((floor) => (
          <section
            className="overview-floor"
            key={floor}
            aria-labelledby={`floor-${floor}`}
          >
            <h2 id={`floor-${floor}`}>
              {floor === "G" ? "Ground floor" : `Floor ${floor}`}
            </h2>
            <div className="overview-grid">
              {query.data.bathrooms
                .filter((b) => b.floor === floor)
                .map((bathroom) => (
                  <article
                    className={`overview-bathroom ${bathroom.available === null ? "unknown" : bathroom.available ? "available" : "unavailable"}`}
                    key={bathroom.category}
                  >
                    <h3>{bathroom.category}</h3>
                    <p className="overview-state">
                      {bathroom.available === null
                        ? "No recent information"
                        : bathroom.available
                          ? "Available · community report"
                          : "Unavailable · community report"}
                    </p>
                    <p className="report-time">
                      {bathroom.reportedAt
                        ? `Reported at ${new Date(bathroom.reportedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                        : "No community reports yet"}
                    </p>
                    <div className="overview-actions">
                      <FavoriteButton
                        bathroom={bathroom}
                        favorite={favorite}
                        onChange={onFavoriteChange}
                      />
                      <button
                        type="button"
                        aria-label={`Contribute: HH5 floor ${floor} ${bathroom.category}`}
                        onClick={() => onContribute(bathroom)}
                      >
                        Contribute
                      </button>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ))}
    </main>
  );
}
