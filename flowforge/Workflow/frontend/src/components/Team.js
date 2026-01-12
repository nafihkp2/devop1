import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Team.css";
import { host } from "../utils/ApiRoutes";

const Team = () => {
  const navigate = useNavigate();
  const [teamName, setTeamName] = useState("");
  const [availableMembers, setAvailableMembers] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [teamLead, setTeamLead] = useState("");
  const [teams, setTeams] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [userTeamInfo, setUserTeamInfo] = useState({});
  const [hoveredUser, setHoveredUser] = useState(null);
  const [selectedMember, setSelectedMember] = useState(""); // For the dropdown

  // Fetch current user and team data on component mount
  useEffect(() => {
    // Get the user from localStorage (same as in Profile.js)
    const storedUser = JSON.parse(localStorage.getItem("user"));
    
    if (!storedUser) {
      // Redirect to login if no user found
      navigate("/login");
      return;
    }
    
    setLoading(true);
    setCurrentUser(storedUser);
    console.log("Current user:", storedUser);
    
    // Initialize the component with the authenticated user
    const initializeComponent = async () => {
      try {
        // Fetch available members based on user's role and relationships
        const membersResponse = await axios.get(
          `${host}/api/available-members/${storedUser.id}`
        );
        
        console.log("Available members:", membersResponse.data);
        setAvailableMembers(membersResponse.data);
        
        if (membersResponse.data.length === 0) {
          console.log("No available members returned from API");
        }
        
        // Fetch all users for reference (needed for display purposes)
        const usersResponse = await axios.get(`${host}/api/users`);
        setUsers(usersResponse.data);
        
        // Fetch existing teams
        await fetchTeams();

        // Fetch user team and project information
        const userTeamsResponse = await axios.get(`${host}/api/user-teams-info`);
        setUserTeamInfo(userTeamsResponse.data);
      } catch (error) {
        console.error("Error in initialization:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeComponent();
  }, [navigate]);

  // Function to fetch teams from backend
  const fetchTeams = async () => {
    try {
      const storedUser = JSON.parse(localStorage.getItem("user"));
      if (!storedUser || !storedUser.id) {
        console.error("No logged-in user found");
        return;
      }
  
      const response = await axios.get(`${host}/api/teams`, {
        headers: {
          "adminid": storedUser.id, // Send the user ID in the request header
        },
      });
  
      setTeams(response.data);
    } catch (error) {
      console.error("Error fetching teams:", error);
    }
  };
  
  // Handle adding a member from the dropdown
  const handleAddMember = () => {
    if (selectedMember && !selectedMembers.includes(parseInt(selectedMember))) {
      setSelectedMembers([...selectedMembers, parseInt(selectedMember)]);
      setSelectedMember(""); // Reset the dropdown after adding
    }
  };

  // Handle removing a member from the selected list
  const handleRemoveMember = (id) => {
    setSelectedMembers(selectedMembers.filter(memberId => memberId !== id));
    
    // If the removed member was the team lead, reset team lead
    if (parseInt(teamLead) === id) {
      setTeamLead("");
    }
  };

  // Handle form submission
  const handleCreateTeam = async () => {
    if (!teamName || selectedMembers.length === 0 || !teamLead) {
      alert("Please fill all fields before submitting.");
      return;
    }

    try {
      await axios.post(`${host}/api/create-team`, {
        teamName,
        members: selectedMembers,
        teamLead,
        createdBy: currentUser.id,    
      });
      
      alert("Team created successfully!");
      
      // Reset form fields after successful submission
      setTeamName("");
      setSelectedMembers([]);
      setTeamLead("");

      // Refresh the teams list to show the newly created team
      fetchTeams();
    } catch (error) {
      console.error("Error creating team:", error);
      alert("Failed to create team. Please try again.");
    }
  };

  // Function to delete a team
  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm("Are you sure you want to delete this team?")) return;

    try {
      await axios.delete(`${host}/api/delete-team/${teamId}`);
      alert("Team deleted successfully!");
      fetchTeams(); // Refresh the team list
    } catch (error) {
      console.error("Error deleting team:", error);
      alert("Failed to delete team. Please try again.");
    }
  };

  // Convert member IDs to names
  const getMemberNames = (memberIds) => {
    if (!memberIds) return "No Members";
    return memberIds.split(",").map(id => {
      const user = users.find(u => u.id === parseInt(id));
      return user ? user.name : `Unknown (${id})`;
    }).join(", ");
  };

  // Handle mouse over on user
  const handleMouseOver = (userId) => {
    setHoveredUser(userId);
  };

  // Handle mouse out on user
  const handleMouseOut = () => {
    setHoveredUser(null);
  };

  // Render team and project info tooltip for a user
  const renderUserTeamInfo = (userId) => {
    if (!userTeamInfo[userId] || userTeamInfo[userId].length === 0) {
      return <div className="user-team-tooltip">Not a member of any team with active projects</div>;
    }

    return (
      <div className="user-team-tooltip">
        <h4>Team Memberships:</h4>
        {userTeamInfo[userId].map((info, index) => (
          <div key={index} className="team-info-item">
            <div><strong>Team:</strong> {info.team_name}</div>
            {info.projects && info.projects.length > 0 ? (
              <>
                <div><strong>Active Projects:</strong></div>
                <ul className="project-list">
                  {info.projects.map((project, pidx) => (
                    <li key={pidx} className={`priority-${project.priority}`}>
                      {project.task_name} (Priority: {project.priority})
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div><em>No active projects</em></div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="team">
      <h2>Create a Team</h2>
      
      {loading ? (
        <p>Loading...</p>
      ) : !currentUser ? (
        <p>Please log in to continue</p>
      ) : (
        <>
          {/* Display current user info */}
          <div className="current-user-info">
            <p>Logged in as: {currentUser.name} ({currentUser.role})</p>
          </div>

          {/* Input for Team Name */}
          <div>
            <label>Team Name:</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name"
            />
          </div>

          {/* Select Members Section with Dropdown */}
          <h3>Select Members</h3>
          {availableMembers.length === 0 ? (
            <div className="no-members-message">
              <p>No members available. This could be because:</p>
              <ul>
                <li>You don't have any relationships established in the database</li>
                <li>You're logged in as an employee (employees can't create teams)</li>
              </ul>
              <p>Check the unified_relationships table to make sure proper relationships exist.</p>
            </div>
          ) : (
            <div className="member-selection">
              <div className="member-dropdown-container">
                <select 
                  value={selectedMember} 
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="member-dropdown"
                >
                  <option value="">Select a member</option>
                  {availableMembers.map((user) => (
                    // Only show members not already selected
                    !selectedMembers.includes(user.id) && (
                      <option key={user.id} value={user.id}>
                        {user.name}-{user.id}
                      </option>
                    )
                  ))}
                </select>
                <button 
                  onClick={handleAddMember} 
                  disabled={!selectedMember}
                  className="add-member-btn"
                >
                  Add Member
                </button>
              </div>

              {/* Display selected members */}
              <div className="selected-members">
                <h4>Selected Members:</h4>
                {selectedMembers.length === 0 ? (
                  <p>No members selected yet</p>
                ) : (
                  <ul className="selected-members-list">
                    {selectedMembers.map((id) => {
                      const member = availableMembers.find((u) => u.id === id);
                      return member ? (
                        <li key={id} className="selected-member-item">
                          <div 
                            className="member-info"
                            onMouseOver={() => handleMouseOver(id)}
                            onMouseOut={handleMouseOut}
                          >
                            <span>{member.name}-{member.id}</span>
                            <button 
                              onClick={() => handleRemoveMember(id)}
                              className="remove-member-btn"
                            >
                              Remove
                            </button>
                          </div>
                          {hoveredUser === id && renderUserTeamInfo(id)}
                        </li>
                      ) : null;
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}

          
          {/* Select Team Lead Section */}
          <h3>Select Team Lead</h3>
          <select value={teamLead} onChange={(e) => setTeamLead(e.target.value)}>
            <option value="">Select a Team Lead</option>
            {selectedMembers.map((id) => {
              const member = availableMembers.find((u) => u.id === id);
              return member ? (
                <option key={id} value={id}>
                  {`${member.name}-${member.id}`}
                </option>
              ) : null;
            })}
          </select>


          {/* Create Team Button */}
          <button 
            onClick={handleCreateTeam}
            disabled={availableMembers.length === 0}
          >
            Create Team
          </button>

          {/* Display Summary */}
          <div>
  <h3>Team Summary</h3>
  <p><strong>Team Name:</strong> {teamName || "N/A"}</p>
  <p>
    <strong>Members:</strong>{" "}
    {selectedMembers.length > 0
      ? selectedMembers
          .map((id) => {
            const member = availableMembers.find((u) => u.id === id);
            return member ? `${member.name}-${member.id}` : "Unknown";
          })
          .join(", ")
      : "None"}
  </p>
  <p>
    <strong>Team Lead:</strong>{" "}
    {teamLead
      ? (() => {
          const lead = availableMembers.find((u) => u.id === parseInt(teamLead));
          return lead ? `${lead.name}-${lead.id}` : "Unknown";
        })()
      : "None"}
  </p>
</div>

        </>
      )}

      {/* Display All Created Teams Below */}
      <div className="team-list">
        <h2>Existing Teams</h2>
        {teams.length === 0 ? (
          <p>No teams created yet.</p>
        ) : (
          <ul>
            {teams.map((team) => (
              <li key={team.id} className="team-item">
                <div className="team-header">
                  <strong>{team.team_name}</strong> 
                  <button
                    onClick={() => handleDeleteTeam(team.id)}
                    className="delete-btn"
                    style={{ backgroundColor: '#a70616', color: 'white' }}
                  >
                    Delete
                  </button>
                </div>
                <div className="team-details">
                  <p>Lead: {team.teamLeadName || team.team_lead}</p>
                  <p>Members: {team.memberNames ? team.memberNames.join(", ") : getMemberNames(team.members)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Team;