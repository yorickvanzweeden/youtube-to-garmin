const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"] as const;

export function getEnv() {
  const values = Object.fromEntries(
    required.map((name) => {
      const value = process.env[name];
      if (!value) throw new Error(`${name} is required`);
      return [name, value];
    }),
  ) as Record<(typeof required)[number], string>;

  return {
    ...values,
    authSecret: process.env.AUTH_SECRET,
    allowedGoogleSub: process.env.ALLOWED_GOOGLE_SUB,
    bootstrapGoogleEmail: process.env.BOOTSTRAP_GOOGLE_EMAIL,
  };
}
