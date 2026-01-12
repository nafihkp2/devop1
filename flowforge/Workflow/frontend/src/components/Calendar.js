import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Calendar.css';
import { host } from "../utils/ApiRoutes";

function BasicProjectCalendar() {
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
      setError("User ID not found. Please log in again.");
      setLoading(false);
      return;
    }
    const userId = user.id;
    const headers = { userid: userId };
    
    axios.get(`${host}/api/dash/teams`, { headers })
      .then(response => {
        setTeams(response.data);
        return response.data;
      })
      .then(teamsData => {
        const projectPromises = teamsData.map(team => 
          axios.get(`${host}/api/dash/projects/${team.id}`, { headers })
            .then(response => ({ 
              teamId: team.id, 
              teamName: team.name, 
              projects: response.data 
            }))
            .catch(err => {
              console.error(`Error fetching projects for team ${team.id}:`, err);
              return { teamId: team.id, teamName: team.name, projects: [] };
            })
        );
        return Promise.all(projectPromises);
      })
      .then(teamProjectsData => {
        let allProjects = [];
        teamProjectsData.forEach(teamData => {
          if (teamData?.projects?.length) {
            const teamProjects = teamData.projects.map(project => ({
              ...project,
              teamName: teamData.teamName,
              startDate: new Date(project.start_datetime),
              endDate: new Date(project.end_datetime)
            }));
            allProjects = [...allProjects, ...teamProjects];
          }
        });
        setProjects(allProjects);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching data:", err);
        setError(`Failed to load projects: ${err.message}`);
        setLoading(false);
      });
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return '#ffcccc';
      case 'medium': return '#ffffcc';
      case 'low': return '#ccffcc';
      default: return '#e6f2ff';
    }
  };

  const generateCalendarDays = (date) => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startDay = startOfMonth.getDay();

    const calendarDays = [];

    // Previous month days
    const prevMonthEnd = new Date(startOfMonth);
    prevMonthEnd.setDate(0);
    for (let i = startDay - 1; i >= 0; i--) {
      calendarDays.push({
        date: new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), prevMonthEnd.getDate() - i),
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= endOfMonth.getDate(); i++) {
      calendarDays.push({
        date: new Date(date.getFullYear(), date.getMonth(), i),
        isCurrentMonth: true
      });
    }

    // Next month days
    const daysNeeded = 42 - calendarDays.length; // 6 weeks
    for (let i = 1; i <= daysNeeded; i++) {
      calendarDays.push({
        date: new Date(endOfMonth.getFullYear(), endOfMonth.getMonth() + 1, i),
        isCurrentMonth: false
      });
    }

    // Split into weeks
    const weeks = [];
    while (calendarDays.length) weeks.push(calendarDays.splice(0, 7));
    return weeks;
  };

  if (loading) return <div>Loading projects...</div>;
  if (error) return <div className="error-message">{error}</div>;
  if (projects.length === 0) return <div>No projects found.</div>;

  // Create projects by date map
  const projectsByDate = {};
  projects.forEach(project => {
    const currentDay = new Date(project.startDate);
    while (currentDay <= project.endDate) {
      const dateKey = currentDay.toISOString().split('T')[0];
      if (!projectsByDate[dateKey]) projectsByDate[dateKey] = [];
      projectsByDate[dateKey].push(project);
      currentDay.setDate(currentDay.getDate() + 1);
    }
  });

  const weeks = generateCalendarDays(currentDate);

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button onClick={handlePrevMonth}>&lt;</button>
        <h2>
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h2>
        <button onClick={handleNextMonth}>&gt;</button>
      </div>
      
      <div className="calendar-grid">
        <div className="weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="weekday">{day}</div>
          ))}
        </div>
        
        {weeks.map((week, wi) => (
          <div key={wi} className="week-row">
            {week.map((day, di) => {
              const dateKey = day.date.toISOString().split('T')[0];
              const dayProjects = projectsByDate[dateKey] || [];
              
              return (
                <div 
                  key={di} 
                  className={`day-cell ${!day.isCurrentMonth ? 'other-month' : ''}`}
                >
                  <div className="date-number">{day.date.getDate()}</div>
                  <div className="projects-container">
                    {dayProjects.map(project => (
                      <div
                        key={project.id}
                        className="project-event"
                        style={{ 
                          backgroundColor: getPriorityColor(project.priority),
                          textDecoration: project.status === 'completed' ? 'line-through' : 'none'
                        }}
                        title={`${project.task_name} (${project.teamName})`}
                      >
                        {project.task_name}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default BasicProjectCalendar;