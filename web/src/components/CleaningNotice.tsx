import type { CleaningState } from "../domain/bathroom";
export function CleaningNotice({
  cleaning,
}: {
  cleaning: CleaningState | null | undefined;
}) {
  if (!cleaning) return null;
  return (
    <div role="status" className={`cleaning-notice ${cleaning.state}`}>
      <strong>
        {cleaning.state === "active"
          ? "Cleaning reported by the team"
          : cleaning.state === "ended"
            ? "Cleaning ended by the team"
            : "Cleaning estimate expired · end not confirmed"}
      </strong>
      <p>
        Team update at{" "}
        {new Date(cleaning.updatedAt).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}
        {cleaning.state === "active"
          ? ` · Expected end ${new Date(cleaning.expectedEndAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
          : " · Check recent community reports for availability"}
      </p>
      {cleaning.state === "active" && (
        <p>
          Contributions are paused until the team ends cleaning or the estimate
          expires.
        </p>
      )}
    </div>
  );
}
