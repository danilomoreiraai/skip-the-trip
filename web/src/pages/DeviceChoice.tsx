import { Laptop, Smartphone } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Device } from "../services/preferences";

export function DeviceChoice({
  onChoose,
}: {
  onChoose: (device: Device) => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <main className="device-choice">
      <div className="product-intro">
        <span className="eyebrow">Before you begin</span>
        <h1 ref={heading} tabIndex={-1}>
          How are you joining?
        </h1>
        <p>Choose your device to get started.</p>
      </div>
      <div className="device-options">
        <button
          type="button"
          className="device-option"
          aria-labelledby="mobile-device-title"
          aria-describedby="mobile-device-description"
          onClick={() => onChoose("mobile")}
        >
          <Smartphone size={40} strokeWidth={1.6} aria-hidden="true" />
          <span id="mobile-device-title" className="device-title">
            Mobile device
          </span>
          <span id="mobile-device-description" className="device-description">
            Consult status and vote. Confirm your location when you vote.
          </span>
          <span className="device-action" aria-hidden="true">
            Consult & vote →
          </span>
        </button>
        <button
          type="button"
          className="device-option"
          aria-labelledby="mac-device-title"
          aria-describedby="mac-device-description"
          onClick={() => onChoose("mac")}
        >
          <Laptop size={40} strokeWidth={1.6} aria-hidden="true" />
          <span id="mac-device-title" className="device-title">
            Mac
          </span>
          <span id="mac-device-description" className="device-description">
            Consult live status. To vote, open Skip the Trip on your mobile
            device.
          </span>
          <span className="device-action" aria-hidden="true">
            Consult status →
          </span>
        </button>
      </div>
    </main>
  );
}
