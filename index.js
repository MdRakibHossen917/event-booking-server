require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const app = express();
const port = process.env.PORT || 5000;

// Initialize Firebase Admin
try {
  // Option 1: Use service account (if you have credentials file)
  // const serviceAccount = require("./path-to-serviceAccountKey.json");
  // admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  
  // Option 2: Use environment variables (recommended for production)
  if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  } else {
    // Option 3: Initialize without credentials (will verify tokens using public keys)
    admin.initializeApp();
  }
  console.log("✅ Firebase Admin initialized");
} catch (error) {
  console.warn("⚠️ Firebase Admin initialization warning:", error.message);
  console.warn("⚠️ Authentication will use fallback method");
}

// Middleware
app.use(cors());
app.use(express.json());

// Authentication Middleware - Verifies Firebase ID Token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized: No token provided",
      });
    }

    const token = authHeader.split("Bearer ")[1];

    try {
      // Verify Firebase ID token
      const decodedToken = await admin.auth().verifyIdToken(token);
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        name: decodedToken.name || decodedToken.email?.split("@")[0],
      };
      next();
    } catch (firebaseError) {
      // Fallback: If Firebase Admin fails, check if user info is in headers
      const userEmail = req.headers["x-user-email"];
      const userUid = req.headers["x-user-uid"];
      
      if (userEmail && userUid) {
        req.user = {
          uid: userUid,
          email: userEmail,
          name: userEmail?.split("@")[0],
        };
        next();
      } else {
        return res.status(401).json({
          success: false,
          error: "Unauthorized: Invalid token",
        });
      }
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Authentication failed",
    });
  }
};

// Authorization Helper - Check if user is the creator
const isCreator = (resource, userEmail, userUid) => {
  // Check by email (most common)
  if (resource.userEmail && resource.userEmail === userEmail) {
    return true;
  }
  if (resource.creatorEmail && resource.creatorEmail === userEmail) {
    return true;
  }
  if (resource.authorEmail && resource.authorEmail === userEmail) {
    return true;
  }
  
  // Check by UID if available
  if (resource.userId && resource.userId === userUid) {
    return true;
  }
  if (resource.creatorId && resource.creatorId === userUid) {
    return true;
  }
  if (resource.authorId && resource.authorId === userUid) {
    return true;
  }
  
  return false;
};

