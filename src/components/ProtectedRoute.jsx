import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute() {
    const { user, token, loading } = useAuth();
    const [childrenCount, setChildrenCount] = useState(null);
    const [checking, setChecking] = useState(false);
    const location = useLocation();

    useEffect(() => {
        if (user?.role === 'Parent' && token) {
            setChecking(true);
            fetch(`http://localhost:5000/api/users/${user.uid}/children`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            .then(res => res.json())
            .then(data => {
                setChildrenCount(data.length || 0);
                setChecking(false);
            })
            .catch(err => {
                console.error(err);
                setChecking(false);
            });
        } else {
            setChildrenCount(-1);
        }
    }, [user, token]);

    if (loading || checking) {
        return null;
    }

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    if (user?.role === 'Parent') {
        if (childrenCount === 0 && location.pathname !== '/parent-connect') {
            return <Navigate to="/parent-connect" replace />;
        }
        if (childrenCount > 0 && location.pathname === '/parent-connect') {
            return <Navigate to="/dashboard" replace />;
        }
    } else {
        // Prevent Students/Admins from accessing parent-connect
        if (location.pathname === '/parent-connect') {
            return <Navigate to="/dashboard" replace />;
        }
    }

    return <Outlet />;
}
