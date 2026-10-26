import type { Audience, Category, Cost, NewResource } from '../shared/types.ts';

// Demo data: every place below is FICTIONAL. Coordinates are offsets around an arbitrary map centre.
export const DEMO_CENTER = { lat: 53.4808, lng: -2.2426 };

type Row = [string, Category, number, number, Cost, string[], Audience, string, string];

const rows: Row[] = [
  ['Riverside Public Library', 'library', 0.002, -0.004, 'free', ['English', 'Urdu'], 'all', 'Mon-Sat 9:00-18:00', 'Large lending library with a children\'s corner, quiet reading room and weekly story hour.'],
  ['Northgate Community Library', 'library', 0.031, 0.012, 'free', ['English', 'Polish'], 'all', 'Tue-Sat 10:00-17:00', 'Neighbourhood branch with free borrowing, printing at cost and a homework table.'],
  ['Millbrook Primary School', 'school', -0.012, 0.018, 'free', ['English'], 'children', 'Mon-Fri 8:30-15:30', 'State primary school with an after-school reading club.'],
  ['St. Anselm Secondary Academy', 'school', 0.018, -0.021, 'free', ['English', 'Spanish'], 'teens', 'Mon-Fri 8:00-16:00', 'Comprehensive secondary school with a sixth-form science wing.'],
  ['Lantern Montessori', 'early-years', -0.02, -0.011, 'paid', ['English', 'French'], 'children', 'Mon-Fri 8:00-17:30', 'Private Montessori nursery for ages 2-5.'],
  ['Little Acorns Playgroup', 'early-years', 0.009, 0.026, 'low', ['English', 'Arabic'], 'children', 'Mon, Wed, Fri 9:00-12:00', 'Parent-run playgroup with sliding-scale fees.'],
  ['Homework Haven', 'tutoring', 0.006, 0.007, 'free', ['English', 'Urdu', 'Bengali'], 'children', 'Mon-Thu 16:00-18:30', 'Volunteer tutors help with maths and reading after school.'],
  ['Maths Matters Club', 'tutoring', -0.027, 0.004, 'low', ['English'], 'teens', 'Sat 10:00-13:00', 'Weekend exam-prep group for GCSE-level maths.'],
  ['Open Door Reading Circle', 'literacy', 0.014, -0.006, 'free', ['English', 'Somali', 'Arabic'], 'adults', 'Tue & Thu 18:00-20:00', 'Adult literacy and conversational English classes in small groups.'],
  ['Speak Up English Lab', 'literacy', -0.008, -0.029, 'free', ['English', 'Polish', 'Spanish'], 'adults', 'Mon-Wed 10:00-12:00', 'Drop-in ESOL practice with trained volunteers.'],
  ['Spark STEM Studio', 'stem', 0.022, 0.003, 'low', ['English'], 'teens', 'Sat 11:00-15:00', 'Robotics and Python workshops for teenagers; kit provided.'],
  ['Little Coders Club', 'stem', -0.015, 0.027, 'free', ['English', 'Spanish'], 'children', 'Wed 16:30-18:00', 'Scratch coding for ages 8-11 run by local engineers.'],
  ['Foundry Skills Centre', 'vocational', -0.031, -0.018, 'low', ['English'], 'adults', 'Mon-Fri 9:00-17:00', 'Short courses in welding, electrics and carpentry.'],
  ['Bright Futures Careers Hub', 'vocational', 0.004, 0.034, 'free', ['English', 'Urdu', 'Polish'], 'adults', 'Mon-Fri 10:00-16:00', 'CV help, interview practice and apprenticeship signposting.'],
  ['Harbour College Evening Classes', 'vocational', 0.025, -0.032, 'paid', ['English'], 'adults', 'Mon-Thu 18:30-21:00', 'Accredited evening courses in accounting and IT support.'],
  ['Ability First Learning Support', 'special-needs', -0.004, 0.015, 'free', ['English', 'Bengali'], 'children', 'Mon-Fri 9:30-15:00', 'Dyslexia screening and one-to-one learning support; step-free access.'],
  ['Clearview Autism Education Group', 'special-needs', 0.016, 0.019, 'low', ['English'], 'children', 'Tue & Thu 10:00-14:00', 'Small-group sensory-friendly sessions for autistic learners.'],
  ['Quiet Hours Study Hall', 'study-space', 0.001, 0.012, 'free', ['English'], 'all', 'Daily 8:00-22:00', 'Silent study hall with desks and power sockets.'],
  ['Campus Corner Study Cafe', 'study-space', -0.018, 0.009, 'low', ['English', 'Spanish'], 'adults', 'Daily 7:00-23:00', 'Cafe with day passes for study desks and group rooms.'],
  ['Connect Hub Computer Room', 'digital-access', 0.011, -0.014, 'free', ['English', 'Urdu', 'Arabic'], 'all', 'Mon-Sat 10:00-18:00', 'Free computers, wifi and device loan for people without home internet.'],
  ['Laptop Library Scheme', 'digital-access', -0.022, 0.021, 'free', ['English'], 'teens', 'Wed & Fri 14:00-17:00', 'Borrow a refurbished laptop for a school term.'],
  ['First Generation Scholarship Fund', 'scholarship', 0.028, 0.024, 'free', ['English'], 'teens', 'Applications open Jan-Mar', 'Small grants for first-in-family university applicants.'],
  ['Women in Trades Bursary', 'scholarship', -0.034, 0.008, 'free', ['English'], 'adults', 'Rolling applications', 'Course fee bursaries for women entering skilled trades.'],
  ['Eastside Adult Learning Centre', 'vocational', -0.006, 0.041, 'low', ['English', 'Bengali', 'Urdu'], 'adults', 'Mon-Fri 9:00-20:00', 'Numeracy, digital basics and first-aid courses.'],
  ['Westfield Library & Learning Hub', 'library', -0.003, -0.039, 'free', ['English', 'Spanish', 'Polish'], 'all', 'Mon-Sun 9:00-19:00', 'Library with a language-exchange corner and study rooms.'],
  ['Sunrise Early Learning', 'early-years', 0.024, -0.009, 'free', ['English', 'Somali'], 'children', 'Mon-Fri 8:30-14:30', 'Publicly funded nursery places for eligible two-year-olds.'],
  ['Pathways Teen Study Support', 'tutoring', 0.008, -0.025, 'free', ['English', 'Arabic'], 'teens', 'Mon & Wed 16:00-18:00', 'Peer mentoring and revision sessions for teenagers.'],
  ['Tech for All Evening Lab', 'stem', -0.01, 0.035, 'free', ['English', 'Urdu'], 'adults', 'Thu 18:30-20:30', 'Beginner web development and spreadsheet skills.'],
  ['Greenfield Special School', 'special-needs', 0.033, -0.015, 'free', ['English'], 'children', 'Mon-Fri 8:45-15:15', 'Specialist state school for pupils with complex learning needs.'],
];

export const seedResources: NewResource[] = rows.map(([name, category, dLat, dLng, cost, languages, audience, hours, description], i) => ({
  name, category, description, cost, languages, audience, hours,
  address: `${10 + i * 3} Sample Street (fictional)`,
  lat: Number((DEMO_CENTER.lat + dLat).toFixed(5)),
  lng: Number((DEMO_CENTER.lng + dLng).toFixed(5)),
  website: '',
}));
