import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./styles/AdminList.css";

import { API_URL } from "./config";

const AdminList = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const response = await fetch(`${API_URL}/admin/list`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.success) {
          setAdmins(data.admins);
        } else {
          setError(data.error || "Failed to fetch admins");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAdmins();
    const intervalId = setInterval(fetchAdmins, 3000);
    return () => clearInterval(intervalId);
  }, []);

  if (loading) {
    return <div className="admin-list-container">Loading admins...</div>;
  }

  if (error) {
    return <div className="admin-list-container error">Error: {error}</div>;
  }

  return (
    <div className="admin-list-container">
      <Link to="/admin" className="back-link">
        &larr; Retour à l'administration
      </Link>
      <h1>Liste des Administrateurs</h1>
      {admins.length === 0 ? (
        <p>Aucun administrateur trouvé.</p>
      ) : (
        <ul className="admin-items">
          {admins.map((admin) => (
            <li key={admin._id} className="admin-item">
              <span className="admin-username">{admin.username}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default AdminList;
