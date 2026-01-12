require("dotenv").config();
const express = require("express");
const router = express.Router();

const mysql = require("mysql2");
const app = express();
const bcrypt = require("bcrypt");

app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
});

// Signup route with employee and HR registration handling
router.post("/signup", async (req, res) => {
    try {
        const { username, email, password, role, accessCode } = req.body;
        
        console.log("Signup request received:", { username, email, role, accessCodeProvided: !!accessCode });
        
        // Validate required fields
        if (!username || !email || !password) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Check if user with this email already exists
        const [existingUsers] = await db.promise().query(
            "SELECT * FROM users WHERE email = ?", 
            [email]
        );
        
        if (existingUsers.length > 0) {
            return res.status(400).json({ message: "Email already in use" });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Special handling for HR registration
        if (role === "hr") {
            // Validate access code is provided
            if (!accessCode) {
                return res.status(400).json({ message: "Access code is required for HR registration" });
            }
            
            // Check if the access code exists and is valid
            const [invites] = await db.promise().query(
                "SELECT * FROM admin_invites WHERE invite_code = ?", 
                [accessCode]
            );
            
            console.log("HR access code check:", { accessCode, validInvites: invites.length });
            
            // Check if we actually got a valid access code result
            if (!invites || invites.length === 0) {
                return res.status(400).json({ message: "Invalid or expired HR access code" });
            }
            
            const admin_id = invites[0].admin_id;
            console.log("Admin ID from invite:", admin_id);
            
            // Start a transaction to ensure data consistency
            const connection = await db.promise().getConnection();
            await connection.beginTransaction();
            
            try {
                // Insert the new HR user, including the admin_id who invited them
                console.log("Inserting HR user with admin reference:", admin_id);
                const [insertResult] = await connection.query(
                    "INSERT INTO users (name, email, password, role, invited_by_admin) VALUES (?, ?, ?, 'hr', ?)", 
                    [username, email, hashedPassword, admin_id]
                );
                
                const newUserId = insertResult.insertId;
                console.log("New HR user created with ID:", newUserId);
                
                // Track the relationship in a separate table for better querying
                console.log("Adding admin-HR relationship to tracking table");
                const [relationResult] = await connection.query(
                    "INSERT INTO admin_hr_relationships (admin_id, hr_id, invite_code) VALUES (?, ?, ?)",
                    [admin_id, newUserId, accessCode]
                );
                console.log("Relationship tracking result:", relationResult.insertId);
                
                // Removed: Mark the invite code as used
                // This is the key change to allow reuse of access codes
                
                // Commit the transaction
                await connection.commit();
                connection.release();
                console.log("Transaction committed successfully");
                
                return res.status(201).json({ 
                    success: true, 
                    message: "HR registration successful",
                    userId: newUserId,
                    invitedBy: admin_id
                });
            } catch (error) {
                // If any error occurs, rollback the transaction
                console.error("Transaction error:", error);
                await connection.rollback();
                connection.release();
                throw error;
            }
        } 
        // Special handling for employee registration
        else if (role === "employee") {
            // Validate access code is provided
            if (!accessCode) {
                return res.status(400).json({ message: "Access code is required for employee registration" });
            }
            
            // First check HR invites table
            const [hrInvites] = await db.promise().query(
                "SELECT * FROM hr_invites WHERE invite_code = ?", 
                [accessCode]
            );
            
            // If not found in hr_invites, check admin_invites as well
            let hr_id;
            let inviteSource;
            
            if (hrInvites && hrInvites.length > 0) {
                // Found in HR invites
                hr_id = hrInvites[0].hr_id;
                inviteSource = "hr";
                console.log("HR ID from HR invite:", hr_id);
            } else {
                // Check admin_invites as fallback
                const [adminInvites] = await db.promise().query(
                    "SELECT * FROM admin_invites WHERE invite_code = ?", 
                    [accessCode]
                );
                
                if (!adminInvites || adminInvites.length === 0) {
                    return res.status(400).json({ message: "Invalid or expired employee access code" });
                }
                
                hr_id = adminInvites[0].admin_id;
                inviteSource = "admin";
                console.log("Admin ID used as HR reference:", hr_id);
            }
            
            console.log("Employee access code check:", { accessCode, inviteSource });
            
            // Start a transaction to ensure data consistency
            const connection = await db.promise().getConnection();
            await connection.beginTransaction();
            
            try {
                // Insert the new employee user, including who invited them
                console.log(`Inserting employee user with ${inviteSource} reference:`, hr_id);
                
                let insertResult;
                if (inviteSource === "hr") {
                    [insertResult] = await connection.query(
                        "INSERT INTO users (name, email, password, role, invited_by_hr) VALUES (?, ?, ?, 'employee', ?)", 
                        [username, email, hashedPassword, hr_id]
                    );
                } else {
                    [insertResult] = await connection.query(
                        "INSERT INTO users (name, email, password, role, invited_by_admin) VALUES (?, ?, ?, 'employee', ?)", 
                        [username, email, hashedPassword, hr_id]
                    );
                }
                
                const newUserId = insertResult.insertId;
                console.log("New employee user created with ID:", newUserId);
                
                // Track the relationship in appropriate table
                if (inviteSource === "hr") {
                    console.log("Adding HR-employee relationship to tracking table");
                    const [relationResult] = await connection.query(
                        "INSERT INTO hr_employee_relationships (hr_id, employee_id, invite_code) VALUES (?, ?, ?)",
                        [hr_id, newUserId, accessCode]
                    );
                    console.log("Relationship tracking result:", relationResult.insertId);
                } else {
                    console.log("Adding Admin-employee relationship to tracking table");
                    const [relationResult] = await connection.query(
                        "INSERT INTO admin_hr_relationships (admin_id, employee_id, invite_code) VALUES (?, ?, ?)",
                        [hr_id, newUserId, accessCode]
                    );
                    console.log("Relationship tracking result:", relationResult.insertId);
                }
                
                // Removed: Mark the invite code as used
                // This is the key change to allow reuse of access codes
                
                // Commit the transaction
                await connection.commit();
                connection.release();
                console.log("Transaction committed successfully");
                
                return res.status(201).json({ 
                    success: true, 
                    message: "Employee registration successful",
                    userId: newUserId,
                    invitedBy: {
                        id: hr_id,
                        type: inviteSource
                    }
                });
            } catch (error) {
                // If any error occurs, rollback the transaction
                console.error("Transaction error:", error);
                await connection.rollback();
                connection.release();
                throw error;
            }
        } else {
            // Handle admin registration (without access code)
            console.log("Inserting admin user");
            const [result] = await db.promise().query(
                "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", 
                [username, email, hashedPassword, role]
            );
            
            console.log("Admin user created with ID:", result.insertId);
            
            return res.status(201).json({ 
                success: true, 
                message: "Signup successful!",
                userId: result.insertId
            });
        }
    } catch (error) {
        console.error("Signup error:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
});

// Add a test endpoint to verify database connection and table structure
router.get("/test-db", async (req, res) => {
    try {
        // Check users table
        const [users] = await db.promise().query("SHOW COLUMNS FROM users");
        
        // Check relationship tables
        const [adminHrRelations] = await db.promise().query("SHOW COLUMNS FROM admin_hr_relationships");
        const [hrEmployeeRelations] = await db.promise().query("SHOW COLUMNS FROM hr_employee_relationships");
        
        // Check invite tables
        const [adminInvites] = await db.promise().query("SHOW COLUMNS FROM admin_invites");
        const [hrInvites] = await db.promise().query("SHOW COLUMNS FROM hr_invites");
        
        res.status(200).json({
            success: true,
            message: "Database tables verified",
            tables: {
                users: users.map(col => col.Field),
                adminHrRelations: adminHrRelations.map(col => col.Field),
                hrEmployeeRelations: hrEmployeeRelations.map(col => col.Field),
                adminInvites: adminInvites.map(col => col.Field),
                hrInvites: hrInvites.map(col => col.Field)
            }
        });
    } catch (error) {
        console.error("Database test error:", error);
        res.status(500).json({
            success: false,
            message: "Database verification failed",
            error: error.message
        });
    }
});

module.exports = router;