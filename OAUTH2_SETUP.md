# OAuth2 Authentication Setup for JuicySuite

This guide provides step-by-step instructions for configuring Parcelvoy to use OAuth2 authentication with your JuicySuite auth server.

## What Was Implemented

A generic OAuth2 authentication provider that supports:
- Custom authorization, token, and userinfo endpoints
- Standard OAuth2 authorization code flow
- CSRF protection with state parameter
- Secure server-side token exchange

## Files Modified/Created

1. **New Files:**
   - `apps/platform/src/auth/OAuth2AuthProvider.ts` - OAuth2 authentication provider implementation

2. **Modified Files:**
   - `apps/platform/src/auth/Auth.ts` - Added OAuth2 provider integration
   - `apps/platform/src/auth/AuthError.ts` - Added OAuth2-specific error codes
   - `apps/platform/src/config/env.ts` - Added OAuth2 environment variables
   - `docs/docs/advanced/authentication.md` - Added OAuth2 documentation

## Configuration Steps

### 1. Set Environment Variables

Add the following to your `.env` file:

```bash
# Set auth driver to oauth2
AUTH_DRIVER=oauth2

# OAuth2 Provider Configuration
AUTH_OAUTH2_NAME=JuicySuite
AUTH_OAUTH2_AUTHORIZATION_URL=https://juicysuite.com/user/authorize
AUTH_OAUTH2_TOKEN_URL=https://juicysuite.com/oauth2/token
AUTH_OAUTH2_USERINFO_URL=https://juicysuite.com/api/v1/user
AUTH_OAUTH2_CLIENT_ID=abcd1234028fc3d8ca6e219575e91666
AUTH_OAUTH2_CLIENT_SECRET=your_secret_here
AUTH_OAUTH2_SCOPES=openid,email,profile
AUTH_OAUTH2_EMAIL_FIELD=email

# Make sure these are set correctly
BASE_URL=https://your-parcelvoy-domain.com
API_BASE_URL=https://your-parcelvoy-domain.com/api
```

### 2. Register Callback URL in JuicySuite

In your JuicySuite OAuth2 client configuration, register the callback URL:

```
https://your-parcelvoy-domain.com/api/auth/login/oauth2/callback
```

Replace `your-parcelvoy-domain.com` with your actual Parcelvoy domain.

### 3. Verify Userinfo Endpoint Response

The userinfo endpoint (`https://juicysuite.app/api/v1/merchant`) must return a JSON response with at least an `email` field:

**Required:**
```json
{
  "email": "user@example.com"
}
```

**Optional fields for better user experience:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "given_name": "John",
  "family_name": "Doe",
  "picture": "https://example.com/avatar.jpg"
}
```

### 4. Restart Parcelvoy

After updating the environment variables, restart your Parcelvoy instance:

```bash
# If running with Docker
docker-compose restart

# If running directly
npm run restart
```

## Testing

### 1. Access Login Page

Navigate to your Parcelvoy login page:
```
https://your-parcelvoy-domain.com
```

### 2. Login Flow

1. Click the "JuicySuite" login button
2. You'll be redirected to: `https://juicysuite.app/merchant/authorize`
3. Authorize the application
4. You'll be redirected back to Parcelvoy at the callback URL
5. Parcelvoy will exchange the authorization code for an access token
6. Parcelvoy will fetch your user info
7. You'll be logged in and redirected to the dashboard

## Endpoints

- **Login:** `GET /api/auth/login/oauth2`
- **Callback:** `GET/POST /api/auth/login/oauth2/callback`

## Troubleshooting

### Error: "Invalid state parameter"
- The state parameter is used for CSRF protection
- This usually indicates a session/cookie issue
- Ensure cookies are enabled in your browser
- Check that your domain is configured correctly

### Error: "Authorization code is missing"
- The OAuth2 provider didn't return a code
- Check the authorization URL configuration
- Verify the client ID is correct

### Error: "Failed to exchange authorization code"
- The token exchange failed
- Verify the token URL is correct
- Check that the client secret is correct
- Ensure the callback URL is registered correctly

### Error: "Failed to fetch user information"
- The userinfo endpoint is not responding correctly
- Verify the userinfo URL is correct
- Ensure the endpoint returns an `email` field
- Check that the access token has proper permissions

### Error: "The email address provided is invalid"
- The userinfo response doesn't contain an email
- Update your userinfo endpoint to include the `email` field

## Security Notes

- The OAuth2 flow uses the authorization code grant type (most secure)
- State parameter prevents CSRF attacks
- All tokens are exchanged server-side
- Tokens are never exposed to the client
- Secure HTTP-only cookies are used for session management

## API Requirements

Your OAuth2 server must support:

1. **Authorization Endpoint:**
   - Method: GET
   - Parameters: `response_type=code`, `client_id`, `redirect_uri`, `state`, `scope`
   - Returns: Authorization code via redirect

2. **Token Endpoint:**
   - Method: POST
   - Content-Type: `application/x-www-form-urlencoded`
   - Parameters: `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `client_secret`
   - Returns: JSON with `access_token`

3. **Userinfo Endpoint:**
   - Method: GET
   - Headers: `Authorization: Bearer {access_token}`
   - Returns: JSON with at least `email` field

## Support

For more information, see:
- [Authentication Documentation](docs/docs/advanced/authentication.md#oauth2-generic)
- [Parcelvoy Documentation](https://docs.parcelvoy.com)
