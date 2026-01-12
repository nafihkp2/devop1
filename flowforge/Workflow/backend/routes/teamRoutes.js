require("dotenv").config();
const express = require("express");
const router = express.Router();
const mysql = require("mysql2");
const app = express();

app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  port: process.env.DB_PORT,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Current user endpoint
router.get("/current-user", (req, res) => {
  const userId = req.session?.userId || 1;
  
  db.query("SELECT id, name, role FROM users WHERE id = ?", [userId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(result[0]);
  });
});

// Available members endpoint
router.get("/available-members/:userId", (req, res) => {
  const userId = req.params.userId;
  
  db.query("SELECT id, name, role FROM users WHERE id = ?", [userId], (err, userResult) => {
    if (err) return res.status(500).json({ error: err.message });
    if (userResult.length === 0) return res.status(404).json({ error: "User not found" });

    const user = userResult[0];
    if (user.role === 'admin') {
      const hrQuery = `
        SELECT u.id, u.name, u.role 
        FROM users u
        JOIN unified_relationships ur ON u.id = ur.hr_id
        WHERE ur.admin_id = ? AND ur.relationship_type = 'admin_hr'
      `;
      
      db.query(hrQuery, [userId], (err, hrResult) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (hrResult.length === 0 && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV)) {
          db.query("SELECT id, name, role FROM users WHERE role = 'hr'", (err, fallbackHrResult) => {
            res.json(fallbackHrResult || []);
          });
          return;
        }
        
        if (hrResult.length > 0) {
          const hrIds = hrResult.map(hr => hr.id);
          const employeeQuery = `
            SELECT u.id, u.name, u.role, ur.hr_id AS managed_by_hr
            FROM users u
            JOIN unified_relationships ur ON u.id = ur.employee_id
            WHERE ur.hr_id IN (?) AND ur.relationship_type = 'hr_employee'
          `;
          
          db.query(employeeQuery, [hrIds], (err, employeeResult) => {
            const combinedResults = [
              ...hrResult.map(hr => ({...hr, is_direct_report: true})),
              ...employeeResult.map(emp => ({...emp, is_direct_report: false}))
            ];
            res.json(combinedResults);
          });
        } else {
          res.json([]);
        }
      });
    } else if (user.role === 'hr') {
      const query = `
        SELECT u.id, u.name, u.role 
        FROM users u
        JOIN unified_relationships ur ON u.id = ur.employee_id
        WHERE ur.hr_id = ? AND ur.relationship_type = 'hr_employee'
      `;
      
      db.query(query, [userId], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        if (result.length === 0 && (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV)) {
          db.query("SELECT id, name, role FROM users WHERE role = 'employee'", (err, fallbackResult) => {
            res.json(fallbackResult || []);
          });
        } else {
          res.json(result);
        }
      });
    } else {
      res.json([]);
    }
  });
});

// User endpoints
router.get("/users/:id", (req, res) => {
  const userId = req.params.id;
  db.query("SELECT id, name, role FROM users WHERE id = ?", [userId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(result[0]);
  });
});

router.get("/users", (req, res) => {
  db.query("SELECT id, name, role FROM users", (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(result);
  });
});

// New endpoint to get user team memberships and active projects
router.get("/user-teams-info", (req, res) => {
  // First, get all users
  db.query("SELECT id FROM users", (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (users.length === 0) return res.json({});
    
    // Process each user to get their team and project info
    let userTeamInfo = {};
    let processedUsers = 0;
    
    users.forEach(user => {
      // Find all teams the user is a member of
      const query = `
        SELECT t.id, t.team_name, t.team_lead
        FROM teams t
        WHERE FIND_IN_SET(?, t.members) > 0 OR t.team_lead = ?
      `;
      
      db.query(query, [user.id, user.id], (err, teams) => {
        if (!err && teams.length > 0) {
          // Initialize user entry in result object
          userTeamInfo[user.id] = [];
          
          let processedTeams = 0;
          
          // For each team, find active projects
          teams.forEach(team => {
            const projectQuery = `
              SELECT id, task_name, priority
              FROM projects
              WHERE team_id = ? AND status = 'active'
            `;
            
            db.query(projectQuery, [team.id], (err, projects) => {
              if (!err) {
                userTeamInfo[user.id].push({
                  team_id: team.id,
                  team_name: team.team_name,
                  is_lead: team.team_lead == user.id,
                  projects: projects || []
                });
              }
              
              processedTeams++;
              if (processedTeams === teams.length) {
                processedUsers++;
                if (processedUsers === users.length) {
                  res.json(userTeamInfo);
                }
              }
            });
          });
        } else {
          // User is not a member of any team
          userTeamInfo[user.id] = [];
          
          processedUsers++;
          if (processedUsers === users.length) {
            res.json(userTeamInfo);
          }
        }
      });
    });
  });
});

// Team management endpoints
router.post("/create-team", (req, res) => {
  const { teamName, members, teamLead, createdBy } = req.body;
  const membersList = members.join(",");
  db.query(
    "INSERT INTO teams (team_name, team_lead, members, created_by) VALUES (?, ?, ?, ?)",
    [teamName, teamLead, membersList, createdBy],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Team created successfully" });
    }
  );
});

