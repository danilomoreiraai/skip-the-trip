import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { type Bathroom, bathroomKey, isRecent } from "../domain/bathroom";
import { getReport } from "../services/reports";
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
      {saved ? "Saved" : "Favorite"}
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
      <section className="favorite-summary" aria-label="Favorite setup">
        <div>
          <Star size={18} aria-hidden="true" />
          <strong>Choose your favorite bathroom</strong>
          <p>
            Save a bathroom using its Favorite button. Its live status will
            appear here whenever you open the app, making your next check
            easier.
          </p>
          {!onChooseFavorite && (
            <p>
              First choose your device below, then find your bathroom in
              Consult.
            </p>
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
      <div>
        <Star size={18} aria-hidden="true" />
        <strong>Your favorite</strong>
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
    return <p role="status">Loading your favorite status…</p>;
  if (query.isError)
    return (
      <div role="alert">
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
    <div className={`favorite-live-status ${state}`} role="status">
      <strong>
        {state === "available"
          ? "Available"
          : state === "unavailable"
            ? "Unavailable"
            : "No recent information"}
      </strong>
      {recent && query.data && (
        <p>
          Reported at{" "}
          <time dateTime={new Date(query.data.reportedAt).toISOString()}>
            {new Date(query.data.reportedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </p>
      )}
      {!recent && <p>Waiting for a recent report.</p>}
    </div>
  );
}
