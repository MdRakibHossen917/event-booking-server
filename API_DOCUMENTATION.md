# Event Booking API Documentation

**Base URL:** `https://event-booking-server-wheat.vercel.app`

## Table of Contents
- [Authentication](#authentication)
- [Groups/Events Endpoints](#groupsevents-endpoints)
- [Articles Endpoints](#articles-endpoints)
- [User Endpoints](#user-endpoints)
- [Dashboard Endpoints](#dashboard-endpoints)
- [Error Responses](#error-responses)

---

## Authentication

All protected endpoints require Firebase authentication. The backend supports two authentication methods:

### Method 1: Firebase ID Token (Primary)
```
Authorization: Bearer <firebase_id_token>
```

### Method 2: Fallback Headers (If Firebase Admin fails)
```
X-User-Email: user@example.com
X-User-UID: firebase_uid
```

### Helper Function
Use the `getAuthHeaders(user)` helper function from `src/utils/apiHelpers.js` to automatically add all required headers:

```javascript
import { getAuthHeaders } from "../utils/apiHelpers";

const headers = await getAuthHeaders(user);
// Returns: {
//   'Content-Type': 'application/json',
//   'Authorization': 'Bearer <token>',
//   'X-User-Email': 'user@example.com',
//   'X-User-UID': 'firebase_uid'
// }
```

---

## Groups/Events Endpoints

### 1. Get All Groups

**Endpoint:** `GET /groups`

**Auth Required:** No

**Description:** Fetch all groups/events

**Query Parameters:**
- `userEmail` (optional, string) - Filter groups by creator email

**Response:**
```json
[
  {
    "_id": "string",
    "groupName": "string",
    "description": "string",
    "location": "string",
    "maxMembers": number,
    "image": "string",
    "formattedDate": "string",
    "formatHour": "string",
    "day": "string",
    "userEmail": "string",
    "userId": "string",
    "creatorName": "string",
    "creatorImage": "string",
    "createdAt": "ISO date string"
  }
]
```

**Used in:** AllGroups.jsx, Banner.jsx, LatestCard.jsx, UpcomingEventCountdown.jsx, GroupDetails.jsx

---

### 2. Get Single Group by ID

**Endpoint:** `GET /groups/:id`

**Auth Required:** No

**Description:** Get details of a specific group

**Path Parameters:**
- `id` (string) - MongoDB ObjectId

**Response:**
```json
{
  "_id": "string",
  "groupName": "string",
  "description": "string",
  "location": "string",
  "maxMembers": number,
  "image": "string",
  "formattedDate": "string",
  "formatHour": "string",
  "day": "string",
  "userEmail": "string",
  "userId": "string",
  "creatorName": "string",
  "creatorImage": "string",
  "createdAt": "ISO date string"
}
```

**Used in:** UpdateGroup.jsx, GroupDetails.jsx

---

### 3. Create Group/Event

**Endpoint:** `POST /createGroup`

**Auth Required:** Yes

**Description:** Create a new group/event. Creator info (`userEmail`, `userId`, `creatorName`) is automatically set from authenticated user.

**Request Body:**
```json
{
  "groupName": "string (required)",
  "description": "string (required)",
  "location": "string (required)",
  "maxMembers": "number (required)",
  "image": "string (optional)",
  "formattedDate": "string (optional)",
  "formatHour": "string (optional)",
  "day": "string (optional)",
  "category": "string (optional)",
  "creatorName": "string (optional, auto-set if not provided)",
  "creatorImage": "string (optional, auto-set if not provided)"
}
```

**Note:** `userEmail`, `userId`, and `createdAt` are automatically set by the backend.

**Response:**
```json
{
  "success": true,
  "message": "Group created successfully",
  "data": {
    "insertedId": "string"
  }
}
```

**Used in:** CreateGroupForm.jsx

---

### 4. Update Group/Event

**Endpoint:** `PUT /groups/:id`

**Auth Required:** Yes

**Description:** Update an existing group/event. Only the creator can update their own groups.

**Path Parameters:**
- `id` (string) - MongoDB ObjectId

**Request Body:**
```json
{
  "groupName": "string (optional)",
  "description": "string (optional)",
  "location": "string (optional)",
  "maxMembers": "number (optional)",
  "image": "string (optional)",
  "formattedDate": "string (optional)",
  "formatHour": "string (optional)",
  "day": "string (optional)",
  "category": "string (optional)"
}
```

**Note:** Creator fields (`userEmail`, `userId`, `creatorEmail`, `creatorId`) cannot be modified.

**Response:**
```json
{
  "success": true,
  "message": "Group updated successfully"
}
```

**Error Responses:**
- `403` - User is not the creator
- `404` - Group not found

**Used in:** UpdateGroup.jsx, MyGroup.jsx

---

### 5. Delete Group/Event

**Endpoint:** `DELETE /groups/:id`

**Auth Required:** Yes

**Description:** Delete a group/event. Only the creator can delete their own groups. Also deletes all related joined records.

**Path Parameters:**
- `id` (string) - MongoDB ObjectId

**Response:**
```json
{
  "success": true,
  "message": "Group deleted successfully"
}
```

**Error Responses:**
- `403` - User is not the creator
- `404` - Group not found
- `500` - Server error

**Used in:** MyGroup.jsx, MyEvents.jsx, MyCreatedGroups.jsx

---

### 6. Get Groups by IDs

**Endpoint:** `POST /groupsByIds`

**Auth Required:** No

**Description:** Get multiple groups by their IDs

**Request Body:**
```json
{
  "ids": ["id1", "id2", "id3"]
}
```

**Response:**
```json
[
  {
    "_id": "string",
    "groupName": "string",
    ...
  }
]
```

**Used in:** MyGroup.jsx, MyEvents.jsx, JoinedGroups.jsx

---

### 7. Join Group/Event

**Endpoint:** `POST /joinGroup`

**Auth Required:** Yes

**Description:** Join a group/event. User email is automatically set from authenticated user.

**Request Body:**
```json
{
  "groupId": "string (required)",
  "groupName": "string (optional)",
  "joinedAt": "ISO date string (optional, auto-set)"
}
```

**Note:** `userEmail` and `userId` are automatically set by the backend.

**Response:**
```json
{
  "success": true,
  "data": {
    "insertedId": "string"
  }
}
```

**Error Responses:**
- `409` - Already joined

**Used in:** AllGroups.jsx, LatestCard.jsx

---

### 8. Leave Group/Event

**Endpoint:** `POST /leaveGroup`

**Auth Required:** Yes

**Description:** Leave a group/event. User can only leave their own join records.

**Request Body:**
```json
{
  "groupId": "string (required)"
}
```

**Note:** `userEmail` is automatically used from authenticated user.

**Response:**
```json
{
  "success": true,
  "message": "Left event successfully"
}
```

**Error Responses:**
- `404` - Join record not found

**Used in:** MyGroup.jsx, MyEvents.jsx, JoinedGroups.jsx

---

### 9. Get User Joined Groups

**Endpoint:** `GET /user-joined-groups`

**Auth Required:** No

**Description:** Get all groups a user has joined

**Query Parameters:**
- `email` (required, string) - User email

**Response:**
```json
[
  {
    "_id": "string",
    "groupId": "string",
    "userEmail": "string",
    "userId": "string",
    "joinedAt": "ISO date string"
  }
]
```

**Used in:** MyGroup.jsx, MyEvents.jsx, AllGroups.jsx, LatestCard.jsx, JoinedGroups.jsx, DashboardHome.jsx

---

## Articles Endpoints

### 10. Get All Articles

**Endpoint:** `GET /articles`

**Auth Required:** No

**Description:** Fetch all articles, sorted by publish date (newest first)

**Response:**
```json
[
  {
    "_id": "string",
    "title": "string",
    "shortDescription": "string",
    "content": "string",
    "coverImage": "string",
    "category": "string",
    "authorName": "string",
    "authorEmail": "string",
    "authorId": "string",
    "authorImage": "string",
    "publishDate": "ISO date string",
    "createdAt": "ISO date string"
  }
]
```

**Used in:** MyArticles.jsx, Articles.jsx, ArticleDetails.jsx, UpdateArticle.jsx, FeaturedArticles.jsx

---

### 11. Get Single Article by ID

**Endpoint:** `GET /articles/:id`

**Auth Required:** No

**Description:** Get details of a specific article

**Path Parameters:**
- `id` (string) - MongoDB ObjectId

**Response:**
```json
{
  "_id": "string",
  "title": "string",
  "shortDescription": "string",
  "content": "string",
  "coverImage": "string",
  "category": "string",
  "authorName": "string",
  "authorEmail": "string",
  "authorId": "string",
  "authorImage": "string",
  "publishDate": "ISO date string",
  "createdAt": "ISO date string"
}
```

**Used in:** ArticleDetails.jsx, UpdateArticle.jsx

---

### 12. Create Article

**Endpoint:** `POST /articles`

**Auth Required:** Yes

**Description:** Create a new article. Author info (`authorEmail`, `authorId`, `authorName`) is automatically set from authenticated user.

**Request Body:**
```json
{
  "title": "string (required)",
  "shortDescription": "string (optional)",
  "content": "string (required)",
  "coverImage": "string (optional)",
  "category": "string (optional, default: 'General')",
  "authorName": "string (optional, auto-set if not provided)",
  "authorImage": "string (optional)",
  "publishDate": "ISO date string (optional, auto-set)"
}
```

**Note:** `authorEmail`, `authorId`, `userId`, `userEmail`, and `createdAt` are automatically set by the backend.

**Response:**
```json
{
  "success": true,
  "message": "Article created successfully",
  "data": {
    "insertedId": "string"
  }
}
```

**Used in:** CreateArticle.jsx

---

### 13. Update Article

**Endpoint:** `PUT /articles/:id`

**Auth Required:** Yes

**Description:** Update an existing article. Only the author can update their own articles.

**Path Parameters:**
- `id` (string) - MongoDB ObjectId

**Request Body:**
```json
{
  "title": "string (optional)",
  "shortDescription": "string (optional)",
  "content": "string (optional)",
  "coverImage": "string (optional)",
  "category": "string (optional)"
}
```

**Note:** Author fields (`authorEmail`, `authorId`, `userEmail`, `userId`) cannot be modified.

**Response:**
```json
{
  "success": true,
  "message": "Article updated successfully"
}
```

**Error Responses:**
- `403` - User is not the author
- `404` - Article not found

**Used in:** UpdateArticle.jsx

---

### 14. Delete Article

**Endpoint:** `DELETE /articles/:id`

**Auth Required:** Yes

**Description:** Delete an article. Only the author can delete their own articles. Also deletes all related comments.

**Path Parameters:**
- `id` (string) - MongoDB ObjectId

**Response:**
```json
{
  "success": true,
  "message": "Article deleted successfully"
}
```

**Error Responses:**
- `403` - User is not the author
- `404` - Article not found

**Used in:** MyArticles.jsx

---

### 15. Get Article Comments

**Endpoint:** `GET /articles/:articleId/comments`

**Auth Required:** No

**Description:** Get all comments for an article, sorted by timestamp (newest first)

**Path Parameters:**
- `articleId` (string) - MongoDB ObjectId

**Response:**
```json
[
  {
    "_id": "string",
    "articleId": "string",
    "text": "string",
    "authorName": "string",
    "authorEmail": "string",
    "authorImage": "string",
    "timestamp": "ISO date string",
    "createdAt": "ISO date string"
  }
]
```

**Used in:** Comments.jsx

---

### 16. Create Article Comment

**Endpoint:** `POST /articles/:articleId/comments`

**Auth Required:** No (public commenting)

**Description:** Add a comment to an article

**Path Parameters:**
- `articleId` (string) - MongoDB ObjectId

**Request Body:**
```json
{
  "text": "string (required)",
  "authorName": "string (optional, default: 'Anonymous')",
  "authorEmail": "string (optional)",
  "authorImage": "string (optional)",
  "timestamp": "ISO date string (optional, auto-set)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Comment created successfully",
  "data": {
    "insertedId": "string"
  }
}
```

**Used in:** Comments.jsx

---

### 17. Delete Article Comment

**Endpoint:** `DELETE /articles/:articleId/comments/:commentId`

**Auth Required:** Yes

**Description:** Delete a comment. Comment author OR article author can delete.

**Path Parameters:**
- `articleId` (string) - MongoDB ObjectId
- `commentId` (string) - MongoDB ObjectId

**Response:**
```json
{
  "success": true,
  "message": "Comment deleted successfully"
}
```

**Error Responses:**
- `403` - User is not the comment author or article author
- `404` - Comment not found

**Used in:** Comments.jsx

---

## User Endpoints

### 18. Save User

**Endpoint:** `POST /save-user`

**Auth Required:** No

**Description:** Save or update user data in MongoDB when they log in

**Request Body:**
```json
{
  "email": "string (required)",
  "name": "string (optional)",
  "photo": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "matchedCount": number,
    "modifiedCount": number,
    "upsertedId": "string"
  }
}
```

**Used in:** AuthProvider.jsx

---

### 19. Get Total Users Count

**Endpoint:** `GET /totalUsers`

**Auth Required:** No

**Description:** Get total number of registered users

**Response:**
```json
{
  "total": number
}
```

**Used in:** DiscountBanner.jsx, Banner.jsx, DashboardHome.jsx

---

## Dashboard Endpoints

### 20. Get Dashboard Stats

**Endpoint:** `GET /dashboard-stats`

**Auth Required:** No

**Description:** Get dashboard statistics (users and groups per day)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "YYYY-MM-DD",
      "users": number,
      "groups": number
    }
  ]
}
```

**Used in:** DashboardHome.jsx

---

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable error message"
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (authorization failed)
- `404` - Not Found
- `409` - Conflict (e.g., already joined)
- `500` - Internal Server Error

### Common Error Messages

**Authentication Errors:**
```json
{
  "success": false,
  "error": "Unauthorized: Please log in again",
  "hint": "Include Authorization header with Bearer token, or X-User-Email and X-User-UID headers"
}
```

**Authorization Errors:**
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "You can only delete your own groups"
}
```

**Validation Errors:**
```json
{
  "success": false,
  "error": "Invalid article ID",
  "message": "The provided ID is not valid"
}
```

---

## External APIs

### ImgBB Image Upload

**Endpoint:** `POST https://api.imgbb.com/1/upload?expiration=600&key={API_KEY}`

**Auth Required:** No (API key in URL)

**Description:** Upload images to ImgBB for hosting

**Request:** FormData with `image` field

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://i.ibb.co/...",
    "delete_url": "https://ibb.co/..."
  }
}
```

**Used in:** CreateArticle.jsx, CreateGroupForm.jsx, Profile.jsx

**API Key:** Set in environment variable `VITE_IMGBB_API_KEY`

---

## Summary

### Public Endpoints (No Auth Required)
- `GET /groups`
- `GET /groups/:id`
- `GET /groups?userEmail={email}`
- `POST /groupsByIds`
- `GET /user-joined-groups?email={email}`
- `GET /articles`
- `GET /articles/:id`
- `GET /articles/:articleId/comments`
- `POST /articles/:articleId/comments`
- `POST /save-user`
- `GET /totalUsers`
- `GET /dashboard-stats`

### Protected Endpoints (Auth Required)
- `POST /createGroup`
- `PUT /groups/:id`
- `DELETE /groups/:id`
- `POST /joinGroup`
- `POST /leaveGroup`
- `POST /articles`
- `PUT /articles/:id`
- `DELETE /articles/:id`
- `DELETE /articles/:articleId/comments/:commentId`

---

## Best Practices

1. **Always use `getAuthHeaders(user)` helper** for protected endpoints
2. **Handle errors gracefully** - Check response status before parsing JSON
3. **Validate input** on frontend before sending requests
4. **Check content-type** before parsing JSON responses
5. **Use try-catch** for all async API calls
6. **Log errors** to console for debugging

---

## Example Usage

### Creating a Group with Authentication

```javascript
import { getAuthHeaders } from "../utils/apiHelpers";

const createGroup = async (groupData, user) => {
  try {
    const headers = await getAuthHeaders(user);
    
    const response = await fetch(
      "https://event-booking-server-wheat.vercel.app/createGroup",
      {
        method: "POST",
        headers,
        body: JSON.stringify(groupData),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create group");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error creating group:", error);
    throw error;
  }
};
```

---

**Last Updated:** 2024
**API Version:** 1.0.0

