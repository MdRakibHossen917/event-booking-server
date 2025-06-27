require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

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

    // Create group
    app.post("/createGroup", async (req, res) => {
      try {
        const groupData = req.body;
        if (!groupData.creatorName) groupData.creatorName = "Unknown User";
        if (!groupData.creatorImage)
          groupData.creatorImage =
            "https://via.placeholder.com/40?text=No+Image";

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

    // Update group
    app.put("/groups/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;

      try {
        const result = await groupCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );

        if (result.matchedCount === 0) {
          return res
            .status(404)
            .json({ success: false, message: "Group not found" });
        }

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

    // Delete group
    app.delete("/groups/:id", async (req, res) => {
      const id = req.params.id;
      try {
        const result = await groupCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
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

    // Leave group
    app.post("/leaveGroup", async (req, res) => {
      try {
        const { groupId, userEmail } = req.body;
        if (!groupId || !userEmail) {
          return res
            .status(400)
            .json({ success: false, message: "Missing data" });
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

    // Join group
    app.post("/joinGroup", async (req, res) => {
      try {
        const joinedGroup = req.body;

        const existing = await joinedCollection.findOne({
          groupId: joinedGroup.groupId,
          userEmail: joinedGroup.userEmail,
        });

        if (existing) {
          return res
            .status(409)
            .json({ success: false, message: "Already joined" });
        }

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

    // Root route
    app.get("/", (req, res) => {
      res.send("🎉 Event Booking Server is Running!");
    });
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`🚀 Server is running on http://localhost:${port}`);
});
