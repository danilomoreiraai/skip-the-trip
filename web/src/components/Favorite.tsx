import { useQuery } from "@tanstack/react-query";
import { Check, LoaderCircle, RefreshCw, Star } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { type Bathroom, bathroomKey, isAvailable } from "../domain/bathroom";
import { getReport } from "../services/reports";
import { BathroomIcon } from "./BathroomIcon";
export function FavoriteButton({
  bathroom,
  favorite,
  onChange,
}: {
  bathroom: Bathroom;
  favorite: Bathroom | null;
  onChange: (value: Bathroom | null) => void;
}) {
  const saved = favorite && bathroomKey(favorite) === bathroomKey(bathroom);
  return (
    <button
      type="button"
      className="favorite-button"
      aria-pressed={Boolean(saved)}
      aria-label={`${saved ? "Unsave" : "Save"} favorite: ${bathroom.building} floor ${bathroom.floor} ${bathroom.category}`}
      onClick={() => onChange(saved ? null : bathroom)}
    >
      <Star
        size={17}
        fill={saved ? "currentColor" : "none"}
        aria-hidden="true"
      />
      <span className="favorite-button-text">
        {saved ? "Saved" : "Favorite"}
      </span>
    </button>
  );
}
export function FavoriteSummary({
  favorite,
  onChange,
  onOpen,
  onChooseFavorite,
}: {
  favorite: Bathroom | null;
  onChange: (value: Bathroom | null) => void;
  onOpen?: () => void;
  onChooseFavorite?: () => void;
}) {
  const locationId = useId();
  if (!favorite)
    return (
      <section
        className="favorite-summary favorite-empty"
        aria-label="Favorite setup"
      >
        <div>
          <div className="favorite-heading">
            <Star size={16} aria-hidden="true" />
            <strong>Choose your favorite bathroom</strong>
          </div>
          <p>
            Save a bathroom in Consult. Its live status will appear here
            whenever you open the app.
          </p>
          {!onChooseFavorite && (
            <p>Choose your device below, then tap Favorite in Consult.</p>
          )}
        </div>
        {onChooseFavorite && (
          <div className="favorite-actions">
            <button type="button" onClick={onChooseFavorite}>
              Choose favorite
            </button>
          </div>
        )}
      </section>
    );
  const location = (
    <>
      <BathroomIcon category={favorite.category} />
      <span aria-hidden="true">
        {favorite.building}{" "}
        {favorite.floor === "G" ? "GF" : `F${favorite.floor}`}
      </span>
      <span id={locationId} className="sr-only">
        {favorite.building} · Floor {favorite.floor} · {favorite.category}
      </span>
    </>
  );
  return (
    <FavoriteLiveStatus key={bathroomKey(favorite)} bathroom={favorite}>
      <button
        type="button"
        className="favorite-remove"
        aria-label="Remove favorite"
        title="Remove favorite"
        onClick={() => onChange(null)}
      >
        <Star size={18} fill="currentColor" aria-hidden="true" />
      </button>
      {onOpen ? (
        <button
          type="button"
          className="favorite-location"
          aria-label="Open favorite"
          aria-describedby={locationId}
          title={`${favorite.building} · Floor ${favorite.floor} · ${favorite.category}`}
          onClick={onOpen}
        >
          {location}
        </button>
      ) : (
        <div
          className="favorite-location"
          title={`${favorite.building} · Floor ${favorite.floor} · ${favorite.category}`}
        >
          {location}
        </div>
      )}
    </FavoriteLiveStatus>
  );
}

function FavoriteLiveStatus({
  bathroom,
  children,
}: {
  bathroom: Bathroom;
  children: ReactNode;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const query = useQuery({
    queryKey: ["report", bathroomKey(bathroom)],
    queryFn: () => getReport(bathroom),
    retry: false,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const settled = !query.isError && !query.isPending;
  const state = !settled
    ? "unknown"
    : isAvailable(query.data, now)
      ? "available"
      : "unavailable";
  const label = query.isPending
    ? "Loading your favorite status…"
    : query.isError
      ? "Couldn't load your favorite status."
      : state === "available"
        ? "Available"
        : "Unavailable";
  return (
    <section className="favorite-saved" aria-label="Your favorite">
      <div className={`favorite-summary favorite-strip ${state}`}>
        {children}
        {query.isError ? (
          <div className="favorite-error" role="alert">
            <span className="sr-only">{label}</span>
            <button
              type="button"
              className="favorite-status"
              aria-label="Try again"
              title={`${label} Try again`}
              onClick={() => void query.refetch()}
            >
              <RefreshCw size={18} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="favorite-status" role="status" title={label}>
            {query.isPending ? (
              <LoaderCircle size={18} aria-hidden="true" />
            ) : state === "available" ? (
              <Check size={20} aria-hidden="true" />
            ) : (
              <img
                src={`${import.meta.env.BASE_URL}assets/cleaning.png`}
                alt=""
                aria-hidden="true"
              />
            )}
            <span className="sr-only">{label}</span>
          </div>
        )}
      </div>
      <p className="report-time favorite-updated">
        {query.isPending ? (
          "Updating…"
        ) : query.isError ? (
          "Couldn't update status."
        ) : query.data?.reportedAt ? (
          <>
            Last report at{" "}
            <time dateTime={new Date(query.data.reportedAt).toISOString()}>
              {new Date(query.data.reportedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </time>
          </>
        ) : (
          "No reports yet"
        )}
      </p>
    </section>
  );
}
