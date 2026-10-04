-- Better Auth 1.7.7 core schema, SQLite dates are ISO text (native D1 adapter).
CREATE TABLE user (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, emailVerified INTEGER NOT NULL DEFAULT 0, image TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE session (id TEXT PRIMARY KEY, expiresAt TEXT NOT NULL, token TEXT NOT NULL UNIQUE, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, ipAddress TEXT, userAgent TEXT, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE);
CREATE INDEX session_userId ON session(userId);
CREATE TABLE account (id TEXT PRIMARY KEY, accountId TEXT NOT NULL, providerId TEXT NOT NULL, userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, accessToken TEXT, refreshToken TEXT, idToken TEXT, accessTokenExpiresAt TEXT, refreshTokenExpiresAt TEXT, scope TEXT, password TEXT, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE INDEX account_userId ON account(userId);
CREATE TABLE verification (id TEXT PRIMARY KEY, identifier TEXT NOT NULL, value TEXT NOT NULL, expiresAt TEXT NOT NULL, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE INDEX verification_identifier ON verification(identifier);
CREATE TABLE preferences (owner TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE, version INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL, updatedAt TEXT NOT NULL);
CREATE TABLE webdav (owner TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE, version INTEGER NOT NULL DEFAULT 1, endpoint TEXT NOT NULL, username TEXT NOT NULL, directory TEXT NOT NULL, secret TEXT NOT NULL);
