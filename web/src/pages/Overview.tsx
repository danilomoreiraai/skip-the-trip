import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { BathroomIcon } from "../components/BathroomIcon";
import { FavoriteButton } from "../components/Favorite";
import { type Bathroom, bathroomKey, floors } from "../domain/bathroom";
import { getBuildingStatus } from "../services/building";
export function Overview({
  favorite,
  onFavoriteChange,
  onContribute,
}: {
  favorite: Bathroom | null;
  onFavoriteChange: (value: Bathroom | null) => void;
  onContribute?: (bathroom: Bathroom) => void;
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
      <section className="overview-intro product-intro">
        <span className="eyebrow">Live building utility</span>
        <h1>HH5 overview</h1>
        <p>
          {onContribute
            ? "Check each floor. Location is only needed when you contribute."
            : "Check live status on each floor. No location access needed."}
        </p>
      </section>
      <div className="overview-tools">
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
      </div>
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
                    id={`bathroom-${bathroomKey(bathroom)}`}
                    tabIndex={-1}
                    className={`overview-bathroom ${bathroom.available === null ? "unknown" : bathroom.available ? "available" : "unavailable"}`}
                    key={bathroom.category}
                  >
                    <BathroomIcon category={bathroom.category} />
                    <h3>{bathroom.category}</h3>
                    <p className="overview-state">
                      {bathroom.available === null
                        ? "No recent information"
                        : bathroom.available
                          ? "Available"
                          : "Unavailable"}
                    </p>
                    <p className="report-time">
                      {bathroom.reportedAt
                        ? `Reported at ${new Date(bathroom.reportedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                        : "No reports yet"}
                    </p>
                    <div className="overview-actions">
                      <FavoriteButton
                        bathroom={bathroom}
                        favorite={favorite}
                        onChange={onFavoriteChange}
                      />
                      {onContribute && (
                        <button
                          type="button"
                          aria-label={`Vote: HH5 floor ${floor} ${bathroom.category}`}
                          onClick={() => onContribute(bathroom)}
                        >
                          Vote <span aria-hidden="true">→</span>
                        </button>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          </section>
        ))}
    </main>
  );
}
