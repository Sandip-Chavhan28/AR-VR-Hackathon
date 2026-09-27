import React from 'react';

export const MainDashboard = ({ title = 'MainDashboard' }) => {
  return (
    <div className="maindashboard-container" style={{ padding: '10px', border: '1px solid #ccc' }}>
      <h3>{title}</h3>
      <p>Mars EDL Flight Director Dashboard</p>
    </div>
  );
};

export default MainDashboard;
