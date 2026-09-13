# DebX DailyCode

A reader for published Notion pages with email/password accounts. Sign in on any
device to access your saved links, nested folders, collections, order, and display preferences.

The frontend is a client-only React application hosted by Next.js App Router.
React Router handles UI navigation. All backend access uses HTTP API routes;
there are no application Server Components or Server Actions.

## Stack

- Next.js 16.3.5, React 19, TypeScript, Tailwind CSS v4, shadcn/ui.
- Better Auth 1.7.4 for email/password signup, login, sessions, and logout.
- Prisma ORM 7.10 with PostgreSQL on Neon.
- react-notion-x and notion-client for published Notion content.

## Local setup

Use Node.js 20.19+, 22.12+, or 24+. Copy `.env.example` to `.env` and set:

- `DATABASE_URL`: your PostgreSQL connection string.
- `BETTER_AUTH_SECRET`: a random secret of at least 32 characters.
- `BETTER_AUTH_URL`: the application origin, locally `http://127.0.0.1:5173`.

Keep `.env` private. None of these variables belongs in `NEXT_PUBLIC_*` variables.

```bash
npm install
npm run db:migrate
npm run dev
```

Open `http://127.0.0.1:5173`, create an account, and add a published Notion link.
The existing local environment has been configured and the migration applied.

## Storage and sync

The account owns its saved links, titles, subpage lists, timestamps, manual order,
sort choice, list/grid view, and theme preference. Prisma stores each library as a
JSON document related to its user, preserving the existing backup format.

Every library request validates the session. The server derives ownership from
that session; the client account header only prevents an in-flight request from
being applied after switching accounts. Writes use revision checks and retry
against the latest document, so simultaneous edits do not overwrite unrelated
changes. A backup replacement fails if its revision is stale.

The UI confirms changes only after the API saves them. It refreshes the library on
window focus and every 15 seconds while visible. New sessions load from the
database. Offline edits are not queued for later upload.

Browser-only pages from the old app are never automatically assigned to an
account. The home screen offers **Import browser pages into my account**, which
merges them without replacing current account pages. The original browser data is
retained. Backup restore is a separate, confirmed replacement of the account's
pages and preferences across devices.

Notion document content is still fetched live from publicly published pages;
the app stores links and library metadata, not an offline copy of each document.
Notion availability and access restrictions can affect fetching.

## Folders

**My Library** is the root. Create folders inside it and nest folders up to five
levels. Any folder may contain both saved pages and other folders. Existing pages
stay at the root. Folders appear first, alphabetically, in list and grid views;
pages retain their existing sorting and drag-to-reorder controls within each folder.

Use **New folder** to create a folder in the current location. Folder menus offer
rename, **Move to…**, and delete. Page menus also offer **Move to…**. The destination
picker supports the root and nested folders. Moves preserve page reader URLs and
carry a folder's entire subtree. The API rejects missing destinations, cycles,
and moves that would put any descendant beyond level five.

Breadcrumbs navigate back through the hierarchy. Adding a page saves it in the
currently open folder. Folder deletion confirms the number of contained folders
and pages and removes that subtree. If another device changes the library before
the delete completes, the API rejects it and asks for fresh confirmation.

Folders and page locations are included in account sync and JSON backups. Old
backups still import at the root. The existing per-account JSON storage supports
folders without a database schema migration.

## API routes

| Route | Purpose |
| --- | --- |
| `/api/auth/[...all]` | Better Auth email/password and session endpoints |
| `GET /api/library` | Read the signed-in user's library and revision |
| `PATCH /api/library` | Add, update, remove, reorder, change preferences, merge or restore |
| `POST /api/notion/[endpoint]` | Authenticated, restricted proxy for Notion read endpoints |

Library requests include `X-Account-Id` matching the authenticated user. Mutations
require JSON and the configured application origin. Responses are private and
uncached. The database client, auth server, and request helpers live in
`src/server` and are marked `server-only`. The frontend uses `fetch` and Better
Auth's React client.

## Checks

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

To run the database/API integration test with the development server running:

```bash
TEST_BASE_URL=http://127.0.0.1:5173 npm test
```

The integration test creates disposable accounts, checks cross-session
persistence, account isolation, concurrent writes, origin validation, stale
imports, password hashing, and logout. It deletes only those test accounts afterward.
Without `TEST_BASE_URL`, that integration test is skipped and unit tests still run.

## Deployment

Deploy using a Next.js-capable host and configure the three environment variables
above, with `BETTER_AUTH_URL` set to the production HTTPS origin. Apply migrations
as a release step before serving the updated application:

```bash
npm run db:migrate
npm run build
npm run start
```

`npm run preview` aliases the production server. The build uses `.next/`, not a
static export. For a container that needs an externally reachable bind address,
run `npx next start --hostname 0.0.0.0 --port 3000` behind your HTTPS host.

Email/password authentication does not send verification or password-reset email;
an email delivery provider would be needed for those additional flows.
