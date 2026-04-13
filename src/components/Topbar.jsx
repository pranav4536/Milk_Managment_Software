import React from 'react';
import { Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const pageTitles = {
  '/': { title: 'Dashboard', sub: 'Overview of your milk operations' },
  '/vendors': { title: 'Vendors', sub: 'Manage milk supplier vendors' },
  '/customers': { title: 'Customers', sub: 'Manage customers and consumption' },
  '/milk-collection': { title: 'Milk Collection', sub: 'Track daily milk collections' },
  '/deliveries': { title: 'Deliveries', sub: 'Track customer milk deliveries' },
  '/bottle-tracking': { title: 'Bottle Tracking', sub: 'Monitor bottle distribution and returns' },
};

export default function Topbar({ onMenuClick }) {
  const location = useLocation();
  const info = pageTitles[location.pathname] || { title: 'Milk Manager', sub: '' };
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });

  return (
    <header className="topbar">
      <button className="topbar-menu-btn" onClick={onMenuClick} id="sidebar-toggle-btn">
        <Menu size={22} />
      </button>
      <div style={{ flex: 1 }}>
        <div className="topbar-title">{info.title}</div>
        <div className="topbar-subtitle">{info.sub}</div>
      </div>
      <div className="topbar-badge">
        📅 {today}
      </div>
    </header>
  );
}
