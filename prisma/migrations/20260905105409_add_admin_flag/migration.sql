-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" DATETIME,
    "image" TEXT,
    "promptCreditsBalance" INTEGER NOT NULL DEFAULT 0,
    "freeCreditsRemainingToday" INTEGER NOT NULL DEFAULT 0,
    "lastFreeGrantDate" TEXT,
    "videoCreditsBalance" INTEGER NOT NULL DEFAULT 0,
    "hasVideoPackage" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerified", "freeCreditsRemainingToday", "hasVideoPackage", "id", "image", "lastFreeGrantDate", "name", "promptCreditsBalance", "videoCreditsBalance") SELECT "createdAt", "email", "emailVerified", "freeCreditsRemainingToday", "hasVideoPackage", "id", "image", "lastFreeGrantDate", "name", "promptCreditsBalance", "videoCreditsBalance" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
