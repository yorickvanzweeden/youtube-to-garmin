const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;

export function getEnv() {
  const values = Object.fromEntries(
    required.map((name) => {
      const value = process.env[name];
      if (!value) throw new Error(`${name} is required`);
      return [name, value];
    }),
  ) as Record<(typeof required)[number], string>;

  const authSecret = process.env.AUTH_SECRET;
  if (!authSecret) throw new Error("AUTH_SECRET is required");
  const allowedGoogleSub = process.env.ALLOWED_GOOGLE_SUB;
  const bootstrapGoogleEmail = process.env.BOOTSTRAP_GOOGLE_EMAIL;
  if (!allowedGoogleSub && !bootstrapGoogleEmail) {
    throw new Error("ALLOWED_GOOGLE_SUB or BOOTSTRAP_GOOGLE_EMAIL is required");
  }

  return {
    ...values,
    authSecret,
    allowedGoogleSub,
    bootstrapGoogleEmail,
  };
}
