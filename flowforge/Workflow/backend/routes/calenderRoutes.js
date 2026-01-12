require("dotenv").config();
const express = require("express");
const router = express.Router();
const mysql = require("mysql2");

router.use(express.json());

// Create database pool connection
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 100,
  queueLimit: 0
});

// Helper function to get user ID from request headers
const getUserId = (req) => {
  // Check headers in a case-insensitive way
  const headers = req.headers;
  const userId = headers['adminid'] || headers['hrid'] || headers['userid'] ||
                 headers['adminId'] || headers['hrId'] || headers['userId'];
  
  if (!userId) {
    console.error('No user ID found in headers:', headers);
  }
  
  return userId;
};

// API to fetch calendar data for a specific month/year
router.get("/calendar", async (req, res) => {
  try {
    const userId = getUserId(req);
    
    if (!userId) {
      return res.status(400).json({ error: "User ID required" });
    }
    
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: "Year and month parameters are required" });
    }
  
    // Get the first and last day of the specified month
    const monthStr = String(month).padStart(2, '0');
    const startDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, parseInt(month), 0).getDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  
    // Query to get all projects for user's teams within the date range
    const projectsQuery = `
      SELECT 
        p.*, 
        t.name AS team_name, 
        u.name AS created_by_name,
        COUNT(DISTINCT m.id) AS milestone_count,
        COUNT(DISTINCT c.id) AS comment_count
      FROM projects p
      JOIN teams t ON p.team_id = t.id
      JOIN users u ON p.created_by = u.id
      LEFT JOIN milestones m ON p.id = m.project_id
      LEFT JOIN comments c ON p.id = c.project_id
      WHERE (
        t.created_by = ? 
        OR FIND_IN_SET(?, t.members) > 0 
        OR t.team_lead = ?
      )
      AND (
        (p.start_datetime BETWEEN ? AND ?) 
        OR (p.end_datetime BETWEEN ? AND ?) 
        OR (p.start_datetime <= ? AND p.end_datetime >= ?)
      )
      GROUP BY p.id
      ORDER BY p.start_datetime
    `;
  
    db.query(
      projectsQuery, 
      [userId, userId, userId, startDate, endDate, startDate, endDate, startDate, endDate],
      (err, projects) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ 
            error: "Database error", 
            details: err.message
          });
        }
        
        // Process dates for frontend use
        const processedProjects = projects.map(project => {
          return {
            ...project,
            start_datetime: project.start_datetime,
            end_datetime: project.end_datetime,
            // Calculate status if needed
            calculated_days_left: Math.ceil((new Date(project.end_datetime) - new Date()) / (1000 * 60 * 60 * 24)),
            calculated_progress: project.status === 'completed' ? 100 : 
                                Math.min(100, Math.max(0, Math.round(
                                  ((new Date() - new Date(project.start_datetime)) / 
                                  (new Date(project.end_datetime) - new Date(project.start_datetime))) * 100
                                )))
          };
        });
        
        // Build a calendar structure with days of the month
        const daysInMonth = new Date(year, month, 0).getDate();
        const calendar = [];
        
        for (let day = 1; day <= daysInMonth; day++) {
          const currentDate = `${year}-${monthStr}-${String(day).padStart(2, '0')}`;
          const dayProjects = processedProjects.filter(project => {
            const projectStart = new Date(project.start_datetime);
            const projectEnd = new Date(project.end_datetime);
            const dayDate = new Date(currentDate);
            
            // Check if the current day falls within project dates
            return (dayDate >= projectStart && dayDate <= projectEnd);
          });
          
          calendar.push({
            date: currentDate,
            dayOfMonth: day,
            dayOfWeek: new Date(currentDate).getDay(),
            projects: dayProjects.map(project => ({
              id: project.id,
              name: project.task_name,
              priority: project.priority,
              status: project.status,
              teamName: project.team_name,
              progress: project.calculated_progress
            }))
          });
        }
        
        // Get summary statistics for the month
        const statsQuery = `
          SELECT 
            COUNT(*) AS total_projects,
            SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_projects,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_projects,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_projects,
            COUNT(DISTINCT team_id) AS team_count
          FROM projects p
          JOIN teams t ON p.team_id = t.id
          WHERE (
            t.created_by = ? 
            OR FIND_IN_SET(?, t.members) > 0 
            OR t.team_lead = ?
          )
          AND (
            (p.start_datetime BETWEEN ? AND ?) 
            OR (p.end_datetime BETWEEN ? AND ?) 
            OR (p.start_datetime <= ? AND p.end_datetime >= ?)
          )
        `;
        
        db.query(
          statsQuery,
          [userId, userId, userId, startDate, endDate, startDate, endDate, startDate, endDate],
          (statsErr, statsResult) => {
            if (statsErr) {
              console.error("Stats error:", statsErr);
              // Still return projects even if stats fail
              return res.json({
                calendar,
                projects: processedProjects
              });
            }
            
            const stats = statsResult[0] || {};
            
            res.json({
              calendar,
              projects: processedProjects,
              monthStats: {
                totalProjects: stats.total_projects || 0,
                activeProjects: stats.active_projects || 0,
                completedProjects: stats.completed_projects || 0,
                pendingProjects: stats.pending_projects || 0,
                teamCount: stats.team_count || 0
              }
            });
          }
        );
      }
    );
  } catch (err) {
    console.error("Full error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      details: err.message 
    });
  }
});

