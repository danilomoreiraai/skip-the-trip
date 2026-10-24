import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { CleaningNotice } from "../components/CleaningNotice";
import { type Bathroom, categories, floors } from "../domain/bathroom";
import { getBuildingStatus } from "../services/building";
import {
  type CleaningCommand,
  getStaffSession,
  loginStaff,
  logoutStaff,
  StaffRequestError,
  sendCleaningCommand,
} from "../services/staff";
export function Staff() {
  const client = useQueryClient();
  const session = useQuery({
    queryKey: ["staff-session"],
    queryFn: getStaffSession,
    retry: false,
  });
  const status = useQuery({
    queryKey: ["building", "HH5"],
    queryFn: getBuildingStatus,
    enabled: Boolean(session.data),
    retry: false,
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
  });
  const [code, setCode] = useState("");
  const [floor, setFloor] = useState<Bathroom["floor"]>("G");
  const [category, setCategory] = useState<Bathroom["category"]>("Male");
  const [message, setMessage] = useState("");
  const login = useMutation({
    mutationFn: loginStaff,
    onSuccess: (data) => {
      setCode("");
      setMessage("");
      client.setQueryData(["staff-session"], data);
    },
    onError: () => {
      setCode("");
      setMessage(
        "Invite invalid, expired or unavailable. Ask the operator for a new invitation.",
      );
    },
  });
  const logout = useMutation({
    mutationFn: async () => {
      if (session.data) await logoutStaff(session.data.csrfToken);
    },
    onSuccess: () => client.setQueryData(["staff-session"], null),
    onError: () => setMessage("Could not sign out. Try again."),
  });
  const command = useMutation({
    mutationFn: async (input: CleaningCommand) => {
      if (!session.data) throw new Error("Staff access required");
      return sendCleaningCommand(session.data.csrfToken, input);
    },
    onSuccess: async () => {
      setMessage("");
      await client.invalidateQueries({ queryKey: ["building", "HH5"] });
      await client.invalidateQueries({ queryKey: ["report"] });
    },
    onError: async (error) => {
      setMessage(
        error instanceof StaffRequestError
          ? error.message
          : "Could not confirm the update. Refresh the status before trying again.",
      );
      if (error instanceof StaffRequestError && error.status === 401)
        client.setQueryData(["staff-session"], null);
      await client.invalidateQueries({ queryKey: ["building", "HH5"] });
    },
  });
  const cleaning = status.data?.cleaning.find(
    (value) => value.floor === floor && value.category === category,
  );
  const active = cleaning?.state === "active";
  const disabled =
    command.isPending || !status.data || status.isError || status.isFetching;
  const update = (
    action: "start" | "extend" | "end",
    minutes: 15 | 30 = 15,
  ) => {
    const base = {
      building: "HH5" as const,
      floor,
      category,
      commandId: crypto.randomUUID(),
    };
    if (action === "start") command.mutate({ ...base, action, minutes });
    else if (cleaning)
      command.mutate({
        ...base,
        action,
        cycleId: cleaning.id,
        version: cleaning.version,
        ...(action === "extend" ? { minutes } : {}),
      } as CleaningCommand);
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate(code.trim());
  };
  return (
    <main className="staff-layout document-card">
      <span className="eyebrow">Cleaning operations · HH5</span>
      <h1>{session.data ? "Cleaner controls" : "Cleaner access"}</h1>
      {message && <p role="alert">{message}</p>}
      {session.isPending ? (
        <p role="status">Checking staff access…</p>
      ) : session.isError ? (
        <>
          <p role="alert">Could not check staff access.</p>
          <button type="button" onClick={() => void session.refetch()}>
            Retry staff access
          </button>
        </>
      ) : session.data === false ? (
        <p>Cleaner access is not enabled yet.</p>
      ) : !session.data ? (
        <form onSubmit={submit}>
          <p>
            Use the individual invitation supplied by the operator. Sessions
            last eight hours.
          </p>
          <label htmlFor="staff-code">Invitation code</label>
          <input
            id="staff-code"
            type="password"
            autoComplete="one-time-code"
            autoCapitalize="none"
            spellCheck={false}
            pattern="[0-9a-f]{64}"
            required
            minLength={64}
            maxLength={64}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            disabled={login.isPending}
          />
          <button type="submit" disabled={login.isPending}>
            {login.isPending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      ) : (
        <>
          <p>
            Updates appear publicly as “Cleaning team”. Your individual access
            is private.
          </p>
          <button
            type="button"
            disabled={logout.isPending || command.isPending}
            onClick={() => logout.mutate()}
          >
            Sign out
          </button>
          <div className="staff-selection">
            <label>
              Floor
              <select
                value={floor}
                onChange={(event) =>
                  setFloor(event.target.value as Bathroom["floor"])
                }
                disabled={command.isPending}
              >
                {floors.map((value) => (
                  <option key={value} value={value}>
                    {value === "G" ? "Ground floor" : `Floor ${value}`}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bathroom type
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as Bathroom["category"])
                }
                disabled={command.isPending}
              >
                {categories.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <CleaningNotice cleaning={cleaning} />
          {status.isError && (
            <p role="alert">
              Could not refresh. Status may be out of date; updates are paused.
            </p>
          )}
          <button
            type="button"
            disabled={status.isFetching || command.isPending}
            onClick={() => void status.refetch()}
          >
            Refresh status
          </button>
          <div className="staff-actions">
            {active ? (
              <>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => update("extend", 15)}
                >
                  Extend cleaning · 15 min
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => update("extend", 30)}
                >
                  Extend cleaning · 30 min
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => update("start", 15)}
                >
                  Start cleaning · 15 min
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => update("start", 30)}
                >
                  Start cleaning · 30 min
                </button>
              </>
            )}
            {cleaning && cleaning.state !== "ended" && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => update("end")}
              >
                End cleaning
              </button>
            )}
          </div>
        </>
      )}
    </main>
  );
}