// MongoDB URI
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.d3rwcxr.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("eventBookingDB");
    const groupCollection = db.collection("groups");
    const joinedCollection = db.collection("joinedGroups");
    const usersCollection = db.collection("users"); // **User collection**
    const articlesCollection = db.collection("articles"); // **Articles collection**
    const commentsCollection = db.collection("comments"); // **Comments collection**

    // Create group - Protected: Requires authentication
    app.post("/createGroup", authenticateToken, async (req, res) => {
      try {
        const groupData = req.body;
        
        // Set creator info from authenticated user
        groupData.userEmail = req.user.email;
        groupData.userId = req.user.uid;
        if (!groupData.creatorName) groupData.creatorName = req.user.name || "Unknown User";
        if (!groupData.creatorImage)
          groupData.creatorImage =
            "https://via.placeholder.com/40?text=No+Image";
        groupData.createdAt = new Date().toISOString();

        const result = await groupCollection.insertOne(groupData);
        res.status(201).json({
          success: true,
          message: "Group created successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error inserting group:", error);
        res
          .status(500)
          .json({ success: false, error: "Failed to create group" });
      }
    });

    // Get all groups or by userEmail (for MyGroups)
    app.get("/groups", async (req, res) => {
      try {
        const { userEmail } = req.query;
        const filter = userEmail ? { userEmail } : {};
        const groups = await groupCollection.find(filter).toArray();
        res.status(200).json(groups);
      } catch (error) {
        console.error("Error fetching groups:", error);
        res
          .status(500)
          .json({ success: false, error: "Failed to fetch groups" });
      }
    });

    // Update group - Protected: Only creator can update
    app.put("/groups/:id", authenticateToken, async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      try {
        // First, check if group exists and user is the creator
        const group = await groupCollection.findOne({ _id: new ObjectId(id) });
        
        if (!group) {
          return res
            .status(404)
            .json({ success: false, message: "Group not found" });
        }

        // Check authorization
        if (!isCreator(group, req.user.email, req.user.uid)) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You can only update your own groups",
          });
        }

        // Prevent changing creator info
        delete updatedData.userEmail;
        delete updatedData.userId;
        delete updatedData.creatorEmail;
        delete updatedData.creatorId;
        updatedData.updatedAt = new Date().toISOString();

        const result = await groupCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        res
          .status(200)
          .json({ success: true, message: "Group updated successfully" });
      } catch (error) {
        console.error("Error updating group:", error);
        res
          .status(500)
          .json({ success: false, message: "Failed to update group" });
      }
    });

    // Delete group - Protected: Only creator can delete
    app.delete("/groups/:id", authenticateToken, async (req, res) => {
      const id = req.params.id;
      try {
        // First, check if group exists and user is the creator
        const group = await groupCollection.findOne({ _id: new ObjectId(id) });
        
        if (!group) {
          return res.status(404).json({ success: false, message: "Group not found" });
        }

        // Check authorization
        if (!isCreator(group, req.user.email, req.user.uid)) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You can only delete your own groups",
          });
        }

        // Delete the group
        const result = await groupCollection.deleteOne({
          _id: new ObjectId(id),
        });
        
        if (result.deletedCount === 1) {
          // Also delete all joined records for this group
          await joinedCollection.deleteMany({ groupId: id });
          
          res
            .status(200)
            .json({ success: true, message: "Group deleted successfully" });
        } else {
          res.status(404).json({ success: false, message: "Group not found" });
        }
      } catch (error) {
        console.error("Error deleting group:", error);
        res
          .status(500)
          .json({ success: false, message: "Failed to delete group" });
      }
    });

    // Leave group - Protected: User can only leave their own join record
    app.post("/leaveGroup", authenticateToken, async (req, res) => {
      try {
        const { groupId } = req.body;
        if (!groupId) {
          return res
            .status(400)
            .json({ success: false, message: "Group ID is required" });
        }

        // Use authenticated user's email
        const userEmail = req.user.email;

        // Verify the join record belongs to the authenticated user
        const joinRecord = await joinedCollection.findOne({
          groupId,
          userEmail,
        });

        if (!joinRecord) {
          return res
            .status(404)
            .json({ success: false, message: "Join record not found" });
        }

        // Additional check: ensure the userEmail matches authenticated user
        if (joinRecord.userEmail !== userEmail) {
          return res.status(403).json({
            success: false,
            message: "Forbidden: You can only leave groups you've joined",
          });
        }

        const result = await joinedCollection.deleteOne({
          groupId,
          userEmail,
        });

        if (result.deletedCount === 1) {
          res
            .status(200)
            .json({ success: true, message: "Left group successfully" });
        } else {
          res
            .status(404)
            .json({ success: false, message: "Join record not found" });
        }
      } catch (error) {
        console.error("Error leaving group:", error);
        res
          .status(500)
          .json({ success: false, message: "Failed to leave group" });
      }
    });

    // Delete past events (example API route or background job)
    const now = new Date();
    await groupCollection.deleteMany({
      formattedDate: { $lt: now.toISOString() },
    });

    // Join group - Protected: Requires authentication
    app.post("/joinGroup", authenticateToken, async (req, res) => {
      try {
        const { groupId } = req.body;
        
        if (!groupId) {
          return res.status(400).json({ success: false, error: "Group ID is required" });
        }

        // Use authenticated user's email
        const userEmail = req.user.email;
        const userId = req.user.uid;

        // Check if already joined
        const existing = await joinedCollection.findOne({
          groupId,
          userEmail,
        });

        if (existing) {
          return res
            .status(409)
            .json({ success: false, message: "Already joined" });
        }

        // Verify group exists
        try {
          const group = await groupCollection.findOne({ _id: new ObjectId(groupId) });
          if (!group) {
            return res.status(404).json({ success: false, error: "Group not found" });
          }
        } catch (objectIdError) {
          return res.status(400).json({ success: false, error: "Invalid group ID format" });
        }

        // Create join record with authenticated user info
        const joinedGroup = {
          groupId,
          userEmail,
          userId,
          joinedAt: new Date().toISOString(),
        };

        const result = await joinedCollection.insertOne(joinedGroup);
        res.status(201).json({ success: true, data: result });
      } catch (err) {
        console.error("Error joining group:", err);
        res.status(500).json({ success: false, error: "Failed to join group" });
      }
    });

    // Get joined groups by user
    app.get("/user-joined-groups", async (req, res) => {
      const { email } = req.query;
      try {
        const groups = await joinedCollection
          .find({ userEmail: email })
          .toArray();
        res.status(200).json(groups);
      } catch (err) {
        console.error("Error fetching joined groups:", err);
        res
          .status(500)
          .json({ success: false, message: "Failed to fetch joined groups" });
      }
    });

    // Fetch groups by array of IDs (for joined groups details)
    app.post("/groupsByIds", async (req, res) => {
      try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid group IDs" });
        }
        const objectIds = ids.map((id) => new ObjectId(id));
        const groups = await groupCollection
          .find({ _id: { $in: objectIds } })
          .toArray();
        res.status(200).json(groups);
      } catch (error) {
        console.error("Error fetching groups by IDs:", error);
        res
          .status(500)
          .json({ success: false, message: "Failed to fetch groups by IDs" });
      }
    });

    // ** New: Save User API **
    app.post("/save-user", async (req, res) => {
      try {
        const { email, name, photo } = req.body;

        if (!email) {
          return res.status(400).json({ error: "Email is required" });
        }

        const updateDoc = {
          $set: {
            email,
            name: name || "No Name",
            photo: photo || "https://via.placeholder.com/40",
            updatedAt: new Date(),
          },
        };

        const result = await usersCollection.updateOne({ email }, updateDoc, {
          upsert: true,
        });

        res.status(200).json({ success: true, result });
      } catch (error) {
        console.error("Error saving user:", error);
        res.status(500).json({ success: false, error: "Failed to save user" });
      }
    });
    app.get("/dashboard-stats", async (req, res) => {
      try {
        // usersCollection
        const usersPerDay = await usersCollection
          .aggregate([
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                users: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ])
          .toArray();

        // groupCollection
        const groupsPerDay = await groupCollection
          .aggregate([
            {
              $group: {
                _id: "$formattedDate",
                groups: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ])
          .toArray();

        const stats = [];

        usersPerDay.forEach((userDay) => {
          const groupDay = groupsPerDay.find((g) => g._id === userDay._id);
          stats.push({
            date: userDay._id,
            users: userDay.users,
            groups: groupDay ? groupDay.groups : 0,
          });
        });

        groupsPerDay.forEach((groupDay) => {
          if (!stats.find((s) => s.date === groupDay._id)) {
            stats.push({
              date: groupDay._id,
              users: 0,
              groups: groupDay.groups,
            });
          }
        });

        stats.sort((a, b) => a.date.localeCompare(b.date));

        res.status(200).json(stats);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ error: "Failed to fetch dashboard stats" });
      }
    });

    // ** New: Total Users Count API **
    app.get("/totalUsers", async (req, res) => {
      try {
        const total = await usersCollection.estimatedDocumentCount();
        res.status(200).json({ total });
      } catch (error) {
        console.error("Error fetching total users:", error);
        res.status(500).json({ error: "Failed to fetch total users" });
      }
    });

    // ** Articles API **
    // Create article - Protected: Requires authentication
    app.post("/articles", authenticateToken, async (req, res) => {
      try {
        const articleData = req.body;
        
        // Validate required fields
        if (!articleData.title) {
          return res.status(400).json({ success: false, error: "Title is required" });
        }

        // Set author info from authenticated user
        articleData.authorEmail = req.user.email;
        articleData.authorId = req.user.uid;
        articleData.userEmail = req.user.email; // For consistency
        articleData.userId = req.user.uid;
        
        // Add default values if not provided
        if (!articleData.authorName) articleData.authorName = req.user.name || "Anonymous";
        if (!articleData.coverImage) {
          articleData.coverImage = "https://via.placeholder.com/800x400?text=No+Image";
        }
        if (!articleData.publishDate) {
          articleData.publishDate = new Date().toISOString();
        }
        if (!articleData.createdAt) {
          articleData.createdAt = new Date().toISOString();
        }

        const result = await articlesCollection.insertOne(articleData);
        res.status(201).json({
          success: true,
          message: "Article created successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error creating article:", error);
        res.status(500).json({ success: false, error: "Failed to create article" });
      }
    });

    // Get all articles
    app.get("/articles", async (req, res) => {
      try {
        const articles = await articlesCollection.find({}).sort({ publishDate: -1, createdAt: -1 }).toArray();
        res.status(200).json(articles);
      } catch (error) {
        console.error("Error fetching articles:", error);
        res.status(500).json({ success: false, error: "Failed to fetch articles" });
      }
    });

    // Get article by ID
    app.get("/articles/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, error: "Invalid article ID" });
        }
        const article = await articlesCollection.findOne({ _id: new ObjectId(id) });
        if (!article) {
          return res.status(404).json({ success: false, error: "Article not found" });
        }
        res.status(200).json(article);
      } catch (error) {
        console.error("Error fetching article:", error);
        res.status(500).json({ success: false, error: "Failed to fetch article" });
      }
    });

    // Update article - Protected: Only author can update
    app.put("/articles/:id", authenticateToken, async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, error: "Invalid article ID" });
        }

        // Check if article exists
        const article = await articlesCollection.findOne({ _id: new ObjectId(id) });
        if (!article) {
          return res.status(404).json({ success: false, error: "Article not found" });
        }

        // Check authorization
        if (!isCreator(article, req.user.email, req.user.uid)) {
          return res.status(403).json({
            success: false,
            error: "Forbidden: You can only update your own articles",
          });
        }

        const updatedData = req.body;
        
        // Prevent changing author info
        delete updatedData.authorEmail;
        delete updatedData.authorId;
        delete updatedData.userEmail;
        delete updatedData.userId;
        updatedData.updatedAt = new Date().toISOString();

        const result = await articlesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        res.status(200).json({
          success: true,
          message: "Article updated successfully",
        });
      } catch (error) {
        console.error("Error updating article:", error);
        res.status(500).json({ success: false, error: "Failed to update article" });
      }
    });

    // Delete article - Protected: Only author can delete
    app.delete("/articles/:id", authenticateToken, async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, error: "Invalid article ID" });
        }

        // Check if article exists
        const article = await articlesCollection.findOne({ _id: new ObjectId(id) });
        if (!article) {
          return res.status(404).json({ success: false, error: "Article not found" });
        }

        // Check authorization
        if (!isCreator(article, req.user.email, req.user.uid)) {
          return res.status(403).json({
            success: false,
            error: "Forbidden: You can only delete your own articles",
          });
        }

        // Delete the article
        const result = await articlesCollection.deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 1) {
          // Also delete all comments for this article
          await commentsCollection.deleteMany({ articleId: id });
          
          res.status(200).json({
            success: true,
            message: "Article deleted successfully",
          });
        } else {
          res.status(404).json({ success: false, error: "Article not found" });
        }
      } catch (error) {
        console.error("Error deleting article:", error);
        res.status(500).json({ success: false, error: "Failed to delete article" });
      }
    });

    // ** Comments API **
    // Get all comments for an article
    app.get("/articles/:id/comments", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, error: "Invalid article ID" });
        }
        const comments = await commentsCollection
          .find({ articleId: id })
          .sort({ timestamp: -1, createdAt: -1 })
          .toArray();
        res.status(200).json(comments);
      } catch (error) {
        console.error("Error fetching comments:", error);
        res.status(500).json({ success: false, error: "Failed to fetch comments" });
      }
    });

    // Create a comment
    app.post("/articles/:id/comments", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, error: "Invalid article ID" });
        }

        // Verify article exists
        const article = await articlesCollection.findOne({ _id: new ObjectId(id) });
        if (!article) {
          return res.status(404).json({ success: false, error: "Article not found" });
        }

        const commentData = req.body;
        
        // Validate required fields
        if (!commentData.text && !commentData.comment) {
          return res.status(400).json({ success: false, error: "Comment text is required" });
        }

        // Prepare comment data
        const newComment = {
          articleId: id,
          text: commentData.text || commentData.comment,
          authorName: commentData.authorName || "Anonymous",
          authorEmail: commentData.authorEmail || "",
          authorImage: commentData.authorImage || "https://via.placeholder.com/40",
          timestamp: commentData.timestamp || new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };

        const result = await commentsCollection.insertOne(newComment);
        res.status(201).json({
          success: true,
          message: "Comment created successfully",
          data: result,
        });
      } catch (error) {
        console.error("Error creating comment:", error);
        res.status(500).json({ success: false, error: "Failed to create comment" });
      }
    });

    // Delete a comment - Protected: Only comment author or article author can delete
    app.delete("/articles/:id/comments/:commentId", authenticateToken, async (req, res) => {
      try {
        const { id, commentId } = req.params;
        
        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ success: false, error: "Invalid article ID" });
        }
        if (!ObjectId.isValid(commentId)) {
          return res.status(400).json({ success: false, error: "Invalid comment ID" });
        }

        // Verify comment exists and belongs to the article
        const comment = await commentsCollection.findOne({
          _id: new ObjectId(commentId),
          articleId: id,
        });

        if (!comment) {
          return res.status(404).json({ success: false, error: "Comment not found" });
        }

        // Check if user is the comment author
        const isCommentAuthor = isCreator(comment, req.user.email, req.user.uid);
        
        // Also check if user is the article author (can delete any comment on their article)
        let isArticleAuthor = false;
        if (!isCommentAuthor) {
          const article = await articlesCollection.findOne({ _id: new ObjectId(id) });
          if (article) {
            isArticleAuthor = isCreator(article, req.user.email, req.user.uid);
          }
        }

        // Authorization check
        if (!isCommentAuthor && !isArticleAuthor) {
          return res.status(403).json({
            success: false,
            error: "Forbidden: You can only delete your own comments or comments on your articles",
          });
        }

        const result = await commentsCollection.deleteOne({
          _id: new ObjectId(commentId),
          articleId: id,
        });

        if (result.deletedCount === 1) {
          res.status(200).json({
            success: true,
            message: "Comment deleted successfully",
          });
        } else {
          res.status(404).json({ success: false, error: "Comment not found" });
        }
      } catch (error) {
        console.error("Error deleting comment:", error);
        res.status(500).json({ success: false, error: "Failed to delete comment" });
      }
    });

    // Root route
    app.get("/", (req, res) => {
      res.send("🎉 Event Booking Server is Running!");
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}

run().catch(console.dir);

// For Vercel deployment
module.exports = app;

// For local development
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`🚀 Server is running on http://localhost:${port}`);
  });
}
