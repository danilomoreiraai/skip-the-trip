import { useQuery } from "@tanstack/react-query";
import { Check, HelpCircle, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { type Bathroom, bathroomKey, isRecent } from "../domain/bathroom";
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
  return (
    <section className="favorite-summary" aria-label="Your favorite">
      <div className="favorite-heading">
        <Star size={16} aria-hidden="true" />
        <strong>Your favorite</strong>
      </div>
      <div className="favorite-location">
        <BathroomIcon category={favorite.category} />
        <p>
          {favorite.building} · Floor {favorite.floor} · {favorite.category}
        </p>
      </div>
      <FavoriteLiveStatus key={bathroomKey(favorite)} bathroom={favorite} />
      <div className="favorite-actions">
        {onOpen && (
          <button type="button" onClick={onOpen}>
            Open favorite
          </button>
        )}
        <button type="button" onClick={() => onChange(null)}>
          Remove favorite
        </button>
      </div>
    </section>
  );
}

function FavoriteLiveStatus({ bathroom }: { bathroom: Bathroom }) {
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
  if (query.isPending)
    return (
      <p className="favorite-feedback" role="status">
        Loading your favorite status…
      </p>
    );
  if (query.isError)
    return (
      <div className="favorite-feedback status-error" role="alert">
        <p>Couldn't load your favorite status.</p>
        <button type="button" onClick={() => void query.refetch()}>
          Try again
        </button>
      </div>
    );
  const recent = isRecent(query.data, now);
  const state = recent
    ? query.data?.available
      ? "available"
      : "unavailable"
    : "unknown";
  return (
    <div className="favorite-live-status" role="status">
      <div className={`status-bar favorite-status ${state}`}>
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
        <strong>
          {state === "available"
            ? "Available"
            : state === "unavailable"
              ? "Unavailable"
              : "No recent information"}
        </strong>
      </div>
      {recent && query.data && (
        <p className="report-time">
          Reported at{" "}
          <time dateTime={new Date(query.data.reportedAt).toISOString()}>
            {new Date(query.data.reportedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </p>
      )}
      {!recent && <p className="report-time">Waiting for a recent report.</p>}
    </div>
  );
}
