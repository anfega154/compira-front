export const env = {
  apiUrl: import.meta.env.VITE_API_URL as string ?? 'http://localhost:8080/api/v1',
  otpResendCooldownSeconds: Number(import.meta.env.VITE_OTP_RESEND_COOLDOWN_SECONDS ?? 120),
} as const
