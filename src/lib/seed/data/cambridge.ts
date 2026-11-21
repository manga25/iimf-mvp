import type { SeedStudent } from "../types";

// 18 Cambridge students. Each level shares one 90-min weekday window so a group can form;
// C2 has only 2 students on purpose (→ "Not enough students at this level/year", AC-3.3).
const g = (name: string, phone: string) => ({ name, phone });

export const CAMBRIDGE: SeedStudent[] = [
  // A1 — children, with guardians. Common: Mon 17:30–19:00.
  { full_name: "Leonor Antunes", phone: "910 000 101", goal: "cambridge", cefr_level: "A1", guardian: g("Rita Antunes", "920 000 101"), slots: ["Mon 17:00-19:00", "Wed 17:00-19:00"] },
  { full_name: "Tomás Ribeiro", phone: "910 000 102", goal: "cambridge", cefr_level: "A1", guardian: g("Nuno Ribeiro", "920 000 102"), slots: ["Mon 17:30-20:00", "Thu 17:00-19:00"] },
  { full_name: "Matilde Lopes", phone: "910 000 103", goal: "cambridge", cefr_level: "A1", guardian: g("Sandra Lopes", "920 000 103"), slots: ["Mon 17:00-19:00", "Sat 09:00-11:00"] },

  // A2 — teenagers, with guardians. Common: Tue 17:30–19:00.
  { full_name: "Duarte Carvalho", phone: "910 000 104", goal: "cambridge", cefr_level: "A2", guardian: g("Paula Carvalho", "920 000 104"), slots: ["Tue 17:00-19:00", "Fri 17:00-20:00"] },
  { full_name: "Beatriz Moreira", phone: "910 000 105", goal: "cambridge", cefr_level: "A2", guardian: g("Jorge Moreira", "920 000 105"), slots: ["Tue 17:30-20:00", "Sat 10:00-12:00"] },
  { full_name: "Gonçalo Pinto", phone: "910 000 106", goal: "cambridge", cefr_level: "A2", guardian: g("Cláudia Pinto", "920 000 106"), slots: ["Tue 17:00-19:00", "Fri 18:00-20:00"] },

  // B1 — adults. Common: Wed 18:30–20:00.
  { full_name: "Inês Correia", phone: "910 000 107", goal: "cambridge", cefr_level: "B1", slots: ["Wed 18:00-20:00", "Mon 19:00-20:00"] },
  { full_name: "Rui Marques", phone: "910 000 108", goal: "cambridge", cefr_level: "B1", slots: ["Wed 18:30-20:00", "Thu 18:30-20:00"] },
  { full_name: "Sofia Teixeira", phone: "910 000 109", goal: "cambridge", cefr_level: "B1", slots: ["Wed 18:30-20:00", "Thu 18:00-20:00"] },
  { full_name: "Pedro Gomes", phone: "910 000 110", goal: "cambridge", cefr_level: "B1", slots: ["Wed 18:30-20:00", "Sat 10:00-12:00"] },

  // B2 — adults. Common: Thu 18:30–20:00.
  { full_name: "Ana Rodrigues", phone: "910 000 111", goal: "cambridge", cefr_level: "B2", slots: ["Thu 18:00-20:00", "Tue 19:00-20:00"] },
  { full_name: "Miguel Fernandes", phone: "910 000 112", goal: "cambridge", cefr_level: "B2", slots: ["Thu 18:30-20:00", "Mon 12:00-14:00"] },
  { full_name: "Carolina Sousa", phone: "910 000 113", goal: "cambridge", cefr_level: "B2", slots: ["Thu 18:30-20:00", "Fri 18:30-20:00"] },

  // C1 — adults with daytime flexibility. Common: Tue 09:30–11:00.
  { full_name: "Helena Machado", phone: "910 000 114", goal: "cambridge", cefr_level: "C1", slots: ["Tue 09:00-12:00", "Thu 09:00-11:00"] },
  { full_name: "João Monteiro", phone: "910 000 115", goal: "cambridge", cefr_level: "C1", slots: ["Tue 09:30-11:30", "Fri 18:00-20:00"] },
  { full_name: "Catarina Barros", phone: "910 000 116", goal: "cambridge", cefr_level: "C1", slots: ["Tue 09:00-11:00", "Wed 14:00-16:00"] },

  // C2 — only two students: unallocated by design.
  { full_name: "Marta Pacheco", phone: "910 000 117", goal: "cambridge", cefr_level: "C2", slots: ["Mon 10:00-12:00"] },
  { full_name: "Ricardo Faria", phone: "910 000 118", goal: "cambridge", cefr_level: "C2", slots: ["Mon 10:00-12:00", "Fri 10:00-12:00"] },
];
