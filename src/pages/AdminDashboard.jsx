import { apiFetch } from '../api';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AdminDashboard.module.css';
import logoLight from '../assets/logo-light.png';
import logoDark from '../assets/logo-dark.png';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock, GraduationCap, Target, Sparkles, MessageSquare, Activity, ChevronRight, Bell, Users, BookOpen, FileText, Flame, Circle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import StudyBackground from '../components/StudyBackground';
import ContentTab from '../components/ContentTab';
import Skeleton from '../components/Skeleton';
export default function AdminDashboard() {
    const getAvatarUrl = (url) => {
        if (!url) return import.meta.env.BASE_URL + 'avatars/avatar-1.svg';
        if (url.startsWith('http')) return url;
        if (url.startsWith('/')) return import.meta.env.BASE_URL + url.slice(1);
        return import.meta.env.BASE_URL + url;
    };

    const queryClient = useQueryClient();

    const [isDark, setIsDark] = useState(false);
    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem('studyapp-activetab') || 'Dashboard';
    });
    const [isSwitching, setIsSwitching] = useState(false);
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
    const [activeTablePopupId, setActiveTablePopupId] = useState(null);
    const [searchInput, setSearchInput] = useState('');
    const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
    const [filterRole, setFilterRole] = useState('All');
    const [activeRoleMenuId, setActiveRoleMenuId] = useState(null);
    const [isFormRoleDropdownOpen, setIsFormRoleDropdownOpen] = useState(false);
    const [isFrequencyDropdownOpen, setIsFrequencyDropdownOpen] = useState(false);

    const { token, user, logout } = useAuth();
    const navigate = useNavigate();
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [invitations, setInvitations] = useState([]);
    const [users, setUsers] = useState([]);
    const [dashboardStats, setDashboardStats] = useState(null);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [yearlyGrowth, setYearlyGrowth] = useState(null);
    const [recentRegistrations, setRecentRegistrations] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    // Parent Dashboard State
    const [parentChildren, setParentChildren] = useState([]);
    const [selectedChildId, setSelectedChildId] = useState(null);

    // Audit Logs State
    const [auditLogs, setAuditLogs] = useState([]);

    // File Manager State
    const [logFiles, setLogFiles] = useState([]);

    // Appearance Settings State
    const [themeMode, setThemeMode] = useState(() => {
        const saved = localStorage.getItem('studyapp-theme');
        if (saved) return saved.charAt(0).toUpperCase() + saved.slice(1);
        return 'Dark';
    });
    const [panelSounds, setPanelSounds] = useState(() => {
        const saved = localStorage.getItem('studyapp-panelsounds');
        return saved !== null ? saved === 'true' : true;
    });
    const [animations, setAnimations] = useState(() => {
        const saved = localStorage.getItem('studyapp-animations');
        return saved !== null ? saved === 'true' : true;
    });

    // Mock Backup State
    const [backups, setBackups] = useState([
        { id: '1', name: 'backup_2026-07-15_1200.sql', date: '7/15/2026, 12:00 PM', size: '15.4 MB' },
        { id: '2', name: 'backup_2026-07-14_1200.sql', date: '7/14/2026, 12:00 PM', size: '15.2 MB' },
        { id: '3', name: 'backup_2026-07-13_1200.sql', date: '7/13/2026, 12:00 PM', size: '14.9 MB' }
    ]);
    const [autoBackupFrequency, setAutoBackupFrequency] = useState(() => {
        return localStorage.getItem('studyapp-autobackupfreq') || 'Daily';
    });
    const [autoBackupTime, setAutoBackupTime] = useState(() => {
        return localStorage.getItem('studyapp-autobackuptime') || '00:00';
    });
    const [selectedBackups, setSelectedBackups] = useState([]);

    const handleForceBackup = () => {
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
        const newBackup = {
            id: Date.now().toString(),
            name: `backup_${dateStr}_${timeStr}.sql`,
            date: now.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true }),
            size: (14 + Math.random() * 2).toFixed(1) + ' MB', // Simulating size between 14.0 and 16.0 MB
            locked: false
        };

        setBackups(prev => {
            let updated = [newBackup, ...prev];
            while (updated.length > 10) {
                // Find the oldest unlocked backup and remove it
                let oldestUnlockedIndex = -1;
                for (let i = updated.length - 1; i >= 0; i--) {
                    if (!updated[i].locked) {
                        oldestUnlockedIndex = i;
                        break;
                    }
                }
                if (oldestUnlockedIndex !== -1) {
                    updated.splice(oldestUnlockedIndex, 1);
                } else {
                    break; // All are locked, cannot enforce the 10 limit
                }
            }
            return updated;
        });
    };

    // Modal states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [modalForm, setModalForm] = useState({ username: '', email: '', password: '', firstName: '', lastName: '', roleName: 'Student' });

    
    const { data: usersData, isLoading: loadingUsersQuery } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await apiFetch('/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch users');
            return res.json();
        },
        enabled: !!token && (activeTab === 'Users' || activeTab === 'Dashboard'),
    });

    useEffect(() => {
        if (usersData) {
            setUsers(usersData);
            setFilteredUsers(usersData);
            setLoadingUsers(false);
        } else if (loadingUsersQuery) {
            setLoadingUsers(true);
        }
    }, [usersData, loadingUsersQuery]);

    const { data: dashboardData } = useQuery({
        queryKey: ['dashboardStats'],
        queryFn: async () => {
            const [overviewRes, recentRes] = await Promise.all([
                apiFetch('/stats/overview', { headers: { 'Authorization': `Bearer ${token}` } }),
                apiFetch('/stats/recent-users', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            if (!overviewRes.ok || !recentRes.ok) throw new Error('Failed to fetch dashboard stats');
            const overview = await overviewRes.json();
            const recent = await recentRes.json();
            return { overview, recent };
        },
        enabled: !!token && activeTab === 'Dashboard',
    });

    useEffect(() => {
        if (dashboardData) {
            setDashboardStats(dashboardData.overview);
            setRecentRegistrations(dashboardData.recent);
        }
    }, [dashboardData]);

    const handleRespondInvitation = async (invitationId, accept) => {
        try {
            const res = await apiFetch('/users/respond-invitation', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ invitationId, accept })
            });
            if (res.ok) {
                setInvitations(prev => prev.filter(inv => inv.id !== invitationId));
            }
        } catch (err) {
            console.error('Failed to respond to invitation:', err);
        }
    };

    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const handleGenerateCode = async () => {
        setIsGeneratingCode(true);
        try {
            const res = await apiFetch('/users/generate-connection-code', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Your Connection Code is: ${data.code}\n\nGive this 6-digit code to your parent. It expires in 15 minutes.`);
            } else {
                alert(data.error || 'Failed to generate code.');
            }
        } catch (err) {
            console.error(err);
            alert('A network error occurred.');
        } finally {
            setIsGeneratingCode(false);
        }
    };

    const handleDisconnectChild = async (studentUid) => {
        if (!window.confirm("Are you sure you want to disconnect this child? They will receive a notification to approve the disconnection.")) {
            return;
        }
        try {
            const res = await apiFetch('/users/initiate-disconnect', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ parentUid: user.uid, studentUid })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
            } else {
                alert(data.error || 'Failed to send disconnect request.');
            }
        } catch (err) {
            console.error('Disconnect error:', err);
            alert('A network error occurred.');
        }
    };

    const { data: auditLogsData } = useQuery({
        queryKey: ['auditLogs'],
        queryFn: async () => {
            const res = await apiFetch('/audit', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Network error');
            return res.json();
        },
        enabled: !!token && user?.role === 'Admin' && activeTab === 'Console',
        refetchInterval: 5000,
    });

    useEffect(() => {
        if (auditLogsData) setAuditLogs(auditLogsData);
    }, [auditLogsData]);

    const { data: logFilesData } = useQuery({
        queryKey: ['logFiles'],
        queryFn: async () => {
            const res = await apiFetch('/files/logs', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!res.ok) throw new Error('Network error');
            return res.json();
        },
        enabled: !!token && user?.role === 'Admin' && activeTab === 'File',
    });

    useEffect(() => {
        if (logFilesData) setLogFiles(logFilesData);
    }, [logFilesData]);

    useEffect(() => {
        if (!token) return;
        const fetchGrowth = async () => {
            try {
                const res = await apiFetch(`/stats/user-growth?year=${selectedYear}`, { headers: { 'Authorization': `Bearer ${token}` } });
                if (res.ok) {
                    const data = await res.json();
                    setYearlyGrowth(data);
                } else {
                    const err = await res.text();
                    console.error("Failed to fetch yearly growth:", err);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchGrowth();
    }, [selectedYear, token]);


useEffect(() => {
        const fetchInvitations = async () => {
            if (user?.role === 'Student' && token) {
                try {
                    const res = await apiFetch('/users/invitations', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        setInvitations(await res.json());
                    }
                } catch (err) {
                    console.error('Failed to fetch invitations:', err);
                }
            }
        };

        fetchInvitations();
        const interval = setInterval(fetchInvitations, 3000); // Check every 3 seconds for testing
        return () => clearInterval(interval);
    }, [user, token]);

    useEffect(() => {
        const fetchChildren = async () => {
            if (user?.role === 'Parent' && token) {
                try {
                    const res = await apiFetch(`/users/${user.uid}/children`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setParentChildren(data);
                        if (data.length > 0 && !selectedChildId) {
                            setSelectedChildId(data[0].uid);
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch children:', err);
                }
            }
        };
        fetchChildren();
    }, [user, token, selectedChildId]);

    // Save activeTab to localStorage so it survives refresh
    useEffect(() => {
        localStorage.setItem('studyapp-activetab', activeTab);
    }, [activeTab]);

    const handleTabChange = (tab) => {
        if (tab === activeTab) return;
        setIsSwitching(true);
        setActiveTab(tab);
        setTimeout(() => setIsSwitching(false), 300);
    };

    useEffect(() => {
        if (activeTab === 'Users') {
            const lowerQuery = searchInput.toLowerCase();
            const filtered = users.filter(u => {
                const matchesSearch = (u.username && u.username.toLowerCase().includes(lowerQuery)) ||
                (u.email && u.email.toLowerCase().includes(lowerQuery)) ||
                (u.firstname && u.firstname.toLowerCase().includes(lowerQuery)) ||
                (u.lastname && u.lastname.toLowerCase().includes(lowerQuery));

                const matchesRole = filterRole === 'All' || u.rolename === filterRole;

                return matchesSearch && matchesRole;
            });
            setFilteredUsers(filtered);
        }
    }, [searchInput, users, activeTab, filterRole]);

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            const res = await apiFetch('/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(modalForm)
            });
            if (res.ok) {
                setIsAddModalOpen(false);
                setModalForm({ username: '', email: '', password: '', firstName: '', lastName: '', roleName: 'Student' });
                queryClient.invalidateQueries({ queryKey: ['users'] });
            } else {
                const err = await res.json();
                alert(err.error || 'Failed to add user');
            }
        } catch (err) {
            console.error(err);
        }
    };

    
    const modifyRoleMutation = useMutation({
        mutationFn: async ({ targetUser, newRole }) => {
            const res = await apiFetch(`/users/${targetUser.uid}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ roleName: newRole })
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update role');
            }
            return res.json();
        },
        onMutate: async ({ targetUser, newRole }) => {
            await queryClient.cancelQueries({ queryKey: ['users'] });
            const previousUsers = queryClient.getQueryData(['users']);
            
            // Optimistically update to the new value
            if (previousUsers) {
                queryClient.setQueryData(['users'], old => 
                    old.map(u => u.uid === targetUser.uid ? { ...u, rolename: newRole } : u)
                );
            }
            
            // Also update local filtered states instantly for snappy UI
            const updateRole = (list) => list.map(u => u.uid === targetUser.uid ? { ...u, rolename: newRole } : u);
            setUsers(prev => updateRole(prev));
            setFilteredUsers(prev => updateRole(prev));
            setActiveRoleMenuId(null);
            setActiveTablePopupId(null);

            return { previousUsers, originalUsers: users, originalFiltered: filteredUsers };
        },
        onError: (err, newTodo, context) => {
            queryClient.setQueryData(['users'], context.previousUsers);
            setUsers(context.originalUsers);
            setFilteredUsers(context.originalFiltered);
            console.error('Modify role error:', err);
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
        },
    });

    const handleModifyRole = async (targetUser, newRole) => {
        modifyRoleMutation.mutate({ targetUser, newRole });
    };

    const handleEditUser = async (e) => {
        e.preventDefault();
        // Optimistic UI update
        const originalUsers = [...users];
        const originalFiltered = [...filteredUsers];
        const updateUser = (list) => list.map(u => u.uid === selectedUser.uid ? { ...u, firstname: modalForm.firstName, lastname: modalForm.lastName } : u);
        setUsers(updateUser(users));
        setFilteredUsers(updateUser(filteredUsers));
        setIsEditModalOpen(false);

        try {
            const res = await apiFetch(`/users/${selectedUser.uid}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({
                    firstName: modalForm.firstName,
                    lastName: modalForm.lastName
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to update user');
            }
        } catch (err) {
            console.error(err);
            setUsers(originalUsers);
            setFilteredUsers(originalFiltered);
        }
    };

    const handleDeleteUser = async () => {
        // Optimistic UI update: instantly remove from state
        const originalUsers = [...users];
        const originalFiltered = [...filteredUsers];
        
        setUsers(users.filter(u => u.uid !== selectedUser.uid));
        setFilteredUsers(filteredUsers.filter(u => u.uid !== selectedUser.uid));
        setIsDeleteModalOpen(false);

        try {
            const res = await apiFetch(`/users/${selectedUser.uid}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to delete user');
            }
            // Deletion successful in background, no further action needed
        } catch (err) {
            console.error(err);
            alert(err.message || 'Error occurred while deleting user');
            // Revert state on failure
            setUsers(originalUsers);
            setFilteredUsers(originalFiltered);
            queryClient.invalidateQueries({ queryKey: ['users'] }); // Sync with backend to be perfectly safe
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        // Close modal instantly — don't block the UI
        setIsResetModalOpen(false);

        try {
            const res = await apiFetch(`/users/${selectedUser.uid}/reset-password`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ newPassword: modalForm.password })
            });
            if (!res.ok) {
                const err = await res.json();
                console.error('Reset password failed:', err.error);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Refs for click outside
    const profilePopupRef = useRef(null);
    const searchContainerRef = useRef(null);
    const filterContainerRef = useRef(null);
    const consoleEndRef = useRef(null);

    // Auto-scroll console
    useEffect(() => {
        if (activeTab === 'Console') {
            consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [auditLogs, activeTab]);

    // Theme synchronization
    useEffect(() => {
        const mode = themeMode.toLowerCase();
        const isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const actualMode = mode === 'auto' ? (isSystemDark ? 'dark' : 'light') : mode;

        document.body.classList.remove('dark-theme', 'oled-theme', 'dark-mode');
        document.body.style.backgroundColor = ''; // clear any inline style from index.html loader
        
        if (actualMode === 'dark') {
            document.body.classList.add('dark-theme');
            setIsDark(true);
        } else if (actualMode === 'oled') {
            document.body.classList.add('dark-theme', 'oled-theme');
            setIsDark(true);
        } else {
            setIsDark(false);
        }
        
        localStorage.setItem('studyapp-theme', mode);
    }, [themeMode]);

    
    useEffect(() => {
        localStorage.setItem('studyapp-panelsounds', panelSounds);
    }, [panelSounds]);

    useEffect(() => {
        localStorage.setItem('studyapp-animations', animations);
        if (!animations) {
            document.body.classList.add('no-animations');
        } else {
            document.body.classList.remove('no-animations');
        }
    }, [animations]);

    useEffect(() => {
        localStorage.setItem('studyapp-autobackupfreq', autoBackupFrequency);
    }, [autoBackupFrequency]);

    useEffect(() => {
        localStorage.setItem('studyapp-autobackuptime', autoBackupTime);
    }, [autoBackupTime]);


    const toggleTheme = (e) => {
        if (e) e.stopPropagation();
        setThemeMode(prev => (prev === 'Dark' || prev === 'Oled' || prev === 'Auto') ? 'Light' : 'Dark');
    };

    // Click outside listener to close popups
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (profilePopupRef.current && !profilePopupRef.current.contains(event.target)) {
                setIsProfilePopupOpen(false);
            }
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setIsSearchActive(false);
                setSearchInput(''); // clear search on close
            }
            if (filterContainerRef.current && !filterContainerRef.current.contains(event.target)) {
                setIsFilterPopupOpen(false);
            }
            // Close table popup if clicked outside
            if (!event.target.closest(`.${styles.actionMenuWrapper}`)) {
                setActiveTablePopupId(null);
                setActiveRoleMenuId(null);
            }
            // Close custom role dropdown if clicked outside
            if (!event.target.closest(`.${styles.customSelectContainer}`)) {
                setIsFormRoleDropdownOpen(false);
                setIsFrequencyDropdownOpen(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, []);

    const handleSearchClick = (e) => {
        e.stopPropagation();
        setIsSearchActive(true);
        // Timeout to allow transition before focus (optional)
        setTimeout(() => document.getElementById('dashboardSearchInput')?.focus(), 100);
    };

    const toggleTablePopup = (e, id) => {
        e.stopPropagation();
        if (activeTablePopupId === id) {
            setActiveTablePopupId(null);
        } else {
            setActiveTablePopupId(id);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getHeaderSubText = () => {
        if (activeTab === 'Dashboard') {
            return (
                <>Welcome back, <span style={{ color: getRoleColor(user?.role), fontWeight: '600' }}>{user?.firstName || user?.username || 'Admin'}</span></>
            );
        }
        return `Viewing ${activeTab}`;
    };

    const getRoleColor = (role) => {
        switch (role) {
            case 'Admin': return '#ef4444';
            case 'Teacher': return '#7c3aed';
            case 'Student': return '#00a82d';
            case 'Parent': return '#3b82f6';
            default: return '#888';
        }
    };

    const mockLessons = [
        { id: 1, title: 'Physics 101', subtitle: 'Kinematics & Dynamics', enrolled: 142, status: 'Published' },
        { id: 2, title: 'History 202', subtitle: 'The Renaissance', enrolled: 0, status: 'Draft' },
        { id: 3, title: 'Math 301', subtitle: 'Advanced Calculus', enrolled: 89, status: 'Published' },
    ];

    const mockStudyData = [
        { name: 'Mon', hours: 2.5 },
        { name: 'Tue', hours: 1.8 },
        { name: 'Wed', hours: 3.2 },
        { name: 'Thu', hours: 1.5 },
        { name: 'Fri', hours: 4.1 },
        { name: 'Sat', hours: 5.0 },
        { name: 'Sun', hours: 2.0 }
    ];

    const mockSubjects = [
        { name: 'Mathematics', score: 94, status: 'excellent', width: '94%' },
        { name: 'Science', score: 82, status: 'good', width: '82%' },
        { name: 'English', score: 69, status: 'warning', width: '69%' },
        { name: 'Programming', score: 96, status: 'excellent', width: '96%' }
    ];

    const mockTimeline = [
        { id: 1, title: 'Completed Python Variables', time: 'Today, 2:30 PM', icon: <Target size={14} /> },
        { id: 2, title: 'Scored 95% on Algebra Quiz', time: 'Today, 11:15 AM', icon: <Sparkles size={14} /> },
        { id: 3, title: 'Studied 1h 24m', time: 'Yesterday, 8:00 PM', icon: <Clock size={14} /> },
        { id: 4, title: 'Started Java Basics', time: '2 Days Ago', icon: <Activity size={14} /> },
    ];

    const renderDashboardTab = () => {
        let maxUserGrowth = 100;
        let roleGradient = '';
        let roleLegends = null;
        let roleTotal = 0;

        if (dashboardStats?.userGrowth?.length) {
            maxUserGrowth = Math.max(...dashboardStats.userGrowth.map(g => g.count), 1);
        }

        if (dashboardStats?.roleDistribution?.length) {
            roleTotal = dashboardStats.roleDistribution.reduce((sum, r) => sum + parseInt(r.count), 0);
            let currentPercentage = 0;
            const gradientParts = [];
            roleLegends = dashboardStats.roleDistribution.map(r => {
                const count = parseInt(r.count);
                const pct = roleTotal > 0 ? (count / roleTotal) * 100 : 0;
                const nextPercentage = currentPercentage + pct;
                const color = getRoleColor(r.rolename);
                
                const startPct = currentPercentage === 0 ? 0 : currentPercentage + 0.5;
                gradientParts.push(`${color} ${startPct}% ${nextPercentage}%`);
                
                currentPercentage = nextPercentage;
                
                return (
                    <div className={styles.legendItem} key={r.rolename}>
                        <div className={styles.legendColor} style={{background: color}}></div> 
                        {r.rolename} ({Math.round(pct)}%)
                    </div>
                );
            });
            roleGradient = `conic-gradient(${gradientParts.join(', ')})`;
        }

        return (
            <div className={`${styles.pageContent} ${activeTab === 'Dashboard' ? (isSwitching ? styles.animateFadeIn : '') : styles.hidden}`} style={{ display: activeTab === 'Dashboard' ? 'flex' : 'none' }}>
                {user?.role === 'Admin' ? (
                    <>
                        {/* Header Section */}
                        <div className={styles.dashboardSection}>
                            <div className={styles.statusText}>Everything is running normally <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"></path></svg></div>
                        </div>

                        {/* 5 Statistic Cards */}
                        <section className={`${styles.fiveColGrid} ${styles.dashboardSection}`}>
                            {/* Card 1: Total Users */}
                            <div className={`${styles.statCard} ${styles.statCardUsers}`}>
                                <div className={styles.statHeader}>
                                    <span className={styles.statTitle}>Total Users</span>
                                    <div className={styles.statIconWrapper}><Users size={18} /></div>
                                </div>
                                <div className={styles.statValue}>{dashboardStats?.totalUsers?.toLocaleString() || '-'}</div>
                                <div className={styles.statTrend} style={{color: dashboardStats?.signupChange?.startsWith('-') ? '#ef4444' : '#22c55e'}}>
                                    {dashboardStats?.signupChange?.startsWith('-') ? '↓ ' : '↑ +'}{dashboardStats?.signupChange || '100%'} this month
                                </div>
                            </div>
                            
                            {/* Card 2: Active Today */}
                            <div className={`${styles.statCard} ${styles.statCardActive}`}>
                                <div className={styles.statHeader}>
                                    <span className={styles.statTitle}>Active Today</span>
                                    <div className={styles.statIconWrapper}><Circle size={14} fill="currentColor" /></div>
                                </div>
                                <div className={styles.statValue}>{dashboardStats?.activeToday?.toLocaleString() || '-'}</div>
                                <div className={styles.statTrend}>
                                    <Circle size={10} fill="currentColor" style={{marginRight: '4px', display: 'inline-block'}} /> Currently studying
                                </div>
                            </div>
                            
                            {/* Card 3: Lessons Completed */}
                            <div className={`${styles.statCard} ${styles.statCardLessons}`}>
                                <div className={styles.statHeader}>
                                    <span className={styles.statTitle}>Lessons Completed</span>
                                    <div className={styles.statIconWrapper}><BookOpen size={18} /></div>
                                </div>
                                <div className={styles.statValue}>{dashboardStats?.lessonsToday?.toLocaleString() || '0'}</div>
                                <div className={styles.statTrend}>
                                    <Circle size={10} fill="currentColor" style={{marginRight: '4px', display: 'inline-block'}} /> Today
                                </div>
                            </div>
                            
                            {/* Card 4: Quizzes Completed */}
                            <div className={`${styles.statCard} ${styles.statCardQuizzes}`}>
                                <div className={styles.statHeader}>
                                    <span className={styles.statTitle}>Quizzes Completed</span>
                                    <div className={styles.statIconWrapper}><FileText size={18} /></div>
                                </div>
                                <div className={styles.statValue}>{dashboardStats?.quizzesCompleted || 0}</div>
                                <div className={styles.statTrend}>
                                    <Circle size={10} fill="currentColor" style={{marginRight: '4px', display: 'inline-block'}} /> Today
                                </div>
                            </div>
                            
                            {/* Card 5: Study Sessions */}
                            <div className={`${styles.statCard} ${styles.statCardSessions}`}>
                                <div className={styles.statHeader}>
                                    <span className={styles.statTitle}>Study Sessions</span>
                                    <div className={styles.statIconWrapper}><Flame size={18} /></div>
                                </div>
                                <div className={styles.statValue}>{dashboardStats?.studySessions || 0}</div>
                                <div className={styles.statTrend}>
                                    <Circle size={10} fill="currentColor" style={{marginRight: '4px', display: 'inline-block'}} /> Today
                                </div>
                            </div>
                        </section>
                        
                        {/* Charts Row 1: Growth & Role */}
                        <section className={`${styles.twoColGrid} ${styles.dashboardSection}`}>
                            <div className={styles.glassPanel} style={{padding: '20px'}}>
                                
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                    <div className={styles.sectionTitle} style={{ margin: 0 }}>User Growth Chart</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <button 
                                            onClick={() => setSelectedYear(y => y - 1)} 
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color)', padding: '5px' }}
                                        >
                                            <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                                        </button>
                                        <span style={{ fontWeight: '600', fontSize: '14px' }}>{selectedYear}</span>
                                        <button 
                                            onClick={() => setSelectedYear(y => y + 1)} 
                                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-color)', padding: '5px' }}
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className={styles.dateSubtext}>New Users (12 Months)</div>
                                <div className={styles.chartContainer}>
                                    {(yearlyGrowth || [])?.map((item, i) => {
                                        const currentMax = Math.max(...(yearlyGrowth || []).map(g => g.count), 1);
                                        const pct = Math.max((item.count / currentMax) * 100, 10);
                                        const isLatest = item.count > 0 && i === new Date().getMonth() && selectedYear === new Date().getFullYear();
                                        return (
                                            <div key={item.month} className={styles.chartBar} style={{height: `${pct}%`, background: isLatest ? '#00a82d' : undefined}}>
                                                <span className={styles.chartValue}>{item.count >= 1000 ? (item.count/1000).toFixed(1) + 'k' : item.count}</span>
                                                <span className={styles.chartLabel} style={{fontSize: '11px'}}>{item.month}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className={styles.glassPanel} style={{padding: '20px', display: 'flex', flexDirection: 'column'}}>
                                <div className={styles.sectionTitle}>Role Distribution</div>
                                <div className={styles.twoColGrid} style={{alignItems: 'center', flex: 1, gap: '10px'}}>
                                    <div className={styles.donutChart} style={{ background: roleGradient || '#333' }}>
                                        <div className={styles.donutHole}>
                                            <span style={{fontSize: '24px', fontWeight: 'bold'}}>{roleTotal >= 1000 ? (roleTotal/1000).toFixed(1) + 'k' : roleTotal}</span>
                                            <span style={{fontSize: '11px', color:'#888'}}>Total Users</span>
                                        </div>
                                    </div>
                                    <div>
                                        {roleLegends}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Charts Row 2: Learning Activity & Popular Courses */}
                        <section className={`${styles.twoColGrid} ${styles.dashboardSection}`}>
                            <div className={styles.glassPanel} style={{padding: '20px'}}>
                                <div className={styles.sectionTitle}>Top Student Streak</div>
                                {!dashboardStats ? (
                                    <div style={{ padding: '20px', display: 'flex', gap: '20px' }}>
                                        <div style={{ flex: 1 }}><Skeleton height="250px" borderRadius="10px" /></div>
                                        <div style={{ flex: 1 }}><Skeleton height="250px" borderRadius="10px" /></div>
                                    </div>
                                ) : dashboardStats.topStudents && dashboardStats.topStudents.length > 0 ? (
                                    <div style={{ display: 'flex', gap: '20px', marginTop: '15px', height: '360px' }}>
                                        {/* Left Side: Top 3 Students Podium */}
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '10px', paddingBottom: '10px' }}>
                                            {/* Rank 2 */}
                                            {dashboardStats.topStudents[1] && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
                                                    <div style={{fontSize: '11px', fontWeight: 'bold', color: '#a0a0a0', marginBottom: '4px'}}>{dashboardStats.topStudents[1].xp || 0} XP</div>
                                                    <img src={getAvatarUrl(dashboardStats.topStudents[1].profilepictureurl) || `https://ui-avatars.com/api/?name=${dashboardStats.topStudents[1].firstname}+${dashboardStats.topStudents[1].lastname}`} style={{width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginBottom: '8px', border: '3px solid #c0c0c0'}}/>
                                                    <div style={{fontWeight: 'bold', fontSize: '14px', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{dashboardStats.topStudents[1].firstname}</div>
                                                    <div style={{fontSize: '12px', color: '#ff9800', fontWeight: 'bold'}}>🔥 {dashboardStats.topStudents[1].currentstreak || 0}</div>
                                                    <div style={{ width: '100%', height: '90px', background: 'rgba(192, 192, 192, 0.4)', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', display: 'flex', justifyContent: 'center', paddingTop: '10px', fontSize: '24px', fontWeight: 'bold', color: '#fff', marginTop: '10px' }}>2</div>
                                                </div>
                                            )}
                                            
                                            {/* Rank 1 */}
                                            {dashboardStats.topStudents[0] && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '35%' }}>
                                                    <div style={{fontSize: '12px', fontWeight: 'bold', color: '#d4af37', marginBottom: '4px'}}>{dashboardStats.topStudents[0].xp || 0} XP</div>
                                                    <img src={getAvatarUrl(dashboardStats.topStudents[0].profilepictureurl) || `https://ui-avatars.com/api/?name=${dashboardStats.topStudents[0].firstname}+${dashboardStats.topStudents[0].lastname}`} style={{width: '65px', height: '65px', borderRadius: '50%', objectFit: 'cover', marginBottom: '8px', border: '3px solid #ffd700'}}/>
                                                    <div style={{fontWeight: 'bold', fontSize: '16px', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{dashboardStats.topStudents[0].firstname}</div>
                                                    <div style={{fontSize: '14px', color: '#ff9800', fontWeight: 'bold'}}>🔥 {dashboardStats.topStudents[0].currentstreak || 0}</div>
                                                    <div style={{ width: '100%', height: '130px', background: 'rgba(255, 215, 0, 0.4)', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', display: 'flex', justifyContent: 'center', paddingTop: '10px', fontSize: '32px', fontWeight: 'bold', color: '#fff', marginTop: '10px' }}>1</div>
                                                </div>
                                            )}
                                            
                                            {/* Rank 3 */}
                                            {dashboardStats.topStudents[2] && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '30%' }}>
                                                    <div style={{fontSize: '11px', fontWeight: 'bold', color: '#cd7f32', marginBottom: '4px'}}>{dashboardStats.topStudents[2].xp || 0} XP</div>
                                                    <img src={getAvatarUrl(dashboardStats.topStudents[2].profilepictureurl) || `https://ui-avatars.com/api/?name=${dashboardStats.topStudents[2].firstname}+${dashboardStats.topStudents[2].lastname}`} style={{width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover', marginBottom: '8px', border: '3px solid #cd7f32'}}/>
                                                    <div style={{fontWeight: 'bold', fontSize: '14px', textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{dashboardStats.topStudents[2].firstname}</div>
                                                    <div style={{fontSize: '12px', color: '#ff9800', fontWeight: 'bold'}}>🔥 {dashboardStats.topStudents[2].currentstreak || 0}</div>
                                                    <div style={{ width: '100%', height: '60px', background: 'rgba(205, 127, 50, 0.4)', borderTopLeftRadius: '10px', borderTopRightRadius: '10px', display: 'flex', justifyContent: 'center', paddingTop: '10px', fontSize: '24px', fontWeight: 'bold', color: '#fff', marginTop: '10px' }}>3</div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Side: Scrollable List for 4+ */}
                                        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '5px', display: 'flex', flexDirection: 'column' }}>
                                            {dashboardStats.topStudents.slice(3, 100).map((student, index) => (
                                                <div key={student.uid} style={{
                                                    display: 'flex', alignItems: 'center', gap: '15px', 
                                                    padding: '12px 10px', borderBottom: '1px solid rgba(128,128,128,0.2)'
                                                }}>
                                                    <div style={{fontSize: '14px', fontWeight: 'bold', color: '#888', width: '25px', textAlign: 'center'}}>
                                                        {index + 4}
                                                    </div>
                                                    <img src={getAvatarUrl(student.profilepictureurl) || `https://ui-avatars.com/api/?name=${student.firstname}+${student.lastname}`} 
                                                         style={{width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover'}}/>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{fontWeight: '600', fontSize: '14px'}}>{student.firstname} {student.lastname}</div>
                                                    </div>
                                                    <div style={{textAlign: 'right', display: 'flex', alignItems: 'center', gap: '15px'}}>
                                                        <div style={{fontSize: '12px', color: '#00a82d', fontWeight: 'bold'}}>{(student.xp || 0).toLocaleString()} XP</div>
                                                        <div style={{fontSize: '13px', color: '#ff9800', fontWeight: 'bold'}}>🔥 {student.currentstreak || 0}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {dashboardStats.topStudents.length <= 3 && (
                                                <div style={{ color: '#888', textAlign: 'center', marginTop: '20px' }}>No more students</div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{color: '#888', textAlign: 'center', width: '100%', marginTop: '20px'}}>No students found</div>
                                )}
                            </div>
                            <div className={styles.glassPanel} style={{padding: '20px', overflowX: 'auto'}}>
                                <div className={styles.sectionTitle} style={{display:'flex',justifyContent:'space-between'}}>
                                    Recent Registrations
                                    <button className={styles.viewAllBtn} style={{fontSize:'12px', padding:'4px 8px'}}>View All</button>
                                </div>
                                <table className={styles.dataTable} style={{minWidth: '500px'}}>
                                    <thead><tr><th>Name</th><th>Role</th><th>Registered</th></tr></thead>
                                    <tbody>
                                        {recentRegistrations.length === 0 ? (
                                            <tr><td colSpan="3" style={{textAlign:'center', color:'#888', padding: '20px'}}>No recent registrations</td></tr>
                                        ) : (Array.isArray(recentRegistrations) ? recentRegistrations : []).slice(0, 4).map(u => (
                                            <tr key={u.uid}>
                                                <td style={{display:'flex', alignItems:'center', gap:'8px'}}>
                                                    <img src={getAvatarUrl(u.profilepictureurl) || `https://ui-avatars.com/api/?name=${u.firstname}+${u.lastname}`} style={{width:'24px', height:'24px', borderRadius:'50%', objectFit:'cover'}}/> 
                                                    {u.firstname} {u.lastname}
                                                </td>
                                                <td>{u.rolename}</td>
                                                <td>{new Date(u.createdat).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </section>


                        {/* Secondary Metrics */}
                        <section className={`${styles.threeColGrid} ${styles.dashboardSection}`}>
                            <div className={styles.glassPanel} style={{padding: '20px'}}>
                                <div className={styles.sectionTitle}>Platform Health</div>
                                <div className={styles.healthGrid}>
                                    <div className={styles.healthItem}>
                                        <span className={styles.healthLabel}>Database</span>
                                        <span className={styles.healthValue}><div className={`${styles.statusDot} ${styles.running}`}></div> Online</span>
                                    </div>
                                    <div className={styles.healthItem}>
                                        <span className={styles.healthLabel}>API</span>
                                        <span className={styles.healthValue}><div className={`${styles.statusDot} ${styles.running}`}></div> Healthy</span>
                                    </div>
                                    <div className={styles.healthItem}>
                                        <span className={styles.healthLabel}>Storage</span>
                                        <span className={styles.healthValue}><div className={`${styles.statusDot} ${styles.warning}`}></div> 73%</span>
                                    </div>
                                    <div className={styles.healthItem}>
                                        <span className={styles.healthLabel}>Email</span>
                                        <span className={styles.healthValue}><div className={`${styles.statusDot} ${styles.running}`}></div> Running</span>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.glassPanel} style={{padding: '20px'}}>
                                <div className={styles.sectionTitle}>Parent Connections</div>
                                <ul className={styles.genericList}>
                                    <li className={styles.genericListItem}>
                                        <div className={styles.genericListSub}>Parents Connected</div>
                                        <div className={styles.genericListTitle}>{dashboardStats?.parentConnections?.parentsConnected?.toLocaleString() || 0}</div>
                                    </li>
                                    <li className={styles.genericListItem}>
                                        <div className={styles.genericListSub}>Children Without Parent</div>
                                        <div className={styles.genericListTitle}>{dashboardStats?.parentConnections?.childrenWithoutParent?.toLocaleString() || 0}</div>
                                    </li>
                                    <li className={styles.genericListItem}>
                                        <div className={styles.genericListSub}>Pending Invitations</div>
                                        <div className={styles.genericListTitle}>{dashboardStats?.parentConnections?.pendingInvitations?.toLocaleString() || 0}</div>
                                    </li>
                                </ul>
                            </div>
                            <div className={styles.glassPanel} style={{padding: '20px'}}>
                                <div className={styles.sectionTitle}>Platform Analytics</div>
                                <ul className={styles.genericList}>
                                    <li className={styles.genericListItem}>
                                        <div className={styles.genericListSub}>Average XP per User</div>
                                        <div className={styles.genericListTitle}>{dashboardStats?.analytics?.averageXpPerUser?.toLocaleString() || 0} XP</div>
                                    </li>
                                    <li className={styles.genericListItem}>
                                        <div className={styles.genericListSub}>Average Quiz Score</div>
                                        <div className={styles.genericListTitle}>{dashboardStats?.analytics?.averageQuizScore || 0}%</div>
                                    </li>
                                    <li className={styles.genericListItem}>
                                        <div className={styles.genericListSub}>Weekly Retention</div>
                                        <div className={styles.genericListTitle}>{dashboardStats?.analytics?.weeklyRetention || 0}%</div>
                                    </li>
                                </ul>
                            </div>
                        </section>

                        {/* Quick Actions */}
                        <section className={styles.dashboardSection}>
                            <div className={styles.sectionTitle} style={{borderBottom:'none', marginBottom: '10px'}}>Quick Actions</div>
                            <div className={styles.quickActionsGrid}>
                                <button className={styles.quickActionBtn}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                                    Add Admin
                                </button>
                                <button className={styles.quickActionBtn}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
                                    Create Course
                                </button>
                                <button className={styles.quickActionBtn}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                    Manage Users
                                </button>
                                <button className={styles.quickActionBtn}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                    View Reports
                                </button>
                                <button className={styles.quickActionBtn}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"></path></svg>
                                    Broadcast Notification
                                </button>
                                <button className={styles.quickActionBtn}>
                                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
                                    Backup Database
                                </button>
                            </div>
                        </section>

                        {/* AI Summary Box */}
                        <section className={styles.dashboardSection}>
                            <div className={styles.aiSummaryBox}>
                                <div className={styles.aiTitle}>
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                                    AI Platform Summary
                                </div>
                                <div className={styles.aiContent}>
                                    Today the platform recorded:
                                    <ul className={styles.aiHighlightList}>
                                        <li><strong>1,430</strong> active students</li>
                                        <li><strong>8,291</strong> lessons completed</li>
                                        <li><strong>3,842</strong> quizzes submitted</li>
                                        <li><strong>321</strong> new registrations</li>
                                    </ul>
                                    Engagement increased by <strong>12%</strong> compared to yesterday.<br/><br/>
                                    <span className={styles.statusText}>No critical issues detected. ✅</span>
                                </div>
                            </div>
                        </section>
                    </>
                ) : user?.role === 'Student' ? (
                    <div className={styles.studentDashboard}>
                        {invitations.length > 0 && (
                            <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid rgba(139, 92, 246, 0.5)', padding: '20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div>
                                    <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '18px' }}>🔔 New Parent Connection Request</h3>
                                    <p style={{ margin: 0, color: '#aaa', fontSize: '14px' }}>
                                        <strong style={{color: '#fff'}}>{invitations[0].parent_username}</strong> wants to connect their parent account to your student profile.
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button onClick={() => handleRespondInvitation(invitations[0].id, true)} style={{ padding: '10px 20px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Approve</button>
                                    <button onClick={() => handleRespondInvitation(invitations[0].id, false)} style={{ padding: '10px 20px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Reject</button>
                                </div>
                            </div>
                        )}

                        <div className={styles.welcomeBanner}>
                            <div className={styles.bannerLeft}>
                                <p className={styles.dateLabel}>Oct 24, 2023</p>
                                <h1>Welcome back, {user?.firstname || user?.username}!</h1>
                                <p className={styles.bannerSubtext}>Always stay updated in your student portal</p>
                            </div>
                            <div className={styles.bannerRight}>
                                <div className={styles.activeLessons}>
                                    <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                                    <span>3 lessons active</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.studentGrid}>
                            <div className={styles.gridLeft}>
                                <div className={styles.cardHeader}>Overall Grade</div>
                                <p className={styles.cardSub}>Your current academic standing</p>
                                <div className={styles.gradeCard}>
                                    <div className={styles.gradeContent}>
                                        <div className={styles.circularProgress}>
                                            <div className={styles.circleOuter}>
                                                <div className={styles.circleInner}>
                                                    <span className={styles.gradePercent}>88<span style={{fontSize: '16px'}}>%</span></span>
                                                    <span className={styles.gradeLabel}>OVERALL</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className={styles.gradeBreakdown}>
                                            <div className={styles.breakdownRow}>
                                                <span>Quizzes</span>
                                                <span>91%</span>
                                            </div>
                                            <div className={styles.breakdownRow}>
                                                <span>Practice</span>
                                                <span>85%</span>
                                            </div>
                                            <div className={styles.breakdownRow}>
                                                <span>Projects</span>
                                                <span>88%</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.gradeLetter}>A-</div>
                                    <div className={styles.milestoneBox}>
                                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>
                                        <span>2% increase since last week. Keep it up!</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.gridRight}>
                                <div className={styles.cardHeader}>Engagement</div>
                                <p className={styles.cardSub}>Your learning momentum</p>
                                <div className={styles.streakCard}>
                                    <h2>12</h2>
                                    <p>Day Study Streak!</p>
                                    <div className={styles.streakFlame}>🔥</div>
                                </div>
                                
                                <div className={styles.cardHeader}>Weekly Rhythm</div>
                                <p className={styles.cardSub}>Time studied this week</p>
                                <div className={styles.rhythmCard}>
                                    <div className={styles.barsContainer}>
                                        <div className={styles.bar} style={{ height: '40%' }}></div>
                                        <div className={styles.bar} style={{ height: '70%' }}></div>
                                        <div className={styles.bar} style={{ height: '50%' }}></div>
                                        <div className={styles.bar} style={{ height: '90%', background: '#f97316' }}></div>
                                        <div className={styles.bar} style={{ height: '30%' }}></div>
                                    </div>
                                    <p className={styles.rhythmFooter}>Peak study day: Thursday</p>
                                </div>

                                <div className={styles.cardHeader}>Parent Connection</div>
                                <p className={styles.cardSub}>Link account with parents</p>
                                <div className={styles.connectionCard}>
                                    <button className={styles.generateBtn} onClick={handleGenerateCode} disabled={isGeneratingCode}>
                                        {isGeneratingCode ? 'Generating...' : 'Generate Code'}
                                    </button>
                                    <p style={{ fontSize: '11px', color: '#888', marginTop: '10px', textAlign: 'center' }}>
                                        Give the 6-digit code to your parent to let them monitor your progress.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : user?.role === 'Parent' ? (
                    <div className={styles.premiumParentDashboard}>
                        <div className={styles.premiumHeader}>
                            <div>
                                <h1 className={styles.premiumGreeting}>Good Morning, {user?.firstname || 'Parent'} 👋</h1>
                            </div>
                            <div className={styles.learningStatusPill}>
                                On Track
                            </div>
                        </div>

                        {parentChildren.length > 0 ? (
                            <>
                                {/* Premium Child Selector */}
                                <div className={styles.childSelectorPremium}>
                                    {parentChildren.map(child => (
                                        <button 
                                            key={child.uid} 
                                            className={`${styles.childAvatarBtn} ${selectedChildId === child.uid ? styles.active : ''}`}
                                            onClick={() => setSelectedChildId(child.uid)}
                                        >
                                            <img src={getAvatarUrl(child.profilepictureurl)} alt={child.firstname} className={styles.childAvatarImg} />
                                            <span className={styles.childAvatarName}>{child.firstname}</span>
                                        </button>
                                    ))}
                                </div>

                                {parentChildren.filter(c => c.uid === selectedChildId).map(child => {
                                    const level = Math.floor((child.xp || 0) / 100) + 1;
                                    
                                    return (
                                        <motion.div 
                                            key={`dashboard-${child.uid}`} 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3 }}
                                            style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
                                        >
                                            {/* Large Profile Card */}
                                            <div className={`${styles.premiumCard} ${styles.profileCard}`}>
                                                <div className={styles.premiumProfileInfo}>
                                                    <img src={getAvatarUrl(child.profilepictureurl)} alt="Profile" className={styles.profileAvatar} />
                                                    <div className={styles.profileDetails}>
                                                        <h2>{child.firstname} {child.lastname}</h2>
                                                        <p>@{child.username}</p>
                                                        
                                                        <div className={styles.profileMeta}>
                                                            <div className={styles.metaItem}>
                                                                <span className={styles.metaLabel}>Level</span>
                                                                <span className={styles.metaValue}>{level}</span>
                                                            </div>
                                                            <div className={styles.metaItem}>
                                                                <span className={styles.metaLabel}>Goal</span>
                                                                <span className={styles.metaValue}>Become fluent in Python</span>
                                                            </div>
                                                            <div className={styles.metaItem}>
                                                                <span className={styles.metaLabel}>Joined</span>
                                                                <span className={styles.metaValue}>March 2026</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className={styles.profileActions}>
                                                    <button className={styles.premiumBtn}>View Full Report</button>
                                                    <button className={styles.premiumBtn}>Message Child</button>
                                                    <button className={`${styles.premiumBtn} ${styles.danger}`} onClick={() => handleDisconnectChild(child.uid)}>
                                                        Disconnect
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Stats Grid */}
                                            <div className={styles.premiumGrid}>
                                                <div className={styles.premiumCard}>
                                                    <div className={styles.statCardHeader}>
                                                        <span>Study Time</span>
                                                        <Clock size={18} color="#737373" />
                                                    </div>
                                                    <div className={styles.statCardValue}>14h 35m</div>
                                                    <div className={styles.statCardTrend}>↑ +18% compared to last week</div>
                                                </div>
                                                <div className={styles.premiumCard}>
                                                    <div className={styles.statCardHeader}>
                                                        <span>Current Streak</span>
                                                        <span>🔥</span>
                                                    </div>
                                                    <div className={styles.statCardValue}>{child.currentstreak || 15} Days</div>
                                                    <div className={styles.statCardTrend}>Keep it up!</div>
                                                </div>
                                                <div className={styles.premiumCard}>
                                                    <div className={styles.statCardHeader}>
                                                        <span>Average Score</span>
                                                        <GraduationCap size={18} color="#737373" />
                                                    </div>
                                                    <div className={styles.statCardValue}>91%</div>
                                                    <div className={styles.statCardTrend} style={{color: '#737373'}}>Across all quizzes</div>
                                                </div>
                                                <div className={styles.premiumCard}>
                                                    <div className={styles.statCardHeader}>
                                                        <span>Course Completion</span>
                                                        <Target size={18} color="#737373" />
                                                    </div>
                                                    <div className={styles.statCardValue}>78%</div>
                                                    <div className={styles.statCardTrend} style={{color: '#737373'}}>Overall progress</div>
                                                </div>
                                            </div>

                                            <div className={styles.premiumGrid3}>
                                                {/* Study Activity Chart */}
                                                <div className={styles.premiumCard}>
                                                    <h3 className={styles.cardTitle}><Activity size={18} /> Study Activity</h3>
                                                    <p className={styles.cardSubtitle}>Past 7 Days</p>
                                                    <div style={{ width: '100%', height: '240px' }}>
                                                        <ResponsiveContainer width="100%" height="100%">
                                                            <BarChart data={mockStudyData}>
                                                                <Tooltip 
                                                                    cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                                                    contentStyle={{ background: '#171717', border: '1px solid #404040', borderRadius: '8px', color: '#fff' }}
                                                                />
                                                                <XAxis dataKey="name" stroke="#737373" tick={{fill: '#737373', fontSize: 12}} axisLine={false} tickLine={false} />
                                                                <Bar dataKey="hours" fill="#ededed" radius={[4, 4, 0, 0]} />
                                                            </BarChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                </div>

                                                {/* AI Summary */}
                                                <div className={styles.premiumCard} style={{ background: 'linear-gradient(180deg, #0a0a0a 0%, #171717 100%)' }}>
                                                    <h3 className={styles.cardTitle}><Sparkles size={18} color="#a78bfa" /> AI Summary</h3>
                                                    <p className={styles.cardSubtitle}>Weekly Insights</p>
                                                    <p className={styles.aiSummaryText}>
                                                        This week, {child.firstname} studied for 14 hours across 6 days.
                                                        Mathematics score increased by 8%. English performance dropped slightly compared to last week.
                                                    </p>
                                                    <div className={styles.aiRecommendation}>
                                                        <h4>Recommendation</h4>
                                                        <p>Encourage 30 minutes of extra English practice this week to improve consistency.</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={styles.premiumGrid2}>
                                                {/* Subject Performance */}
                                                <div className={styles.premiumCard}>
                                                    <h3 className={styles.cardTitle}>Subject Performance</h3>
                                                    <p className={styles.cardSubtitle}>Average scores by subject</p>
                                                    <div className={styles.subjectsList}>
                                                        {mockSubjects.map(sub => (
                                                            <div key={sub.name} className={styles.subjectRow}>
                                                                <div className={styles.subjectHeader}>
                                                                    <span className={styles.subjectName}>{sub.name}</span>
                                                                    <span className={styles.subjectScore}>{sub.score}%</span>
                                                                </div>
                                                                <div className={styles.subjectProgressBg}>
                                                                    <div className={`${styles.subjectProgressFill} ${styles[sub.status]}`} style={{ width: sub.width }}></div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Recent Activity */}
                                                <div className={styles.premiumCard}>
                                                    <h3 className={styles.cardTitle}>Recent Activities</h3>
                                                    <p className={styles.cardSubtitle}>Timeline of achievements</p>
                                                    <div className={styles.timelineList}>
                                                        {mockTimeline.map(item => (
                                                            <div key={item.id} className={styles.timelineItem}>
                                                                <div className={styles.timelineIcon}>{item.icon}</div>
                                                                <div className={styles.timelineContent}>
                                                                    <p className={styles.timelineTitle}>{item.title}</p>
                                                                    <span className={styles.timelineTime}>{item.time}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                        </motion.div>
                                    );
                                })}
                            </>
                        ) : (
                            <div className={styles.premiumCard} style={{ textAlign: 'center', padding: '60px 20px', alignItems: 'center' }}>
                                <Bell size={32} color="#737373" style={{ marginBottom: '16px' }} />
                                <h2 style={{ fontSize: '24px', margin: '0 0 8px 0', color: '#ededed' }}>No Connected Accounts</h2>
                                <p style={{ color: '#a3a3a3', margin: 0 }}>Please go to the Parent Connect page to link a child's account.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <section className={styles.glassPanel} style={{ padding: '40px', borderRadius: '16px', textAlign: 'center', marginTop: '20px', width: '100%' }}>
                        <h2 style={{ fontSize: '28px', marginBottom: '10px', color: 'var(--text-color)' }}>Welcome to Keaktek!</h2>
                        <p style={{ color: '#94a3b8', fontSize: '16px' }}>
                            Your dashboard features are coming soon.
                        </p>
                    </section>
                )}
            </div>
        );
    };

    const renderUsersTab = () => (
        <div className={`${styles.pageContent} ${activeTab === 'Users' ? (isSwitching ? styles.animateFadeIn : '') : styles.hidden}`} style={{ display: activeTab === 'Users' ? 'flex' : 'none' }}>
            <section className={styles.statsGrid}>
                <div className={`${styles.statCard} ${styles.glassPanel}`}>
                    <div className={styles.statHeader}><span style={{ color: getRoleColor('Teacher') }}>Teachers</span><svg style={{ stroke: getRoleColor('Teacher') }} viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"></circle><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path></svg></div>
                    <div className={styles.statValue}>{users.filter(u => u.rolename === 'Teacher').length}</div>
                </div>
                <div className={`${styles.statCard} ${styles.glassPanel}`}>
                    <div className={styles.statHeader}><span style={{ color: getRoleColor('Student') }}>Students</span><svg style={{ stroke: getRoleColor('Student') }} viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"></circle><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path></svg></div>
                    <div className={styles.statValue}>{users.filter(u => u.rolename === 'Student').length}</div>
                </div>
                <div className={`${styles.statCard} ${styles.glassPanel}`}>
                    <div className={styles.statHeader}><span style={{ color: getRoleColor('Admin') }}>Admins</span><svg style={{ stroke: getRoleColor('Admin') }} viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"></circle><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path></svg></div>
                    <div className={styles.statValue}>{users.filter(u => u.rolename === 'Admin').length}</div>
                </div>
                <div className={`${styles.statCard} ${styles.glassPanel}`}>
                    <div className={styles.statHeader}><span style={{ color: getRoleColor('Parent') }}>Parents</span><svg style={{ stroke: getRoleColor('Parent') }} viewBox="0 0 24 24"><circle cx="12" cy="7" r="4"></circle><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path></svg></div>
                    <div className={styles.statValue}>{users.filter(u => u.rolename === 'Parent').length}</div>
                </div>
            </section>
            <section className={`${styles.tableSection} ${styles.glassPanel}`}>
                <div className={styles.tableHeader}>
                    <h2>Directory <span style={{ fontSize: '14px', color: '#888', fontWeight: 'normal', marginLeft: '8px' }}>({users.length} total)</span></h2>
                    <div className={styles.tableActions}>
                        <input 
                            type="text" 
                            className={`${styles.formInput} ${styles.tableSearch}`} 
                            placeholder="Search user..." 
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                        <div className={styles.filterWrapper} ref={filterContainerRef}>
                            <button className={`${styles.filterBtn} ${styles.tooltip} ${styles.tooltipBottom}`} data-tooltip="Filter Users" onClick={() => setIsFilterPopupOpen(!isFilterPopupOpen)}>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                            </button>
                            <div className={`${styles.filterPopup} ${styles.glassPanel} ${isFilterPopupOpen ? styles.show : ''}`}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#888' }}>Filter by Role</h4>
                                {['All', 'Admin', 'Teacher', 'Student', 'Parent'].map(r => (
                                    <div key={r} className={styles.popupItem} onClick={() => { setFilterRole(r); setIsFilterPopupOpen(false); }}>
                                        <span style={{ fontWeight: filterRole === r ? 'bold' : 'normal' }}>{r}</span>
                                        {filterRole === r && <svg viewBox="0 0 24 24" width="14" height="14" stroke="#10b981" fill="none" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button className={`${styles.addCircleBtn} ${styles.tooltip} ${styles.tooltipBottom}`} data-tooltip="Add User" onClick={() => {
                            setModalForm({ email: '', password: '', firstName: '', lastName: '', roleName: 'Student' });
                            setIsAddModalOpen(true);
                        }}>
                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                    </div>
                </div>
                {loadingUsers ? (
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <Skeleton height="45px" borderRadius="10px" />
                        <Skeleton height="45px" borderRadius="10px" />
                        <Skeleton height="45px" borderRadius="10px" />
                        <Skeleton height="45px" borderRadius="10px" />
                        <Skeleton height="45px" borderRadius="10px" />
                    </div>
                ) : (
                <table className={styles.dataTable}>
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Full Name</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Grade</th>
                            <th>Login Method</th>
                            <th>XP</th>
                            <th>Joined</th>
                            <th>Last Active</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.map(user => (
                            <tr key={user.uid}>
                                <td>{user.username}</td>
                                <td>{user.firstname} {user.lastname}</td>
                                <td>{user.email}</td>
                                <td><span className={`${styles.roleBadge} ${styles[user.rolename ? user.rolename.toLowerCase() : '']}`}>{user.rolename}</span></td>
                                <td>{user.grade || '-'}</td>
                                <td>{user.login_method}</td>
                                <td>{user.xp}</td>
                                <td>{new Date(user.createdat).toLocaleDateString()}</td>
                                <td>{user.lastlogindate ? new Date(user.lastlogindate + (user.lastlogindate.endsWith('Z') ? '' : 'Z')).toLocaleString() : 'Never'}</td>
                                <td className={styles.actionCell}>
                                    <div className={styles.actionMenuWrapper}>
                                        <button className={styles.threeDotsBtn} onClick={(e) => toggleTablePopup(e, user.uid)}>
                                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                                        </button>
                                        <div className={`${styles.tablePopup} ${styles.glassPanel} ${activeTablePopupId === user.uid ? styles.show : ''}`}>
                                            <div className={styles.popupItem} onClick={() => {
                                                setSelectedUser(user);
                                                setModalForm({ firstName: user.firstname || '', lastName: user.lastname || '' });
                                                setActiveTablePopupId(null);
                                                setIsEditModalOpen(true);
                                            }}>
                                                <span>Edit User</span>
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                            </div>
                                            <div className={`${styles.popupItem} ${styles.hasNestedMenu}`} onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveRoleMenuId(activeRoleMenuId === user.uid ? null : user.uid);
                                            }}>
                                                <span>Modify Role</span>
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                                
                                                <div className={`${styles.nestedMenu} ${activeRoleMenuId === user.uid ? styles.show : ''}`}>
                                                    {['Student', 'Parent', 'Teacher', 'Admin'].map(role => (
                                                        <div 
                                                            key={role} 
                                                            className={styles.popupItem} 
                                                            style={{ color: user.rolename === role ? getRoleColor(role) : undefined }}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleModifyRole(user, role);
                                                            }}
                                                        >
                                                            <span>{role}</span>
                                                            {user.rolename === role && (
                                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className={styles.popupItem} onClick={() => {
                                                setSelectedUser(user);
                                                setModalForm({ password: '' });
                                                setActiveTablePopupId(null);
                                                setIsResetModalOpen(true);
                                            }}>
                                                <span>Reset Password</span>
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                            </div>
                                            <div className={styles.popupItem} style={{color: '#ef4444', borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: '4px', paddingTop: '8px'}} onClick={() => {
                                                setSelectedUser(user);
                                                setActiveTablePopupId(null);
                                                setIsDeleteModalOpen(true);
                                            }}>
                                                <span>Delete User</span>
                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                )}
            </section>
        </div>
    );

    const renderAnalyticsTab = () => (
        <div className={`${styles.pageContent} ${activeTab === 'Analytics' ? (isSwitching ? styles.animateFadeIn : '') : styles.hidden}`} style={{ display: activeTab === 'Analytics' ? 'flex' : 'none' }}>
            <section className={styles.statsGrid}>
                <div className={`${styles.statCard} ${styles.glassPanel}`}>
                    <div className={styles.statHeader}><span>Page Views</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg></div>
                    <div className={styles.statValue}>1.2M</div>
                    <div className={styles.statTrend}>+14% vs last week</div>
                </div>
                <div className={`${styles.statCard} ${styles.glassPanel}`}>
                    <div className={styles.statHeader}><span>Bounce Rate</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></div>
                    <div className={styles.statValue}>42.3%</div>
                    <div className={styles.statTrend} style={{color:'#ef4444'}}>-2.1% vs last week</div>
                </div>
            </section>
            <section className={styles.glassPanel} style={{padding: '30px', flex: 1}}>
                <h2 style={{marginBottom: '20px'}}>Traffic Overview</h2>
                <div className={styles.mockChart}>
                    [ Interactive Chart Area ]
                </div>
            </section>
        </div>
    );

    const renderLessonsTab = () => (
        <div className={`${styles.pageContent} ${activeTab === 'Lessons' ? (isSwitching ? styles.animateFadeIn : '') : styles.hidden}`} style={{ display: activeTab === 'Lessons' ? 'flex' : 'none' }}>
            <div className={styles.tableHeader}>
                <h2>Curriculum Modules</h2>
                <button className={styles.viewAllBtn}>Create Lesson</button>
            </div>
            <section className={styles.statsGrid}>
                {mockLessons.map(lesson => (
                    <div key={lesson.id} className={`${styles.statCard} ${styles.glassPanel}`}>
                        <div className={styles.statHeader}><span>{lesson.title}</span><span className={`${styles.status} ${lesson.status === 'Published' ? styles.active : styles.pending}`}>{lesson.status}</span></div>
                        <h3 style={{margin: '10px 0'}}>{lesson.subtitle}</h3>
                        <div className={styles.statTrend}>{lesson.enrolled} Enrolled</div>
                    </div>
                ))}
            </section>
        </div>
    );

    const renderQuizTab = () => (
        <div className={`${styles.pageContent} ${activeTab === 'Quiz' ? (isSwitching ? styles.animateFadeIn : '') : styles.hidden}`} style={{ display: activeTab === 'Quiz' ? 'flex' : 'none' }}>
            <section className={styles.statsGrid}>
                <div className={`${styles.statCard} ${styles.glassPanel}`}>
                    <div className={styles.statHeader}><span>Avg Score</span></div>
                    <div className={styles.statValue}>78%</div>
                </div>
                <div className={`${styles.statCard} ${styles.glassPanel}`}>
                    <div className={styles.statHeader}><span>Completion Rate</span></div>
                    <div className={styles.statValue}>92%</div>
                </div>
            </section>
            <section className={`${styles.tableSection} ${styles.glassPanel}`}>
                <div className={styles.tableHeader}>
                    <h2>Active Quizzes</h2>
                    <button className={styles.viewAllBtn}>New Quiz</button>
                </div>
                <table className={styles.dataTable}>
                    <thead><tr><th>Title</th><th>Subject</th><th>Submissions</th><th>Avg Score</th></tr></thead>
                    <tbody>
                        <tr><td>Midterm Exam</td><td>Mathematics</td><td>45/50</td><td>82%</td></tr>
                        <tr><td>Pop Quiz 1</td><td>Physics</td><td>120/142</td><td>74%</td></tr>
                        <tr><td>Final Project</td><td>History</td><td>12/20</td><td>88%</td></tr>
                    </tbody>
                </table>
            </section>
        </div>
    );

    
    const renderGamesTab = () => (
        <div className={`${styles.pageContent} ${activeTab === 'Games' ? (isSwitching ? styles.animateFadeIn : '') : styles.hidden}`} style={{ display: activeTab === 'Games' ? 'flex' : 'none', flexDirection: 'column' }}>
            <section className={styles.glassPanel} style={{padding: '30px', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: '60vh'}}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{width: '64px', height: '64px', color: '#6366f1', marginBottom: '20px'}}>
                    <path d="M6 12h4m-2 -2v4m4-1h.01M16 11h.01"></path>
                    <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                </svg>
                <h2 style={{marginBottom: '10px', fontSize: '24px'}}>Games Management</h2>
                <p style={{color: 'var(--text-muted, #888)', maxWidth: '400px', marginBottom: '30px'}}>
                    Add, modify, and publish interactive games to the Keaktek app. This module is currently under development.
                </p>
                <button style={{ padding: '10px 20px', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', opacity: 0.7, cursor: 'not-allowed' }}>
                    Publish New Game
                </button>
            </section>
        </div>
    );

    const renderConsoleTab = () => (
        <div className={`${styles.pageContent} ${activeTab === 'Console' ? (isSwitching ? styles.animateFadeIn : '') : styles.hidden}`} style={{ display: activeTab === 'Console' ? 'flex' : 'none' }}>
            <section style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div className={styles.consoleContainer}>
                    <div className={styles.consoleHeader}>
                        <div className={styles.consoleTabs}>
                            <div className={`${styles.consoleTab} ${styles.active}`}>View All ({auditLogs.length})</div>
                            <div className={styles.consoleTab} onClick={() => queryClient.invalidateQueries({ queryKey: ['auditLogs'] })}>Refresh</div>
                        </div>
                        <div className={styles.consoleActions}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#888" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#888" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#888" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg>
                        </div>
                    </div>
                    <div className={styles.consoleLogs} style={{ overflowY: 'auto', flex: 1 }}>
                        {[...auditLogs].reverse().map(log => {
                            const time = new Date(log.created_at).toLocaleTimeString();
                            let color = '#fff';
                            if (log.action === 'DELETE_USER') color = '#ef4444'; // red
                            else if (log.action === 'ADD_USER') color = '#10b981'; // green
                            else if (log.action === 'EDIT_USER') color = '#3b82f6'; // blue
                            else if (log.action === 'UPDATE_ROLE' || log.action === 'RESET_PASSWORD') color = '#eab308'; // yellow
                            
                            return (
                                <div key={log.id} style={{ color }}>
                                    [{time}] [{log.action}]: {log.details} (Actor: {log.actor_username || 'System'})
                                </div>
                            );
                        })}
                        <div ref={consoleEndRef} />
                        {auditLogs.length === 0 && <div style={{ color: '#888' }}>No logs found.</div>}
                    </div>
                    <div className={styles.consoleInputArea}>
                        <div className={styles.consoleInputBox}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#888" strokeWidth="2"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                            <input type="text" className={styles.consoleInput} placeholder="Type a command..." />
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#888" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );

    const renderSettingsTab = () => (
        <div className={`${styles.pageContent} ${activeTab === 'Settings' ? (isSwitching ? styles.animateFadeIn : '') : styles.hidden}`} style={{ display: activeTab === 'Settings' ? 'flex' : 'none', flexDirection: 'column' }}>

            <section className={styles.appearancePanel}>
                <div className={styles.appearanceTitle}>Appearance</div>
                
                <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                        <div className={styles.settingLabel}>Light/Dark Mode</div>
                        <div className={styles.settingDesc}>Choose the style that suits you best</div>
                    </div>
                    <div className={styles.settingControl}>
                        <div className={styles.themeGroup}>
                            <button className={`${styles.themeBtn} ${themeMode === 'Light' ? styles.active : ''}`} onClick={() => setThemeMode('Light')}>
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
                                Light
                            </button>
                            <button className={`${styles.themeBtn} ${themeMode === 'Dark' ? styles.active : ''}`} onClick={() => setThemeMode('Dark')}>
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                                Dark
                            </button>
                            <button className={`${styles.themeBtn} ${themeMode === 'Oled' ? styles.active : ''}`} onClick={() => setThemeMode('Oled')}>
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="2"></circle><path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path></svg>
                                Oled
                            </button>
                            <button className={`${styles.themeBtn} ${themeMode === 'Auto' ? styles.active : ''}`} onClick={() => setThemeMode('Auto')}>
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                                Auto
                            </button>
                        </div>
                    </div>
                </div>

                <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                        <div className={styles.settingLabel}>Panel Sounds</div>
                        <div className={styles.settingDesc}>Play a sound at crucial moments in the panel</div>
                    </div>
                    <div className={styles.settingControl}>
                        Off
                        <div className={`${styles.toggleSwitch} ${panelSounds ? styles.active : ''}`} onClick={() => setPanelSounds(!panelSounds)}>
                            <div className={styles.toggleSlider}></div>
                        </div>
                        On
                    </div>
                </div>

                <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                        <div className={styles.settingLabel}>Animations</div>
                        <div className={styles.settingDesc}>Enable or disable animations in the panel</div>
                    </div>
                    <div className={styles.settingControl}>
                        Off
                        <div className={`${styles.toggleSwitch} ${animations ? styles.active : ''}`} onClick={() => setAnimations(!animations)}>
                            <div className={styles.toggleSlider}></div>
                        </div>
                        On
                    </div>
                </div>

            </section>

            <section className={styles.appearancePanel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div className={styles.appearanceTitle} style={{ marginBottom: 0 }}>Account Settings</div>
                </div>
                <div className={styles.securityInputGroup}>
                    <label>Display Name</label>
                    <input type="text" className={styles.formInput} placeholder="Update Name" defaultValue="Justin Mason" />
                </div>
                <div className={styles.securityInputGroup}>
                    <label>Email Address</label>
                    <input type="email" className={styles.formInput} placeholder="Update Email" defaultValue="admin@nexus.ui" />
                </div>
                <div className={styles.securityInputGroup}>
                    <label>Role</label>
                    <input type="text" className={styles.formInput} defaultValue="Super Administrator" disabled style={{opacity: 0.5, cursor: 'not-allowed'}} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
                    <button className={styles.greenBtn}>Save Changes</button>
                </div>
            </section>

            <section className={styles.appearancePanel}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div className={styles.appearanceTitle} style={{ marginBottom: 0 }}>Update Password</div>
                </div>
                <div className={styles.securityInputGroup}>
                    <label>Current Password</label>
                    <input type="password" className={styles.formInput} placeholder="Current Password" />
                </div>
                <div className={styles.securityInputGroup}>
                    <label>New Password</label>
                    <input type="password" className={styles.formInput} placeholder="New Password" />
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '5px' }}>Your new password should be at least 8 characters in length and unique to this website.</div>
                </div>
                <div style={{ borderBottom: '1px solid #222', margin: '15px 0' }}></div>
                <div className={styles.securityInputGroup}>
                    <label>Confirm New Password</label>
                    <input type="password" className={styles.formInput} placeholder="Confirm New Password" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '15px' }}>
                    <button className={styles.greenBtn}>Update Password</button>
                </div>
            </section>

            <section className={styles.appearancePanel}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px' }}>
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    <div className={styles.appearanceTitle} style={{ marginBottom: 0 }}>Two Factor Authentication</div>
                </div>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>
                    You do not currently have two-step verification enabled on your account. Click the button below to begin configuring it.
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button className={styles.greenBtn}>Enable Two-Step</button>
                </div>
            </section>

            <section className={styles.appearancePanel}>
                <div className={styles.activityHeader}>
                    <div className={styles.appearanceTitle} style={{ marginBottom: 0 }}>Account Activity Log</div>
                    <button className={styles.activityFiltersBtn}>
                        Activity Filters
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                </div>

                <div className={styles.activityRow}>
                    <div className={styles.activityCol}>
                        <div className={styles.activityIcon}>
                            <img src="https://i.pravatar.cc/150?u=a042581f4e29026024d" alt="user" />
                        </div>
                        <span style={{ color: 'var(--text-color, #e2e8f0)' }}>sigma_ekoa</span>
                    </div>
                    <div className={styles.activityCol}>user:account.profile-updated</div>
                    <div className={styles.activityCol}>🇺🇸 103.216.49.138</div>
                    <div className={styles.activityCol} style={{ justifyContent: 'flex-end' }}>21 minutes ago</div>
                </div>

                <div className={styles.activityRow}>
                    <div className={styles.activityCol}>
                        <div className={styles.activityIcon}>
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#888" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        </div>
                        <span style={{ color: '#888' }}>System</span>
                    </div>
                    <div className={styles.activityCol}>auth:oauth-login</div>
                    <div className={styles.activityCol}></div>
                    <div className={styles.activityCol} style={{ justifyContent: 'flex-end' }}>18 days ago</div>
                </div>

                <div className={styles.activityRow}>
                    <div className={styles.activityCol}>
                        <div className={styles.activityIcon}>
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#888" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        </div>
                        <span style={{ color: '#888' }}>System</span>
                    </div>
                    <div className={styles.activityCol}>auth:oauth-login</div>
                    <div className={styles.activityCol}></div>
                    <div className={styles.activityCol} style={{ justifyContent: 'flex-end' }}>23 days ago</div>
                </div>
                
                <div className={styles.activityRow}>
                    <div className={styles.activityCol}>
                        <div className={styles.activityIcon}>
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#888" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        </div>
                        <span style={{ color: '#888' }}>System</span>
                    </div>
                    <div className={styles.activityCol}>auth:fail</div>
                    <div className={styles.activityCol}></div>
                    <div className={styles.activityCol} style={{ justifyContent: 'flex-end', gap: '15px' }}>
                        23 days ago
                        <button className={styles.clipboardBtn}>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><line x1="9" y1="14" x2="15" y2="14"></line><line x1="9" y1="18" x2="15" y2="18"></line><line x1="9" y1="10" x2="10" y2="10"></line></svg>
                        </button>
                    </div>
                </div>

                <div className={styles.activityRow}>
                    <div className={styles.activityCol}>
                        <div className={styles.activityIcon}>
                            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#888" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                        </div>
                        <span style={{ color: '#888' }}>System</span>
                    </div>
                    <div className={styles.activityCol}>auth:fail</div>
                    <div className={styles.activityCol}></div>
                    <div className={styles.activityCol} style={{ justifyContent: 'flex-end', gap: '15px' }}>
                        23 days ago
                        <button className={styles.clipboardBtn}>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><line x1="9" y1="14" x2="15" y2="14"></line><line x1="9" y1="18" x2="15" y2="18"></line><line x1="9" y1="10" x2="10" y2="10"></line></svg>
                        </button>
                    </div>
                </div>
            </section>
        </div>
    );

    const renderBackupTab = () => (
        <div className={`${styles.pageContent} ${activeTab === 'Backup' ? (isSwitching ? styles.animateFadeIn : '') : styles.hidden}`} style={{ display: activeTab === 'Backup' ? 'flex' : 'none' }}>
            <section className={`${styles.glassPanel}`} style={{ padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ marginBottom: '5px' }}>System Backup Settings</h2>
                    <p style={{ color: '#888', fontSize: '13px', margin: 0 }}>Configure automatic backups or force a manual backup.</p>
                </div>
                <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color:'#888'}}>Frequency</label>
                        <div className={styles.customSelectContainer} style={{ width: '130px' }}>
                            <div 
                                className={styles.customSelectBox} 
                                style={{ height: '40px', padding: '0 15px', fontSize: '13px' }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsFrequencyDropdownOpen(!isFrequencyDropdownOpen);
                                }}
                            >
                                <span>{autoBackupFrequency}</span>
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isFrequencyDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </div>
                            <div className={`${styles.customSelectList} ${isFrequencyDropdownOpen ? styles.show : ''}`}>
                                {['Daily', 'Weekly', 'Monthly'].map(freq => (
                                    <div 
                                        key={freq} 
                                        className={styles.customSelectOption}
                                        style={{ padding: '8px 15px', fontSize: '13px' }}
                                        onClick={() => {
                                            setAutoBackupFrequency(freq);
                                            setIsFrequencyDropdownOpen(false);
                                        }}
                                    >
                                        {freq}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <label style={{fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color:'#888'}}>Time</label>
                        <input type="time" className={styles.formInput} style={{ width: '140px', height: '40px', padding: '0 15px', fontSize: '13px', cursor: 'text' }} value={autoBackupTime} onChange={(e) => setAutoBackupTime(e.target.value)} />
                    </div>
                    <button className={styles.confirmBtn} style={{ padding: '0 20px', height: '40px', fontSize: '14px', whiteSpace: 'nowrap' }} onClick={handleForceBackup}>Force Backup Now</button>
                </div>
            </section>
            
            <section className={`${styles.tableSection} ${styles.glassPanel}`}>
                <div className={styles.tableHeader}>
                    <h2>Recent Backups</h2>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        {selectedBackups.length > 0 && (
                            <span style={{ fontSize: '13px', color: '#888' }}>{selectedBackups.length} selected</span>
                        )}
                        {selectedBackups.length > 0 && (
                            <button className={styles.confirmBtn} style={{ padding: '8px 15px', height: '35px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                Download
                            </button>
                        )}
                        {backups.length > 0 && (
                            <button 
                                className={styles.iconBtn} 
                                style={{ padding: '8px 15px', height: '35px', fontSize: '13px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.2)', background: 'transparent', color: '#fff', whiteSpace: 'nowrap', width: 'auto' }}
                                onClick={() => {
                                    if (selectedBackups.length === backups.length) {
                                        setSelectedBackups([]);
                                    } else {
                                        setSelectedBackups(backups.map(b => b.id));
                                    }
                                }}
                            >
                                {selectedBackups.length === backups.length ? 'Deselect All' : 'Select All'}
                            </button>
                        )}
                    </div>
                </div>
                <div className={styles.tableContainer}>
                    <table className={styles.dataTable}>
                        <thead>
                            <tr>
                                <th>BACKUP ID</th>
                                <th>FILE NAME</th>
                                <th>DATE</th>
                                <th>SIZE</th>
                                <th style={{ width: '50px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {backups.map((b, index) => {
                                const oldestUnlockedId = backups.length >= 10 ? backups.slice().reverse().find(backup => !backup.locked)?.id : null;
                                const isOldestAndCapped = b.id === oldestUnlockedId;
                                const isLocked = b.locked;
                                return (
                                <tr key={b.id} style={{ backgroundColor: isLocked ? 'rgba(34, 197, 94, 0.05)' : isOldestAndCapped ? 'rgba(239, 68, 68, 0.05)' : undefined }}>
                                    <td className={styles.userId} style={{ color: isLocked ? '#22c55e' : isOldestAndCapped ? '#ef4444' : undefined }}>{b.id}</td>
                                    <td style={{ fontWeight: 'bold', color: isLocked ? '#22c55e' : isOldestAndCapped ? '#ef4444' : undefined, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {isLocked && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>}
                                        {b.name}
                                        {isOldestAndCapped && (
                                            <span style={{ fontSize: '11px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '2px 6px', borderRadius: '4px', marginLeft: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                                Pending Deletion
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ color: isLocked ? 'rgba(34, 197, 94, 0.8)' : isOldestAndCapped ? 'rgba(239, 68, 68, 0.7)' : '#888' }}>{b.date}</td>
                                    <td style={{ color: isLocked ? 'rgba(34, 197, 94, 0.8)' : isOldestAndCapped ? 'rgba(239, 68, 68, 0.7)' : '#888' }}>{b.size}</td>
                                    <td className={styles.actionsCell}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '15px' }}>
                                            <input 
                                                type="checkbox" 
                                                style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: '#3b82f6', margin: 0, colorScheme: 'dark' }}
                                                checked={selectedBackups.includes(b.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedBackups([...selectedBackups, b.id]);
                                                    else setSelectedBackups(selectedBackups.filter(id => id !== b.id));
                                                }}
                                            />
                                            <div className={styles.actionMenuWrapper}>
                                                <button className={styles.threeDotsBtn} onClick={() => setActiveTablePopupId(activeTablePopupId === b.id ? null : b.id)}>
                                                    <svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                                                </button>
                                                <div className={`${styles.tablePopup} ${activeTablePopupId === b.id ? styles.show : ''}`}>
                                                    <div className={styles.popupItem} style={{ justifyContent: 'flex-start', gap: '8px' }} onClick={() => {
                                                        setBackups(backups.map(backup => backup.id === b.id ? { ...backup, locked: !backup.locked } : backup));
                                                        setActiveTablePopupId(null);
                                                    }}>
                                                        {b.locked ? (
                                                            <>
                                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path></svg>
                                                                Unlock
                                                            </>
                                                        ) : (
                                                            <>
                                                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                                                Lock
                                                            </>
                                                        )}
                                                    </div>
                                                    <div className={styles.popupItem} style={{ justifyContent: 'flex-start', gap: '8px' }}>
                                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                                        Download (.sql)
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const renderFileTab = () => {

        return (
            <div className={`${styles.pageContent} ${activeTab === 'File' ? (isSwitching ? styles.animateFadeIn : '') : styles.hidden}`} style={{ display: activeTab === 'File' ? 'flex' : 'none', width: '100%' }}>
                <section className={`${styles.glassPanel} ${styles.fileManagerContainer}`} style={{ padding: '20px 30px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div className={styles.fileManagerHeader}>
                        <div className={styles.fileManagerSearch}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#888" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input type="text" placeholder="Search" />
                        </div>
                        <div className={styles.fileManagerActions}>
                            <button className={styles.fileBtn}>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
                                Create Directory
                            </button>
                            <button className={styles.fileBtn}>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Upload
                            </button>
                            <button className={`${styles.fileBtn} ${styles.primary}`}>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                                New file
                            </button>
                            <button className={styles.fileBtn}>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </div>
                    
                    <table className={styles.fileTable}>
                        <thead>
                            <tr>
                                <th style={{ width: '40px', textAlign: 'center' }}><input type="checkbox" style={{ margin: 0 }} /></th>
                                <th>name +"</th>
                                <th style={{ width: '150px' }}>size +"</th>
                                <th style={{ width: '200px' }}>date +"</th>
                                <th style={{ width: '50px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className={styles.fileRow}>
                                <td style={{ textAlign: 'center' }}><input type="checkbox" style={{ margin: 0 }} /></td>
                                <td>
                                    <div className={styles.fileIcon}>
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                        logs
                                    </div>
                                </td>
                                <td><span className={styles.fileSize}>--</span></td>
                                <td><span className={styles.fileDate}>System Folder</span></td>
                                <td>
                                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#888" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                                </td>
                            </tr>
                            {logFiles.map(file => (
                                <tr key={file.name} className={styles.fileRow}>
                                    <td style={{ textAlign: 'center' }}><input type="checkbox" style={{ margin: 0 }} /></td>
                                    <td>
                                        <div className={`${styles.fileIcon} ${styles.logFile}`}>
                                            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                            {file.name}
                                        </div>
                                    </td>
                                    <td><span className={styles.fileSize}>{formatBytes(file.size)}</span></td>
                                    <td><span className={styles.fileDate}>{new Date(file.date).toLocaleString()}</span></td>
                                    <td>
                                        <svg onClick={async () => {
                                            try {
                                                await apiFetch(`/files/logs/${file.name}`, {
                                                    method: 'DELETE',
                                                    headers: { 'Authorization': `Bearer ${token}` }
                                                });
                                                queryClient.invalidateQueries({ queryKey: ['logFiles'] });
                                            } catch (e) {
                                                console.error(e);
                                            }
                                        }} viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#ef4444" strokeWidth="2" style={{ cursor: 'pointer' }}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </div>
        );
    };

    return (
        <div className={styles.dashboardWrapper}>
            <StudyBackground isDark={isDark} />
            <aside className={`${styles.sidebar} ${styles.glassPanel}`}>
                <div className={styles.logoContainer}>
                    <img src={logoLight} alt="Keaktek" className={styles.logoLight} />
                    <img src={logoDark} alt="Keaktek" className={styles.logoDark} />
                    <span className={styles.logoText}>Keaktek</span>
                </div>
                <ul className={styles.navLinks}>
                    {user?.role === 'Student' ? (
                        <>
                            <div className={styles.sidebarSection}>MY COURSES</div>
                            <li data-tooltip="Overview" className={`${activeTab === 'Dashboard' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Dashboard')}>
                                <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                Overview
                            </li>
                            <li data-tooltip="Board" className={`${activeTab === 'Board' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Board')}>
                                <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
                                Board
                            </li>
                            <li data-tooltip="Content" className={`${activeTab === 'Content' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Content')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                                Content
                            </li>
                            <li data-tooltip="Practice" className={`${activeTab === 'Practice' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Practice')}>
                                <svg viewBox="0 0 24 24"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                                Practice
                            </li>

                            <div className={styles.sidebarSection}>SOCIAL</div>
                            <li data-tooltip="Leaderboard" className={`${activeTab === 'Leaderboard' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Leaderboard')}>
                                <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                Leaderboard
                            </li>
                            <li data-tooltip="Class chat" className={`${activeTab === 'Chat' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Chat')}>
                                <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                                Class chat
                            </li>

                            <div className={styles.sidebarSection}>MY PROGRESS</div>
                            <li data-tooltip="Progress" className={`${activeTab === 'Progress' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Progress')}>
                                <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                                Progress
                            </li>
                            <li data-tooltip="Schedule" className={`${activeTab === 'Schedule' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Schedule')}>
                                <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                Schedule
                            </li>

                            <div style={{marginTop: '20px'}}></div>
                            <li data-tooltip="AI Study Buddy" className={`${activeTab === 'AIBuddy' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('AIBuddy')}>
                                <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path><path d="M17 11h-2a3 3 0 0 0-3-3H12a3 3 0 0 0-3 3H7a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2z"></path><path d="M12 22a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2z"></path></svg>
                                AI Study Buddy
                            </li>
                        </>
                    ) : (
                        <li data-tooltip="Dashboard Overview" className={`${activeTab === 'Dashboard' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Dashboard')}>
                            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                            Dashboard
                        </li>
                    )}

                    {user?.role === 'Admin' && (
                        <>
                            <li data-tooltip="Manage Users" className={`${activeTab === 'Users' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Users')}>
                                <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                                Users
                            </li>
                            <li data-tooltip="View Analytics" className={`${activeTab === 'Analytics' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Analytics')}>
                                <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                                Analytics
                            </li>
                            <li data-tooltip="Manage Content" className={`${activeTab === 'Content' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Content')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                                Content
                            </li>
                            <li data-tooltip="Manage Games" className={`${activeTab === 'Games' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Games')}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M6 12h4m-2 -2v4m4-1h.01M16 11h.01"></path>
                                    <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                                </svg>
                                Games
                            </li>
                            <li data-tooltip="System Console" className={`${activeTab === 'Console' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Console')}>
                                <svg viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
                                Console
                            </li>
                        </>
                    )}
                    <li 
                        className={`${styles.navItem} ${activeTab === 'Settings' ? styles.active : ''}`}
                        onClick={() => handleTabChange('Settings')}
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        Settings
                    </li>
                    <li 
                        className={`${styles.navItem} ${activeTab === 'File' ? styles.active : ''}`}
                        onClick={() => handleTabChange('File')}
                    >
                        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        File
                    </li>
                    {user?.role === 'Admin' && (
                        <li data-tooltip="System Backup" className={`${activeTab === 'Backup' ? styles.active : ''} ${styles.tooltip}`} onClick={() => handleTabChange('Backup')}>
                            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            Backup
                        </li>
                    )}
                </ul>

                <div className={styles.sidebarFooter} ref={profilePopupRef}>
                    {user?.profilePictureURL ? (
                                <img src={getAvatarUrl(user.profilePictureURL)} alt="" className={styles.profilePic} style={{ objectFit: 'cover' }} />
                    ) : (
                        <div className={styles.profilePic}></div>
                    )}
                    <div className={styles.profileInfo}>
                        <div className={styles.profileName}>{user?.firstName || ''} {user?.lastName || ''}</div>
                        <div className={styles.profileRole} style={{ color: getRoleColor(user?.role) }}>{user?.role || 'User'}</div>
                    </div>
                    
                    <button className={`${styles.threeDotsBtn} ${styles.tooltip}`} data-tooltip="More Options" onClick={(e) => {
                        e.stopPropagation();
                        setIsProfilePopupOpen(!isProfilePopupOpen);
                    }}>
                        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                    </button>

                    <div className={`${styles.profilePopup} ${styles.glassPanel} ${isProfilePopupOpen ? styles.show : ''}`}>
                        <div className={styles.popupItem} onClick={toggleTheme}>
                            <span>Toggle Theme</span>
                            <div className={styles.themeSpinIcon}>
                                <svg className={styles.sunIcon} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><line x1="12" y1="2" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"></line><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"></line><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"></line></svg>
                                <svg className={styles.moonIcon} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                            </div>
                        </div>
                        <div className={styles.popupItem} style={{color: '#ef4444', borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: '4px', paddingTop: '8px'}} onClick={handleLogout}>
                            <span>Log Out</span>
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        </div>
                    </div>
                </div>
            </aside>

            <main className={styles.mainContent}>
                <header className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.headerTitle}>
                            <h1>{activeTab}</h1>
                            <p>{getHeaderSubText()}</p>
                        </div>
                    </div>
                    
                    <div className={styles.headerControls}>
                        <div className={`${styles.searchContainer} ${isSearchActive ? styles.active : ''}`} ref={searchContainerRef}>
                            <input 
                                type="text" 
                                className={styles.searchInput} 
                                id="dashboardSearchInput"
                                placeholder="Search data..." 
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onClick={handleSearchClick}
                            />
                            <div className={styles.searchBtn}>
                                <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            </div>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <button className={`${styles.iconBtn} ${styles.tooltip} ${styles.tooltipBottom}`} data-tooltip="Notifications" onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                                {invitations.length > 0 && <span style={{ position: 'absolute', top: '0', right: '0', background: '#ef4444', color: 'white', fontSize: '10px', borderRadius: '50%', padding: '2px 5px', pointerEvents: 'none' }}>{invitations.length}</span>}
                            </button>
                            <div className={`${styles.notificationPopup} ${styles.glassPanel} ${isNotificationsOpen ? styles.show : ''}`}>
                                <h4 style={{ margin: '0 0 15px 0', fontSize: '16px', color: 'var(--text-color)', borderBottom: '1px solid rgba(128,128,128,0.2)', paddingBottom: '10px' }}>Notifications</h4>
                                {invitations.length === 0 ? (
                                    <div style={{ fontSize: '13px', color: '#888' }}>No new notifications.</div>
                                ) : (
                                    invitations.map(inv => (
                                        <div key={inv.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '13px', lineHeight: '1.4' }}><strong style={{color: '#fff'}}>{inv.parent_username}</strong> wants to connect with you.</span>
                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                <button onClick={() => handleRespondInvitation(inv.id, true)} style={{ flex: 1, padding: '8px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Accept</button>
                                                <button onClick={() => handleRespondInvitation(inv.id, false)} style={{ flex: 1, padding: '8px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Reject</button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                        </div>
                </header>

                {renderDashboardTab()}
                {renderUsersTab()}
                {renderAnalyticsTab()}
                {renderGamesTab()}
                  <ContentTab activeTab={activeTab} isSwitching={isSwitching} />
                {renderConsoleTab()}
                {renderFileTab()}
                {renderSettingsTab()}
                {renderBackupTab()}

                {/* MODALS */}
                {isAddModalOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsAddModalOpen(false)}>
                        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                            <h2 style={{marginBottom: '20px'}}>Add New User</h2>
                            <form onSubmit={handleAddUser}>
                                <div className={styles.formGroup}>
                                    <label>Email</label>
                                    <input type="email" required className={styles.formInput} value={modalForm.email} onChange={e => setModalForm({...modalForm, email: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Username (Optional)</label>
                                    <input type="text" className={styles.formInput} placeholder="Leave blank to auto-generate" value={modalForm.username} onChange={e => setModalForm({...modalForm, username: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Password</label>
                                    <input type="password" required className={styles.formInput} value={modalForm.password} onChange={e => setModalForm({...modalForm, password: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>First Name</label>
                                    <input type="text" className={styles.formInput} value={modalForm.firstName} onChange={e => setModalForm({...modalForm, firstName: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Last Name</label>
                                    <input type="text" className={styles.formInput} value={modalForm.lastName} onChange={e => setModalForm({...modalForm, lastName: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Role</label>
                                    <div className={styles.customSelectContainer}>
                                        <div 
                                            className={styles.customSelectBox} 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsFormRoleDropdownOpen(!isFormRoleDropdownOpen);
                                            }}
                                        >
                                            <span style={{ color: getRoleColor(modalForm.roleName) }}>{modalForm.roleName}</span>
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isFormRoleDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                                                <polyline points="6 9 12 15 18 9"></polyline>
                                            </svg>
                                        </div>
                                        <div className={`${styles.customSelectList} ${isFormRoleDropdownOpen ? styles.show : ''}`}>
                                            {['Student', 'Parent', 'Teacher', 'Admin'].map(role => (
                                                <div 
                                                    key={role} 
                                                    className={styles.customSelectOption}
                                                    style={{ color: modalForm.roleName === role ? getRoleColor(role) : undefined }}
                                                    onClick={() => {
                                                        setModalForm({...modalForm, roleName: role});
                                                        setIsFormRoleDropdownOpen(false);
                                                    }}
                                                >
                                                    {role}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" className={styles.cancelBtn} onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                                    <button type="submit" className={styles.confirmBtn}>Add User</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {isEditModalOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsEditModalOpen(false)}>
                        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                            <h2 style={{marginBottom: '20px'}}>Edit User: {selectedUser?.username}</h2>
                            <form onSubmit={handleEditUser}>
                                <div className={styles.formGroup}>
                                    <label>First Name</label>
                                    <input type="text" className={styles.formInput} value={modalForm.firstName} onChange={e => setModalForm({...modalForm, firstName: e.target.value})} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Last Name</label>
                                    <input type="text" className={styles.formInput} value={modalForm.lastName} onChange={e => setModalForm({...modalForm, lastName: e.target.value})} />
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" className={styles.cancelBtn} onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                                    <button type="submit" className={styles.confirmBtn}>Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {isResetModalOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsResetModalOpen(false)}>
                        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                            <h2 style={{marginBottom: '20px'}}>Reset Password: {selectedUser?.username}</h2>
                            <form onSubmit={handleResetPassword}>
                                <div className={styles.formGroup}>
                                    <label>New Password</label>
                                    <input type="text" required className={styles.formInput} value={modalForm.password} onChange={e => setModalForm({...modalForm, password: e.target.value})} />
                                </div>
                                <div className={styles.modalActions}>
                                    <button type="button" className={styles.cancelBtn} onClick={() => setIsResetModalOpen(false)}>Cancel</button>
                                    <button type="submit" className={styles.confirmBtn}>Reset</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                {isDeleteModalOpen && (
                    <div className={styles.modalOverlay} onClick={() => setIsDeleteModalOpen(false)}>
                        <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                            <h2 style={{marginBottom: '20px'}}>Delete User</h2>
                            <p>Are you sure you want to delete {selectedUser?.username}? This action cannot be undone.</p>
                            <div className={styles.modalActions}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
                                <button type="button" className={styles.deleteBtn} onClick={handleDeleteUser}>Delete Permanently</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
