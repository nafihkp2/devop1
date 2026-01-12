require("dotenv").config();
const express = require("express");
const router = express.Router();
const mysql = require("mysql2");

router.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// API to create a new project
router.post("/projects", (req, res) => {
  console.log("Received project data:", req.body);
  const { teamId, task, startDateTime, endDateTime, description, priority } = req.body;
  const createdBy = req.headers['userid']; // Get the user who's creating the project
  
  // Validate required fields
  if (!teamId || !task || !startDateTime || !endDateTime) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  const query = `
    INSERT INTO projects (team_id, task_name, start_datetime, end_datetime, description, priority, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
  `;
  
  db.query(
    query,
    [teamId, task, startDateTime, endDateTime, description, priority, createdBy],
    (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ 
        id: result.insertId,
        message: "Project created successfully" 
      });
    }
  );
});

// NEW API: Update an existing project
router.put("/projects/:projectId", (req, res) => {
  const projectId = req.params.projectId;
  const { task, startDateTime, endDateTime, description, priority, projectStatus } = req.body;
  const requestingUserId = req.headers['userid'];
  
  // Validate required fields
  if (!task || !startDateTime || !endDateTime) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  // First check if the requesting user has permission to edit the project
  const checkPermissionQuery = `
    SELECT p.created_by AS project_creator, t.created_by AS team_creator, t.id AS team_id
    FROM projects p
    JOIN teams t ON p.team_id = t.id
    WHERE p.id = ?
  `;
  
  db.query(checkPermissionQuery, [projectId], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    const { project_creator, team_creator, team_id } = result[0];
    
    // Allow edit if user is either project creator or team creator
    if (requestingUserId != project_creator && requestingUserId != team_creator) {
      return res.status(403).json({ error: "You don't have permission to edit this project" });
    }
    
    // If user has permission, update the project
    const updateQuery = `
      UPDATE projects 
      SET task_name = ?, start_datetime = ?, end_datetime = ?, description = ?, priority = ?, 
          status = ?, completed_date = ${projectStatus === 'completed' ? 'NOW()' : 'NULL'}
      WHERE id = ?
    `;
    
    db.query(
      updateQuery,
      [task, startDateTime, endDateTime, description, priority, projectStatus, projectId],
      (err, updateResult) => {
        if (err) {
          console.error("Database error:", err);
          return res.status(500).json({ error: err.message });
        }
        
        if (updateResult.affectedRows === 0) {
          return res.status(404).json({ error: "Project not found" });
        }
        
        res.json({ 
          message: "Project updated successfully",
          projectId: projectId
        });
      }
    );
  });
});

// API to mark a project as complete
router.put("/projects/:projectId/complete", (req, res) => {
  const projectId = req.params.projectId;
  const requestingUserId = req.headers['userid']; // Get the user trying to complete the project
  
  // Modified query to fetch team lead information
  const checkCreatorQuery = `
    SELECT 
      p.created_by AS project_creator, 
      t.created_by AS team_creator, 
      t.id AS team_id,
      t.team_lead AS team_lead  /* Add this line to get team lead ID */
    FROM projects p
    JOIN teams t ON p.team_id = t.id
    WHERE p.id = ?
  `;
  
  db.query(checkCreatorQuery, [projectId], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    const { project_creator, team_creator, team_id, team_lead } = result[0];
    
    // If requesting user is the project creator or team creator, mark as complete immediately
    if (requestingUserId == project_creator || requestingUserId == team_creator) {
      completeProject(projectId, res);
    } 
    // Otherwise, create a notification for approval
    else {
      createCompletionRequest(projectId, requestingUserId, team_lead, team_id, res);
    }
  });
});

// Helper function to complete a project
function completeProject(projectId, res) {
  const query = `
    UPDATE projects 
    SET status = 'completed', completed_date = NOW() 
    WHERE id = ?
  `;
  
  db.query(query, [projectId], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: err.message });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    res.json({ 
      message: "Project marked as complete successfully",
      projectId: projectId
    });
  });
}

// Helper function to create a completion request notification
function createCompletionRequest(projectId, requestingUserId, approverUserId, teamId, res) {
  // First get the project name for the notification
  db.query("SELECT task_name FROM projects WHERE id = ?", [projectId], (err, projects) => {
    if (err || projects.length === 0) {
      return res.status(500).json({ error: err ? err.message : "Project not found" });
    }
    
    const projectName = projects[0].task_name;
    
    // Insert notification
    const notificationQuery = `
      INSERT INTO notifications (
        user_id, 
        type, 
        content, 
        status, 
        action_by, 
        related_project_id,
        related_team_id
      ) VALUES (?, 'completion_request', ?, 'pending', ?, ?, ?)
    `;
    
    const notificationContent = JSON.stringify({
      message: `Request to mark project "${projectName}" as complete`,
      projectId: projectId
    });
    
    db.query(
      notificationQuery, 
      [approverUserId, notificationContent, requestingUserId, projectId, teamId],
      (err, result) => {
        if (err) {
          console.error("Error creating notification:", err);
          return res.status(500).json({ error: err.message });
        }
        
        res.json({ 
          message: "Completion request sent to team lead for approval",
          projectId: projectId,
          notificationId: result.insertId
        });
      }
    );
  });
}

