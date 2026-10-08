import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { clearMeCache } from '../api/core';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Screens expect `role` (legacy API shape), getMe() returns `roleName`.
        const toLegacyUser = ({ roleName, ...rest }) => ({ ...rest, role: roleName });

        async function checkSession() {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                localStorage.removeItem('studyapp_token');
                localStorage.removeItem('studyapp_user');
                setToken(null);
                setUser(null);
                setLoading(false);
                return;
            }

            const jwtToken = session.access_token;
            try {
                const { getMe } = await import('../api/core');
                const userData = toLegacyUser(await getMe({ force: true }));
                setToken(jwtToken);
                setUser(userData);
                localStorage.setItem('studyapp_token', jwtToken);
                localStorage.setItem('studyapp_user', JSON.stringify(userData));
            } catch (err) {
                console.error('Failed to fetch profile:', err);
                const storedUser = localStorage.getItem('studyapp_user');
                if (storedUser) {
                    setToken(jwtToken);
                    setUser(JSON.parse(storedUser));
                } else {
                    setToken(null);
                    setUser(null);
                }
            }
            setLoading(false);
        }
        checkSession();
    }, []);

    const login = (userData, jwtToken) => {
        setUser(userData);
        setToken(jwtToken);
        localStorage.setItem('studyapp_token', jwtToken);
        localStorage.setItem('studyapp_user', JSON.stringify(userData));
    };

    const logout = async () => {
        // Clear local state first so the UI never gets stuck on a failed network call.
        setUser(null);
        setToken(null);
        localStorage.removeItem('studyapp_token');
        localStorage.removeItem('studyapp_user');
        clearMeCache();
        try {
            await supabase.auth.signOut();
        } catch (err) {
            console.error('Sign out error:', err);
        }
    };

    const updateUser = (newUserData) => {
        setUser(newUserData);
        localStorage.setItem('studyapp_user', JSON.stringify(newUserData));
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
