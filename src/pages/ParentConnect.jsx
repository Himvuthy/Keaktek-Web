import { apiFetch } from '../api';
import { supabase } from '../supabaseClient';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ParentConnect.module.css';

const ParentConnect = () => {
    const [connectionCode, setConnectionCode] = useState('');
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const [isDark, setIsDark] = useState(false);
    const [isKhmer, setIsKhmer] = useState(false);

    useEffect(() => {
        const savedTheme = localStorage.getItem('studyapp-theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            document.body.classList.add('dark-mode');
            setIsDark(true);
        }

        const fetchPendingInvitations = async () => {
            const token = localStorage.getItem('studyapp_token');
            if (token) {
                try {
                    const res = await apiFetch('/users/parent-invitations', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.length > 0) {
                            setMessage(`Connection request sent! Please wait for your child to approve it on their account.`);
                        }
                    }
                } catch (err) {
                    console.error('Failed to fetch parent invitations', err);
                }
            }
        };
        fetchPendingInvitations();
        
        // Clean up classes when unmounting
        return () => {
            document.body.classList.remove('dark-theme');
        }
    }, []);

    const toggleTheme = () => {
        const newIsDark = !isDark;
        setIsDark(newIsDark);
        if (newIsDark) {
            document.body.classList.add('dark-theme');
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-theme');
            document.body.classList.remove('dark-mode');
        }
        localStorage.setItem('studyapp-theme', newIsDark ? 'dark' : 'light');
    };

    const navigate = useNavigate();

    const handleInvite = async (e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);
        setIsLoading(true);

        const token = localStorage.getItem('studyapp_token');
        try {
            const res = await apiFetch('/users/submit-connection-code', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` 
                },
                body: JSON.stringify({ code: connectionCode })
            });

            const data = await res.json();

            if (res.ok) {
                setMessage('Connection request sent! Please wait for your child to approve it on their account.');
                setConnectionCode('');
            } else {
                setError(data.error || 'Failed to send invitation.');
            }
        } catch (err) {
            setError('A network error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        localStorage.removeItem('studyapp_token');
        localStorage.removeItem('studyapp_user');
        navigate('/login');
    };

    const handleRefresh = async () => {
        // Simple manual check if any children are now connected to allow redirect to dashboard
        const user = JSON.parse(localStorage.getItem('studyapp_user'));
        const token = localStorage.getItem('studyapp_token');
        if (user && user.uid) {
            try {
                const res = await apiFetch(`/users/${user.uid}/children`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const children = await res.json();
                    if (children.length > 0) {
                        navigate('/dashboard');
                    } else {
                        setMessage('Your child has not accepted the invitation yet.');
                    }
                }
            } catch (err) {
                console.error(err);
            }
        }
    };

    return (
        <div className={styles.profileSetupWrapper}>
            <div className={styles.bgLayer}></div>

            <div className={styles.darkBgLayer}>
                <div className={`${styles.blob} ${styles.blob1}`}></div>
                <div className={`${styles.blob} ${styles.blob2}`}></div>
                <div className={`${styles.blob} ${styles.blob3}`}></div>
            </div>

            <div className={styles.glassCard} style={{ width: '480px', height: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: 'var(--text-color, #333)', margin: '0' }}>Connect with Your Child</h2>
                <p className={styles.subtitle}>
                    Before you can access the Parent Dashboard, you need to connect your account to your child's student account. 
                    <br/><br/>
                    Ask your child to log into their Student Dashboard and click "Generate Code". Enter the 6-digit code below:
                </p>
                
                {error && <div className={styles.errorAlert}>{error}</div>}
                {message && <div className={styles.successAlert}>{message}</div>}

                <form onSubmit={handleInvite} className={styles.form}>
                    <input 
                        type="text" 
                        placeholder="e.g. 123456" 
                        value={connectionCode}
                        onChange={(e) => setConnectionCode(e.target.value)}
                        className={styles.inputField}
                        required
                    />
                    <button type="submit" className={styles.submitBtn} disabled={isLoading || !connectionCode}>
                        {isLoading ? 'Verifying...' : 'Connect'}
                    </button>
                </form>

                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '10px', paddingTop: '20px', borderTop: '1px solid rgba(0,0,0,0.1)' }}>
                    <button onClick={handleRefresh} style={{ background: 'transparent', border: 'none', color: '#0000FF', cursor: 'pointer', fontWeight: 'bold' }}>
                        Check Status
                    </button>
                    <button onClick={handleLogout} style={{ background: 'transparent', border: 'none', color: '#ff4d4d', cursor: 'pointer', fontWeight: 'bold' }}>
                        Logout
                    </button>
                </div>
            </div>

            <div className={styles.themeToggleBtn} id="themeBtn" title="Toggle Dark Mode" onClick={toggleTheme}>
                <svg className={styles.sunIcon} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4"></circle><line x1="12" y1="2" x2="12" y2="4"></line><line x1="12" y1="20" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"></line><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"></line><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"></line>
                </svg>
                <svg className={styles.moonIcon} viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                </svg>
            </div>

            <div 
                className={`${styles.langToggle} ${isKhmer ? styles.khmer : ''}`} 
                id="langBtn" 
                title="Toggle Language"
                onClick={() => setIsKhmer(!isKhmer)}
            ></div>
        </div>
    );
};

export default ParentConnect;
