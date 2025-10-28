# Authentication
Parcelvoy comes with a few different types of authentication out of the box:
- Basic
- SAML
- OpenID
- Google
- OAuth2 (Generic)

Whereas a lot of platforms will gate SSO as a luxury feature and charge extra for it (this is known as the **SSO Tax**) we opted to go the opposite direction and lean in completely to SSO to make sure you understand that Parcelvoy takes your security seriously. SSO is not something that only Enterprise companies should have, but should be available at every level.

## Basic
Right out of the gate Parcelvoy is setup to use a simple **Basic** auth that allows for a single user that can be set inside of the environment variables. This is a limited form of auth as it does not allow for multiple users and is largely meant for evaluation purposes.

To change the credentials for basic auth, modify the following environment variables and restart your Parcelvoy instance.
```
AUTH_BASIC_NAME=Login
AUTH_BASIC_USERNAME=parcelvoy
AUTH_BASIC_PASSWORD=password
```

## OpenID

### Config
| key | type | required |
|--|--|--|
| AUTH_DRIVER | 'openid' | true |
| AUTH_OPENID_NAME | string | false |
| AUTH_OPENID_ISSUER_URL | string | true |
| AUTH_OPENID_CLIENT_ID | string | true |
| AUTH_OPENID_CLIENT_SECRET | string | true |
| AUTH_OPENID_REDIRECT_URI | string | true |
| AUTH_OPENID_DOMAIN_WHITELIST | string | true |
| AUTH_OPENID_RESPONSE_TYPES | string | false |

## SAML

### Config
| key | type | required |
|--|--|--|
| AUTH_DRIVER | 'saml' | true |
| AUTH_SAML_NAME | string | false |
| AUTH_SAML_CALLBACK_URL | string | true |
| AUTH_SAML_ENTRY_POINT_URL | string | true |
| AUTH_SAML_ISSUER | string | true |
| AUTH_SAML_CERT | string | true |
| AUTH_SAML_IS_AUTHN_SIGNED | boolean | false |


### Google Workspace
You can utilize either SAML or OpenID to connect to your Google Account. We'll be highlighting how to setup SAML as it is slightly easier than OpenID to configure.

1. Open the admin console for Google Workspace (https://admin.google.com)
2. Navigate to Apps -> Web and mobile apps
3. Click `Add app` and from the dropdown select `Add custom SAML app`
4. Enter an app name and select an optional logo and continue to the next step
5. Copy the SSO URL and the Certificate, you'll need them later. Hit Continue.
6. Under Service Provider Details enter the following:
    - ACS URL: `YOUR_DOMAIN.com/api/auth/login/saml/callback`
    - Entity ID: `YOUR_DOMAIN.com/api/auth/login/saml/callback`
    - Name ID Format: `EMAIL`
    - Name ID: `Basic Information > Primary Email`
7. Hit Continue.
8. Under SAML attribute mapping you can map the following attributes:
    - First name: `first_name`
    - Last name: `last_name`
9. Hit Finish to save.
8. Navigate to your new SAML configuration and select User Access. Make sure to turn this on for the groups you would like to have access.
9. Open your IDE. In your environment variables add or replace the following:
```
AUTH_DRIVER=saml
AUTH_SAML_CALLBACK_URL=// The domain from above
AUTH_SAML_ENTRY_POINT_URL=// The SSO URL you previously copied
AUTH_SAML_ISSUER=// The entity ID from above
AUTH_SAML_CERT=// The certificate you previously copied
AUTH_SAML_IS_AUTHN_SIGNED=false
```
10. Restart your instance to make sure the latest changes are propogated. It can take up to an hour for a new Google SAML app to go live, check back in if it doesn't work immediately.

## OAuth2 (Generic)

For OAuth2 providers that don't support OpenID Connect (OIDC) discovery, you can use the generic OAuth2 authentication driver. This allows you to configure custom authorization, token, and userinfo endpoints.

### Config
| key | type | required | description |
|--|--|--|--|
| AUTH_DRIVER | 'oauth2' | true | Set to 'oauth2' to enable OAuth2 authentication |
| AUTH_OAUTH2_NAME | string | false | Display name for the OAuth2 provider |
| AUTH_OAUTH2_AUTHORIZATION_URL | string | true | The authorization endpoint URL |
| AUTH_OAUTH2_TOKEN_URL | string | true | The token exchange endpoint URL |
| AUTH_OAUTH2_USERINFO_URL | string | true | The userinfo endpoint URL (must return email) |
| AUTH_OAUTH2_CLIENT_ID | string | true | OAuth2 client ID |
| AUTH_OAUTH2_CLIENT_SECRET | string | true | OAuth2 client secret |
| AUTH_OAUTH2_SCOPES | string | false | Comma-separated list of scopes (default: 'openid,email,profile') |

### Endpoints
- Login: `GET/POST /api/auth/login/oauth2`
- Callback: `GET/POST /api/auth/login/oauth2/callback`

### Example Configuration
```bash
AUTH_DRIVER=oauth2
AUTH_OAUTH2_NAME=JuicySuite
AUTH_OAUTH2_AUTHORIZATION_URL=https://juicysuite.app/merchant/authorize
AUTH_OAUTH2_TOKEN_URL=https://juicysuite.app/oauth2/token
AUTH_OAUTH2_USERINFO_URL=https://juicysuite.app/api/v1/merchant
AUTH_OAUTH2_CLIENT_ID=your_client_id
AUTH_OAUTH2_CLIENT_SECRET=your_client_secret
AUTH_OAUTH2_SCOPES=openid,email,profile
```

### Requirements
1. **Redirect URI**: Register the callback URL in your OAuth2 provider:
   - Format: `${API_BASE_URL}/auth/login/oauth2/callback`
   - Example: `https://your-domain.com/api/auth/login/oauth2/callback`

2. **Userinfo Response**: The userinfo endpoint must return at least an `email` field. Optional fields include:
   - `name` or `given_name` - First name
   - `family_name` - Last name
   - `picture` - Profile image URL

3. **Authorization Code Flow**: The OAuth2 provider must support the standard authorization code flow with:
   - Authorization endpoint that accepts: `response_type=code`, `client_id`, `redirect_uri`, `state`, `scope`
   - Token endpoint that accepts: `grant_type=authorization_code`, `code`, `redirect_uri`, `client_id`, `client_secret`
   - Bearer token authentication for userinfo endpoint

### Security
- State parameter is used for CSRF protection
- Secure cookies are used for state and relay state storage
- All tokens are exchanged server-side (never exposed to the client)
