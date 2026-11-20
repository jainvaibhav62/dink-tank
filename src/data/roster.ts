// Default event roster, seeded from players_list.txt. The Create Event form
// pre-fills its textarea from this so the admin can confirm/edit, then create —
// participants never sign up. Edit freely or paste a different list in the form.
export const DEFAULT_ROSTER: string[] = [
  'Grace Lin',
  'Aashray Gulati',
  'Amy Goegan',
  'Brian Young',
  'Brittny Efendy',
  'Camille Calma',
  'Carl-Axel Lagercrantz',
  'Emily Sun',
  'Gerrit Schöttler',
  'Jacob Sim',
  'Jacqueline Glazer',
  'Jordi Nonay Jordi',
  'Liam Tarzy',
  'Michael Brandley',
  'Pablo Mesa Pardo',
  'Saad Naqvi',
  'Sandeep Krishnan',
  'Sarina Gupta',
  'Sid Kaul',
  'Tiberiu Gavris',
  'Vaibhav Jain',
  'Ansh S Patel',
  'Sarthak Ahir',
  'Denny Lee',
  'Aditya Jhaveri',
  'Jebby Arulson2',
  'Ellen Li',
  'Maxim Pershin',
  'Shreya Sadashiva Kamath',
  'Maksim Vishnevskii',
  'Yash Dange',
  'Lexi Ling',
  'Bowen Li',
  'Ivan Sinyavin',
  'Mahima Saxena',
  'Jenn Gu',
]

/** Up to two initials from a name, e.g. "Grace Lin" → "GL". */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}