router.get("/calendar/timeline", (req, res) => {
  const userId = getUserId(req);
  const { start_date, end_date } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: "User ID required" });
  }
  
  if (!start_date || !end_date) {
    return res.status(400).json({ error: "Date range parameters are required" });
  }
  
  // Query to get all projects for user's teams within the date range
  const projectsQuery = `
    SELECT 
      p.*, 
      t.id AS team_id, 
      t.name AS team_name, 
      u.name AS created_by_name,
      COUNT(DISTINCT m.id) AS milestone_count
    FROM projects p
    JOIN teams t ON p.team_id = t.id
    JOIN users u ON p.created_by = u.id
    LEFT JOIN milestones m ON p.id = m.project_id
    WHERE (
      t.created_by = ? 
      OR FIND_IN_SET(?, t.members) > 0 
      OR t.team_lead = ?
    )
    AND (
      (p.start_datetime BETWEEN ? AND ?) 
      OR (p.end_datetime BETWEEN ? AND ?) 
      OR (p.start_datetime <= ? AND p.end_datetime >= ?)
    )
    GROUP BY p.id, t.id, t.name, u.name
    ORDER BY t.name, p.start_datetime
  `;
  
  db.query(
    projectsQuery, 
    [userId, userId, userId, start_date, end_date, start_date, end_date, start_date, end_date],
    (err, projects) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ 
          error: "Database error", 
          details: err.message
        });
      }
      
      // Process dates for frontend use
      const processedProjects = projects.map(project => {
        return {
          ...project,
          start_datetime: project.start_datetime,
          end_datetime: project.end_datetime,
          // Calculate status if needed
          calculated_days_left: Math.ceil((new Date(project.end_datetime) - new Date()) / (1000 * 60 * 60 * 24)),
          calculated_progress: project.status === 'completed' ? 100 : 
                              Math.min(100, Math.max(0, Math.round(
                                ((new Date() - new Date(project.start_datetime)) / 
                                (new Date(project.end_datetime) - new Date(project.start_datetime))) * 100
                              )))
        };
      });
      
      // Group projects by team
      const teamMap = {};
      
      processedProjects.forEach(project => {
        const teamId = project.team_id;
        
        if (!teamMap[teamId]) {
          teamMap[teamId] = {
            team_id: teamId,
            team_name: project.team_name,
            projects: []
          };
        }
        
        teamMap[teamId].projects.push(project);
      });
      
      // Convert map to array
      const teams = Object.values(teamMap);
      
      res.json(teams);
    }
  );
});

