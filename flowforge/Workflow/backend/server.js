require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bodyParser = require("body-parser");
const teamRoutes = require("./routes/teamRoutes");

const dashboardRoutes = require("./routes/dashboardRoutes");
const adminRoutes = require("./routes/admin");
const authRoutes = require("./routes/auth");
const hrRoutes = require("./routes/hrRoutes");
const AnalyticRoutes = require("./routes/AnalyticRoutes");
const profileRoutes = require("./routes/ProfileRoutes");
const calendarRoutes = require("./routes/calenderRoutes");

const path = require('path');
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());
// Connect to MySQL
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to MySQL database!");
  connection.release(); // Release the connection back to the pool
});

// Signup API with access code validation
app.post("/api/signup", (req, res) => {
  const { username, email, password, role, accessCode } = req.body;
  
  // Validate input
  if (!username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  // Default role to 'employee' if not provided
  const userRole = role || "employee";

  // Check if user already exists
  const checkUserQuery = "SELECT * FROM users WHERE email = ?";
  db.query(checkUserQuery, [email], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Check if an access code is provided
    if (accessCode) {
      // First check admin_invites table
      db.query(
        "SELECT * FROM admin_invites WHERE invite_code = ?", 
        [accessCode], 
        (err, adminInvites) => {
          if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ message: "Database error" });
          }
          
          // Then check hr_invites table
          db.query(
            "SELECT * FROM hr_invites WHERE invite_code = ?", 
            [accessCode], 
            (err, hrInvites) => {
              if (err) {
                console.error("Database error:", err);
                return res.status(500).json({ message: "Database error" });
              }
              
              // Check if code exists in either table
              const validAdminCode = adminInvites.length > 0;
              const validHrCode = hrInvites.length > 0;
              
              if (!validAdminCode && !validHrCode) {
                return res.status(400).json({ message: "Invalid or expired access code" });
              }
              
              // Insert user with appropriate role
              // If HR role is requested, valid admin code is required
              if (userRole === "hr" && !validAdminCode) {
                return res.status(400).json({ message: "Invalid access code for HR registration" });
              }
              
              // Insert user
              db.query(
                "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)",
                [username, email, password, userRole],
                (err, result) => {
                  if (err) {
                    console.error("Database error:", err);
                    return res.status(500).json({ message: "Database error" });
                  }
                  
                  const newUserId = result.insertId;
                  
                  // Add relationship entry to unified_relationships table
                  if (userRole === "hr" && validAdminCode) {
                    const adminId = adminInvites[0].admin_id;
                    db.query(
                      "INSERT INTO unified_relationships (admin_id, hr_id, employee_id, relationship_type, invite_code) VALUES (?, ?, NULL, 'admin_hr', ?)",
                      [adminId, newUserId, accessCode],
                      (err) => {
                        if (err) {
                          console.error("Error adding relationship:", err);
                        }
                      }
                    );
                  } else if (userRole === "employee") {
                    if (validHrCode) {
                      const hrId = hrInvites[0].hr_id;
                      db.query(
                        "INSERT INTO unified_relationships (admin_id, hr_id, employee_id, relationship_type, invite_code) VALUES (NULL, ?, ?, 'hr_employee', ?)",
                        [hrId, newUserId, accessCode],
                        (err) => {
                          if (err) {
                            console.error("Error adding relationship:", err);
                          }
                        }
                      );
                    } else if (validAdminCode) {
                      const adminId = adminInvites[0].admin_id;
                      db.query(
                        "INSERT INTO unified_relationships (admin_id, hr_id, employee_id, relationship_type, invite_code) VALUES (?, NULL, ?, 'admin_hr', ?)",
                        [adminId, newUserId, accessCode],
                        (err) => {
                          if (err) {
                            console.error("Error adding relationship:", err);
                          }
                        }
                      );
                    }
                  }
                  
                  res.status(201).json({ 
                    message: `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} signup successful!` 
                  });
                }
              );
            }
          );
        }
      );
    } else if (userRole === "hr") {
      // HR registration requires an access code
      return res.status(400).json({ message: "Access code is required for HR registration" });
    } else {
      // Regular user signup without access code (for standard employees)
      const insertUserQuery = "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)";
      db.query(insertUserQuery, [username, email, password, userRole], (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ message: "Database error" });
        }

        res.status(201).json({ message: "Signup successful!" });
      });
    }
  });
});

// Login API
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const query = "SELECT id, name, email, role FROM users WHERE email = ? AND password = ?";
  db.query(query, [email, password], (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    
    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Return user data including role
    res.json({ message: "Login successful", user: results[0] });
  });
});

// Use routes
app.use("/api", teamRoutes);

app.use("/api/dash", dashboardRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/hr", hrRoutes);
app.use('/api/analytics', AnalyticRoutes);
app.use('/api/Profile', profileRoutes);
app.use("/api/cal", calendarRoutes);

// Add route to check access code (checks both admin and hr tables)
app.get("/api/check-access-code/:code", (req, res) => {
  const code = req.params.code;
  
  // Check admin_invites
  db.query(
    "SELECT * FROM admin_invites WHERE invite_code = ?",
    [code],
    (err, adminResults) => {
      if (err) return res.status(500).json({ error: "Database error" });
      
      // Check hr_invites
      db.query(
        "SELECT * FROM hr_invites WHERE invite_code = ?",
        [code],
        (err, hrResults) => {
          if (err) return res.status(500).json({ error: "Database error" });
          
          res.json({ 
            valid: adminResults.length > 0 || hrResults.length > 0,
            adminCode: { 
              found: adminResults.length,
              results: adminResults 
            },
            hrCode: {
              found: hrResults.length,
              results: hrResults
            }
          });
        }
      );
    }
  );
});

// Add new endpoint to check relationships
app.get("/api/relationships/:userId/:role", (req, res) => {
  const { userId, role } = req.params;
  
  let query = "";
  let params = [];
  
  if (role === "admin") {
    query = "SELECT * FROM unified_relationships WHERE admin_id = ?";
    params = [userId];
  } else if (role === "hr") {
    query = "SELECT * FROM unified_relationships WHERE hr_id = ?";
    params = [userId];
  } else if (role === "employee") {
    query = "SELECT * FROM unified_relationships WHERE employee_id = ?";
    params = [userId];
  } else {
    return res.status(400).json({ message: "Invalid role" });
  }
  
  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    
    res.json({ 
      success: true,
      relationships: results
    });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(5000, () => console.log("Backend running on port 5000"));