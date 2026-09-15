import type { AcademyState } from "./model";
export const DEMO_SEASON = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" });
export const tiers = [{ name: "Bronze", xp: 0 }, { name: "Prata", xp: 800 }, { name: "Ouro", xp: 2000 }, { name: "Platina", xp: 3500 }, { name: "Diamante", xp: 5000 }];
export function experience(state: AcademyState, season = DEMO_SEASON) {
  const total = state.xpEvents.reduce((sum, event) => sum + event.amount, 0);
  const annual = state.xpEvents.filter(event => event.season === season).reduce((sum, event) => sum + event.amount, 0);
  return { total, annual, level: Math.floor(total / 400) + 1, levelProgress: (total % 400) / 4, tier: [...tiers].reverse().find(tier => annual >= tier.xp) || tiers[0] };
}
