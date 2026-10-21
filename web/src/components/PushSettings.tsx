import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { type Bathroom, bathroomKey } from "../domain/bathroom";
import {
  disablePush,
  enablePush,
  getPushConfig,
  getPushPreference,
  supportsPush,
  syncPushFavorite,
} from "../services/push";
export function PushSettings({ favorite }: { favorite: Bathroom | null }) {
  const client = useQueryClient();
  const config = useQuery({
    queryKey: ["push-config"],
    queryFn: getPushConfig,
    retry: false,
  });
  const preference = useQuery({
    queryKey: ["push-preference"],
    queryFn: getPushPreference,
    enabled: config.data !== undefined,
    retry: false,
  });
  const [message, setMessage] = useState("");
  const change = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable && favorite && config.data?.publicKey)
        await enablePush(favorite, config.data.publicKey);
      else await disablePush();
    },
    onSuccess: async () => {
      setMessage("");
      await client.invalidateQueries({ queryKey: ["push-preference"] });
    },
    onError: (error) =>
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update notification settings.",
      ),
  });
  const renewed = useRef("");
  const desired = favorite ? bathroomKey(favorite) : "none";
  const current = preference.data?.bathroom
    ? bathroomKey(preference.data.bathroom)
    : "none";
  useEffect(() => {
    const signature = `${desired}:${config.data?.enabled}`;
    if (
      !preference.data?.subscribed ||
      (desired === current && renewed.current === signature)
    )
      return;
    renewed.current = signature;
    let active = true;
    void (config.data?.enabled ? syncPushFavorite(favorite) : disablePush())
      .then(() => {
        if (active)
          void client.invalidateQueries({ queryKey: ["push-preference"] });
      })
      .catch(() => {
        if (active)
          setMessage(
            "Could not update notifications for your favorite. Try turning notifications off.",
          );
      });
    return () => {
      active = false;
    };
  }, [
    desired,
    current,
    preference.data?.subscribed,
    favorite,
    client,
    config.data?.enabled,
  ]);
  if (!favorite && !preference.data?.subscribed) return null;
  return (
    <section className="push-settings" aria-label="Cleaning notifications">
      <h2>Cleaning notifications</h2>
      {config.isError || preference.isError ? (
        <p role="status">Notifications are temporarily unavailable.</p>
      ) : config.data?.enabled === false && !preference.data?.subscribed ? (
        <p>Notifications are not enabled yet.</p>
      ) : (
        <>
          <p>
            Opt in to an alert when the team starts cleaning your favorite
            bathroom.
          </p>
          {!supportsPush() && (
            <p>Notifications are not supported in this browser context.</p>
          )}
          <p className="push-guidance">
            On iPhone/iPad, add this app to your Home Screen, open it there,
            then enable notifications.
          </p>
          <button
            type="button"
            disabled={
              change.isPending ||
              preference.isPending ||
              (!preference.data?.subscribed &&
                (!favorite || !supportsPush() || !config.data?.publicKey))
            }
            onClick={() => change.mutate(!preference.data?.subscribed)}
          >
            {preference.data?.subscribed
              ? "Turn off cleaning notifications"
              : "Enable cleaning notifications"}
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
