require("dotenv").config();
const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Get HR invite code - modified to ensure constant code per admin
router.get("/get-hr-invite/:admin_id", async (req, res) => {
    try {
        const { admin_id } = req.params;
        console.log("Fetching HR invite for admin:", admin_id);

        if (!admin_id) {
            return res.status(400).json({ success: false, message: "Admin ID is required" });
        }

        // First verify admin exists
        const [adminResult] = await pool.query(
            "SELECT * FROM users WHERE id = ? AND role = 'admin'", 
            [admin_id]
        );
        
        if (adminResult.length === 0) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        // Get existing invite code
        const [result] = await pool.query(
            "SELECT invite_code FROM admin_invites WHERE admin_id = ?", 
            [admin_id]
        );

        if (result.length > 0) {
            console.log("Found existing invite code:", result[0].invite_code);
            return res.json({ 
                success: true, 
                inviteCode: result[0].invite_code 
            });
        } else {
            // Create new permanent code for verified admin
            const newInviteCode = admin_id + "-" + Math.random().toString(36).substr(2, 8).toUpperCase();
            console.log("Generated new permanent invite code:", newInviteCode);
            
            await pool.query(
                "INSERT INTO admin_invites (admin_id, invite_code) VALUES (?, ?)", 
                [admin_id, newInviteCode]
            );
            
            return res.json({ 
                success: true, 
                inviteCode: newInviteCode 
            });
        }
    } catch (error) {
        console.error("Error fetching HR invite:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
        });
    }
});

// Add a new endpoint to get all admin relationships
router.get("/relationships/:admin_id", async (req, res) => {
    try {
        const { admin_id } = req.params;
        console.log("Fetching relationships for admin:", admin_id);

        if (!admin_id) {
            return res.status(400).json({ success: false, message: "Admin ID is required" });
        }

        // Verify admin exists
        const [adminResult] = await pool.query(
            "SELECT * FROM users WHERE id = ? AND role = 'admin'", 
            [admin_id]
        );
        
        if (adminResult.length === 0) {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        // Get all relationships where admin is involved
        const [relationships] = await pool.query(
            `SELECT ur.*, 
             hr.name as hr_name, hr.email as hr_email,
             emp.name as employee_name, emp.email as employee_email
             FROM unified_relationships ur 
             LEFT JOIN users hr ON ur.hr_id = hr.id
             LEFT JOIN users emp ON ur.employee_id = emp.id
             WHERE ur.admin_id = ?`,
            [admin_id]
        );

        return res.json({
            success: true,
            relationships: relationships
        });
    } catch (error) {
        console.error("Error fetching admin relationships:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
});

module.exports = router;