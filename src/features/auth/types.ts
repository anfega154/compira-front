export type UserRole = 'ADMINISTRATOR' | 'COORDINATOR' | 'COLLABORATOR'

export type UserStatus = 'ACTIVE' | 'INACTIVE'

export type MfaChannel = 'EMAIL' | 'SMS'

export type ChallengeName =
  | 'NEW_PASSWORD_REQUIRED'
  | 'EMAIL_OTP'
  | 'SMS_MFA'
  | 'SELECT_MFA_TYPE'
  | 'SOFTWARE_TOKEN_MFA'

export type AuthStatus = 'AUTHENTICATED' | 'CHALLENGE_REQUIRED'

export type AuthUser = {
  id: string
  cognitoSub: string
  email: string
  firstName: string
  lastName: string
  phoneNumber: string
  preferredMfaChannel: MfaChannel
  status: UserStatus
  roles: UserRole[]
  createdAt: string
  updatedAt: string
  lastLoginAt: string
}

export type AuthTokens = {
  accessToken: string
  idToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
}

export type CodeDeliveryDetails = {
  destination: string
  deliveryMedium: string
  attributeName: string
}

export type AuthChallenge = {
  challengeName: ChallengeName
  session: string
  availableMfaChannels: MfaChannel[]
  codeDeliveryDetails: CodeDeliveryDetails | null
}

export type AuthResponse = {
  status: AuthStatus
  user: AuthUser | null
  tokens: AuthTokens | null
  challenge: AuthChallenge | null
}

export type LoginRequest = {
  email: string
  password: string
}

export type ChallengeRequest = {
  email: string
  session: string
  challengeName: ChallengeName
  code?: string
  newPassword?: string
  mfaChannel?: MfaChannel
}

export type ResendCodeRequest = {
  email: string
}

export type ResendCodeResponse = {
  codeDeliveryDetails: CodeDeliveryDetails
}

export type LogoutRequest = {
  accessToken: string
}

export type PasswordRecoveryRequest = {
  email: string
}

export type PasswordRecoveryResponse = {
  codeDeliveryDetails: CodeDeliveryDetails
}

export type PasswordRecoveryConfirmRequest = {
  email: string
  confirmationCode: string
  newPassword: string
}

export type AuthErrorCategory =
  | 'UNAUTHORIZED'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'TOO_MANY_REQUESTS'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR'

export type AuthErrorCode =
  | 'AUTH_000'
  | 'AUTH_001'
  | 'AUTH_002'
  | 'AUTH_003'
  | 'AUTH_004'
  | 'AUTH_005'
  | 'AUTH_006'
  | 'AUTH_007'
  | 'AUTH_008'
  | 'AUTH_012'
  | 'AUTH_013'
  | 'AUTH_014'

export type AuthApiError = {
  code: AuthErrorCode
  message: string
  category: AuthErrorCategory
}

export type RegisterUserRequest = {
  email: string
  password: string
  firstName: string
  lastName: string
  phoneNumber: string
  preferredMfaChannel: MfaChannel
  roleCode?: UserRole
}

export type RegisterUserResponse = {
  cognitoSub: string
  userConfirmed: boolean
  codeDeliveryDetails: CodeDeliveryDetails
}

export type DeleteUserRequest = {
  email: string
}
