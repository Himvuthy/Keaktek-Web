import { apiFetch } from '../api';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './ProfileSetup.module.css';

export default function ProfileSetup() {
    const [isDark, setIsDark] = useState(false);
    const [isKhmer, setIsKhmer] = useState(false);
    
    const [step, setStep] = useState(1);
    const [username, setUsername] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    
    const [selectedYear, setSelectedYear] = useState('');
    
    const [gradeSelectOpen, setGradeSelectOpen] = useState(false);
    const [selectedGrade, setSelectedGrade] = useState('');

    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [error, setError] = useState('');

    const [carouselIndex, setCarouselIndex] = useState(2);
    const totalAvatars = 10;
    
    const navigate = useNavigate();
    const { user, token, updateUser } = useAuth();
    
    const carouselRef = useRef(null);
    const isScrolling = useRef(false);

    // Clear suggestions when first or last name changes so they re-fetch
    useEffect(() => {
        setSuggestions([]);
    }, [firstName, lastName]);

    useEffect(() => {
        if (step === 2 && firstName && lastName && suggestions.length === 0) {
            const fetchSuggestions = async () => {
                setLoadingSuggestions(true);
                try {
                    const res = await apiFetch('/auth/suggest-usernames', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ firstName, lastName })
                    });
                    const data = await res.json();
                    if (res.ok) {
                        setSuggestions(data.suggestions || []);
                    }
                } catch (error) {
                    console.error('Failed to fetch suggestions', error);
                } finally {
                    setLoadingSuggestions(false);
                }
            };
            fetchSuggestions();
        }
    }, [step, firstName, lastName]);

    useEffect(() => {
        const savedTheme = localStorage.getItem('studyapp-theme');
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-theme');
            document.body.classList.add('dark-mode');
            setIsDark(true);
        }
        
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

    const handleWheel = (e) => {
        if (isScrolling.current) return;
        isScrolling.current = true;

        if (e.deltaY > 0) {
            handleNext();
        } else {
            handlePrev();
        }

        setTimeout(() => { isScrolling.current = false; }, 250); 
    };

    const handleNext = () => {
        setCarouselIndex((prev) => (prev + 1) % totalAvatars);
    };

    const handlePrev = () => {
        setCarouselIndex((prev) => (prev - 1 + totalAvatars) % totalAvatars);
    };

    const handleAvatarClick = (index) => {
        let offset = (index - carouselIndex) % totalAvatars;
        if (offset < -Math.floor(totalAvatars / 2)) offset += totalAvatars;
        if (offset > Math.floor(totalAvatars / 2)) offset -= totalAvatars;
        
        if (Math.abs(offset) <= 2 && offset !== 0) {
            setCarouselIndex(index);
        }
    };

    const getAvatarStyle = (index) => {
        let offset = (index - carouselIndex) % totalAvatars;
        if (offset < -Math.floor(totalAvatars / 2)) offset += totalAvatars;
        if (offset > Math.floor(totalAvatars / 2)) offset -= totalAvatars;

        const positions = {
            center: { w: 200, h: 200, x: 0, opacity: 1, zIndex: 3, border: '4px solid white', shadow: '0 8px 25px rgba(0,0,0,0.25)' },
            right1: { w: 180, h: 180, x: 256, opacity: 0.8, zIndex: 2, border: '3px solid rgba(255, 255, 255, 0.4)', shadow: '0 4px 15px rgba(0,0,0,0.15)' },
            right2: { w: 140, h: 140, x: 482, opacity: 0.6, zIndex: 1, border: '3px solid rgba(255, 255, 255, 0.4)', shadow: '0 4px 10px rgba(0,0,0,0.1)' },
            left1:  { w: 180, h: 180, x: -256, opacity: 0.8, zIndex: 2, border: '3px solid rgba(255, 255, 255, 0.4)', shadow: '0 4px 15px rgba(0,0,0,0.15)' },
            left2:  { w: 140, h: 140, x: -482, opacity: 0.6, zIndex: 1, border: '3px solid rgba(255, 255, 255, 0.4)', shadow: '0 4px 10px rgba(0,0,0,0.1)' }
        };

        let state;
        if (offset === 0) state = positions.center;
        else if (offset === 1) state = positions.right1;
        else if (offset === 2) state = positions.right2;
        else if (offset === -1) state = positions.left1;
        else if (offset === -2) state = positions.left2;
        else {
            state = { w: 100, h: 100, x: Math.sign(offset) * 800, opacity: 0, zIndex: 0, border: 'none', shadow: 'none' };
        }

        return {
            width: `${state.w}px`,
            height: `${state.h}px`,
            transform: `translate(calc(-50% + ${state.x}px), -50%)`,
            opacity: state.opacity,
            zIndex: state.zIndex,
            border: state.border,
            boxShadow: state.shadow,
            pointerEvents: Math.abs(offset) <= 2 ? 'auto' : 'none'
        };
    };

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: currentYear - 1950 + 1 }, (_, i) => currentYear - i);
    const grades = [
        'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 
        'Grade 12 (Science)', 'Grade 12 (Non Science)', 'Casual Grade'
    ];

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest(`.${styles.customSelectWrapper}`)) {
                setGradeSelectOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handleConfirm = async () => {
        setError('');
        try {
            const res = await apiFetch('/auth/profile', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    birthYear: selectedYear,
                    grade: selectedGrade,
                    avatarIndex: carouselIndex,
                    username
                })
            });

            const data = await res.json();
            if (res.ok) {
                updateUser(data.user);
                navigate('/dashboard');
            } else {
                setError(data.error || 'Failed to update profile');
            }
        } catch (err) {
            setError('An error occurred. Please try again later.');
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

            <div className={styles.carouselWrapper} id="carouselWrapper" onWheel={handleWheel} ref={carouselRef}>
                <div className={styles.arrow} id="prevBtn" onClick={handlePrev}>
                    <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </div>
                
                <div className={styles.avatarContainer} id="avatarTrack">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div 
                            key={i} 
                            className={`${styles.avatar} ${styles[`pic${i+1}`]}`} 
                            style={getAvatarStyle(i)}
                            onClick={() => handleAvatarClick(i)}
                        ></div>
                    ))}
                </div>

                <div className={styles.arrow} id="nextBtn" onClick={handleNext}>
                    <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
            </div>

            <div className={styles.glassCard}>
                <div className={`${styles.sliderContainer} ${step === 1 ? styles.step1 : styles.step2}`}>
                    <div className={styles.stepWrapper}>
                        <div className={styles.formGroup}>
                            {error && step === 1 && <div style={{ color: '#ff4d4d', marginBottom: '10px', textAlign: 'center' }}>{error}</div>}
                    <input 
                        type="text" 
                        className={styles.formInput} 
                        placeholder="First name" 
                        value={firstName} 
                        onChange={(e) => setFirstName(e.target.value)} 
                    />
                    <input 
                        type="text" 
                        className={styles.formInput} 
                        placeholder="Last name" 
                        value={lastName} 
                        onChange={(e) => setLastName(e.target.value)} 
                    />
                    
                    <input 
                        type="number" 
                        className={styles.formInput} 
                        placeholder="Birth year" 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(e.target.value)}
                        min="1950"
                        max={new Date().getFullYear()}
                    />

                    {user?.role !== 'Parent' && (
                        <div className={`${styles.customSelectWrapper} ${gradeSelectOpen ? styles.open : ''}`}>
                            <div 
                                className={`${styles.customSelectDisplay} ${selectedGrade ? styles.hasValue : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setGradeSelectOpen(!gradeSelectOpen);
                                }}
                            >
                                {selectedGrade || 'Grade'}
                            </div>
                            <ul className={styles.customSelectOptions}>
                                {grades.map(g => (
                                    <li key={g} onClick={() => { setSelectedGrade(g); setGradeSelectOpen(false); }}>{g}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    
                    <button className={styles.confirmBtn} onClick={() => {
                        if (!firstName || !lastName || !selectedYear) {
                            setError('Please fill in all fields');
                            return;
                        }
                        setError('');
                        setStep(2);
                    }}>Next</button>
                        </div>
                    </div>
                    
                    <div className={styles.stepWrapper}>
                        <div className={styles.formGroup}>
                            <h2 className={styles.stepTitle}>Choose your username</h2>
                            {error && step === 2 && <div style={{ color: '#ff4d4d', marginBottom: '10px', textAlign: 'center' }}>{error}</div>}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '330px' }}>
                                <input 
                                    type="text" 
                                    className={styles.formInput} 
                                    placeholder="Username" 
                                    value={username} 
                                    onChange={(e) => setUsername(e.target.value)}
                                    style={{ width: '100%' }}
                                />
                                {step === 2 && (suggestions.length > 0 || loadingSuggestions) && (
                                    <div className={styles.suggestionsContainer} style={{ marginTop: 0, width: '100%' }}>
                                        {loadingSuggestions ? (
                                            <div style={{ fontSize: '12px', color: '#888' }}>Loading suggestions...</div>
                                        ) : (
                                            suggestions.map(s => (
                                                <div key={s} className={styles.suggestionBadge} onClick={() => setUsername(s)}>
                                                    {s}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '10px', width: '330px', marginTop: 'auto' }}>
                                <button className={styles.secondaryBtn} onClick={() => { setError(''); setStep(1); }}>Back</button>
                                <button className={styles.confirmBtn} onClick={handleConfirm} style={{flex: 1, marginTop: 0}}>Confirm</button>
                            </div>
                        </div>
                    </div>
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
}
