// The two accounts the seed creates. They live here rather than inside the seed
// script because the sign-in screen offers them as a one-click fill, and
// importing the seed would drag bcrypt and the database client into the browser
// bundle. Plain demo credentials, listed in the README for the same reason.
export const DEMO_ACCOUNTS = [
  { name: "Аліса Тест", email: "alice@example.com", password: "password123" },
  { name: "Богдан Демо", email: "bob@example.com", password: "password123" },
];
