require("dotenv").config();
const express = require("express");
const router = express.Router();
const mysql = require("mysql2/promise");

// Database connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Middleware to verify user is authenticated
const authenticateUser = async (req, res, next) => {
  const userId = req.headers.userid;
  
  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  // Store userId in request for use in route handlers
  req.userId = userId;
  next();
};

// Apply authentication middleware to all routes
router.use(authenticateUser);

// Get overall project completion statistics (only for teams created by the user)
router.get("/overall", async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        COUNT(*) AS total_projects,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_projects,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_projects,
        ROUND((SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) AS completion_rate,
        AVG(TIMESTAMPDIFF(DAY, start_datetime, IFNULL(completed_date, NOW()))) AS avg_duration_days
      FROM projects p
      JOIN teams t ON p.team_id = t.id
      WHERE t.created_by = ?
    `, [req.userId]);
    
    res.json(results[0]);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get completion statistics by team (only for teams created by the user)
router.get("/by-team", async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        t.id AS team_id,
        t.team_name AS team_name,
        COUNT(p.id) AS total_projects,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) AS completed_projects,
        ROUND((SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) / COUNT(p.id)) * 100, 2) AS completion_rate,
        AVG(TIMESTAMPDIFF(DAY, p.start_datetime, IFNULL(p.completed_date, NOW()))) AS avg_duration_days
      FROM teams t
      LEFT JOIN projects p ON t.id = p.team_id
      WHERE t.created_by = ?
      GROUP BY t.id
      ORDER BY completion_rate DESC
    `, [req.userId]);
    
    res.json(results);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get completion timeline data (only for teams created by the user)
router.get("/timeline", async (req, res) => {
  const { period = 'month', count = 6 } = req.query;
  const parsedCount = parseInt(count, 10);
  if (isNaN(parsedCount)) {
    return res.status(400).json({ error: "Invalid count value" });
  }
  
  let timeFormat, groupBy;
  if (period === 'day') {
    timeFormat = '%Y-%m-%d';
    groupBy = 'DAY';
  } else if (period === 'week') {
    timeFormat = '%Y-%u';
    groupBy = 'WEEK';
  } else if (period === 'month') {
    timeFormat = '%Y-%m';
    groupBy = 'MONTH';
  } else {
    return res.status(400).json({ error: "Invalid period. Use 'day', 'week', or 'month'" });
  }
  
  try {
    const [results] = await db.query(`
      SELECT 
        DATE_FORMAT(p.completed_date, ?) AS time_period,
        COUNT(*) AS completed_count
      FROM projects p
      JOIN teams t ON p.team_id = t.id
      WHERE p.status = 'completed'
      AND p.completed_date IS NOT NULL
      AND p.completed_date >= DATE_SUB(CURDATE(), INTERVAL ? ${groupBy})
      AND t.created_by = ?
      GROUP BY time_period
      ORDER BY MIN(p.completed_date)
    `, [timeFormat,parsedCount, req.userId]);
    
    res.json(results);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get project completion by priority (only for teams created by the user)
router.get("/by-priority", async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        p.priority,
        COUNT(*) AS total_projects,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) AS completed_projects,
        ROUND((SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) AS completion_rate,
        AVG(TIMESTAMPDIFF(DAY, p.start_datetime, IFNULL(p.completed_date, NOW()))) AS avg_duration_days
      FROM projects p
      JOIN teams t ON p.team_id = t.id
      WHERE p.priority IS NOT NULL
      AND t.created_by = ?
      GROUP BY p.priority
      ORDER BY FIELD(p.priority, 'high', 'medium', 'low')
    `, [req.userId]);
    
    res.json(results);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get user performance analytics (only for teams created by the user)
router.get("/user-performance", async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        u.id AS user_id,
        u.name AS user_name,
        COUNT(DISTINCT p.id) AS assigned_projects,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) AS completed_projects,
        ROUND((SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) / COUNT(DISTINCT p.id)) * 100, 2) AS completion_rate,
        AVG(TIMESTAMPDIFF(DAY, p.start_datetime, IFNULL(p.completed_date, NOW()))) AS avg_duration_days
      FROM users u
      JOIN teams t ON (FIND_IN_SET(u.id, t.members) > 0 OR t.team_lead = u.id)
      JOIN projects p ON t.id = p.team_id
      WHERE t.created_by = ?
      GROUP BY u.id
      ORDER BY completion_rate DESC
    `, [req.userId]);
    
    res.json(results);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get completion status by task duration (only for teams created by the user)
router.get("/by-duration", async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        CASE 
          WHEN TIMESTAMPDIFF(DAY, p.start_datetime, p.end_datetime) <= 7 THEN '0-7 days'
          WHEN TIMESTAMPDIFF(DAY, p.start_datetime, p.end_datetime) <= 14 THEN '8-14 days'
          WHEN TIMESTAMPDIFF(DAY, p.start_datetime, p.end_datetime) <= 30 THEN '15-30 days'
          ELSE '30+ days'
        END AS duration_bucket,
        COUNT(*) AS total_projects,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) AS completed_projects,
        ROUND((SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) AS completion_rate
      FROM projects p
      JOIN teams t ON p.team_id = t.id
      WHERE t.created_by = ?
      GROUP BY duration_bucket
      ORDER BY FIELD(duration_bucket, '0-7 days', '8-14 days', '15-30 days', '30+ days')
    `, [req.userId]);
    
    res.json(results);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get analytics for a specific team (only if created by the user)
router.get("/team/:teamId", async (req, res) => {
  const teamId = req.params.teamId;
  
  try {
    // Verify user has access to this team
    const [teamAccess] = await db.query(
      "SELECT id FROM teams WHERE id = ? AND created_by = ?", 
      [teamId, req.userId]
    );
    
    if (teamAccess.length === 0) {
      return res.status(403).json({ error: "Access denied to this team's data" });
    }
    
    // Get basic team stats
    const [teamStats] = await db.query(`
      SELECT 
        COUNT(*) AS total_projects,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_projects,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_projects,
        ROUND((SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) AS completion_rate,
        AVG(TIMESTAMPDIFF(DAY, start_datetime, IFNULL(completed_date, NOW()))) AS avg_duration_days
      FROM projects
      WHERE team_id = ?
    `, [teamId]);
    
    // Get completion trend over time for this team
    const [completionTrend] = await db.query(`
      SELECT 
        DATE_FORMAT(completed_date, '%Y-%m') AS month,
        COUNT(*) AS completed_count
      FROM projects
      WHERE team_id = ?
      AND status = 'completed'
      AND completed_date IS NOT NULL
      AND completed_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY month
      ORDER BY month
    `, [teamId]);
    
    // Get member performance within this team
    const [memberPerformance] = await db.query(`
      SELECT 
        u.id AS user_id,
        u.name AS user_name,
        COUNT(DISTINCT p.id) AS assigned_projects,
        SUM(CASE WHEN p.status = 'completed' AND p.created_by = u.id THEN 1 ELSE 0 END) AS completed_projects
      FROM teams t
      JOIN users u ON FIND_IN_SET(u.id, t.members) > 0 OR t.team_lead = u.id
      LEFT JOIN projects p ON t.id = p.team_id
      WHERE t.id = ?
      GROUP BY u.id
    `, [teamId]);
    
    res.json({
      teamStats: teamStats[0],
      completionTrend,
      memberPerformance
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get detailed analytics dashboard data (only for teams created by the user)
router.get("/dashboard", async (req, res) => {
  try {
    // Run multiple queries concurrently
    const [overallStats, teamStats, timeline, priorityStats, durationStats] = await Promise.all([
      db.query(`
        SELECT 
          COUNT(*) AS total_projects,
          SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) AS completed_projects,
          SUM(CASE WHEN p.status = 'active' THEN 1 ELSE 0 END) AS active_projects,
          ROUND((SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) AS completion_rate
        FROM projects p
        JOIN teams t ON p.team_id = t.id
        WHERE t.created_by = ?
      `, [req.userId]),
      db.query(`
        SELECT 
          t.id AS team_id,
          t.team_name AS team_name,
          COUNT(p.id) AS total_projects,
          SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) AS completed_projects
        FROM teams t
        LEFT JOIN projects p ON t.id = p.team_id
        WHERE t.created_by = ?
        GROUP BY t.id
        ORDER BY COUNT(p.id) DESC
        LIMIT 5
      `, [req.userId]),
      db.query(`
        SELECT 
          DATE_FORMAT(p.completed_date, '%Y-%m') AS time_period,
          COUNT(*) AS completed_count
        FROM projects p
        JOIN teams t ON p.team_id = t.id
        WHERE p.status = 'completed'
        AND p.completed_date IS NOT NULL
        AND p.completed_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        AND t.created_by = ?
        GROUP BY time_period
        ORDER BY time_period
      `, [req.userId]),
      db.query(`
        SELECT 
          p.priority,
          COUNT(*) AS total_projects,
          SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) AS completed_projects
        FROM projects p
        JOIN teams t ON p.team_id = t.id
        WHERE p.priority IS NOT NULL
        AND t.created_by = ?
        GROUP BY p.priority
      `, [req.userId]),
      db.query(`
        SELECT 
          CASE 
            WHEN TIMESTAMPDIFF(DAY, p.start_datetime, p.end_datetime) <= 7 THEN '0-7 days'
            WHEN TIMESTAMPDIFF(DAY, p.start_datetime, p.end_datetime) <= 14 THEN '8-14 days'
            WHEN TIMESTAMPDIFF(DAY, p.start_datetime, p.end_datetime) <= 30 THEN '15-30 days'
            ELSE '30+ days'
          END AS duration_bucket,
          COUNT(*) AS total_projects,
          SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) AS completed_projects
        FROM projects p
        JOIN teams t ON p.team_id = t.id
        WHERE t.created_by = ?
        GROUP BY duration_bucket
        ORDER BY FIELD(duration_bucket, '0-7 days', '8-14 days', '15-30 days', '30+ days')
      `, [req.userId])
    ]);
    
    res.json({
      overallStats: overallStats[0][0],
      teamStats: teamStats[0],
      timeline: timeline[0],
      priorityStats: priorityStats[0],
      durationStats: durationStats[0]
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});
// Add these new routes to your existing AnalyticRoutes.js

// Get all ongoing projects for HR view
router.get("/hr/ongoing-projects", async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        p.id AS project_id,
        p.task_name AS project_name,
        p.description,
        p.start_datetime,
        p.end_datetime,
        p.priority,
        p.status,
        t.id AS team_id,
        t.team_name,
        (SELECT name FROM users WHERE id = t.team_lead) AS team_lead_name,
        GROUP_CONCAT(DISTINCT u.name SEPARATOR ', ') AS team_members
      FROM projects p
      JOIN teams t ON p.team_id = t.id
      JOIN users u ON FIND_IN_SET(u.id, t.members) > 0
      WHERE p.status IN ('active', 'completed')
      AND (t.created_by = ? OR FIND_IN_SET(?, t.members) > 0 OR t.team_lead = ?)
      GROUP BY p.id
      ORDER BY p.end_datetime ASC
    `, [req.userId, req.userId, req.userId]);
    
    res.json(results);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Get detailed project report for PDF generation
router.get("/hr/project-report/:projectId", async (req, res) => {
  const projectId = req.params.projectId;
  
  try {
    // Verify HR has access to this project
    const [accessCheck] = await db.query(`
      SELECT 1 FROM projects p
      JOIN teams t ON p.team_id = t.id
      WHERE p.id = ?
      AND (t.created_by = ? OR FIND_IN_SET(?, t.members) > 0 OR t.team_lead = ?)
    `, [projectId, req.userId, req.userId, req.userId]);
    
    if (accessCheck.length === 0) {
      return res.status(403).json({ error: "Access denied to this project" });
    }

    // Get project details
    const [projectDetails] = await db.query(`
      SELECT 
        p.id AS project_id,
        p.task_name AS project_name,
        p.description,
        p.start_datetime,
        p.end_datetime,
        p.priority,
        p.status,
        t.id AS team_id,
        t.team_name,
        (SELECT name FROM users WHERE id = t.team_lead) AS team_lead_name
      FROM projects p
      JOIN teams t ON p.team_id = t.id
      WHERE p.id = ?
    `, [projectId]);

    // Get team members
    const [teamMembers] = await db.query(`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role
      FROM teams t
      JOIN users u ON FIND_IN_SET(u.id, t.members) > 0 OR t.team_lead = u.id
      WHERE t.id = ?
    `, [projectDetails[0].team_id]);
    // Get tasks with completion status
    const [tasks] = await db.query(`
       SELECT 
        id,
        title,
        description,
        priority,
        status,
        due_date,
        created_at
      FROM tasks
      WHERE project_id = ?
      ORDER BY 
        FIELD(priority, 'high', 'medium', 'low') DESC,
        due_date ASC
    `, [projectId]);
    if (!projectDetails.length) {
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({
      project: projectDetails[0],
      teamMembers,
      tasks
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});
// Get projects for calendar view (only pending/active projects)
router.get("/calendar-projects", async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        p.id,
        p.task_name AS title,
        p.start_datetime AS start,
        p.end_datetime AS end,
        p.priority,
        p.status,
        t.team_name,
        p.description
      FROM projects p
      JOIN teams t ON p.team_id = t.id
      WHERE p.status = 'active'
      AND (t.created_by = ? 
        OR t.team_lead = ?
        OR FIND_IN_SET(?, t.members) > 0)
      ORDER BY p.start_datetime
    `, [req.userId, req.userId, req.userId]);
    
    res.json(results);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;