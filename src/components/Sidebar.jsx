import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Milk, X, Droplets, Package, Receipt, Truck
} from 'lucide-react';

const navItems = [
  { path: '/',                        icon: LayoutDashboard, label: 'Dashboard'            },
  { path: '/vendors',                  icon: Users,           label: 'Vendors'              },
  { path: '/customers',                icon: Users,           label: 'Customers'            },
  { path: '/milk-collection',          icon: Milk,            label: 'Milk Collection'      },
  { path: '/deliveries',               icon: Truck,           label: 'Deliveries'           },
  { path: '/bottle-tracking',          icon: Package,         label: 'Bottle Tracking'      },
];

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();

  return (
    <>
      {/* Backdrop */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Droplets size={22} color="#fff" />
          </div>
          <div className="sidebar-logo-text">
            <h1>MilkManager</h1>
            <span>Management System</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Main Menu</div>
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
              onClick={onClose}
            >
              <Icon size={18} className="nav-icon" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <p>Milk Management v1.0</p>
        </div>
      </aside>
    </>
  );
}