router.get("/teams", (req, res) => {
  const loggedInAdminId = req.headers["adminid"]; // Get admin ID from request headers

  if (!loggedInAdminId) {
    return res.status(400).json({ error: "Admin ID is required" });
  }

  db.query("SELECT * FROM teams WHERE created_by = ?", [loggedInAdminId], (err, teamsResult) => {
    if (err) return res.status(500).json({ error: err.message });

    db.query("SELECT id, name FROM users", (err, usersResult) => {
      if (err) return res.status(500).json({ error: err.message });

      const usersMap = usersResult.reduce((acc, user) => {
        acc[user.id] = user.name;
        return acc;
      }, {});

      const enhancedTeams = teamsResult.map(team => ({
        ...team,
        teamLeadName: usersMap[team.team_lead] || `Unknown (ID: ${team.team_lead})`,
        memberNames: team.members.split(',').map(id => usersMap[id] || `Unknown (ID: ${id})`)
      }));

      res.json(enhancedTeams);
    });
  });
});

router.get("/teams/:userId", (req, res) => {
  const userId = req.params.userId;

  // Fetch user details
  db.query("SELECT id, name, role FROM users WHERE id = ?", [userId], (err, userResult) => {
    if (err) return res.status(500).json({ error: err.message });
    if (userResult.length === 0) return res.status(404).json({ error: "User not found" });

    const user = userResult[0];
    let teamsQuery = "";
    let queryParams = [];

    if (user.role === 'admin') {
      teamsQuery = `
        SELECT DISTINCT t.* FROM teams t
        WHERE t.created_by = ? 
        UNION
        SELECT DISTINCT t.* FROM teams t
        JOIN unified_relationships ur ON t.created_by = ur.hr_id
        WHERE ur.admin_id = ? AND ur.relationship_type = 'admin_hr'
      `;
      queryParams = [userId, userId];
    } else if (user.role === 'hr') {
      teamsQuery = `
  SELECT DISTINCT t.*, 
    CASE 
      WHEN t.created_by = ? THEN 'created'
      WHEN FIND_IN_SET(?, t.members) > 0 OR t.team_lead = ? THEN 'member'
      ELSE 'admin_created'
    END AS team_source
  FROM teams t
  WHERE 
    t.created_by = ?
    OR FIND_IN_SET(?, t.members) > 0 
    OR t.team_lead = ?
    OR EXISTS (
      SELECT 1 FROM unified_relationships ur 
      WHERE ur.hr_id = ? 
      AND ur.admin_id = t.created_by 
      AND ur.relationship_type = 'admin_hr'
    )
    OR (FIND_IN_SET(?, t.members) > 0 AND t.created_by IN (SELECT id FROM users WHERE role = 'admin'))
`;
queryParams = [userId, userId, userId, userId, userId, userId, userId, userId];
} else if (user.role === 'employee') {
  teamsQuery = `
    SELECT t.* 
    FROM teams t
    WHERE t.team_lead = ?
  `;
  queryParams = [userId];
}

    db.query(teamsQuery, queryParams, (err, teamsResult) => {
      if (err) return res.status(500).json({ error: err.message });

      // Fetch user names for team leads and members
      db.query("SELECT id, name FROM users", (err, usersResult) => {
        if (err) return res.status(500).json({ error: err.message });

        const usersMap = usersResult.reduce((acc, user) => {
          acc[user.id] = user.name;
          return acc;
        }, {});

        // Format team data with teamLeadName and memberNames
        const enhancedTeams = teamsResult.map(team => ({
          ...team,
          teamLeadName: usersMap[team.team_lead] || `Unknown (ID: ${team.team_lead})`,
          memberNames: team.members.split(',').map(id => usersMap[id] || `Unknown (ID: ${id})`)
          
        }));

        res.json(enhancedTeams);
      });
    });
  });
});


router.get("/teamlead/teams/:userId", (req, res) => {
    const userId = req.params.userId;
  
    // Fetch user details
    db.query("SELECT id, name, role FROM users WHERE id = ?", [userId], (err, userResult) => {
      if (err) return res.status(500).json({ error: err.message });
      if (userResult.length === 0) return res.status(404).json({ error: "User not found" });
  
      const user = userResult[0];
      let teamsQuery = "";
      let queryParams = [];
  
     if (user.role === 'hr') {
        teamsQuery = `
        SELECT t.* 
      FROM teams t
      WHERE t.team_lead = ?
  `;
  queryParams = [userId];
  } else if (user.role === 'employee') {
    teamsQuery = `
      SELECT t.* 
      FROM teams t
      WHERE t.team_lead = ?
    `;
    queryParams = [userId];
  }
  
      db.query(teamsQuery, queryParams, (err, teamsResult) => {
        if (err) return res.status(500).json({ error: err.message });
  
        // Fetch user names for team leads and members
        db.query("SELECT id, name FROM users", (err, usersResult) => {
          if (err) return res.status(500).json({ error: err.message });
  
          const usersMap = usersResult.reduce((acc, user) => {
            acc[user.id] = user.name;
            return acc;
          }, {});
  
          // Format team data with teamLeadName and memberNames
          const enhancedTeams = teamsResult.map(team => ({
            ...team,
            teamLeadName: usersMap[team.team_lead] || `Unknown (ID: ${team.team_lead})`,
            memberNames: team.members.split(',').map(id => usersMap[id] || `Unknown (ID: ${id})`)
            
          }));
  
          res.json(enhancedTeams);
        });
      });
    });
  });

  
router.delete("/delete-team/:id", (req, res) => {
  const teamId = req.params.id;
  db.query("DELETE FROM teams WHERE id = ?", [teamId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Team deleted successfully" });
  });
});



module.exports = router;