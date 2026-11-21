import type { SeedStudent } from "../types";

// 16 School Support students (years 5, 7, 9, 10, 12). All are minors → all have a guardian.
// Students in the same year attend different schools; the group is formed by year only.
const s = (full_name: string, n: number, school_year: number, guardian: string, slots: string[]): SeedStudent => ({
  full_name,
  phone: `910 000 ${n}`,
  goal: "school_support",
  school_year,
  guardian: { name: guardian, phone: `920 000 ${n}` },
  slots,
});

export const SCHOOL_SUPPORT: SeedStudent[] = [
  // Year 5 — common: Fri 17:00–18:30.
  s("Francisca Cunha", 119, 5, "Marisa Cunha", ["Fri 17:00-19:00", "Mon 17:00-18:30"]),
  s("Rodrigo Tavares", 120, 5, "Hugo Tavares", ["Fri 17:00-18:30", "Wed 17:00-18:30"]),
  s("Mariana Leite", 121, 5, "Susana Leite", ["Fri 17:00-18:30", "Sat 09:00-11:00"]),

  // Year 7 — common: Wed 17:00–18:30.
  s("Afonso Mendes", 122, 7, "Carla Mendes", ["Wed 17:00-18:30", "Thu 17:00-18:30"]),
  s("Lara Azevedo", 123, 7, "Filipe Azevedo", ["Wed 17:00-19:00"]),
  s("Diogo Santos", 124, 7, "Patrícia Santos", ["Wed 17:00-18:30", "Mon 17:00-18:00"]),
  s("Clara Neves", 125, 7, "Bruno Neves", ["Wed 16:30-18:30", "Fri 18:30-20:00"]),

  // Year 9 — common: Thu 17:00–18:30.
  s("Vasco Matos", 126, 9, "Elisa Matos", ["Thu 17:00-18:30", "Tue 19:00-20:00"]),
  s("Alice Campos", 127, 9, "Ricardo Campos", ["Thu 17:00-19:00"]),
  s("Henrique Vieira", 128, 9, "Mónica Vieira", ["Thu 16:30-18:30", "Sat 10:00-12:00"]),

  // Year 10 — common: Fri 18:30–20:00.
  s("Martim Rocha", 129, 10, "Daniela Rocha", ["Fri 18:30-20:00", "Mon 19:00-20:00"]),
  s("Eva Cardoso", 130, 10, "Luís Cardoso", ["Fri 18:00-20:00"]),
  s("Salvador Lima", 131, 10, "Isabel Lima", ["Fri 18:30-20:00", "Tue 18:00-19:00"]),

  // Year 12 — free Wednesday afternoons. Common: Wed 14:30–16:00.
  s("Constança Reis", 132, 12, "Vítor Reis", ["Wed 14:00-16:30", "Mon 16:00-17:30"]),
  s("Lourenço Coelho", 133, 12, "Ana Coelho", ["Wed 14:30-16:00", "Fri 16:00-17:00"]),
  s("Benedita Almeida", 134, 12, "Rui Almeida", ["Wed 14:00-16:00", "Sat 09:00-10:30"]),
];
