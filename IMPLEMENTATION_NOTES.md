# Post-Signup Story Flow Implementation

## Overview
This implementation ensures that users who generate a story before signing up are automatically redirected to `storydetail.html` with their generated story after completing the signup process on `checkout.html`.

## How It Works

### 1. Story Generation (Pre-Signup)
**Location:** `script.js` - `initCheckout()` function

When a user creates a story without being signed in:
- The story generation job is started via `startGuestGeneration(payload)`
- The returned `jobId` is stored in sessionStorage: `yw_pending_story_jobid`
- The story preview is shown on the checkout page
- A signup gate is displayed prompting the user to create an account

### 2. Signup with Pending Story
**Location:** `script.js` - `apiSignup()` function

When the user signs up from the checkout page:
- The function checks for a pending story jobId in sessionStorage
- If found, it includes the `pendingStoryJobId` in the signup payload
- The backend receives this jobId and associates the story with the new user account

**API Payload Example:**
```javascript
{
  "childName": "Mia",
  "email": "mia@example.com",
  "password": "password123",
  "birthYear": 2020,
  "gender": "female",
  "pendingStoryJobId": "abc123xyz"  // Added if pre-signup story exists
}
```

### 3. Post-Signup Redirect
**Location:** `script.js` - `openAuthModal()` signup handler

After successful signup:
- The code checks if there's a pending story (`yw_pending_story_jobid` in sessionStorage)
- If yes: redirects to `storydetail.html` 
- If no: uses the default behavior (seed a demo story or go to home)

### 4. Story Loading on Detail Page
**Location:** `script.js` - `initStoryDetail()` function

When `storydetail.html` loads with a pending story:
1. Checks if user is signed in (redirects to home if not)
2. Retrieves the pending `jobId` from sessionStorage
3. Shows a loading state in the storybook viewer
4. Polls the authenticated job endpoint every 5 seconds: `/api/v1/jobs/{jobId}`
5. When status is `completed`:
   - Fetches the full story via `/api/v1/stories/{storyId}`
   - Stores it in sessionStorage as `yw_current_story`
   - Reloads the page to let existing storydetail logic render it
6. Handles errors and timeouts gracefully

## Key sessionStorage Keys

- `yw_pending_story_jobid` - Stores the jobId from pre-signup story generation
- `yw_pending_transcript` - Stores the original story parameters
- `yw_guest_payload` - Stores the structured payload for story generation
- `yw_current_story` - Stores the completed story data for display
- `yw_postauth` - Flag indicating user just signed up/in
- `yw_signed_in` - Flag indicating user authentication state

## API Endpoints Used

### Guest Story Generation (Pre-Signup)
- **POST** `/api/v1/stories/guest-generate`
- Returns a `jobId` for polling

### Job Polling (Authenticated)
- **GET** `/api/v1/jobs/{jobId}`
- Requires JWT token in Authorization header
- Returns job status and story data when complete

### Story Retrieval (Authenticated)
- **GET** `/api/v1/stories/{storyId}`
- Requires JWT token
- Returns full story with pages, images, and audio

## Flow Diagram

```
1. User creates story (not signed in)
   └─> startGuestGeneration() → jobId stored in sessionStorage
   └─> Shows preview on checkout.html
   └─> Displays signup gate

2. User clicks "Sign Up for Free"
   └─> Opens signup modal
   └─> User fills form and submits

3. apiSignup() sends data + pendingStoryJobId to backend
   └─> Backend associates story with new user
   └─> Returns JWT token

4. Post-signup handler checks for pending story
   └─> If found: redirect to storydetail.html
   └─> If not: normal flow (home.html or seed story)

5. storydetail.html loads
   └─> initStoryDetail() runs
   └─> Finds pending jobId
   └─> Shows loading state
   └─> Polls /api/v1/jobs/{jobId} every 5s
   └─> When complete: fetches full story
   └─> Stores in sessionStorage
   └─> Reloads page to render

6. Page reloads with story data
   └─> Existing storydetail logic renders the story
   └─> User sees their personalized story!
```

## Error Handling

- **Job polling timeout:** Max 60 attempts (5 minutes)
- **Network errors:** Retries automatically during polling
- **Failed generation:** Shows error message with option to create new story
- **Not signed in:** Redirects to home.html
- **No pending story:** Falls back to normal storydetail behavior

## Mobile Debug Support

The implementation includes mobile-friendly debug messages:
- `mobileDebug()` function shows on-screen notifications
- Helpful for testing on mobile devices
- Can be disabled via `ENABLE_MOBILE_DEBUG` flag

## Testing Checklist

- [ ] Generate story as guest (not signed in)
- [ ] Verify jobId is stored in sessionStorage
- [ ] Click signup button on checkout page
- [ ] Complete signup form
- [ ] Verify redirect to storydetail.html
- [ ] Verify loading state is shown
- [ ] Verify story loads after completion
- [ ] Test with slow network (polling should continue)
- [ ] Test error states (failed generation)
- [ ] Test on mobile devices

## Notes

- The backend must support the `pendingStoryJobId` parameter in the signup endpoint
- The backend must return the story via the authenticated `/api/v1/jobs/{jobId}` endpoint
- JWT token is stored in localStorage as fallback for mobile devices
- All API calls use `getAuthHeaders()` to include the JWT token
- The implementation is backwards compatible - works with or without pending stories
