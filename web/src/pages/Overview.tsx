import { useQuery } from "@tanstack/react-query";
import { Check, HelpCircle, RefreshCw } from "lucide-react";
import { useState } from "react";
import { BathroomIcon } from "../components/BathroomIcon";
import { FavoriteButton } from "../components/Favorite";
import { Selector } from "../components/ui";
import {
  type Bathroom,
  bathroomKey,
  buildings,
  floors,
  isBuildingAvailable,
} from "../domain/bathroom";
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
  const [building, setBuilding] = useState<Bathroom["building"]>("HH5");
  const query = useQuery({
    queryKey: ["building", building],
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
        <h1>{building} overview</h1>
        <p>
          {onContribute
            ? "Tap a bathroom to contribute."
            : "Live status by floor."}
        </p>
      </section>
      <Selector
        label="Select building"
        options={buildings}
        value={building}
        onChange={setBuilding}
        isOptionDisabled={(value) => !isBuildingAvailable(value)}
        getOptionHint={(value) =>
          isBuildingAvailable(value) ? undefined : "Available soon"
        }
      />
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
              <span className="overview-floor-code" aria-hidden="true">
                {floor === "G" ? "GF" : `F${floor}`}
              </span>
              {floor === "G" ? "Ground floor" : `Floor ${floor}`}
            </h2>
            <div className="overview-grid">
              {query.data.bathrooms
                .filter((b) => b.floor === floor)
                .map((bathroom) => {
                  const state =
                    bathroom.available === null
                      ? "unknown"
                      : bathroom.available
                        ? "available"
                        : "unavailable";
                  const status =
                    state === "unknown"
                      ? "No recent information"
                      : state === "available"
                        ? "Available"
                        : "Unavailable";
                  return (
                    <article
                      id={`bathroom-${bathroomKey(bathroom)}`}
                      tabIndex={-1}
                      className={`overview-bathroom ${state}`}
                      key={bathroom.category}
                      aria-label={`${building} floor ${floor} ${bathroom.category}`}
                    >
                      <h3 className="sr-only">{bathroom.category}</h3>
                      {onContribute ? (
                        <button
                          type="button"
                          className="overview-open"
                          aria-label={`Vote: ${building} floor ${floor} ${bathroom.category}`}
                          title={`Vote: ${bathroom.category}`}
                          onClick={() => onContribute(bathroom)}
                        >
                          <BathroomIcon category={bathroom.category} />
                        </button>
                      ) : (
                        <div className="overview-open">
                          <BathroomIcon category={bathroom.category} />
                        </div>
                      )}
                      <div className="overview-actions">
                        <FavoriteButton
                          bathroom={bathroom}
                          favorite={favorite}
                          onChange={onFavoriteChange}
                        />
                        <span
                          className="overview-indicator"
                          role="status"
                          title={status}
                        >
                          {state === "available" ? (
                            <Check size={18} aria-hidden="true" />
                          ) : state === "unavailable" ? (
                            <img
                              src={`${import.meta.env.BASE_URL}assets/cleaning.png`}
                              alt=""
                              aria-hidden="true"
                            />
                          ) : (
                            <HelpCircle size={18} aria-hidden="true" />
                          )}
                          <span className="sr-only">{status}</span>
                        </span>
                      </div>
                    </article>
                  );
                })}
            </div>
          </section>
        ))}
    </main>
  );
}
