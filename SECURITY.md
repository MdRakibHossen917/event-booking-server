# Backend Security & Authorization

## Overview
This backend implements comprehensive authentication and authorization to ensure only content creators can edit or delete their own content.

## Authentication

### Firebase Admin SDK
The backend uses Firebase Admin SDK to verify Firebase ID tokens sent from the frontend.

### Token Format
All protected endpoints require an `Authorization` header:
```
Authorization: Bearer <firebase-id-token>
```

### Fallback Method
If Firebase Admin initialization fails, the backend accepts user info via headers:
- `X-User-Email`: User's email address
- `X-User-UID`: User's Firebase UID

## Protected Endpoints

### Groups (Events)
- **POST `/createGroup`** - Requires authentication, sets creator info automatically
- **PUT `/groups/:id`** - Only creator can update
- **DELETE `/groups/:id`** - Only creator can delete (also deletes joined records)

### Articles
- **POST `/articles`** - Requires authentication, sets author info automatically
- **PUT `/articles/:id`** - Only author can update
- **DELETE `/articles/:id`** - Only author can delete (also deletes comments)

### Comments
- **POST `/articles/:id/comments`** - Public (no auth required for commenting)
- **DELETE `/articles/:id/comments/:commentId`** - Comment author OR article author can delete

### Group Actions
- **POST `/joinGroup`** - Requires authentication, uses authenticated user's email
- **POST `/leaveGroup`** - Requires authentication, user can only leave their own join records

## Authorization Logic

### Creator Check
The `isCreator()` helper function checks if a user is the creator by:
1. Comparing `userEmail` field
2. Comparing `creatorEmail` field
3. Comparing `authorEmail` field
4. Comparing `userId` field (if available)
5. Comparing `creatorId` field (if available)
6. Comparing `authorId` field (if available)

### Security Features
1. **Automatic Creator Assignment**: When creating groups/articles, creator info is automatically set from authenticated user
2. **Prevent Creator Info Modification**: Update endpoints prevent changing creator/author fields
3. **Cascading Deletes**: Deleting a group/article also deletes related records (joined groups, comments)
4. **Input Validation**: All endpoints validate ObjectId format and required fields

## Environment Variables

### Required
- `DB_USER` - MongoDB username
- `DB_PASS` - MongoDB password

### Optional (for Firebase Admin)
- `FIREBASE_PROJECT_ID` - Firebase project ID for token verification

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Set environment variables in `.env`:
```
DB_USER=your_mongodb_username
DB_PASS=your_mongodb_password
FIREBASE_PROJECT_ID=your_firebase_project_id
```

3. For production with Firebase Admin (recommended):
   - Download Firebase service account key
   - Add to project root as `serviceAccountKey.json`
   - Update initialization code in `index.js`

## Error Responses

### 401 Unauthorized
- No token provided
- Invalid token
- Authentication failed

### 403 Forbidden
- User is not the creator/author
- User trying to modify content they don't own

### 404 Not Found
- Resource doesn't exist
- Invalid ID format

## Testing

To test protected endpoints, include the Firebase ID token in the Authorization header:

```javascript
fetch('https://your-api.com/groups/123', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${firebaseIdToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ ... })
})
```

## Security Best Practices

1. ✅ All create/edit/delete operations require authentication
2. ✅ Creator info is automatically set from authenticated user
3. ✅ Users cannot modify creator/author fields
4. ✅ Authorization checks before any modification
5. ✅ Input validation on all endpoints
6. ✅ Proper error handling and logging
7. ✅ Cascading deletes for data integrity

