import { type Bathroom, bathroomKey } from "../domain/bathroom";

export type VoteCooldowns = Record<string, number>;

export function getVoteCooldown(
  cooldowns: VoteCooldowns,
  bathroom: Bathroom | null,
): number {
  return bathroom ? (cooldowns[bathroomKey(bathroom)] ?? 0) : 0;
}

export function withVoteCooldown(
  cooldowns: VoteCooldowns,
  bathroom: Bathroom,
  until: number,
): VoteCooldowns {
  return { ...cooldowns, [bathroomKey(bathroom)]: until };
}
