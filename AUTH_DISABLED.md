# Authentication Temporarily Disabled for MVP Development

## What was changed:

1. **Middleware disabled** (`middleware.ts`):

   - The authentication middleware has been commented out
   - A simple bypass middleware now allows all requests to pass through

2. **Mock authentication** (`lib/mock-auth.ts`):

   - Created a mock authentication function that returns a guest user session
   - This prevents API routes from failing due to missing authentication

3. **Auth configuration** (`app/(auth)/auth.ts`):
   - Added a `USE_MOCK_AUTH` flag (currently set to `true`)
   - When enabled, uses mock authentication instead of real NextAuth

## How to re-enable authentication:

1. **Enable real authentication**:

   - In `app/(auth)/auth.ts`, change `const USE_MOCK_AUTH = true;` to `const USE_MOCK_AUTH = false;`

2. **Re-enable middleware**:

   - In `middleware.ts`, uncomment the original middleware function
   - Remove or comment out the temporary bypass middleware

3. **Clean up**:
   - You can delete `lib/mock-auth.ts` if no longer needed

## Current state:

- ✅ No authentication required to access the app
- ✅ All API routes work with mock guest user session
- ✅ Chat functionality should work normally
- ✅ User interface shows as a guest user

## Notes:

- The mock user has ID `mock-user-id` and email `guest-123`
- All database operations will be associated with this mock user
- When you re-enable authentication, you may want to clean up any data created by the mock user
