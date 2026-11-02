# C1: Short-lived access tokens + refresh tokens

- Access token cookie: `nexora_access`, 10-minute lifetime.
- Refresh token cookie: `nexora_refresh`, 7-day lifetime.
- Both tokens are random opaque values; only SHA-256 hashes are stored in MongoDB.
- Refresh tokens are single-use: `/api/auth/refresh` consumes the old refresh token and issues a new access/refresh pair.
- Both cookies are HttpOnly and SameSite=Lax; Secure is enabled in production.
- `/api/auth/me` is retried after a successful refresh in the client AuthProvider.
- Logout revokes both presented tokens.
- Existing users will need to sign in once after deployment because the old `nexora_session` cookie is no longer accepted.
- Refresh reuse detection is limited to rejecting an already-consumed token; this implementation does not yet revoke an entire token family after reuse.
- Build and integration tests must be run in the project environment before deployment.
