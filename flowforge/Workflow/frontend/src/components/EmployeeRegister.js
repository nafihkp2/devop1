import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "./Login.css"; // Assuming you're using the same styles
import { host } from "../utils/ApiRoutes";

const EmployeeRegister = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    accessCode: ""
  });
  const [error, setError] = useState("");

  useEffect(() => {
    // Extract access code from URL query parameters if available
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (code) {
      setFormData(prev => ({ ...prev, accessCode: code }));
    }
  }, [location]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.accessCode) {
      setError("Access code is required for employee registration!");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match!");
      return;
    }

    try {
      const response = await axios.post(`${host}/api/signup`, {
        username: formData.name,
        email: formData.email,
        password: formData.password,
        role: "employee",
        accessCode: formData.accessCode
      });

      if (response.status === 201) {
        alert("Registration successful! Please log in to continue.");
        navigate("/login");
      }
    } catch (error) {
      console.error("Registration error:", error);
      setError(error.response?.data?.message || "Registration failed. Please try again.");
    }
  };

  return (
    <div className="landing-page">
      <div className="intro-section">
        <h1 className="app-title">WorkFlow</h1>
        <h2 className="app-tagline">Employee Registration</h2>
      </div>

      <div className="auth-container">
        <div className="auth-box">
          <h2>Create your employee account</h2>
          <p className="subtitle">Join your team on WorkFlow</p>
          {error && <p className="error-message">{error}</p>}

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Full Name"
                required
              />
            </div>
            
            <div className="input-group">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Email Address"
                required
              />
            </div>
            
            <div className="input-group">
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Password"
                required
              />
            </div>
            
            <div className="input-group">
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Confirm Password"
                required
              />
            </div>

            <div className="input-group">
              <input
                type="text"
                name="accessCode"
                value={formData.accessCode}
                onChange={handleChange}
                placeholder="HR Access Code"
                required
              />
              <small className="code-hint">
                This code is provided by your HR
              </small>
            </div>

            <button type="submit" className="primary-button">
              Register
            </button>
          </form>

          <div className="auth-footer">
            <button
              className="toggle-auth"
              onClick={() => navigate("/login")}
            >
              Already have an account? Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeRegister;