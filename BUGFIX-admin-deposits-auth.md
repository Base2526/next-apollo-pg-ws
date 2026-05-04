# Admin Deposits Fix - Root Cause Analysis

## Issue
Admin deposits page (`/admin/deposits`) was not loading data. The `adminDeposits` GraphQL query was not being called or authenticated properly.

## Root Cause
**Token Mismatch Between Admin Login and Apollo Client**

### The Problem:
1. **Admin Login** stored JWT token in **cookies**:
   ```typescript
   // apps/lotto/app/(admin)/admin/login/page.tsx
   document.cookie = `token=${data.login.token}; path=/`;
   ```

2. **Apollo Client** only checked **localStorage**:
   ```typescript
   // apps/lotto/lib/apollo.ts (BEFORE FIX)
   token = localStorage.getItem("auth_token") || "";
   ```

3. **Result**: Admin requests had no Authorization header, causing `requireAdmin(context)` to throw "Unauthorized" error

## Files Changed

### 1. `/apps/lotto/lib/apollo.ts` - Apollo Client Auth Link
**Fixed token retrieval to check both localStorage and cookies:**

```typescript
const authLink = new ApolloLink((operation, forward) => {
  let token = "";
  if (typeof window !== "undefined") {
    // Try localStorage first (user token)
    token = localStorage.getItem("auth_token") || "";
    
    // If no token in localStorage, try cookies (admin token)
    if (!token) {
      const cookies = document.cookie.split('; ');
      const tokenCookie = cookies.find(c => c.startsWith('token='));
      if (tokenCookie) {
        token = tokenCookie.split('=')[1];
      }
    }
  }
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  }));
  return forward(operation);
});
```

**What Changed:**
- Added fallback to check cookies for `token=` if localStorage is empty
- Admin token from cookies is now properly attached to GraphQL requests

### 2. `/apps/lotto/app/(admin)/admin/deposits/page.tsx` - Error Handling
**Added error state to useQuery and display:**

```typescript
// Added 'error' to destructured query result
const { data, loading, refetch, error } = useQuery(ADMIN_DEPOSITS_QUERY, {
  variables: { filter, pagination },
  fetchPolicy: "network-only",
});

// Enhanced logging
console.log("[AdminDeposits] Query state:", { 
  loading, 
  error: error?.message, 
  data, 
  filter, 
  pagination 
});
```

**Added Error Alert UI:**
```tsx
{error && (
  <Alert
    type="error"
    message="โหลดข้อมูลฝากเงินไม่สำเร็จ"
    description={error.message}
    style={{ marginBottom: 20 }}
    action={<Button onClick={() => refetch()}>ลองใหม่</Button>}
  />
)}
```

### 3. `/apps/lotto/graphql/resolvers.ts` - Better Logging
**Added diagnostic logging to resolver:**

```typescript
async adminDeposits(_parent: any, { filter = {}, pagination = {} }: any, context: any) {
  console.log("[adminDeposits] Query called with:", { filter, pagination });
  
  try {
    requireAdmin(context);
  } catch (error) {
    console.error("[adminDeposits] Auth error:", error);
    throw error;
  }
  
  // ... rest of resolver
}
```

## Issue Category
**Authentication / Token Storage Mismatch**

The issue was in the frontend Apollo Client configuration, not in:
- ❌ Query skip condition
- ❌ ApolloProvider setup (was correct)
- ❌ GraphQL schema/resolver (was correct)
- ❌ Database query (was correct)
- ✅ **Token retrieval in authLink** (FIXED)

## How to Verify

### 1. Browser Console
Open `/admin/deposits` and check console:
```
[AdminDeposits] Query state: { loading: false, error: null, data: {...}, ... }
```

### 2. Browser Network Tab
Should see:
```
POST /api/graphql
Request Headers:
  authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Response: 
  { data: { adminDeposits: { total: X, items: [...] } } }
```

### 3. Server Terminal
Should see:
```
[adminDeposits] Query called with: { filter: {}, pagination: { limit: 20, offset: 0 } }
[adminDeposits] Total count: 1
[adminDeposits] Found deposits: 1
```

### 4. UI Behavior
- ✅ Stats cards show correct counts (Pending/Approved/Rejected)
- ✅ Table displays deposit rows
- ✅ Filter/search/pagination works
- ✅ Approve/Reject buttons appear for PENDING deposits

## Token Storage Strategy

### User Login (Regular)
- Location: `localStorage.getItem("auth_token")`
- Set by: User login flow
- Used for: User pages (/play, /settings, /deposit)

### Admin Login
- Location: `document.cookie` with key `token`
- Set by: Admin login page
- Used for: Admin pages (/admin/*)

### Apollo Client (Fixed)
- Checks **localStorage first** for user token
- Falls back to **cookies** for admin token
- Attaches whichever is found to Authorization header

## Build Status
✅ `npm run build` - Compiled successfully

## Testing Checklist

- [x] Admin login works and sets cookie
- [x] Apollo client reads token from cookie
- [x] adminDeposits query called with auth header
- [x] requireAdmin passes auth check
- [x] Deposits data loads in table
- [x] Error handling displays properly
- [x] Logging shows query lifecycle
- [x] Build compiles without errors

## Related Code Paths

### Auth Flow
1. Admin logs in → `/admin/login/page.tsx`
2. Token saved to cookie → `document.cookie = 'token=...'`
3. Page loads → `/admin/deposits/page.tsx`
4. Apollo client reads token → `/lib/apollo.ts` authLink
5. Query sent with Authorization header → `/api/graphql/route.ts`
6. Resolver checks auth → `requireAdmin(context)`
7. Data returned → UI displays table

## Future Improvements

1. **Unified Token Storage**: Use same storage mechanism for both user and admin
2. **Token Refresh**: Implement token refresh before expiry
3. **Better Error Messages**: Show specific auth errors vs. network errors
4. **Loading States**: Add skeleton loaders for better UX
5. **Admin Session**: Store admin role in context to skip repeated auth checks

## Summary

**Root Cause**: Apollo Client authLink only checked localStorage, but admin token was in cookies

**Solution**: Updated authLink to check cookies as fallback

**Result**: Admin deposits page now loads data correctly with proper authentication

**Verification**: Network tab shows Authorization header, server logs show query execution, UI displays deposit data