// New API to handle completion requests (approve/reject)
router.put("/projects/:projectId/completion-request/:action", (req, res) => {
  const { projectId, action } = req.params;
  const notificationId = req.body.notificationId;
  const userId = req.headers['userid'];
  
  // First verify the user has permission to approve/reject
  const verifyQuery = `
    SELECT p.id, n.id AS notification_id
    FROM projects p
    JOIN teams t ON p.team_id = t.id
    JOIN notifications n ON n.related_project_id = p.id
    WHERE p.id = ? AND n.id = ? AND n.user_id = ? AND n.status = 'pending'
  `;
  
  db.query(verifyQuery, [projectId, notificationId, userId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (result.length === 0) {
      return res.status(403).json({ error: "Unauthorized or notification not found" });
    }
    
    // Update notification status
    const notificationStatus = action === 'approve' ? 'approved' : 'rejected';
    db.query(
      "UPDATE notifications SET status = ?, processed_at = NOW() WHERE id = ?",
      [notificationStatus, notificationId],
      (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // If approved, complete the project
        if (action === 'approve') {
          completeProject(projectId, res);
        } else {
          res.json({ message: "Completion request rejected" });
        }
      }
    );
  });
});

// API to fetch projects for a specific team
router.get("/projects/:teamId", (req, res) => {
  const teamId = req.params.teamId;
  
  db.query(
    "SELECT * FROM projects WHERE team_id = ?",
    [teamId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(result);
    }
  );
});

// NEW API: Fetch a single project by ID
router.get("/projects/detail/:projectId", (req, res) => {
  const projectId = req.params.projectId;
  
  db.query(
    "SELECT * FROM projects WHERE id = ?",
    [projectId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      
      if (result.length === 0) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json(result[0]);
    }
  );
});

// API to delete a project (only for team creator)
router.delete("/projects/:projectId", (req, res) => {
  const projectId = req.params.projectId;
  const userId = req.headers['userid'];
  
  // Check if user has permission to delete the project
  const checkPermissionQuery = `
    SELECT p.id, t.created_by AS team_creator
    FROM projects p
    JOIN teams t ON p.team_id = t.id
    WHERE p.id = ?
  `;
  
  db.query(checkPermissionQuery, [projectId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (result.length === 0) {
      return res.status(404).json({ error: "Project not found" });
    }
    
    if (result[0].team_creator != userId) {
      return res.status(403).json({ error: "Only team creator can delete projects" });
    }
    
   // Delete the project
db.query("DELETE FROM projects WHERE id = ?", [projectId], (err, deleteResult) => {
  if (err) {
    return res.status(500).json({ error: err.message });
  }

  // Check if there are notifications related to this project
  db.query("SELECT COUNT(*) AS count FROM notifications WHERE related_project_id = ?", [projectId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (result[0].count > 0) {
      // If notifications exist, delete them
      db.query("DELETE FROM notifications WHERE related_project_id = ?", [projectId], (err) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
      });
    }

    res.json({ 
      message: "Project deleted successfully",
      projectId: projectId
    });
  });
});

  });
});

router.get("/teams", (req, res) => {
  try {
    const { adminid, hrid, userid } = req.headers;
    const userId = adminid || hrid || userid;

    if (!userId) {
      return res.status(400).json({ error: "No valid user ID provided" });
    }

    const query = `
      SELECT t.*, u.name AS teamLeadName
      FROM teams t
      LEFT JOIN users u ON t.team_lead = u.id
      WHERE t.created_by = ? 
         OR FIND_IN_SET(?, t.members) > 0 
         OR t.team_lead = ?
    `;

    const values = [userId, userId, userId];

    db.query(query, values, (err, result) => {
      if (err) {
        return res.status(500).json({ error: "Database error" });
      }
      res.json(result); // Instead of { success: true, teams: result }

    });

  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});




  // Fixed processTeamsQuery function to properly handle the response
  function processTeamsQuery(err, teamsResult, res) {
    if (err) {
      console.error("Database error in processTeamsQuery:", err);
      return res.status(500).json({ error: err.message });
    }
    
    console.log(`Processing ${teamsResult?.length || 0} teams`);
    
    if (!teamsResult || teamsResult.length === 0) {
      console.log("No teams found");
      return res.json([]);
    }
    
    db.query("SELECT id, name FROM users", (err, usersResult) => {
      if (err) {
        console.error("Error fetching users:", err);
        return res.status(500).json({ error: err.message });
      }
      
      const usersMap = usersResult.reduce((acc, user) => {
        acc[user.id] = user.name;
        return acc;
      }, {});
      
      const enhancedTeams = teamsResult.map(team => {
        const members = team.members ? team.members.split(',') : [];
        console.log(`Team ${team.id} members:`, members);
        
        return {
          ...team,
          teamLeadName: usersMap[team.team_lead] || `Unknown (ID: ${team.team_lead})`,
          memberNames: members.map(id => usersMap[id] || `Unknown (ID: ${id})`)
        };
      });
      
      console.log("Enhanced teams data:", enhancedTeams);
      res.json(enhancedTeams);
    });
  };

// API to get notifications for a user
router.get("/notifications", (req, res) => {
  const userId = req.headers['userid'];
  
  if (!userId) {
    return res.status(400).json({ error: "User ID required" });
  }
  
  const query = `
    SELECT n.*, 
           u.name AS action_by_name,
           p.task_name AS project_name
    FROM notifications n
    LEFT JOIN users u ON n.action_by = u.id
    LEFT JOIN projects p ON n.related_project_id = p.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
  `;
  
  db.query(query, [userId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.json(result);
  });
});

module.exports = router;