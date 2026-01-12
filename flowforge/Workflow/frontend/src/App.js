import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, Navigate, Link } from "react-router-dom";
import "./App.css";
import Tasks from "./components/TaskAnalyticsDashboard.js";
import Team from "./components/Team";
import Login from "./components/Login";
import Teamlead from "./components/Teamlead";
import MeetingCalendar from "./components/Calendar";
import AdminDashboard from "./pages/AdminDashboard";
import HRDashboard from "./pages/HRDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import Profile from "./components/Pofile";
import EmployeeRegister from "./components/EmployeeRegister";


function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loggedInUser = localStorage.getItem("user");
    if (loggedInUser) {
      const userData = JSON.parse(loggedInUser);
      console.log("Loaded user data:", userData); // Add this line
      setUser(userData);
    }
  }, []);
  
  const handleLogin = (userData) => {
    console.log("Logged in user data:", userData); // Add this line
    setUser(userData);
    localStorage.setItem("user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("user");
  };

  return (
    <Router>
      <div className="app">
        {!user ? (
          <Routes>
            <Route path="/login" element={<Login onLogin={handleLogin} />} />
            <Route path="/*" element={<Navigate to="/login" />} />
            <Route path="/employee-register" element={<EmployeeRegister />} />
            <Route path="/" element={<Login onLogin={handleLogin} />} />
          </Routes>
        ) : (
          <>
            <nav className="sidebar">
              <div className="logo-container">
                <h1 className="logo">Flowforge</h1>
              </div>
              <ul className="nav-links">
                <li><Link to="/dashboard">Dashboard</Link></li>
                {(user?.role === 'admin' || user?.role === 'hr') && (
                  <li><Link to="/tasks">Performance stats</Link></li>
                )} 
                <li><Link to="/calendar">Calendar</Link></li>
                
                {/* Only show Team link for admin/hr */}
                {(user?.role === 'admin' || user?.role === 'hr') && (
                  <li><Link to="/team">Team</Link></li>
                )}
                {(user?.role === 'employee' || user?.role === 'hr') && (
                  <li><Link to="/teamlead">Teamlead</Link></li>
                )}
                <li><Link to="/profile">Profile</Link></li>
                <li><button onClick={handleLogout}>Logout</button></li>
              </ul>
            </nav>

            <div className="main-content">
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute user={user} allowedRoles={['admin', 'hr', 'employee']}>
                      {user.role === 'admin' ? (
                        <AdminDashboard />
                      ) : user.role === 'hr' ? (
                        <HRDashboard />
                      ) : (
                        <EmployeeDashboard />
                      )}
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/tasks" 
                  element={
                    <ProtectedRoute user={user} allowedRoles={['admin', 'hr', 'employee']}>
                      <Tasks />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/calendar" 
                  element={
                    <ProtectedRoute user={user} allowedRoles={['admin', 'hr', 'employee']}>
                      <MeetingCalendar />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/team" 
                  element={
                    <ProtectedRoute user={user} allowedRoles={['admin', 'hr']}>
                      <Team />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/teamlead" 
                  element={
                    <ProtectedRoute user={user} allowedRoles={['employee', 'hr']}>
                      <Teamlead />
                    </ProtectedRoute>
                  } 
                />
               
                <Route 
                  path="profile" 
                  element={
                    <ProtectedRoute user={user} allowedRoles={['admin', 'hr', 'employee']}>
                      <Profile/>
                    </ProtectedRoute>
                  } 
                />
                <Route path="/login" element={<Navigate to="/dashboard" />} />
              </Routes>
            </div>
          </>
        )}
      </div>
    </Router>
  );
}

export default App;