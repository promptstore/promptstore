import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const WithPrivateRoute = ({ children }) => {
  const { currentUser } = useAuth();
  // console.log('currentUser:', currentUser);
  if (!process.env.REACT_APP_FIREBASE_API_KEY) {
    return children;
  }

  if (currentUser) {
    return children;
  }

  return <Navigate to="/login" />;
};

export default WithPrivateRoute;