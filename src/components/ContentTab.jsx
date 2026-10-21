import { apiFetch } from '../api';
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import styles from '../pages/AdminDashboard.module.css';
import ContentPreviewModal from './ContentPreviewModal';
import NewLessonModal from './NewLessonModal';
import NewQuizModal from './NewQuizModal';
import PlacementQuestionModal from './PlacementQuestionModal';

export default function ContentTab({ activeTab, isSwitching }) {
    const queryClient = useQueryClient();
    const isVisible = activeTab === 'Content';
    const [contentView, setContentView] = useState('all'); // 'all' | 'placement'
    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [isPlacementQuestionModalOpen, setIsPlacementQuestionModalOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [editingPlacementQuestion, setEditingPlacementQuestion] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [placementQuestionToDelete, setPlacementQuestionToDelete] = useState(null);
    
    // Filter State
    const [filter, setFilter] = useState('All');
    const [placementSubjectFilter, setPlacementSubjectFilter] = useState('All');
    const [placementSearch, setPlacementSearch] = useState('');
    const [isFilterPopupOpen, setIsFilterPopupOpen] = useState(false);
    const filterContainerRef = useRef(null);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const dropdownRef = useRef(null);

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterContainerRef.current && !filterContainerRef.current.contains(event.target)) {
                setIsFilterPopupOpen(false);
            }
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const { data: contents = [], isLoading: loading, error: queryError } = useQuery({
        queryKey: ['contentData'],
        queryFn: async () => {
            const token = localStorage.getItem('studyapp_token');
            const [lessonsRes, quizzesRes] = await Promise.all([
                apiFetch('/lessons', { headers: { 'Authorization': `Bearer ${token}` } }),
                apiFetch('/quizzes', { headers: { 'Authorization': `Bearer ${token}` } })
            ]);
            
            let lessons = [];
            let quizzes = [];
            let errors = [];
            
            if (lessonsRes.ok) lessons = await lessonsRes.json();
            else errors.push(`Lessons: ${lessonsRes.status}`);
            
            if (quizzesRes.ok) quizzes = await quizzesRes.json();
            else errors.push(`Quizzes: ${quizzesRes.status}`);
            
            if (errors.length === 2) throw new Error(errors.join(' | '));
            
            const combined = [
                ...(Array.isArray(lessons) ? lessons.map(l => ({ ...l, type: 'Lesson', id: l.lessonid })) : []),
                ...(Array.isArray(quizzes) ? quizzes.map(q => ({ ...q, type: 'Quiz', id: q.quizid })) : [])
            ];
            
            combined.sort((a, b) => b.id - a.id);
            return combined;
        },
        enabled: isVisible
    });

    const { data: placementQuestions = [], isLoading: loadingPlacement } = useQuery({
        queryKey: ['placementQuestions'],
        queryFn: async () => {
            const token = localStorage.getItem('studyapp_token');
            const res = await apiFetch('/placement-questions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to load placement questions');
            return await res.json();
        },
        enabled: isVisible
    });

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString();
    };

    const handlePublishToggle = async (item) => {
        setActiveDropdown(null);
        
        queryClient.setQueryData(['contentData'], (oldData) => {
            if (!oldData) return [];
            return oldData.map(c => 
                (c.id === item.id && c.type === item.type) ? { ...c, ispublished: !c.ispublished } : c
            );
        });

        const token = localStorage.getItem('studyapp_token');
        const endpoint = item.type === 'Lesson' ? `/lessons/${item.id}` : `/quizzes/${item.id}`;
        try {
            const res = await apiFetch(endpoint, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ ispublished: !item.ispublished })
            });
            if (!res.ok) throw new Error('Failed to toggle publish status');
            queryClient.invalidateQueries({ queryKey: ['contentData'] });
        } catch (err) {
            console.error('Failed to toggle publish', err);
            queryClient.invalidateQueries({ queryKey: ['contentData'] });
        }
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;
        const item = itemToDelete;
        
        queryClient.setQueryData(['contentData'], (oldData) => {
            if (!oldData) return [];
            return oldData.filter(c => !(c.id === item.id && c.type === item.type));
        });

        setItemToDelete(null);

        const token = localStorage.getItem('studyapp_token');
        const endpoint = item.type === 'Lesson' ? `/lessons/${item.id}` : `/quizzes/${item.id}`;
        try {
            await apiFetch(endpoint, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            queryClient.invalidateQueries({ queryKey: ['contentData'] });
            queryClient.invalidateQueries({ queryKey: ['placementQuestions'] });
        } catch (err) {
            console.error('Failed to delete', err);
            queryClient.invalidateQueries({ queryKey: ['contentData'] });
        }
    };

    const confirmDeletePlacementQuestion = async () => {
        if (!placementQuestionToDelete) return;
        const q = placementQuestionToDelete;
        setPlacementQuestionToDelete(null);
        const token = localStorage.getItem('studyapp_token');
        try {
            await apiFetch(`/placement-questions/${q.questionid}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            queryClient.invalidateQueries({ queryKey: ['placementQuestions'] });
            queryClient.invalidateQueries({ queryKey: ['contentData'] });
        } catch (err) {
            console.error('Failed to delete placement question', err);
        }
    };

    const openEditModal = (item) => {
        setActiveDropdown(null);
        setEditingItem(item);
        if (item.type === 'Lesson') {
            setIsLessonModalOpen(true);
        } else {
            setIsQuizModalOpen(true);
        }
    };

    const filteredContents = contents.filter(c => {
        if (filter === 'All') return true;
        if (filter === 'Placement') return !!c.is_placement;
        if (filter === 'Lesson' || filter === 'Quiz') return c.type === filter;
        if (filter === 'Published') return c.ispublished === true;
        if (filter === 'Unpublished') return c.ispublished === false;
        return true;
    });

    const placementSubjects = ['All', ...Array.from(new Set(placementQuestions.map(q => q.subjectname).filter(Boolean)))];
    const filteredPlacementQuestions = placementQuestions.filter(q => {
        const matchesSubject = placementSubjectFilter === 'All' || q.subjectname === placementSubjectFilter;
        const query = placementSearch.trim().toLowerCase();
        const matchesSearch = !query ||
            (q.questiontext || '').toLowerCase().includes(query) ||
            (q.topic || '').toLowerCase().includes(query) ||
            (q.subjectname || '').toLowerCase().includes(query) ||
            (q.grade || '').toLowerCase().includes(query);
        return matchesSubject && matchesSearch;
    });

    return (
        <div className={`${styles.pageContent} ${isVisible ? (isSwitching ? styles.animateFadeIn : '') : styles.hidden}`} style={{ display: isVisible ? 'flex' : 'none' }}>
            <div className={styles.tableHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0 }}>Content Management</h2>
                    <div style={{ display: 'flex', background: 'rgba(128,128,128,0.12)', padding: '4px', borderRadius: '10px', gap: '4px' }}>
                        <button
                            type="button"
                            onClick={() => setContentView('all')}
                            style={{
                                padding: '7px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '13px',
                                background: contentView === 'all' ? '#3b82f6' : 'transparent',
                                color: contentView === 'all' ? '#fff' : '#94a3b8',
                                transition: 'all 0.2s'
                            }}
                        >
                            Lessons & Quizzes
                        </button>
                        <button
                            type="button"
                            onClick={() => setContentView('placement')}
                            style={{
                                padding: '7px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '13px',
                                background: contentView === 'placement' ? '#8b5cf6' : 'transparent',
                                color: contentView === 'placement' ? '#fff' : '#94a3b8',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <span>🎯 Grade Placement Questions</span>
                            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '1px 7px', borderRadius: '999px', fontSize: '11px', color: '#fff' }}>
                                {placementQuestions.length}
                            </span>
                        </button>
                    </div>
                </div>

                {contentView === 'all' ? (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className={styles.filterWrapper} ref={filterContainerRef}>
                            <button className={`${styles.filterBtn} ${styles.tooltip} ${styles.tooltipBottom}`} data-tooltip="Filter Content" onClick={() => setIsFilterPopupOpen(!isFilterPopupOpen)}>
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                            </button>
                            <div className={`${styles.filterPopup} ${styles.glassPanel} ${isFilterPopupOpen ? styles.show : ''}`}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#888' }}>Filter Content</h4>
                                {['All', 'Lesson', 'Quiz', 'Placement', 'Published', 'Unpublished'].map(t => (
                                    <div key={t} className={styles.popupItem} onClick={() => { setFilter(t); setIsFilterPopupOpen(false); }}>
                                        <span style={{ fontWeight: filter === t ? 'bold' : 'normal' }}>{t}</span>
                                        {filter === t && <svg viewBox="0 0 24 24" width="14" height="14" stroke="#10b981" fill="none" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button className={styles.viewAllBtn} onClick={() => { setEditingItem(null); setIsLessonModalOpen(true); }}>New Lesson</button>
                        <button className={styles.viewAllBtn} onClick={() => { setEditingItem(null); setIsQuizModalOpen(true); }} style={{ background: '#3b82f6' }}>New Quiz</button>
                        <button className={styles.viewAllBtn} onClick={() => { setEditingPlacementQuestion(null); setIsPlacementQuestionModalOpen(true); }} style={{ background: '#8b5cf6' }}>+ Placement Question</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="Search topic, question, grade..."
                            value={placementSearch}
                            onChange={e => setPlacementSearch(e.target.value)}
                            style={{
                                padding: '8px 14px',
                                borderRadius: '10px',
                                border: '1px solid var(--border-input)',
                                background: 'var(--bg-input)',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                minWidth: '220px',
                                outline: 'none'
                            }}
                        />
                        <button
                            className={styles.viewAllBtn}
                            onClick={() => { setEditingPlacementQuestion(null); setIsPlacementQuestionModalOpen(true); }}
                            style={{ background: '#8b5cf6' }}
                        >
                            + Add Placement Question
                        </button>
                    </div>
                )}
            </div>
            
            {contentView === 'all' ? (
                <section className={`${styles.tableSection} ${styles.glassPanel}`}>
                    {queryError && (
                        <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderRadius: '8px', marginBottom: '15px' }}>
                            Error: {queryError.message}
                        </div>
                    )}
                    {loading ? <p>Loading content...</p> : (
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Title</th>
                                    <th>Subject / Grade</th>
                                    <th>Created</th>
                                    <th>XP Reward</th>
                                    <th>Status</th>
                                    <th style={{ width: '40px' }}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredContents.map(item => (
                                    <tr key={`${item.type}-${item.id}`}>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', background: item.type === 'Lesson' ? '#4ade8022' : '#3b82f622', color: item.type === 'Lesson' ? '#4ade80' : '#3b82f6' }}>
                                                    {item.type}
                                                </span>
                                                {item.is_placement && (
                                                    <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }}>
                                                        Placement
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.title}</div>
                                            {item.type === 'Quiz' && Array.isArray(item.questions) && (
                                                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: 2 }}>
                                                    {item.questions.length} question{item.questions.length === 1 ? '' : 's'}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
                                                {[item.subjectname, item.grade].filter(Boolean).join(' • ') || '-'}
                                            </span>
                                        </td>
                                        <td>{formatDate(item.createdat)}</td>
                                        <td>{item.xpreward || 0} XP</td>
                                        <td>
                                            <span className={`${styles.status} ${item.ispublished ? styles.active : styles.pending}`}>
                                                {item.ispublished ? 'Published' : 'Unpublished'}
                                            </span>
                                        </td>
                                        <td style={{ position: 'relative', textAlign: 'center' }}>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === `${item.type}-${item.id}` ? null : `${item.type}-${item.id}`); }}
                                                style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '18px', padding: '5px' }}
                                            >
                                                ⋮
                                            </button>
                                            {activeDropdown === `${item.type}-${item.id}` && (
                                                <div ref={dropdownRef} className={`${styles.filterPopup} ${styles.glassPanel} ${styles.show}`} style={{ position: 'absolute', right: '40px', top: '10px', minWidth: '120px', zIndex: 10, padding: '5px', textAlign: 'left' }}>
                                                    <div className={styles.popupItem} onClick={() => { setPreviewItem(item); setActiveDropdown(null); }}>Preview</div>
                                                    <div className={styles.popupItem} onClick={() => openEditModal(item)}>Edit</div>
                                                    <div className={styles.popupItem} onClick={() => handlePublishToggle(item)}>{item.ispublished ? 'Unpublish' : 'Publish'}</div>
                                                    <div className={styles.popupItem} onClick={() => { setItemToDelete(item); setActiveDropdown(null); }} style={{ color: '#ef4444' }}>Delete</div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredContents.length === 0 && (
                                    <tr><td colSpan="7" style={{ textAlign: 'center' }}>No content found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </section>
            ) : (
                <section className={`${styles.tableSection} ${styles.glassPanel}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {placementSubjects.map(subj => (
                                <button
                                    key={subj}
                                    type="button"
                                    onClick={() => setPlacementSubjectFilter(subj)}
                                    style={{
                                        padding: '6px 14px',
                                        borderRadius: '999px',
                                        border: placementSubjectFilter === subj ? '1px solid #8b5cf6' : '1px solid rgba(128,128,128,0.25)',
                                        background: placementSubjectFilter === subj ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                                        color: placementSubjectFilter === subj ? '#c4b5fd' : '#94a3b8',
                                        fontWeight: 600,
                                        fontSize: '12.5px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {subj === 'Math' ? 'Mathematics' : subj}
                                </button>
                            ))}
                        </div>
                        <span style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                            Showing {filteredPlacementQuestions.length} of {placementQuestions.length} placement questions
                        </span>
                    </div>

                    {loadingPlacement ? <p>Loading placement questions...</p> : (
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th style={{ width: '50px' }}>#</th>
                                    <th style={{ width: '160px' }}>Subject & Grade</th>
                                    <th style={{ width: '190px' }}>Diagnostic Topic</th>
                                    <th>Question & Answer Options</th>
                                    <th style={{ width: '130px', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPlacementQuestions.map((q, idx) => {
                                    const correctOpt = (q.options || []).find(o => o.iscorrect || o.isCorrect);
                                    return (
                                        <tr key={q.questionid}>
                                            <td style={{ fontWeight: 700, color: '#888' }}>{idx + 1}</td>
                                            <td>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                    <span style={{ alignSelf: 'flex-start', padding: '3px 8px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, background: q.subjectname === 'Physics' ? 'rgba(59, 130, 246, 0.18)' : 'rgba(139, 92, 246, 0.18)', color: q.subjectname === 'Physics' ? '#60a5fa' : '#a78bfa' }}>
                                                        {q.subjectname === 'Math' ? 'Mathematics' : q.subjectname}
                                                    </span>
                                                    <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>{q.grade}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399' }}>
                                                    {q.topic || 'General Concept'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '6px', lineHeight: 1.45, color: 'var(--text-primary)' }}>
                                                    {q.questiontext}
                                                </div>
                                                {correctOpt && (
                                                    <div style={{ fontSize: '12px', color: '#10b981', marginBottom: '3px' }}>
                                                        ✓ Correct: <strong>{correctOpt.option}</strong>
                                                    </div>
                                                )}
                                                {correctOpt?.rationale && (
                                                    <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                                                        💡 {correctOpt.rationale}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setEditingPlacementQuestion(q); setIsPlacementQuestionModalOpen(true); }}
                                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.4)', background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setPlacementQuestionToDelete(q)}
                                                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredPlacementQuestions.length === 0 && (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', padding: '24px' }}>
                                            No placement questions match your filter. Click "+ Add Placement Question" to create one.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </section>
            )}

            {previewItem && (
                <ContentPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
            )}

            {isLessonModalOpen && (
                <NewLessonModal editingItem={editingItem} onClose={() => { setIsLessonModalOpen(false); setEditingItem(null); }} />
            )}

            {isQuizModalOpen && (
                <NewQuizModal editingItem={editingItem} onClose={() => { setIsQuizModalOpen(false); setEditingItem(null); }} />
            )}

            {isPlacementQuestionModalOpen && (
                <PlacementQuestionModal
                    editingQuestion={editingPlacementQuestion}
                    onClose={() => { setIsPlacementQuestionModalOpen(false); setEditingPlacementQuestion(null); }}
                />
            )}

            {itemToDelete && (
                <div className={styles.modalOverlay} onClick={() => setItemToDelete(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h2 style={{marginBottom: '20px'}}>Delete {itemToDelete.type}</h2>
                        <p style={{marginBottom: '10px', color: '#64748b', lineHeight: '1.5'}}>
                            Are you sure you want to delete this {itemToDelete.type.toLowerCase()}?
                        </p>
                        <p style={{marginBottom: '24px', color: '#64748b'}}>This action cannot be undone.</p>
                        <div className={styles.modalActions}>
                            <button type="button" className={styles.cancelBtn} onClick={() => setItemToDelete(null)}>Cancel</button>
                            <button type="button" className={styles.deleteBtn} onClick={confirmDelete}>Delete Permanently</button>
                        </div>
                    </div>
                </div>
            )}

            {placementQuestionToDelete && (
                <div className={styles.modalOverlay} onClick={() => setPlacementQuestionToDelete(null)}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <h2 style={{marginBottom: '20px'}}>Delete Placement Question</h2>
                        <p style={{marginBottom: '10px', color: '#64748b', lineHeight: '1.5'}}>
                            Are you sure you want to delete this placement question ({placementQuestionToDelete.topic || 'Question'})?
                        </p>
                        <p style={{marginBottom: '24px', color: '#64748b'}}>This action cannot be undone.</p>
                        <div className={styles.modalActions}>
                            <button type="button" className={styles.cancelBtn} onClick={() => setPlacementQuestionToDelete(null)}>Cancel</button>
                            <button type="button" className={styles.deleteBtn} onClick={confirmDeletePlacementQuestion}>Delete Question</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
