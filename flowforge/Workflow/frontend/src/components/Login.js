import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Login.css";
import { host } from "../utils/ApiRoutes";

const Login = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "employee",
    accessCode: "" // Access code field for both HR and employee roles
  });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (isSignUp) {
      // Validate access code requirement for both HR and employee roles
      if ((formData.role === "hr" || formData.role === "employee") && !formData.accessCode) {
        setError(`Access code is required for ${formData.role === "hr" ? "HR" : "Employee"} registration!`);
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match!");
        return;
      }

      try {
        const payload = {
          username: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        };

        // Add access code for HR and employee registration
        if (formData.role === "hr" || formData.role === "employee") {
          payload.accessCode = formData.accessCode;
        }

        const response = await fetch(`${host}/api/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await response.json();
        if (response.ok) {
          alert("Signup successful! Please log in.");
          setIsSignUp(false);
        } else {
          setError(data.message || "Signup failed!");
        }
      } catch (error) {
        console.error("Signup error:", error);
        setError("Error signing up. Please try again.");
      }
    } else {
      try {
        const response = await axios.post(`${host}/api/login`, {
          email: formData.email,
          password: formData.password,
        });

        if (response.data.user) {
          localStorage.setItem("user", JSON.stringify(response.data.user));
          onLogin(response.data.user);

          if (response.data.user.role === "admin") {
            navigate("/admin-dashboard");
          } else if (response.data.user.role === "hr") {
            navigate("/hr-dashboard");
          } else {
            navigate("/dashboard");
          }
        } else {
          setError("Invalid credentials");
        }
      } catch (error) {
        setError("Login failed. Please try again.");
      }
    }
  };

  return (
    <div className="landing-page">
      {/* Introduction Section */}
      <div className="intro-section">
        <h1 className="app-title">FlowForge</h1>
        <h2 className="app-tagline">Streamline Your Work, Amplify Your Productivity</h2>
        <div className="features-list">
          <div className="feature-card">
            <h3>🚀 Efficient Task Management</h3>
            <p>Organize and prioritize tasks with ease using our intuitive system.</p>
          </div>
          <div className="feature-card">
            <h3>🤝 Team Collaboration</h3>
            <p>Work seamlessly with your team through shared projects and real-time updates.</p>
          </div>
          <div className="feature-card">
            <h3>📊 Data-Driven Insights</h3>
            <p>Track progress and performance with comprehensive analytics.</p>
          </div>
        </div>
        <div className="testimonial">
          <p>"ForgeFlow has transformed how our team operates. Highly recommended!"</p>
          <p>- Sarah T., Project Manager</p>
        </div>
      </div>

      {/* Login/Signup Section */}
      <div className="auth-container">
        <div className="auth-box">
          <h2>{isSignUp ? "Create your account" : "Sign in"}</h2>
          <p className="subtitle">
            {isSignUp ? "Join ForgeFlow today" : "Welcome back to ForgeFlow"}
          </p>
          {error && <p className="error-message">{error}</p>}

          <form onSubmit={handleSubmit}>
            {isSignUp && (
              <>
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
                  <select 
                    name="role" 
                    value={formData.role} 
                    onChange={handleChange}
                  >
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                    <option value="hr">HR</option>
                  </select>
                </div>
                {/* Access Code Input for HR and Employee */}
                {(formData.role === "hr" || formData.role === "employee") && (
                  <div className="input-group">
                    <input
                      type="text"
                      name="accessCode"
                      value={formData.accessCode}
                      onChange={handleChange}
                      placeholder={`${formData.role === "hr" ? "HR" : "Employee"} Access Code`}
                      required
                    />
                    <small className="code-hint">
                      {formData.role === "hr" 
                        ? "Contact your admin for the access code"
                        : "Contact HR for your employee access code"}
                    </small>
                  </div>
                )}
              </>
            )}

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

            {isSignUp && (
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
            )}

            <button type="submit" className="primary-button">
              {isSignUp ? "Sign Up" : "Sign In"}
            </button>
          </form>

          <div className="auth-footer">
            <button
              className="toggle-auth"
              onClick={() => setIsSignUp(!isSignUp)}
            >
              {isSignUp ? "Already have an account? Sign in" : "Create account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;