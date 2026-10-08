import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import StudyBackground from '../components/StudyBackground';
import logoLight from '../assets/logo.png';
import logoDark from '../assets/logo-dark.png';
import loginBgLight from '../assets/login-bg.png';
import loginBgDark from '../assets/login-bg-dark.png';

import styles from './Login.module.css';

export default function ParentLogin() {
    const [isDark, setIsDark] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login, user } = useAuth();

    // Check saved theme
    useEffect(() => {
        const savedTheme = localStorage.getItem('studyapp-theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
            setIsDark(true);
        }
    }, []);

    // Redirect if already logged in
    useEffect(() => {
        if (user) {
            navigate('/dashboard');
        }
    }, [user, navigate]);

    const toggleTheme = () => {
        const newIsDark = !isDark;
        setIsDark(newIsDark);
        if (newIsDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        localStorage.setItem('studyapp-theme', newIsDark ? 'dark' : 'light');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        if (!identifier || !password) {
            setError('Please fill in both fields.');
            return;
        }

        try {
            const response = await apiFetch(`/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email: identifier, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Login failed.');
                return;
            }

            login(data.user, data.token);
            navigate('/dashboard');
        } catch (err) {
            console.error('Login error:', err);
            setError('An error occurred. Please try again.');
        }
    };

    const sunPath = <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41M12 7a5 5 0 100 10 5 5 0 000-10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>;
    const moonPath = <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>;

    return (
        <div className={styles.loginWrapper}>
            <StudyBackground isDark={isDark} />
            <div className={styles.websiteCanvas}>
                <div className={styles.leftPanel}>
                    <img src={isDark ? loginBgDark : loginBgLight} alt="" className={styles.bgImage} />
                    
                    {/* Dynamic Logo */}
                    <div className={styles.logoContainer}>
                        <img src={isDark ? logoDark : logoLight} alt="Keaktek Logo" className={styles.uploadedLogo} />
                        <span className={styles.logoText}>Keaktek</span>
                    </div>
                    
                    <button 
                        onClick={toggleTheme}
                        className={styles.themeToggleBtn} 
                        aria-label="Toggle Dark Mode"
                        style={{ color: isDark ? '#F3F4F6' : '#F59E0B' }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            {isDark ? moonPath : sunPath}
                        </svg>
                    </button>
                </div>
                
                <div className={styles.rightPanel}>
                    <h1 className={styles.loginTitle}>Parent Login</h1>
                    
                    <form className={styles.loginForm} onSubmit={handleLogin}>
                        <div className={`${styles.inputGroup} ${styles.emailGroup}`}>
                            <label className={styles.inputLabel}>Phone number or Username</label>
                            <input 
                                type="text" 
                                className={`${styles.inputBox} ${error ? styles.error : ''}`}
                                placeholder="Enter your phone number or Username"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                            />
                        </div>

                        <div className={`${styles.inputGroup} ${styles.passwordGroup}`}>
                            <label className={styles.inputLabel}>Password</label>
                            <input 
                                type="password" 
                                className={`${styles.inputBox} ${error ? styles.error : ''}`}
                                placeholder="Enter your password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>

                        {error && (
                            <span className={styles.inputErrorText} style={{ display: 'block', marginBottom: '10px' }}>
                                {error}
                            </span>
                        )}

                        <button type="submit" className={`${styles.actionButton} ${styles.loginBtn}`}>Login</button>

                        <div className={styles.signupText}>
                            No account? <Link to="/parent-register" className={styles.signupLink}>Sign up as Parent</Link>
                        </div>

                        <div className={styles.signupText} style={{ marginTop: '24px' }}>
                            <Link to="/login" style={{ color: 'var(--text-muted)', fontWeight: '600', textDecoration: 'none', fontSize: '14px' }}>Login as Student</Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}


