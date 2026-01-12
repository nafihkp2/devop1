import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import '../components/Dashboard.css';
import { host } from "../utils/ApiRoutes";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState({});
  const [teamProjects, setTeamProjects] = useState({});
  const [expandedProjectId, setExpandedProjectId] = useState(null);
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const descRefs = useRef({});
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [currentEditingTeamId, setCurrentEditingTeamId] = useState(null); // Add this new state variable
  const [editProject, setEditProject] = useState({});
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

  // Fetch teams, projects, and notifications
  useEffect(() => {
    if (!userId) return;
    
    // Define fetchTeamProjects inside the effect
    const fetchTeamProjects = (teamId) => {
      axios.get(`${host}/api/dash/projects/${teamId}`)
        .then((response) => {
          setTeamProjects(prev => ({
            ...prev,
            [teamId]: response.data
          }));
          
          if (response.data.length > 0) {
            // Initialize form with empty values for new projects
            setProjects(prev => ({
              ...prev,
              [teamId]: {
                task: '',
                startDateTime: '',
                endDateTime: '',
                description: '',
                formattedDescription: '',
                priority: 'medium'
              }
            }));
          }
        })
        .catch((error) => console.error(`Error fetching projects for team ${teamId}:`, error));
    };
    
    // Set up headers based on user role
    const headers = {};
    if (userRole === 'admin' && userId) {
      headers['adminid'] = userId;
    } else if (userRole === 'hr' && userId) {
      headers['hrid'] = userId;
    } else if (userId) {
      headers['employeeid'] = userId;
    }
    
    // Always add userId header for other API calls
    headers['userid'] = userId;
    
    // Fetch teams
    axios.get(`${host}/api/dash/teams`, { headers })
      .then((response) => {
        console.log("Teams fetched:", response.data);
        setTeams(response.data);
        const initialProjects = response.data.reduce((acc, team) => ({
          ...acc,
          [team.id]: {
            task: '',
            startDateTime: '',
            endDateTime: '',
            description: '',
            formattedDescription: '',
            priority: 'medium'
          }
        }), {});
        setProjects(initialProjects);
        
        // Fetch existing projects for each team
        response.data.forEach(team => {
          fetchTeamProjects(team.id);
        });
      })
      .catch((error) => {
        console.error("Error fetching teams:", error);
        if (error.response) {
          console.error("Error details:", error.response.data);
        }
      });
      
    // Fetch notifications
    axios.get(`${host}/api/dash/notifications`, { headers })
      .then((response) => {
        console.log("Notifications fetched:", response.data);
        setNotifications(response.data);
      })
      .catch((error) => {
        console.error("Error fetching notifications:", error);
      });
      
  }, [userRole, userId]);

  // Format date for display
  const formatDateForDisplay = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Rich text formatting functions
  const formatText = (teamId, command) => {
    const div = descRefs.current[teamId];
    if (div) {
      div.focus();
      document.execCommand(command, false, null);
      const event = new Event('input', { bubbles: true });
      div.dispatchEvent(event);
    }
  };

  const updateDescription = (teamId, content) => {
    const selection = window.getSelection();
    const range = document.createRange();
    const div = descRefs.current[teamId];
    const cursorPosition = selection.anchorOffset;

    setProjects(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], formattedDescription: content }
    }));

    setTimeout(() => {
      if (div.childNodes.length > 0) {
        range.setStart(div.childNodes[0], Math.min(cursorPosition, div.childNodes[0].length));
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }, 0);
  };

  const startEditingProject = (projectId, teamId) => {
    setExpandedProjectId(null);
    setEditingProjectId(projectId);
    setCurrentEditingTeamId(teamId); // Set the current editing team ID
    
    axios.get(`${host}/api/dash/projects/detail/${projectId}`, { headers: { userid: userId } })
      .then(response => {
        setEditProject({
          teamId: teamId,
          task: response.data.task_name,
          startDateTime: response.data.start_datetime.slice(0, 16),
          endDateTime: response.data.end_datetime.slice(0, 16),
          description: response.data.description,
          formattedDescription: response.data.description,
          priority: response.data.priority,
          status: response.data.status
        });
      })
      .catch(error => {
        console.error("Error fetching project details:", error);
        setErrors(prev => ({
          ...prev,
          api: `Failed to fetch project details: ${error.response ? error.response.data.error : error.message}`
        }));
      });
  };

  const updateProject = () => {
    if (!editingProjectId) return;
    
    const newErrors = {};
    if (!editProject.task.trim()) newErrors.editTask = 'Task name is required';
    if (!editProject.startDateTime) newErrors.editStartDateTime = 'Start date is required';
    if (!editProject.endDateTime) newErrors.editEndDateTime = 'End date is required';
    if (editProject.startDateTime && editProject.endDateTime && 
        new Date(editProject.startDateTime) >= new Date(editProject.endDateTime)) {
      newErrors.editDateRange = 'End date must be after start date';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(prev => ({ ...prev, ...newErrors }));
      return;
    }
    
    const projectData = {
      task: editProject.task,
      startDateTime: editProject.startDateTime,
      endDateTime: editProject.endDateTime,
      description: editProject.formattedDescription,
      priority: editProject.priority,
      projectStatus: editProject.status 
    };
    
    const headers = { 'userid': userId };
    
    axios.put(`${host}/api/dash/projects/${editingProjectId}`, projectData, { headers })
      .then(response => {
        console.log("Project updated successfully:", response.data);
        setSuccessMessage(`Project "${editProject.task}" updated successfully!`);
        
        axios.get(`${host}/api/dash/projects/${editProject.teamId}`)
          .then((projectsResponse) => {
            setTeamProjects(prev => ({
              ...prev,
              [editProject.teamId]: projectsResponse.data
            }));
          });
          
        setEditingProjectId(null);
        setCurrentEditingTeamId(null); // Reset the current editing team ID
        setTimeout(() => setSuccessMessage(null), 3000);
      })
      .catch(error => {
        console.error("Error updating project:", error.response ? error.response.data : error.message);
        setErrors(prev => ({ 
          ...prev, 
          api: `Failed to update project: ${error.response ? error.response.data.error : error.message}`
        }));
      });
  };

  const handleEditInput = (field, value) => {
    setEditProject(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateEditDescription = (content) => {
    setEditProject(prev => ({
      ...prev,
      formattedDescription: content
    }));
  };

  const formatEditText = (command) => {
    const div = descRefs.current.editProject;
    if (div) {
      div.focus();
      document.execCommand(command, false, null);
      const event = new Event('input', { bubbles: true });
      div.dispatchEvent(event);
    }
  };
  // Form handlers
  const handleTaskInput = (teamId, value) => {
    setProjects(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], task: value }
    }));
  };

  const handleDateChange = (teamId, field, value) => {
    setProjects(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], [field]: value }
    }));
  };

  const handlePriorityChange = (teamId, value) => {
    setProjects(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], priority: value }
    }));
  };

  // Validation
  const validateProject = (teamId) => {
    const newErrors = {};
    const project = projects[teamId];
    
    if (!project.task.trim()) newErrors.task = 'Task name is required';
    if (!project.startDateTime) newErrors.startDateTime = 'Start date is required';
    if (!project.endDateTime) newErrors.endDateTime = 'End date is required';
    if (project.startDateTime && project.endDateTime && 
        new Date(project.startDateTime) >= new Date(project.endDateTime)) {
      newErrors.dateRange = 'End date must be after start date';
    }
    
    setErrors(prev => ({ ...prev, [teamId]: newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  // Save project to database
  const saveProject = (teamId) => {
    const project = projects[teamId];
    
    const projectData = {
      teamId: teamId,
      task: project.task,
      startDateTime: project.startDateTime,
      endDateTime: project.endDateTime,
      description: project.formattedDescription,
      priority: project.priority
    };

    console.log("Sending project data:", projectData);

    const headers = { 'userid': userId };

    axios.post(`${host}/api/dash/projects`, projectData, { headers })
      .then(response => {
        console.log("Project saved successfully:", response.data);
        setSuccessMessage(`Project "${project.task}" created successfully!`);
        
        // Reset form fields for new projects
        setProjects(prev => ({
          ...prev,
          [teamId]: {
            task: '',
            startDateTime: '',
            endDateTime: '',
            description: '',
            formattedDescription: '',
            priority: 'medium'
          }
        }));
        
        // Refresh projects for this team
        axios.get(`${host}/api/dash/projects/${teamId}`)
          .then((projectsResponse) => {
            setTeamProjects(prev => ({
              ...prev,
              [teamId]: projectsResponse.data
            }));
          });
          
        setTimeout(() => setSuccessMessage(null), 3000);
      })
      .catch(error => {
        console.error("Error saving project:", error.response ? error.response.data : error.message);
        setErrors(prev => ({ 
          ...prev, 
          [teamId]: { ...prev[teamId], api: `Failed to save project: ${error.response ? error.response.data.error : error.message}` } 
        }));
      });
  };

  // Mark project as complete
  const markProjectComplete = (projectId, teamId) => {
    const headers = { 'userid': userId };
    
    axios.put(`${host}/api/dash/projects/${projectId}/complete`, {}, { headers })
      .then(response => {
        console.log("Project completion response:", response.data);
        
        if (response.data.notificationId) {
          // Show message that request was sent
          setSuccessMessage(`Completion request sent to team owner for approval`);
        } else {
          // Show message that project was marked complete
          setSuccessMessage(`Project marked as complete successfully!`);
        }
        
        // Refresh projects for this team
        axios.get(`${host}/api/dash/projects/${teamId}`)
          .then((projectsResponse) => {
            setTeamProjects(prev => ({
              ...prev,
              [teamId]: projectsResponse.data
            }));
          });
          
        // Also refresh notifications
        axios.get(`${host}/api/dash/notifications`, { headers })
          .then((notificationsResponse) => {
            setNotifications(notificationsResponse.data);
          });
          
        setTimeout(() => setSuccessMessage(null), 3000);
      })
      .catch(error => {
        console.error("Error marking project complete:", error.response ? error.response.data : error.message);
        setErrors(prev => ({ 
          ...prev, 
          api: `Failed to mark project as complete: ${error.response ? error.response.data.error : error.message}`
        }));
        setTimeout(() => setErrors(prev => ({ ...prev, api: null })), 3000);
      });
  };

  // Delete project
  const deleteProject = (projectId, teamId) => {
    if (!window.confirm("Are you sure you want to delete this project?")) {
      return;
    }
    
    const headers = { 'userid': userId };
    
    axios.delete(`${host}/api/dash/projects/${projectId}`, { headers })
      .then(response => {
        console.log("Project deleted:", response.data);
        setSuccessMessage(`Project deleted successfully!`);
        
        // Refresh projects for this team
        axios.get(`${host}/api/dash/projects/${teamId}`)
          .then((projectsResponse) => {
            setTeamProjects(prev => ({
              ...prev,
              [teamId]: projectsResponse.data
            }));
          });
          
        setTimeout(() => setSuccessMessage(null), 3000);
      })
      .catch(error => {
        console.error("Error deleting project:", error.response ? error.response.data : error.message);
        setErrors(prev => ({ 
          ...prev, 
          api: `Failed to delete project: ${error.response ? error.response.data.error : error.message}`
        }));
        setTimeout(() => setErrors(prev => ({ ...prev, api: null })), 3000);
      });
  };

  // Handle notification action (approve/reject)
  const handleNotificationAction = (notificationId, projectId, action) => {
    const headers = { 'userid': userId };
    
    axios.put(`${host}/api/dash/projects/${projectId}/completion-request/${action}`, 
      { notificationId }, 
      { headers }
    )
      .then(response => {
        console.log("Notification action response:", response.data);
        setSuccessMessage(`Project completion request ${action}d successfully!`);
        
        // Refresh notifications
        axios.get(`${host}/api/dash/notifications`, { headers })
          .then((notificationsResponse) => {
            setNotifications(notificationsResponse.data);
          });
          
        // Refresh all team projects
        teams.forEach(team => {
          axios.get(`${host}/api/dash/projects/${team.id}`)
            .then((projectsResponse) => {
              setTeamProjects(prev => ({
                ...prev,
                [team.id]: projectsResponse.data
              }));
            });
        });
          
        setTimeout(() => setSuccessMessage(null), 3000);
      })
      .catch(error => {
        console.error("Error handling notification:", error.response ? error.response.data : error.message);
        setErrors(prev => ({ 
          ...prev, 
          api: `Failed to ${action} request: ${error.response ? error.response.data.error : error.message}`
        }));
        setTimeout(() => setErrors(prev => ({ ...prev, api: null })), 3000);
      });
  };

  // Confirm action
  const handleConfirm = (teamId) => {
    if (!validateProject(teamId)) return;
    saveProject(teamId);
    setExpandedIndex(null);
  };

  // Toggle project details
  const toggleProjectDetails = (projectId) => {
    if (expandedProjectId === projectId) {
      setExpandedProjectId(null);
    } else {
      setExpandedProjectId(projectId);
    }
  };

  // Determine priority color
  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return '';
    }
  };

  // Check if the user is the team creator
  const isTeamCreator = (teamCreatedBy) => {
    return userId === teamCreatedBy;
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
      <h1>Dashboard</h1>
      

      {userRole === 'hr' && (
        <div className="hr-section">
          <button onClick={() => navigate('/hr-reports')}>View Reports</button>
        </div>
      )}

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

      {teams.length === 0 ? (
        <div className="no-teams-message">
          <p>No teams found. Please create a team first.</p>
        </div>
      ) : (
        <div className="stats-container">
          {teams.map(team => (
            <div 
              className={`stat-card ${expandedIndex === team.id ? 'expanded' : ''}`} 
              key={team.id}
            >
              <h3>{team.team_name}</h3>
              <p>Team Lead: {team.teamLeadName || 'Not assigned'}</p>

              {/* Display existing projects */}
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
                            
                            {/* Only show delete button for team creators */}
                            {isTeamCreator(team.created_by) && (
                              <>
                              <button 
                                className="edit-project-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingProject(project.id, team.id);
                                }}
                              >
                                Edit Project
                              </button>
                              <button 
                                className="delete-project-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteProject(project.id, team.id);
                                }}
                              >
                                Delete Project
                              </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="no-projects">No projects assigned yet.</p>
                )}
              </div>

              {userRole !== 'employee' && (
                <>
                  <button 
                    className="add-project-btn" 
                    onClick={() => setExpandedIndex(expandedIndex === team.id ? null : team.id)}
                  >
                    + Add New Project
                  </button>

                  {expandedIndex === team.id && (
                    <div className="project-popup">
                      <div className="form-group">
                        <label>Task Name:</label>
                        <input
                          type="text"
                          value={projects[team.id]?.task || ''}
                          onChange={(e) => handleTaskInput(team.id, e.target.value)}
                          placeholder="Enter task name"
                          className={errors[team.id]?.task ? 'error' : ''}
                        />
                        {errors[team.id]?.task && 
                          <span className="error-message">{errors[team.id].task}</span>}
                      </div>

                      <div className="form-group">
                        <label>Priority</label>
                        <select
                          value={projects[team.id]?.priority || 'medium'}
                          onChange={(e) => handlePriorityChange(team.id, e.target.value)}
                          className="priority-select"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Schedule <span className="required">*</span></label>
                        <div className="datetime-picker">
                          <input
                            type="datetime-local"
                            value={projects[team.id]?.startDateTime || ''}
                            onChange={(e) => handleDateChange(team.id, 'startDateTime', e.target.value)}
                            className={errors[team.id]?.startDateTime ? 'error' : ''}
                          />
                          <span>to</span>
                          <input
                            type="datetime-local"
                            value={projects[team.id]?.endDateTime || ''}
                            min={projects[team.id]?.startDateTime}
                            onChange={(e) => handleDateChange(team.id, 'endDateTime', e.target.value)}
                            className={errors[team.id]?.endDateTime ? 'error' : ''}
                          />
                        </div>
                        {errors[team.id]?.dateRange && 
                          <span className="error-message">{errors[team.id].dateRange}</span>}
                      </div>

                      <div className="form-group">
                        <label>Description</label>
                        <div className="rich-text-toolbar">
                          <button onClick={() => formatText(team.id, 'bold')}>B</button>
                          <button onClick={() => formatText(team.id, 'italic')}>I</button>
                          <button onClick={() => formatText(team.id, 'underline')}>U</button>
                        </div>
                        <div
                          ref={el => (descRefs.current[team.id] = el)}
                          className="rich-text-editor"
                          contentEditable
                          onInput={(e) => updateDescription(team.id, e.currentTarget.innerHTML)}
                          dangerouslySetInnerHTML={{ __html: projects[team.id]?.formattedDescription || '' }}
                        />
                      </div>

                      <div className="action-buttons">
                        <button className="confirm-btn" onClick={() => handleConfirm(team.id)}>
                          Confirm
                        </button>
                      </div>
                      
                      {errors[team.id]?.api && 
                        <span className="error-message">{errors[team.id].api}</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Project Form - Moved outside the team mapping loop */}
      {editingProjectId && (
        <div className="project-popup edit-project-popup">
          <h3>Edit Project</h3>
          <div className="form-group">
            <label>Task Name:</label>
            <input
              type="text"
              value={editProject.task || ''}
              onChange={(e) => handleEditInput('task', e.target.value)}
              className={errors.editTask ? 'error' : ''}
            />
            {errors.editTask && <span className="error-message">{errors.editTask}</span>}
          </div>

          <div className="form-group">
            <label>Priority</label>
            <select
              value={editProject.priority || 'medium'}
              onChange={(e) => handleEditInput('priority', e.target.value)}
              className="priority-select"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="form-group">
            <label>Schedule</label>
            <div className="datetime-picker">
              <input
                type="datetime-local"
                value={editProject.startDateTime || ''}
                onChange={(e) => handleEditInput('startDateTime', e.target.value)}
              />
              <span>to</span>
              <input
                type="datetime-local"
                value={editProject.endDateTime || ''}
                min={editProject.startDateTime}
                onChange={(e) => handleEditInput('endDateTime', e.target.value)}
              />
            </div>
            {errors.editDateRange && <span className="error-message">{errors.editDateRange}</span>}
          </div>

          <div className="form-group">
            <label>Description</label>
            <div className="rich-text-toolbar">
              <button onClick={() => formatEditText('bold')}>B</button>
              <button onClick={() => formatEditText('italic')}>I</button>
              <button onClick={() => formatEditText('underline')}>U</button>
            </div>
            <div
              ref={el => (descRefs.current.editProject = el)}
              className="rich-text-editor"
              contentEditable
              onInput={(e) => updateEditDescription(e.currentTarget.innerHTML)}
              dangerouslySetInnerHTML={{ __html: editProject.formattedDescription || '' }}
            />
          </div>

          {/* Add this new form group for status */}
          <div className="form-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={editProject.status !== "completed"}
                onChange={(e) => handleEditInput('status', e.target.checked ? 'active' : 'completed')}
              />
              Mark as {editProject.status === "completed" ? "Active" : "Completed"}
            </label>
            {editProject.status === "completed" && (
              <span className="status-help-text">Unchecking this will reopen the project</span>
            )}
          </div>

          <div className="action-buttons">
            <button className="confirm-btn" onClick={updateProject}>
              Update Project
            </button>
            <button className="cancel-btn" onClick={() => {
              setEditingProjectId(null);
              setCurrentEditingTeamId(null);
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;