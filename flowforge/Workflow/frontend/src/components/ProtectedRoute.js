import { Navigate } from "react-router-dom";

const ProtectedRoute = ({ user, allowedRoles, children }) => {
    // If no user, redirect to login
    if (!user) {
      return <Navigate to="/login" replace />;
    }
  
    // If user exists but role not in allowed roles, redirect to dashboard
    if (!allowedRoles.includes(user.role)) {
      console.warn(`Access denied. Required roles: ${allowedRoles.join(", ")}`);
      return <Navigate to="/dashboard" replace />;
    }
  
    return children;
};

export default ProtectedRoute;
