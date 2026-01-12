require("dotenv").config();
const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise"); // Use promise-based version

// Create a connection pool instead of a single connection
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 100,
  queueLimit: 0
});

// Generate employee invite code
router.post("/generate-employee-invite", async (req, res) => {
    try {
        const { hr_id } = req.body;
        console.log("Generating employee invite for HR:", hr_id);

        if (!hr_id) {
            return res.status(400).json({ success: false, message: "HR ID is required" });
        }

        // Validate HR user
        const [hrResult] = await pool.query(
            "SELECT * FROM users WHERE id = ? AND role = 'hr'", 
            [hr_id]
        );
        
        if (hrResult.length === 0) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const inviteCode = Math.random().toString(36).substr(2, 8).toUpperCase();
        console.log("Generated new invite code:", inviteCode);

        // Check if there's an existing invite for this HR
        const [existing] = await pool.query(
            "SELECT * FROM hr_invites WHERE hr_id = ?", 
            [hr_id]
        );

        let result;
        if (existing.length > 0) {
            // Update existing invite
            [result] = await pool.query(
                "UPDATE hr_invites SET invite_code = ? WHERE hr_id = ?",
                [inviteCode, hr_id]
            );
            console.log("Updated existing invite code");
        } else {
            // Create new invite
            [result] = await pool.query(
                "INSERT INTO hr_invites (hr_id, invite_code) VALUES (?, ?)",
                [hr_id, inviteCode]
            );
            console.log("Created new invite code");
        }

        return res.json({ 
            success: true, 
            inviteCode: inviteCode,
            message: "Employee invite code generated successfully"
        });
    } catch (error) {
        console.error("Error generating employee invite:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
        });
    }
});

// Get employee invite code
router.get("/get-employee-invite/:hr_id", async (req, res) => {
    try {
        const { hr_id } = req.params;
        console.log("Fetching employee invite for HR:", hr_id);

        if (!hr_id) {
            return res.status(400).json({ success: false, message: "HR ID is required" });
        }

        // Verify HR exists
        const [hrResult] = await pool.query(
            "SELECT * FROM users WHERE id = ? AND role = 'hr'", 
            [hr_id]
        );
        
        if (hrResult.length === 0) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        // Get existing invite code
        const [result] = await pool.query(
            "SELECT invite_code FROM hr_invites WHERE hr_id = ?", 
            [hr_id]
        );

        if (result.length > 0) {
            console.log("Found existing invite code:", result[0].invite_code);
            return res.json({ 
                success: true, 
                inviteCode: result[0].invite_code 
            });
        } else {
            // Create new code only for verified HR
            const newInviteCode = Math.random().toString(36).substr(2, 8).toUpperCase();
            console.log("Generated new invite code:", newInviteCode);
            
            await pool.query(
                "INSERT INTO hr_invites (hr_id, invite_code) VALUES (?, ?)", 
                [hr_id, newInviteCode]
            );
            
            return res.json({ 
                success: true, 
                inviteCode: newInviteCode 
            });
        }
    } catch (error) {
        console.error("Error fetching employee invite:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
        });
    }
});

// Get HR's employees - updated to use unified_relationships table
router.get("/employees/:hr_id", async (req, res) => {
    try {
        const { hr_id } = req.params;
        console.log("Fetching employees for HR:", hr_id);

        if (!hr_id) {
            return res.status(400).json({ success: false, message: "HR ID is required" });
        }

        // Verify HR exists
        const [hrResult] = await pool.query(
            "SELECT * FROM users WHERE id = ? AND role = 'hr'", 
            [hr_id]
        );
        
        if (hrResult.length === 0) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        // Get all employees associated with this HR from unified_relationships table
        const [employees] = await pool.query(
            `SELECT ur.*, u.name, u.email 
             FROM unified_relationships ur
             JOIN users u ON ur.employee_id = u.id
             WHERE ur.hr_id = ? AND ur.relationship_type = 'hr_employee'`,
            [hr_id]
        );

        return res.json({
            success: true,
            employees: employees
        });
    } catch (error) {
        console.error("Error fetching HR employees:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

module.exports = router;