// API to fetch project details by ID
router.get("/calendar/project/:id", (req, res) => {
  const userId = getUserId(req);
  const projectId = req.params.id;
  
  if (!userId) {
    return res.status(400).json({ error: "User ID required" });
  }
  
  if (!projectId) {
    return res.status(400).json({ error: "Project ID is required" });
  }
  
  // Query to get project details including milestones
  const projectQuery = `
    SELECT 
      p.*,
      t.name AS team_name,
      u.name AS created_by_name
    FROM projects p
    JOIN teams t ON p.team_id = t.id
    JOIN users u ON p.created_by = u.id
    WHERE p.id = ?
    AND (
      t.created_by = ? 
      OR FIND_IN_SET(?, t.members) > 0 
      OR t.team_lead = ?
    )
  `;
  
  db.query(
    projectQuery,
    [projectId, userId, userId, userId],
    (err, projectResults) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ 
          error: "Database error", 
          details: err.message
        });
      }
      
      if (!projectResults || projectResults.length === 0) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      const project = projectResults[0];
      
      // Get milestones for this project
      const milestonesQuery = `
        SELECT * FROM milestones 
        WHERE project_id = ? 
        ORDER BY due_date
      `;
      
      db.query(
        milestonesQuery,
        [projectId],
        (mErr, milestones) => {
          if (mErr) {
            // Still return project if milestones query fails
            return res.json({
              ...project,
              milestones: []
            });
          }
          
          // Get comments for this project
          const commentsQuery = `
            SELECT c.*, u.name AS user_name, u.profile_picture 
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.project_id = ?
            ORDER BY c.created_at DESC
            LIMIT 10
          `;
          
          db.query(
            commentsQuery,
            [projectId],
            (cErr, comments) => {
              // Return project with all related data
              res.json({
                ...project,
                milestones: milestones || [],
                comments: comments || [],
                calculated_days_left: Math.ceil((new Date(project.end_datetime) - new Date()) / (1000 * 60 * 60 * 24)),
                calculated_progress: project.status === 'completed' ? 100 : 
                                    Math.min(100, Math.max(0, Math.round(
                                      ((new Date() - new Date(project.start_datetime)) / 
                                      (new Date(project.end_datetime) - new Date(project.start_datetime))) * 100
                                    )))
              });
            }
          );
        }
      );
    }
  );
});

// API to fetch month statistics
router.get("/calendar/stats", (req, res) => {
  const userId = getUserId(req);
  const { year, month } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: "User ID required" });
  }
  
  if (!year || !month) {
    return res.status(400).json({ error: "Year and month parameters are required" });
  }
  
  // Get the first and last day of the specified month
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, parseInt(month), 0).getDate();
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  
  // Query to get summary statistics for the month
  const statsQuery = `
    SELECT 
      COUNT(*) AS total_projects,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_projects,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed_projects,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_projects,
      COUNT(DISTINCT team_id) AS team_count,
      SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) AS high_priority_count,
      SUM(CASE WHEN priority = 'medium' THEN 1 ELSE 0 END) AS medium_priority_count,
      SUM(CASE WHEN priority = 'low' THEN 1 ELSE 0 END) AS low_priority_count
    FROM projects p
    JOIN teams t ON p.team_id = t.id
    WHERE (
      t.created_by = ? 
      OR FIND_IN_SET(?, t.members) > 0 
      OR t.team_lead = ?
    )
    AND (
      (p.start_datetime BETWEEN ? AND ?) 
      OR (p.end_datetime BETWEEN ? AND ?) 
      OR (p.start_datetime <= ? AND p.end_datetime >= ?)
    )
  `;
  
  db.query(
    statsQuery,
    [userId, userId, userId, startDate, endDate, startDate, endDate, startDate, endDate],
    (err, statsResult) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ 
          error: "Database error", 
          details: err.message
        });
      }
      
      const stats = statsResult[0] || {};
      
      res.json({
        monthStats: {
          totalProjects: stats.total_projects || 0,
          activeProjects: stats.active_projects || 0,
          completedProjects: stats.completed_projects || 0,
          pendingProjects: stats.pending_projects || 0,
          teamCount: stats.team_count || 0,
          highPriorityCount: stats.high_priority_count || 0,
          mediumPriorityCount: stats.medium_priority_count || 0,
          lowPriorityCount: stats.low_priority_count || 0
        }
      });
    }
  );
});

module.exports = router;