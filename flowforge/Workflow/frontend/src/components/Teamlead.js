import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./TeamLead.css";
import { host } from "../utils/ApiRoutes";

const TeamLeadView = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    
    if (!storedUser) {
      navigate("/login");
      return;
    }
    
    setCurrentUser(storedUser);
    
    const fetchData = async () => {
      try {
        // Fetch teams where user is team lead
        const teamsResponse = await axios.get(
          `${host}/api/teamlead/teams/${storedUser.id}`
        );
        
        // Fetch all users for member names
        const usersResponse = await axios.get(`${host}/api/users`);
        setUsers(usersResponse.data);
        
        setTeams(teamsResponse.data);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const getMemberNames = (memberIds) => {
    return memberIds.split(",").map(id => {
      const user = users.find(u => u.id === parseInt(id));
      return user ? `${user.name}-${id}` : `Unknown (ID: ${id})`;
    }).join(", ");
  };

  return (
    <div className="team-lead-view">
      <h2>My Team</h2>
      
      {loading ? (
        <p>Loading...</p>
      ) : !currentUser ? (
        <p>Please log in to continue</p>
      ) : (
        <>
          {teams.length === 0 ? (
            <p>You are not currently leading any teams.</p>
          ) : (
            teams.map(team => (
              <div key={team.id} className="team-card">
                <h3>{team.team_name}</h3>
                <div className="team-details">
                  <p><strong>Team Lead:</strong> {currentUser.name}-{currentUser.id}</p>
                  <p><strong>Members:</strong> {getMemberNames(team.members)}</p>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
};

export default TeamLeadView;