import { randomBytes } from "./random";

export function generatePassword(length = 20): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()-_=+";
  const limit = 256 - (256 % alphabet.length);
  let password = "";
  while (password.length < length) {
    const values = randomBytes(length);
    for (const value of values) {
      if (value < limit && password.length < length) {
        password += alphabet[value % alphabet.length];
      }
    }
  }
  return password;
}
