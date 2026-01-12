import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../components/Dashboard.css';
import { host } from "../utils/ApiRoutes";

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [teamProjects, setTeamProjects] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [expandedProjectId, setExpandedProjectId] = useState(null);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);

  // Fetch user role from localStorage
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user'));
    if (userData?.role) {
      setUserRole(userData.role);
      setUserId(userData.id);
    } else {
      navigate('/login');
    }
  }, [navigate]);

  // Fetch teams and projects
  useEffect(() => {
    if (!userId) return;
    
    fetchTeamsAndProjects();
    fetchNotifications();
  }, [userId]);

  const fetchTeamsAndProjects = async () => {
    try {
      const headers = { userid: userId };
      
      // Fetch teams the employee is part of
      const teamsResponse = await axios.get(`${host}/api/dash/teams`, { headers });
      setTeams(teamsResponse.data);

      // Fetch projects for each team
      const projectsResponses = await Promise.all(
        teamsResponse.data.map(team => 
          axios.get(`${host}/api/dash/projects/${team.id}`, { headers })
        )
      );
      
      const projectsData = teamsResponse.data.reduce((acc, team, index) => ({
        ...acc,
        [team.id]: projectsResponses[index].data
      }), {});
      setTeamProjects(projectsData);
    } catch (error) {
      console.error("Error fetching teams and projects:", error);
    }
  };

  const fetchNotifications = async () => {
    try {
      const headers = { userid: userId };
      const response = await axios.get(`${host}/api/dash/notifications`, { headers });
      setNotifications(response.data);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const formatDateForDisplay = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const markProjectComplete = (projectId, teamId) => {
    const headers = { userid: userId };
    
    axios.put(`${host}/api/dash/projects/${projectId}/complete`, {}, { headers })
      .then(response => {
        if (response.data.notificationId) {
          setSuccessMessage("Project completion request submitted successfully!");
        } else {
          setSuccessMessage("Project marked as complete successfully!");
        }
        
        // Refresh projects for this team
        axios.get(`${host}/api/dash/projects/${teamId}`, { headers })
          .then((projectsResponse) => {
            setTeamProjects(prev => ({
              ...prev,
              [teamId]: projectsResponse.data
            }));
          });
          
        setTimeout(() => setSuccessMessage(null), 3000);
      })
      .catch(error => {
        console.error("Error marking project complete:", error);
        setErrors(prev => ({ 
          ...prev, 
          api: `Failed to mark project as complete: ${error.response ? error.response.data.error : error.message}`
        }));
        setTimeout(() => setErrors(prev => ({ ...prev, api: null })), 3000);
      });
  };

  // Handle notification action (approve/reject)
  const handleNotificationAction = (notificationId, projectId, action) => {
    const headers = { userid: userId };
    
    axios.put(`${host}/api/dash/projects/${projectId}/completion-request/${action}`, 
      { notificationId }, 
      { headers }
    )
      .then(response => {
        setSuccessMessage(`Project completion request ${action}d successfully!`);
        
        // Refresh notifications
        fetchNotifications();
          
        // Refresh all team projects
        fetchTeamsAndProjects();
          
        setTimeout(() => setSuccessMessage(null), 3000);
      })
      .catch(error => {
        console.error("Error handling notification:", error);
        setErrors(prev => ({ 
          ...prev, 
          api: `Failed to ${action} request: ${error.response ? error.response.data.error : error.message}`
        }));
        setTimeout(() => setErrors(prev => ({ ...prev, api: null })), 3000);
      });
  };

  const toggleProjectDetails = (projectId) => {
    setExpandedProjectId(prev => prev === projectId ? null : projectId);
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  };

  // Parse notification content
  const parseNotificationContent = (contentString) => {
    try {
      return JSON.parse(contentString);
    } catch (e) {
      console.error("Error parsing notification content:", e);
      return { message: contentString };
    }
  };

  // Filter notifications for completion requests
  const completionRequestNotifications = notifications.filter(
    notification => notification.type === 'completion_request' && notification.status === 'pending'
  );

  return (
    <div className="dashboard">
      <h1>Employee Dashboard</h1>
      
      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      {errors.api && (
        <div className="error-message global-error">
          {errors.api}
        </div>
      )}

      {/* Pending Notifications Section */}
      {completionRequestNotifications.length > 0 && (
        <div className="notifications-section">
          <h3>Pending Approval Requests</h3>
          <div className="notifications-list">
            {completionRequestNotifications.map(notification => {
              const content = parseNotificationContent(notification.content);
              return (
                <div key={notification.id} className="notification-item">
                  <div className="notification-content">
                    <p>{content.message}</p>
                    <p className="notification-meta">
                      Requested by: {notification.action_by_name || 'Unknown'}
                    </p>
                  </div>
                  <div className="notification-actions">
                    <button 
                      className="approve-btn"
                      onClick={() => handleNotificationAction(notification.id, content.projectId, 'approve')}
                    >
                      Approve
                    </button>
                    <button 
                      className="reject-btn"
                      onClick={() => handleNotificationAction(notification.id, content.projectId, 'reject')}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h3>Your Assigned Teams</h3>
      {teams.length === 0 ? (
        <div className="no-teams-message">
          <p>No team assignments found</p>
        </div>
      ) : (
        <div className="stats-container">
          {teams.map(team => (
            <div className="stat-card" key={team.id}>
              <h3>{team.team_name}</h3>
              <p>Team Lead: {team.teamLeadName || 'Not assigned'} {team.teamLeadId && `(ID: ${team.teamLeadId})`}</p>

              <div className="projects-list">
                {teamProjects[team.id] && teamProjects[team.id].length > 0 ? (
                  teamProjects[team.id].map(project => (
                    <div key={project.id} className={`project-item ${project.status === 'completed' ? 'completed-project' : ''}`}>
                      <div 
                        className={`project-header ${getPriorityColor(project.priority)}`}
                        onClick={() => toggleProjectDetails(project.id)}
                      >
                        <div className="project-title">
                          {project.task_name}
                          {project.status === 'completed' && <span className="completed-tag">✓ Completed</span>}
                        </div>
                        <div className="project-priority">
                          Priority: {project.priority.charAt(0).toUpperCase() + project.priority.slice(1)}
                        </div>
                      </div>
                      
                      {expandedProjectId === project.id && (
                        <div className="project-details">
                          <div className="project-dates">
                            <div>Start: {formatDateForDisplay(project.start_datetime)}</div>
                            <div>End: {formatDateForDisplay(project.end_datetime)}</div>
                          </div>
                          <div className="project-description">
                            <div dangerouslySetInnerHTML={{ __html: project.description }} />
                          </div>
                          <div className="project-actions">
                            {project.status !== 'completed' && (
                              <button 
                                className="complete-project-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markProjectComplete(project.id, team.id);
                                }}
                              >
                                Mark Complete
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="no-projects">No projects assigned</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;