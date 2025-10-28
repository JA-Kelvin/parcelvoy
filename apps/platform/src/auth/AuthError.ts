import { ErrorType } from '../core/errors'

export default {
    AuthorizationError: {
        message: 'Authorization error.',
        code: 1000,
        statusCode: 401,
    },
    InvalidRefreshToken: {
        message: 'The refresh token provided is invalid.',
        code: 1001,
    },
    SAMLValidationError: {
        message: 'Unable to parse response from SSO.',
        code: 1002,
    },
    AdminNotFound: {
        message: 'The admin user matching the provided criteria does not exist.',
        code: 1003,
    },
    InvalidDomain: {
        message: 'The provided email does not have access to access this site.',
        code: 1004,
    },
    InvalidEmail: {
        message: 'The email address provided is invalid or not present.',
        code: 1005,
    },
    OpenIdValidationError: {
        message: 'Unable to parse response from OpenID.',
        code: 1006,
    },
    AccessDenied: {
        message: 'Access denied.',
        code: 1007,
        statusCode: 403,
    },
    MissingCredentials: {
        message: 'An email and password must be provided to login.',
        code: 1008,
        statusCode: 400,
    },
    InvalidCredentials: {
        message: 'The email and password combination provided is invalid.',
        code: 1008,
        statusCode: 400,
    },
    InvalidState: {
        message: 'Invalid state parameter - possible CSRF attack.',
        code: 1009,
        statusCode: 400,
    },
    InvalidCode: {
        message: 'Authorization code is missing or invalid.',
        code: 1010,
        statusCode: 400,
    },
    OAuth2ValidationError: {
        message: 'Unable to validate OAuth2 response.',
        code: 1011,
        statusCode: 400,
    },
    TokenExchangeFailed: {
        message: 'Failed to exchange authorization code for access token.',
        code: 1012,
        statusCode: 400,
    },
    UserinfoFetchFailed: {
        message: 'Failed to fetch user information from OAuth2 provider.',
        code: 1013,
        statusCode: 400,
    },
} as Record<string, ErrorType>
