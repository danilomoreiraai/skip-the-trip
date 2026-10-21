import { Star } from "lucide-react";
import { type Bathroom, bathroomKey } from "../domain/bathroom";
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
}: {
  favorite: Bathroom | null;
  onChange: (value: Bathroom | null) => void;
  onOpen: () => void;
}) {
  if (!favorite) return null;
  return (
    <section className="favorite-summary" aria-label="Your favorite">
      <div>
        <Star size={18} aria-hidden="true" />
        <strong>Your favorite</strong>
        <p>
          {favorite.building} · Floor {favorite.floor} · {favorite.category}
        </p>
      </div>
      <div className="favorite-actions">
        <button type="button" onClick={onOpen}>
          Open favorite
        </button>
        <button type="button" onClick={() => onChange(null)}>
          Remove favorite
        </button>
      </div>
    </section>
  );
}
