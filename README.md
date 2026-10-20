# Rentals — Property Rental Management

A full-stack app for a property management company: property managers maintain properties and units and
review rental applications, and applicants browse available units and apply for them. Approval issues a
twelve-month lease. The mobile app keeps working offline and syncs queued changes when the connection
returns.

- **Backend:** ASP.NET Core 10 Web API · EF Core 10 (SQL Server, code-first migrations) · ASP.NET Identity with bearer tokens · FluentValidation · Bogus · xUnit
- **Mobile:** Expo SDK 58 (React Native, TypeScript) · Expo Router · TanStack Query · Zustand · NativeWind (Tailwind) · react-hook-form + zod · expo-secure-store · NetInfo

```
backend/              ASP.NET Core solution
  src/Rentals.Domain          entities, workflow and business rules (no dependencies)
  src/Rentals.Infrastructure  EF Core DbContext, configurations, migrations, Identity, Bogus seeder
  src/Rentals.Api             controllers, application services, validation, auth, OpenAPI
  tests/Rentals.UnitTests     xUnit tests for the business logic and validation rules
mobile/               Expo app
  src/app                     routes (Expo Router)
  src/api                     typed API client and DTOs
  src/query                   TanStack Query client, persistence, offline mutations
  src/stores                  Zustand stores (session, sync status, filters, toasts)
  src/features                screens and components per feature
docker-compose.yml    SQL Server for local development
```

## Running locally

### Prerequisites

- .NET 10 SDK
- SQL Server: Docker (the included `docker-compose.yml`), or a local SQL Server / SQL Server Express instance
- Node.js 20+ and either an Android emulator, an iOS simulator, or the Expo Go app on a phone on the same network

### 1. Database

```bash
docker compose up -d
```

This starts SQL Server 2022 Express on `localhost:1433` (`sa` / `Rentals_Dev_Passw0rd`). On Apple Silicon the
image runs under Rosetta emulation; make sure “Use Rosetta for x86_64/amd64 emulation” is enabled in Docker Desktop.

To use an existing SQL Server or SQL Server Express instance instead, override the connection string, e.g.

```bash
export ConnectionStrings__Default="Server=.\\SQLEXPRESS;Database=Rentals;Trusted_Connection=True;TrustServerCertificate=True"
```

### 2. API

```bash
cd backend
dotnet run --project src/Rentals.Api
```

On start the API creates the database, applies migrations and seeds demo data (idempotently — restarting
does not duplicate anything). To start over with fresh demo data, run `docker compose down -v` and start
the database and API again. The API listens on `http://0.0.0.0:5080`; Swagger UI is at
<http://localhost:5080/swagger>. To call protected endpoints from Swagger, sign in with `POST /api/auth/login`
and paste the `accessToken` into **Authorize**.

### 3. Mobile app

```bash
cd mobile
npm install
npx expo start      # then press "a" for Android or "i" for iOS, or scan the QR code with Expo Go
```

The app talks to port `5080` on the machine running Metro, so the same setup works on simulators,
emulators and physical devices on the same network. To point it elsewhere, copy `.env.example` to `.env`
and set `EXPO_PUBLIC_API_URL`.

### Demo accounts

All seeded accounts use the password **`Demo123!`** (development builds also offer them on the sign-in screen).

| Role             | Email                                                  |
| ---------------- | ------------------------------------------------------ |
| Property manager | `manager@demo.test`, `manager2@demo.test`              |
| Applicant        | `applicant@demo.test` (has an application in every status, a draft with errors, and a draft shared with `applicant2@demo.test`), `applicant2@demo.test` … `applicant6@demo.test` |

### Tests

```bash
cd backend && dotnet test     # domain workflow, leasing, unit types, validation rules
cd mobile && npm test         # offline version chain, server error mapping, form schemas
cd mobile && npm run typecheck && npm run lint
```

## How it works

### Roles and permissions

Two roles, `Applicant` and `PropertyManager`, chosen at sign-up. Every endpoint requires an authenticated
user (fallback policy); manager-only and applicant-only actions use the `ManagerOnly` / `ApplicantOnly`
policies. Applicants only ever see applications they are on — anything else is reported as not found. The
domain model checks this again, and the server computes the caller's permissions (`canEdit`,
`canSubmit`, `canClaim`, …) into the view model, which is all the UI uses to decide what to show.

### Co-applicants

An application has a primary applicant (who started it) and up to three co-applicants, added by the email
of their applicant account (`POST /api/applications/{id}/applicants`). Everyone on it can view, edit,
submit and withdraw it — every ownership check covers all of them. The primary applicant can remove
co-applicants; a co-applicant can leave. Adding someone already on the application is a no-op, so a
replayed request is harmless.

### Application workflow

```
Draft ──submit──▶ Submitted ──claim──▶ UnderReview ──approve──▶ Approved (lease issued)
  ▲                  ▲  │                 │  ├─────return──▶ Returned ──resubmit──▶ Submitted
  │                  └──┼────release──────┘  └─────deny────▶ Denied
  └─ withdraw from any open status ─────────────────────────▶ Withdrawn
```

The transitions live in one place (`ApplicationWorkflow`) and every change goes through the
`RentalApplication` aggregate, which also records the history (who, when, comment, outcome). Approved,
Denied and Withdrawn are terminal. At submit and at approval the action is rejected when the unit has an
active lease; other open applications for that unit are left alone. Approval also rejects a lease that
overlaps an upcoming one, and touches the unit row so two concurrent approvals cannot both commit.

