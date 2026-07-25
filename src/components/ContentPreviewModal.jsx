import React, { useState, useEffect } from 'react';
import styles from './ContentPreviewModal.module.css';

export default function ContentPreviewModal({ item, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDetails = async () => {
            const token = localStorage.getItem('studyapp_token');
            const endpoint = item.type === 'Lesson' ? `/lessons/${item.id}` : `/quizzes/${item.id}`;
            try {
                const res = await fetch(import.meta.env.VITE_API_URL + endpoint, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to fetch details');
                const result = await res.json();
                setData(result);
            } catch (err) {
                setError(err.message);
            }
            setLoading(false);
        };
        fetchDetails();
    }, [item]);

    // Extract YouTube ID
    const getYoutubeId = (url) => {
        if (!url) return null;
        const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        return match ? match[1] : null;
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.mobileFrame} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <button className={styles.backBtn} onClick={onClose}>
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="#8b5cf6" strokeWidth="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        <span style={{ color: '#8b5cf6', fontWeight: '500' }}>Back</span>
                    </button>
                    <h2 className={styles.headerTitle}>{item.type} Preview</h2>
                    <div style={{width: 60}}></div> {/* Spacer for centering */}
                </div>

                <div className={styles.scrollArea}>
                    {loading && <div style={{textAlign: 'center', padding: 20}}>Loading preview...</div>}
                    {error && <div style={{textAlign: 'center', color: 'red', padding: 20}}>{error}</div>}
                    
                    {!loading && data && item.type === 'Lesson' && (
                        <div className={styles.previewContent}>
                            {data.youtubeurl && (
                                <div className={styles.videoCard}>
                                    <iframe 
                                        className={styles.videoPlayer}
                                        src={`https://www.youtube.com/embed/${getYoutubeId(data.youtubeurl)}`} 
                                        title="YouTube video player" 
                                        frameBorder="0" 
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                        allowFullScreen>
                                    </iframe>
                                    <a href={data.youtubeurl} target="_blank" rel="noreferrer" className={styles.watchOnYoutubeBtn}>
                                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.376.55 9.376.55s7.505 0 9.377-.55a3.016 3.016 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                        Watch on YouTube
                                    </a>
                                </div>
                            )}

                            <div className={styles.card}>
                                <h3 className={styles.cardTitle}>{data.title}</h3>
                                <div className={styles.cardMeta}>
                                    {data.subjectname || 'Unknown Subject'} • {data.xpreward || 0}XP
                                </div>
                            </div>

                            {(data.description || data.summarize) && (
                                <div className={styles.card}>
                                    <h4 className={styles.cardSectionTitle}>Summary & Content</h4>
                                    <p className={styles.cardText}>{data.description || data.summarize}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {!loading && data && item.type === 'Quiz' && (
                        <div className={styles.previewContent}>
                            <div className={styles.card}>
                                <h3 className={styles.cardTitle}>{data.title}</h3>
                                <div className={styles.cardMeta}>
                                    {(data.questions?.length || 0)} questions • {data.subjectname || 'Subject'} • {data.xpreward || 0}XP
                                </div>
                            </div>

                            {data.questions && data.questions.map((q, qIndex) => (
                                <div key={q.questionid} className={styles.card}>
                                    <div className={styles.questionHeader}>
                                        <div className={styles.questionNumber}>{qIndex + 1}</div>
                                        <div className={styles.questionText}>{q.questiontext}</div>
                                    </div>
                                    <div className={styles.optionsList}>
                                        {q.options && q.options.map((opt, oIndex) => {
                                            const letter = String.fromCharCode(65 + oIndex); // A, B, C, D
                                            return (
                                                <div key={opt.optionid} className={`${styles.optionItem} ${opt.iscorrect ? styles.correctOption : ''}`}>
                                                    <div className={styles.optionLetterBox}>
                                                        {opt.iscorrect ? (
                                                            <svg viewBox="0 0 24 24" width="16" height="16" stroke="white" strokeWidth="3" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        ) : (
                                                            letter
                                                        )}
                                                    </div>
                                                    <span className={styles.optionText}>{opt.option}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
