import { Laptop, Smartphone } from "lucide-react";
import { useEffect, useRef } from "react";
import { FavoriteSummary } from "../components/Favorite";
import type { Bathroom } from "../domain/bathroom";
import type { Device } from "../services/preferences";

export function DeviceChoice({
  onChoose,
  favorite,
  onFavoriteChange,
}: {
  onChoose: (device: Device) => void;
  favorite: Bathroom | null;
  onFavoriteChange: (value: Bathroom | null) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className="device-choice">
      <div className="device-intro">
        <h1 ref={heading} tabIndex={-1}>
          How are you joining?
        </h1>
      </div>
      <div className="device-options">
        <button
          type="button"
          className="option device-option"
          aria-labelledby="mobile-device-title"
          aria-describedby="mobile-device-description"
          onClick={() => onChoose("mobile")}
        >
          <Smartphone size={36} strokeWidth={1.6} aria-hidden="true" />
          <span id="mobile-device-title" className="device-title">
            Mobile device
          </span>
          <span id="mobile-device-description" className="device-description">
            Consult & vote
          </span>
        </button>
        <button
          type="button"
          className="option device-option"
          aria-labelledby="mac-device-title"
          aria-describedby="mac-device-description"
          onClick={() => onChoose("mac")}
        >
          <Laptop size={36} strokeWidth={1.6} aria-hidden="true" />
          <span id="mac-device-title" className="device-title">
            Mac
          </span>
          <span id="mac-device-description" className="device-description">
            Consult only
          </span>
        </button>
      </div>
      <p className="device-note">
        Voting on mobile requires location confirmation.
      </p>
      {favorite ? (
        <FavoriteSummary favorite={favorite} onChange={onFavoriteChange} />
      ) : (
        <section className="device-favorite-hint" aria-label="Favorite setup">
          Save a favorite in Consult. Its status will appear here whenever you
          open the app.
        </section>
      )}
    </main>
  );
}
