import type { SeedStudent } from "../types";

// 6 Individual students (60-min one-to-one classes).
// Paulo Esteves and Emily Clarke are free only at weekends (exercises the S3 weekday preference).
// Emily has a UK number (+44 7700 900xxx is Ofcom's range reserved for fiction).
export const INDIVIDUAL: SeedStudent[] = [
  { full_name: "Sérgio Nogueira", phone: "910 000 135", goal: "individual", slots: ["Mon 12:30-14:00", "Wed 12:30-14:00"] },
  { full_name: "Teresa Lacerda", phone: "910 000 136", goal: "individual", slots: ["Tue 10:00-12:00", "Thu 10:00-12:00"] },
  { full_name: "Paulo Esteves", phone: "910 000 137", goal: "individual", slots: ["Sat 09:00-11:00"] },
  { full_name: "Emily Clarke", phone: "+44 7700 900123", goal: "individual", slots: ["Sat 14:00-16:00", "Sun 10:00-11:00"] },
  { full_name: "Simão Brandão", phone: "910 000 139", goal: "individual", guardian: { name: "Teresa Brandão", phone: "920 000 139" }, slots: ["Mon 16:00-17:30", "Tue 16:00-17:30"] },
  { full_name: "Joana Batista", phone: "910 000 140", goal: "individual", slots: ["Thu 14:00-16:00"] },
];