### The application form

The page is driven by a single view model (`GET /api/applications/{id}`) and shows one section at a time:
Applicant Information, Residence History, Summary. Each section is its own component and renders
editable or read-only depending on the server's `isEditable` (Draft or Returned, and you are the applicant).

The form posts to one action, `POST /api/applications/{id}/form`, with a `command` naming the button:

- **Continue** — validates the posted section (FluentValidation on the server, the same rules in zod on the
  client), saves it only when valid and returns the next step. Invalid input comes back as field errors,
  keyed by JSON path (`applicantInfo.email`, `residences[1].moveOutDate`), and the section re-renders with them.
- **Save draft** — saves the section as it is, errors included, and stays on it. Only storage limits
  (field lengths, residence ids, at most 10 residences) are enforced for a draft.
- **Submit** — available from the Summary once both sections are complete.
- **Back** returns to the previous section without saving, so it never needs a request (and works offline).

#### Sections saved with errors

Each section's rules are defined once (`ApplicationValidators.cs`), split into *limits* (always enforced,
they protect storage) and *rules* (decide whether the section is complete). `ApplicationSectionRules`
applies them everywhere: Continue requires limits and rules, Save draft only limits, and every read of
the application reports each section's status (`Empty`, `Incomplete`, `Complete`) with its errors keyed
by field path. Errors are computed from the stored data, never stored, so they cannot drift from the
rules. The Summary lists everything still blocking submission, and Submit is rejected
(`400 submission_blocked`, with every error) while anything remains. Drafts live in the database, so a
co-applicant sees them and they survive switching devices; the client mirrors the rules in zod to show
the same errors immediately, also offline.

Residences are added, edited and removed in a modal; the list is saved as a whole on Continue.

### Concurrency and idempotency

- **Optimistic concurrency.** Properties and units carry a SQL Server `rowversion`; updates must send the
  version they were based on and get `409 concurrency_conflict` otherwise. Application sections each have
  their own version number, so saves to different sections never interfere, while a second save of the
  same section based on an old version is rejected as stale with a message to reload. A save that races
  another one at the database level is retried against fresh state, letting the domain rules decide.
- **Idempotent creates.** Properties, units, applications and residences use ids generated on the device.
  Replaying a create returns the existing record (`200` instead of `201`). Status transitions treat a
  replay by the same user as a no-op, so a request repeated after a lost response is harmless.
- **Errors** are RFC 7807 problem details with a stable `code` (`unit_has_active_lease`, `stale_section`, …).

### Offline mode (mobile)

- **Server state** lives only in TanStack Query. The query cache, including mutations that have not been
  sent yet, is persisted to AsyncStorage, so previously loaded data is shown when the app starts offline.
- **Connectivity** comes from NetInfo, wired into TanStack Query's `onlineManager`. While offline, queries
  are served from the cache and mutations are paused. A banner shows the offline state and how many
  changes are waiting to sync; going back online resumes the paused mutations automatically.
- **Replay after restart.** Every mutation is registered up front with `setMutationDefaults` (in
  `src/query/mutations.ts`), so a change queued before the app was closed still has its request and cache
  updates when it is replayed later. Changes to the same record share a mutation *scope* and replay in order.
- **Optimistic updates** make offline changes visible immediately; after the last queued change to a record
  settles, the affected queries are refetched from the server.
- **Version chain.** When several edits of the same record were queued offline, each replayed save records
  the version it produced, and the next one sends that version — unless an earlier save was rejected, in
  which case the later edits are rejected too instead of silently overwriting someone else's change.
- **Rejected changes** (validation, conflicts, permissions) are not retried; the user gets a toast and the
  change is listed under *Account → Changes not saved*.
- **Auth offline.** Tokens are stored in the Keychain/Keystore via `expo-secure-store` and the session is
  restored without a network call, so a signed-in user stays signed in offline. Expired access tokens are
  refreshed when online; only an explicit rejection of the refresh token signs the user out.
- Development builds have a *Simulate offline* switch on the Account screen for demos.

### Client state

Zustand holds only client state: the auth session, sync status (connectivity, rejected changes, version
chain), list filters and toasts. Server data is never copied into a store.

## Bonus items

| Item | Status |
| --- | --- |
| Paging and sorting in the database; reusable grid driven by a JSON endpoint (rows + filtered total), documented in OpenAPI | Done — `GET /api/applications`, `DataGrid` component |
| Review queue: claim (Under Review) and release | Done |
| Property manager notes, never returned to applicants | Done |
| Save a section with errors; Summary lists everything blocking submission; rules defined once per section, errors returned per field | Done — *Save draft* command, `ApplicationSectionRules` |
| More than one applicant per application, ownership checks for all of them | Done — co-applicants |
| Two applicants editing at once: different sections don't interfere, same section is rejected as stale with a message to reload | Done — per-section versions, *Reload latest* in the app |

## Notes and trade-offs

- **Removing** a property or unit is a soft delete, blocked while a unit has an open application or a
  current/upcoming lease, so existing applications and leases keep their history.
- **Sign-out** is local (bearer tokens are stateless). It discards the cached data and unsynced changes of
  that user after a confirmation.
- **Dates** are calendar dates (`DateOnly`); “today” is the UTC date on the server.
- The SQL Server password in `appsettings.json` and `docker-compose.yml` is a local development value only.
