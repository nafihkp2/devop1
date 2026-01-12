import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";
import axios from 'axios';
import { host } from "../utils/ApiRoutes";

const Profile = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", role: "" });
  const [updateError, setUpdateError] = useState("");
  const [updateSuccess, setUpdateSuccess] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Admin related states
  const [hrCode, setHrCode] = useState("");
  
  // HR related states
  const [employeeCode, setEmployeeCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        // You can add a toast or temporary message here if you want
        console.log('Code copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy code: ', err);
      });
  };

  const fetchHrInviteCode = useCallback(async (admin_id) => {
    try {
      setIsLoading(true);
      console.log("Fetching HR invite code for admin:", admin_id);
      
      const response = await axios.get(
        `${host}/api/admin/get-hr-invite/${admin_id}`
      );
      
      console.log("HR invite code response:", response.data);

      if (response.data && response.data.success) {
        const code = response.data.inviteCode || response.data.invite_code;
        if (code) {
          setHrCode(code);
          console.log("HR code set successfully:", code);
        } else {
          console.error("No invite code found in response:", response.data);
        }
      } else {
        console.error("Failed to fetch HR invite code:", response.data);
      }
    } catch (error) {
      console.error("Error fetching HR invite code:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchEmployeeInviteCode = useCallback(async (hr_id) => {
    try {
      setIsLoading(true);
      console.log("Fetching employee invite code for HR:", hr_id);
      
      const response = await axios.get(
        `${host}/api/hr/get-employee-invite/${hr_id}`
      );
      
      console.log("Employee invite code response:", response.data);

      if (response.data && response.data.success) {
        const code = response.data.inviteCode || response.data.invite_code;
        if (code) {
          setEmployeeCode(code);
          console.log("Employee code set successfully:", code);
        } else {
          console.error("No invite code found in response:", response.data);
        }
      } else {
        console.error("Failed to fetch employee invite code:", response.data);
      }
    } catch (error) {
      console.error("Error fetching employee invite code:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUserProfile = useCallback(async (userId) => {
    try {
      const response = await axios.get(`${host}/api/Profile/${userId}`);
      
      if (response.data && response.data.success) {
        return response.data.user;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    console.log("Stored user:", storedUser);
    
    if (storedUser) {
      fetchUserProfile(storedUser.id).then(latestUserData => {
        if (latestUserData) {
          const updatedUser = { ...storedUser, ...latestUserData };
          localStorage.setItem("user", JSON.stringify(updatedUser));
          setUser(updatedUser);
          setFormData({ 
            name: updatedUser.name, 
            email: updatedUser.email, 
            role: updatedUser.role 
          });
        } else {
          setUser(storedUser);
          setFormData({ 
            name: storedUser.name, 
            email: storedUser.email, 
            role: storedUser.role 
          });
        }
      });

      if (storedUser.role === "admin") {
        console.log("User is admin, fetching HR invite code");
        fetchHrInviteCode(storedUser.id);
      } else if (storedUser.role === "hr") {
        console.log("User is HR, fetching employee invite code");
        fetchEmployeeInviteCode(storedUser.id);
      }
    } else {
      navigate("/login");
    }
  }, [navigate, fetchHrInviteCode, fetchEmployeeInviteCode, fetchUserProfile]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      setIsUpdating(true);
      setUpdateError("");
      setUpdateSuccess("");
      
      if (!formData.name.trim()) {
        setUpdateError("Name cannot be empty");
        setIsUpdating(false);
        return;
      }
      
      const response = await axios.put(
        `${host}/api/Profile/update/${user.id}`,
        { name: formData.name }
      );
      
      if (response.data && response.data.success) {
        const updatedUser = response.data.user;
        const storedUser = JSON.parse(localStorage.getItem("user"));
        const mergedUser = { ...storedUser, ...updatedUser };
        localStorage.setItem("user", JSON.stringify(mergedUser));
        setUser(mergedUser);
        setIsEditing(false);
        setUpdateSuccess("Profile updated successfully!");
        setTimeout(() => setUpdateSuccess(""), 3000);
      } else {
        setUpdateError(response.data?.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      setUpdateError(
        error.response?.data?.message || 
        "An error occurred while updating your profile"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setUpdateError("");
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role
    });
  };

  if (!user) {
    return (
      <div className="profile-container">
        <h1>My Profile</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <h1>My Profile</h1>
      <div className="profile-card">
        <div className="profile-info">
          <label>Name:</label>
          {isEditing ? (
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={!formData.name.trim() ? "input-error" : ""}
            />
          ) : (
            <p>{user.name}</p>
          )}
        </div>

        <div className="profile-info">
          <label>Email:</label>
          <p>{user.email}</p>
        </div>

        <div className="profile-info">
          <label>Role:</label>
          <p className="role">{user.role}</p>
        </div>

        {user.role === "admin" && (
          <div className="hr-access-section">
            <h3>HR Access Management</h3>
            {isLoading ? (
              <p className="loading-code">Loading access code...</p>
            ) : hrCode ? (
              <div className="access-details">
                <div className="code-container">
                  <p>HR Access Code: <strong>{hrCode}</strong></p>
                  <button 
                    className="copy-btn" 
                    onClick={() => copyToClipboard(hrCode)}
                    title="Copy to clipboard"
                  >
                    Copy Code
                  </button>
                </div>
                <p>Share this code with HR personnel during registration.</p>
              </div>
            ) : (
              <p className="no-code">No access code available.</p>
            )}
          </div>
        )}

        {user.role === "hr" && (
          <div className="employee-access-section">
            <h3>Employee Access Management</h3>
            {isLoading ? (
              <p className="loading-code">Loading access code...</p>
            ) : employeeCode ? (
              <div className="access-details">
                <div className="code-container">
                  <p>Employee Access Code: <strong>{employeeCode}</strong></p>
                  <button 
                    className="copy-btn" 
                    onClick={() => copyToClipboard(employeeCode)}
                    title="Copy to clipboard"
                  >
                    Copy Code
                  </button>
                </div>
                <p>Share this code with employees during registration.</p>
              </div>
            ) : (
              <p className="no-code">No access code available.</p>
            )}
          </div>
        )}

        {updateError && <div className="error-message">{updateError}</div>}
        {updateSuccess && <div className="success-message">{updateSuccess}</div>}

        <div className="profile-actions">
          {isEditing ? (
            <>
              <button 
                className="save-btn" 
                onClick={handleSave} 
                disabled={isUpdating}
              >
                {isUpdating ? "Saving..." : "Save"}
              </button>
              <button 
                className="cancel-btn" 
                onClick={handleCancel}
                disabled={isUpdating}
              >
                Cancel
              </button>
            </>
          ) : (
            <button className="edit-btn" onClick={() => setIsEditing(true)}>
              Edit Profile
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;