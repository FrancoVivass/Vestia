export type AuthErrorCode =
  | 'invalid_credentials'
  | 'user_disabled'
  | 'business_disabled'
  | 'network_error'
  | 'session_expired'
  | 'unknown_error';

export interface AuthFeedback {
  code: AuthErrorCode;
  title: string;
  message: string;
}

export interface AuthUserMetadata {
  role?: string;
  businessStatus?: 'active' | 'inactive';
  userStatus?: 'active' | 'inactive';
}
