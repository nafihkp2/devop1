import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import './TaskAnalyticsStyles.css';
import { host } from "../utils/ApiRoutes";
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell 
} from 'recharts';

// Colors for charts
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
const PRIORITY_COLORS = {
  high: '#FF8042',
  medium: '#FFBB28',
  low: '#00C49F'
};

const TaskAnalyticsDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState({
    overallStats: {},
    teamStats: [],
    timeline: [],
    priorityStats: [],
    durationStats: []
  });
  const [ongoingProjects, setOngoingProjects] = useState([]);
  const [selectedProjectForReport, setSelectedProjectForReport] = useState(null);
  const [projectReportData, setProjectReportData] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamAnalytics, setTeamAnalytics] = useState(null);
  const [timelinePeriod, setTimelinePeriod] = useState('month');
  const [userPerformance, setUserPerformance] = useState([]);
  const [viewMode, setViewMode] = useState('dashboard');

  // Get user ID from auth context or localStorage
  const storedUser = JSON.parse(localStorage.getItem("user")) || {};
  const userId = storedUser.id || '';

  // Create axios instance with default headers
  const  api = axios.create({
    baseURL: `${host}`,
    headers: {
      'userid': userId
    }
  });
  useEffect(() => {
    const fetchOngoingProjects = async () => {
      if (viewMode !== 'hr-projects' || !userId) return;
      
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/api/analytics/hr/ongoing-projects');
        setOngoingProjects(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching ongoing projects:', error);
        setError(error.response?.data?.error || 'Failed to load ongoing projects');
        setLoading(false);
      }
    };
  
    fetchOngoingProjects();
  }, [userId, viewMode]);
  // Fetch dashboard analytics
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/api/analytics/dashboard');
        setAnalytics(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setError(error.response?.data?.error || 'Failed to load analytics data');
        setLoading(false);
      }
    };

    if (userId) {
      fetchAnalytics();
    } else {
      setError('User authentication required');
      setLoading(false);
    }
  }, [userId]);

  // Fetch team-specific analytics when a team is selected
  useEffect(() => {
    const fetchTeamAnalytics = async () => {
      if (!selectedTeam || !userId) return;
      
      try {
        setError(null);
        const response = await api.get(`/api/analytics/team/${selectedTeam}`);
        setTeamAnalytics(response.data);
      } catch (error) {
        console.error('Error fetching team analytics:', error);
        setError(error.response?.data?.error || 'Failed to load team analytics');
      }
    };

    fetchTeamAnalytics();
  }, [selectedTeam, userId]);

  // Fetch timeline data with different periods
  useEffect(() => {
    const fetchTimelineData = async () => {
      if (!userId) return;
      
      try {
        setError(null);
        const response = await api.get(`/api/analytics/timeline?period=${timelinePeriod}&count=6`);
        setAnalytics(prev => ({ ...prev, timeline: response.data }));
      } catch (error) {
        console.error('Error fetching timeline data:', error);
        setError(error.response?.data?.error || 'Failed to load timeline data');
      }
    };

    fetchTimelineData();
  }, [timelinePeriod, userId]);

  // Fetch user performance data
  useEffect(() => {
    const fetchUserPerformance = async () => {
      if (!userId || viewMode !== 'user-performance') return;
      
      try {
        setLoading(true);
        setError(null);
        const response = await api.get('/api/analytics/user-performance');
        setUserPerformance(response.data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching user performance:', error);
        setError(error.response?.data?.error || 'Failed to load user performance data');
        setLoading(false);
      }
    };

    fetchUserPerformance();
  }, [userId, viewMode]);
  const fetchProjectReport = async (projectId) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/analytics/hr/project-report/${projectId}`);
      setProjectReportData(response.data)
      setLoading(false);
      return response.data;
    } catch (error) {
      console.error('Error fetching project report:', error);
      setError(error.response?.data?.error || 'Failed to load project report');
      setLoading(false);
      return null;
    }
  };

  const generatePDFReport = async (projectId) => {
    const reportData = await fetchProjectReport(projectId);
    if (!reportData) return;
  
    const doc = new jsPDF();
    
    // Add project header
    doc.setFontSize(18);
    doc.text(`Project Report: ${reportData.project.project_name}`, 14, 20);
  
    doc.setFontSize(12);
    doc.text(`Team: ${reportData.project.team_name}`, 14, 30);
    doc.text(`Team Lead: ${reportData.project.team_lead_name}`, 14, 38);
    doc.text(`Status: ${reportData.project.status}`, 14, 46);
    doc.text(`Priority: ${reportData.project.priority}`, 14, 54);
    doc.text(`Start Date: ${new Date(reportData.project.start_datetime).toLocaleDateString()}`, 14, 62);
    doc.text(`End Date: ${new Date(reportData.project.end_datetime).toLocaleDateString()}`, 14, 70);
  
    // Add team members table (simplified without task completion)
    doc.text('Team Members:', 14, 85);
    
    const memberData = reportData.teamMembers.map(member => [
      member.name,
      member.role
    ]);
    
    autoTable(doc, {
      startY: 90,
      head: [['Name', 'Role']],
      body: memberData,
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] }
    });
  
    // Add tasks table
    
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 20,
      
      
      theme: 'grid',
      headStyles: { fillColor: [41, 128, 185] }
    });
  
    // Add summary
    const completedTasks = reportData.tasks.filter(t => t.status === 'completed').length;
    const totalTasks = reportData.tasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    
  
    // Add a new page for user performance analytics
    doc.addPage();
    doc.setFontSize(18);
    doc.text('User Performance Analytics', 14, 20);
    
    // Fetch user performance data
    try {
      const response = await api.get('/api/analytics/user-performance');
      const userPerformanceData = response.data;
      
      if (userPerformanceData.length > 0) {
        // Add user performance table
        doc.setFontSize(12);
        doc.text('User Performance Details:', 14, 40);
        
        const userPerfData = userPerformanceData.map(user => [
          user.user_name,
          user.assigned_projects,
          user.completed_projects,
          `${user.completion_rate}%`,
          `${Math.round(user.avg_duration_days)} days`
        ]);
        
        autoTable(doc, {
          startY: 50,
          head: [['User', 'Assigned', 'Completed', 'Completion Rate', 'Avg Duration']],
          body: userPerfData,
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185] }
        });
  
        // Add charts (simulated with tables since we can't directly embed charts in jsPDF)
        
        // Completion Rate Bar Chart (simulated)
        doc.text('Completion Rate by User:', 14, doc.lastAutoTable.finalY + 20);
        
        const completionRateData = userPerformanceData.map(user => ({
          user: user.user_name,
          rate: user.completion_rate
        }));
        
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 25,
          head: [['User', 'Completion Rate (%)']],
          body: completionRateData.map(item => [item.user, item.rate]),
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185] },
          columnStyles: {
            1: { cellWidth: 40 }
          },
          didDrawCell: (data) => {
            if (data.column.index === 1 && data.row.index > 0) {
              const rate = parseFloat(data.cell.raw);
              const width = (rate / 100) * 40;
              doc.setFillColor(0, 114, 188);
              doc.rect(data.cell.x + 1, data.cell.y + 1, width, data.cell.height - 2, 'F');
            }
          }
        });
  
        // Projects Distribution (simulated)
        doc.text('Projects Distribution:', 14, doc.lastAutoTable.finalY + 20);
        
        const projectsData = [
          ['Assigned', userPerformanceData.reduce((sum, user) => user.assigned_projects, 0)],
          ['Completed', userPerformanceData.reduce((sum, user) => user.completed_projects, 0)]
        ];
        
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 25,
          head: [['Type', 'Count']],
          body: projectsData,
          theme: 'grid',
          headStyles: { fillColor: [41, 128, 185] }
        });
      }
    } catch (error) {
      console.error('Error fetching user performance for PDF:', error);
      doc.text('Could not load user performance data', 14, 40);
    }
  
    // Save the PDF
    doc.save(`Project_Report_${reportData.project.project_name}.pdf`);
  };
  
  // Fetch team statistics
  const fetchTeamStats = async () => {
    if (!userId || viewMode !== 'teams') return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/analytics/by-team');
      setAnalytics(prev => ({ ...prev, teamStats: response.data }));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching team stats:', error);
      setError(error.response?.data?.error || 'Failed to load team statistics');
      setLoading(false);
    }
  };

  // Fetch priority statistics
  const fetchPriorityStats = async () => {
    if (!userId || viewMode !== 'by-priority') return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/analytics/by-priority');
      setAnalytics(prev => ({ ...prev, priorityStats: response.data }));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching priority stats:', error);
      setError(error.response?.data?.error || 'Failed to load priority statistics');
      setLoading(false);
    }
  };

  // Fetch duration statistics
  const fetchDurationStats = async () => {
    if (!userId || viewMode !== 'by-duration') return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/api/analytics/by-duration');
      setAnalytics(prev => ({ ...prev, durationStats: response.data }));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching duration stats:', error);
      setError(error.response?.data?.error || 'Failed to load duration statistics');
      setLoading(false);
    }
  };

  // Handle view mode change
  useEffect(() => {
    if (viewMode === 'teams') {
      fetchTeamStats();
    } else if (viewMode === 'by-priority') {
      fetchPriorityStats();
    } else if (viewMode === 'by-duration') {
      fetchDurationStats();
    }
  }, [viewMode, userId]);

  if (loading) {
    return <div className="loading">Loading analytics data...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  // Ensure we have data before rendering
  const hasOverallData = analytics.overallStats && Object.keys(analytics.overallStats).length > 0;
  const hasTeamData = Array.isArray(analytics.teamStats) && analytics.teamStats.length > 0;
  const hasTimelineData = Array.isArray(analytics.timeline) && analytics.timeline.length > 0;
  const hasPriorityData = Array.isArray(analytics.priorityStats) && analytics.priorityStats.length > 0;
  const hasDurationData = Array.isArray(analytics.durationStats) && analytics.durationStats.length > 0;
  const hasUserPerformanceData = Array.isArray(userPerformance) && userPerformance.length > 0;

  return (
    <div className="analytics-dashboard">
      <h1>Project Performance Dashboard</h1>
      
      {/* View Mode Selector */}
      <div className="view-selector">
        <button 
          className={viewMode === 'dashboard' ? 'active' : ''} 
          onClick={() => setViewMode('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={viewMode === 'teams' ? 'active' : ''} 
          onClick={() => setViewMode('teams')}
        >
          Team Stats
        </button>
        <button 
          className={viewMode === 'user-performance' ? 'active' : ''} 
          onClick={() => setViewMode('user-performance')}
        >
          User Performance
        </button>
        <button 
          className={viewMode === 'by-priority' ? 'active' : ''} 
          onClick={() => setViewMode('by-priority')}
        >
          By Priority
        </button>
        <button 
          className={viewMode === 'by-duration' ? 'active' : ''} 
          onClick={() => setViewMode('by-duration')}
        >
          By Duration
        </button>
        <button 
          className={viewMode === 'hr-projects' ? 'active' : ''} 
          onClick={() => setViewMode('hr-projects')}
        >
          Report
        </button>
      </div>
      
      {/* Dashboard View */}
      {viewMode === 'dashboard' && (
        <>
          {/* Overall Statistics */}
          {hasOverallData && (
            <div className="stat-cards">
              <div className="stat-card">
                <h3>Total Projects</h3>
                <p className="stat-value">{analytics.overallStats.total_projects || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Completed Projects</h3>
                <p className="stat-value">{analytics.overallStats.completed_projects || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Active Projects</h3>
                <p className="stat-value">{analytics.overallStats.active_projects || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Completion Rate</h3>
                <p className="stat-value">{analytics.overallStats.completion_rate || 0}%</p>
              </div>
            </div>
          )}

          {/* Team Selector */}
          {hasTeamData && (
            <div className="team-selector">
              <h2>Team Performance</h2>
              <select 
                onChange={(e) => setSelectedTeam(e.target.value)}
                value={selectedTeam || ''}
              >
                <option value="">All Teams</option>
                {analytics.teamStats.map(team => (
                  <option key={team.team_id} value={team.team_id}>
                    {team.team_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Team Stats Chart */}
          {hasTeamData && (
            <div className="chart-container">
              <h3>Team Completion Stats</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.teamStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="team_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="completed_projects" name="Completed" fill="#0088FE" />
                  <Bar dataKey="total_projects" name="Total" fill="#FFBB28" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Completion Timeline */}
          {hasTimelineData && (
            <div className="chart-container">
              <div className="chart-header">
                <h3>Completion Timeline</h3>
                <div className="period-selector">
                  <button 
                    className={timelinePeriod === 'month' ? 'active' : ''} 
                    onClick={() => setTimelinePeriod('month')}
                  >
                    Monthly
                  </button>
                  <button 
                    className={timelinePeriod === 'week' ? 'active' : ''} 
                    onClick={() => setTimelinePeriod('week')}
                  >
                    Weekly
                  </button>
                  <button 
                    className={timelinePeriod === 'day' ? 'active' : ''} 
                    onClick={() => setTimelinePeriod('day')}
                  >
                    Daily
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time_period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="completed_count" 
                    name="Completed Projects" 
                    stroke="#0088FE" 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Priority & Duration Distribution */}
          {hasPriorityData && hasDurationData && (
            <div className="charts-row">
              <div className="chart-container half-width">
                <h3>Projects by Priority</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics.priorityStats}
                      dataKey="total_projects"
                      nameKey="priority"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {analytics.priorityStats.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={PRIORITY_COLORS[entry.priority] || COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="chart-container half-width">
                <h3>Projects by Duration</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics.durationStats}
                      dataKey="total_projects"
                      nameKey="duration_bucket"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {analytics.durationStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

{viewMode === 'hr-projects' && (
  <div className="hr-projects-view">
    <h2>Projects - View</h2>
    
    <div className="projects-table-container">
      <table className="projects-table">
        <thead>
          <tr>
            <th>Project Name</th>
            <th>Team</th>
            <th>Team Lead</th>
            <th>Members</th>
            <th>Priority</th>
            <th>End Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {ongoingProjects.map(project => (
            <tr key={project.project_id}>
              <td>{project.project_name}</td>
              <td>{project.team_name}</td>
              <td>{project.team_lead_name}</td>
              <td>{project.team_members}</td>
              <td>
                <span className={`priority-badge ${project.priority.toLowerCase()}`}>
                  {project.priority}
                </span>
              </td>
              <td>{new Date(project.end_datetime).toLocaleDateString()}</td>
              <td>
                <button 
                  className="generate-report-btn"
                  onClick={() => generatePDFReport(project.project_id)}
                >
                  Generate Report
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    
    {ongoingProjects.length === 0 && !loading && (
      <div className="no-data">No ongoing projects found</div>
    )}
  </div>
)}

      {/* Team Stats View */}
      {viewMode === 'teams' && hasTeamData && (
        <div className="detailed-team-view">
          <h2>Detailed Team Statistics</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={analytics.teamStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="team_name" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'completion_rate') return `${value}%`;
                    if (name === 'avg_duration_days') return `${Math.round(value)} days`;
                    return value;
                  }}
                />
                <Legend />
                <Bar dataKey="total_projects" name="Total Projects" fill="#FFBB28" />
                <Bar dataKey="completed_projects" name="Completed Projects" fill="#0088FE" />
                <Bar dataKey="completion_rate" name="Completion Rate %" fill="#00C49F" />
                <Bar dataKey="avg_duration_days" name="Avg Duration (days)" fill="#FF8042" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="team-stats-table">
            <h3>Team Statistics Table</h3>
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Total Projects</th>
                  <th>Completed</th>
                  <th>Completion Rate</th>
                  <th>Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {analytics.teamStats.map(team => (
                  <tr key={team.team_id}>
                    <td>{team.team_name}</td>
                    <td>{team.total_projects}</td>
                    <td>{team.completed_projects}</td>
                    <td>{team.completion_rate}%</td>
                    <td>{Math.round(team.avg_duration_days)} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Performance View */}
      {viewMode === 'user-performance' && hasUserPerformanceData && (
        <div className="user-performance-view">
          <h2>User Performance Analytics</h2>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={userPerformance}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="user_name" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === 'completion_rate') return `${value}%`;
                    if (name === 'avg_duration_days') return `${Math.round(value)} days`;
                    return value;
                  }}
                />
                <Legend />
                <Bar dataKey="assigned_projects" name="Assigned Projects" fill="#FFBB28" />
                <Bar dataKey="completed_projects" name="Completed Projects" fill="#0088FE" />
                <Bar dataKey="completion_rate" name="Completion Rate %" fill="#00C49F" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="user-performance-table">
            <h3>User Performance Details</h3>
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Assigned Projects</th>
                  <th>Completed</th>
                  <th>Completion Rate</th>
                  <th>Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {userPerformance.map(user => (
                  <tr key={user.user_id}>
                    <td>{user.user_name}</td>
                    <td>{user.assigned_projects}</td>
                    <td>{user.completed_projects}</td>
                    <td>{user.completion_rate}%</td>
                    <td>{Math.round(user.avg_duration_days)} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Priority Stats View */}
      {viewMode === 'by-priority' && hasPriorityData && (
        <div className="priority-stats-view">
          <h2>Project Statistics by Priority</h2>
          <div className="chart-container">
            <div className="charts-row">
              <div className="chart-container half-width">
                <h3>Projects Distribution by Priority</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.priorityStats}
                      dataKey="total_projects"
                      nameKey="priority"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {analytics.priorityStats.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={PRIORITY_COLORS[entry.priority] || COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Projects']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-container half-width">
                <h3>Completion Rate by Priority</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.priorityStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="priority" />
                    <YAxis label={{ value: 'Percentage %', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Completion Rate']} />
                    <Bar dataKey="completion_rate" name="Completion Rate" fill="#0088FE">
                      {analytics.priorityStats.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={PRIORITY_COLORS[entry.priority] || COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="priority-stats-table">
            <h3>Priority Statistics Details</h3>
            <table>
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Total Projects</th>
                  <th>Completed</th>
                  <th>Completion Rate</th>
                  <th>Avg Duration</th>
                </tr>
              </thead>
              <tbody>
                {analytics.priorityStats.map((priorityStat, index) => (
                  <tr key={index}>
                    <td>{priorityStat.priority}</td>
                    <td>{priorityStat.total_projects}</td>
                    <td>{priorityStat.completed_projects}</td>
                    <td>{priorityStat.completion_rate}%</td>
                    <td>{Math.round(priorityStat.avg_duration_days)} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Duration Stats View */}
      {viewMode === 'by-duration' && hasDurationData && (
        <div className="duration-stats-view">
          <h2>Project Statistics by Duration</h2>
          <div className="chart-container">
            <div className="charts-row">
              <div className="chart-container half-width">
                <h3>Projects by Duration</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analytics.durationStats}
                      dataKey="total_projects"
                      nameKey="duration_bucket"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {analytics.durationStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [value, 'Projects']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-container half-width">
                <h3>Completion Rate by Duration</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.durationStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="duration_bucket" />
                    <YAxis label={{ value: 'Percentage %', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Completion Rate']} />
                    <Bar dataKey="completion_rate" name="Completion Rate" fill="#0088FE">
                      {analytics.durationStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="duration-stats-table">
            <h3>Duration Statistics Details</h3>
            <table>
              <thead>
                <tr>
                  <th>Duration</th>
                  <th>Total Projects</th>
                  <th>Completed</th>
                  <th>Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {analytics.durationStats.map((durationStat, index) => (
                  <tr key={index}>
                    <td>{durationStat.duration_bucket}</td>
                    <td>{durationStat.total_projects}</td>
                    <td>{durationStat.completed_projects}</td>
                    <td>{durationStat.completion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team-specific analytics if a team is selected */}
      {selectedTeam && teamAnalytics && viewMode === 'dashboard' && (
        <div className="team-specific-analytics">
          <h2>Team Analytics Details</h2>
          
          <div className="stat-cards">
            <div className="stat-card">
              <h3>Team Completion Rate</h3>
              <p className="stat-value">{teamAnalytics.teamStats.completion_rate || 0}%</p>
            </div>
            <div className="stat-card">
              <h3>Avg Duration</h3>
              <p className="stat-value">{Math.round(teamAnalytics.teamStats.avg_duration_days || 0)} days</p>
            </div>
            <div className="stat-card">
              <h3>Active Projects</h3>
              <p className="stat-value">{teamAnalytics.teamStats.active_projects || 0}</p>
            </div>
            <div className="stat-card">
              <h3>Completed Projects</h3>
              <p className="stat-value">{teamAnalytics.teamStats.completed_projects || 0}</p>
            </div>
          </div>
          
          {teamAnalytics.completionTrend?.length > 0 && (
            <div className="chart-container">
              <h3>Team Completion Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={teamAnalytics.completionTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="completed_count" 
                    name="Completed" 
                    stroke="#8884d8" 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          
          {teamAnalytics.memberPerformance?.length > 0 && (
            <div className="chart-container">
              <h3>Member Performance</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={teamAnalytics.memberPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="user_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="assigned_projects" name="Assigned" fill="#FFBB28" />
                  <Bar dataKey="completed_projects" name="Completed" fill="#00C49F" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskAnalyticsDashboard;