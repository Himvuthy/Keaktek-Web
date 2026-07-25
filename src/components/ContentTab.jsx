import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import styles from '../pages/AdminDashboard.module.css';
import ContentPreviewModal from './ContentPreviewModal';
import NewLessonModal from './NewLessonModal';
import NewQuizModal from './NewQuizModal';


export default function ContentTab({ activeTab, isSwitching }) {
    const queryClient = useQueryClient();
    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
    const [previewItem, setPreviewItem] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [itemToDelete, setItemToDelete] = useState(null);
    
    // Filter State
    const [filter, setFilter] = useState('All');
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
            console.log('Action: Fetching content data from server...');
            const token = localStorage.getItem('studyapp_token');
            const [lessonsRes, quizzesRes] = await Promise.all([
                fetch(import.meta.env.VITE_API_URL + '/lessons', { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(import.meta.env.VITE_API_URL + '/quizzes', { headers: { 'Authorization': `Bearer ${token}` } })
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
            
            // Sort by creation date if available, or just ID
            combined.sort((a, b) => b.id - a.id);
            return combined;
        },
        enabled: activeTab === 'Content'
    });

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString();
    };

    const handlePublishToggle = async (item) => {
        console.log(`Action: Toggling publish status for ${item.type} (ID: ${item.id})`);
        setActiveDropdown(null);
        
        // Optimistic UI update
        queryClient.setQueryData(['contentData'], (oldData) => {
            if (!oldData) return [];
            return oldData.map(c => 
                (c.id === item.id && c.type === item.type) ? { ...c, ispublished: !c.ispublished } : c
            );
        });

        const token = localStorage.getItem('studyapp_token');
        const endpoint = item.type === 'Lesson' ? `/lessons/${item.id}` : `/quizzes/${item.id}`;
        try {
            const res = await fetch(import.meta.env.VITE_API_URL + endpoint, {
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
        console.log(`Action: Confirmed delete for ${item.type} (ID: ${item.id})`);
        
        // Optimistic UI update
        queryClient.setQueryData(['contentData'], (oldData) => {
            if (!oldData) return [];
            return oldData.filter(c => !(c.id === item.id && c.type === item.type));
        });

        setItemToDelete(null);

        const token = localStorage.getItem('studyapp_token');
        const endpoint = item.type === 'Lesson' ? `/lessons/${item.id}` : `/quizzes/${item.id}`;
        try {
            await fetch(import.meta.env.VITE_API_URL + endpoint, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            // Background sync
            queryClient.invalidateQueries({ queryKey: ['contentData'] });
        } catch (err) {
            console.error('Failed to delete', err);
            queryClient.invalidateQueries({ queryKey: ['contentData'] });
        }
    };

    const openEditModal = (item) => {
        console.log(`Action: Opening edit modal for ${item.type} (ID: ${item.id})`);
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
        if (filter === 'Lesson' || filter === 'Quiz') return c.type === filter;
        if (filter === 'Published') return c.ispublished === true;
        if (filter === 'Unpublished') return c.ispublished === false;
        return true;
    });

    return (
        <div className={`${styles.pageContent} ${activeTab === 'Content' ? (isSwitching ? styles.animateFadeIn : '') : styles.hidden}`} style={{ display: activeTab === 'Content' ? 'flex' : 'none' }}>
            <div className={styles.tableHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                <h2>Content Management</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <div className={styles.filterWrapper} ref={filterContainerRef}>
                        <button className={`${styles.filterBtn} ${styles.tooltip} ${styles.tooltipBottom}`} data-tooltip="Filter Content" onClick={() => setIsFilterPopupOpen(!isFilterPopupOpen)}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        </button>
                        <div className={`${styles.filterPopup} ${styles.glassPanel} ${isFilterPopupOpen ? styles.show : ''}`}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#888' }}>Filter Content</h4>
                            {['All', 'Lesson', 'Quiz', 'Published', 'Unpublished'].map(t => (
                                <div key={t} className={styles.popupItem} onClick={() => { setFilter(t); setIsFilterPopupOpen(false); }}>
                                    <span style={{ fontWeight: filter === t ? 'bold' : 'normal' }}>{t}</span>
                                    {filter === t && <svg viewBox="0 0 24 24" width="14" height="14" stroke="#10b981" fill="none" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                </div>
                            ))}
                        </div>
                    </div>
                    <button className={styles.viewAllBtn} onClick={() => { setEditingItem(null); setIsLessonModalOpen(true); }}>New Lesson</button>
                    <button className={styles.viewAllBtn} onClick={() => { setEditingItem(null); setIsQuizModalOpen(true); }} style={{ background: '#3b82f6' }}>New Quiz</button>
                </div>
            </div>
            
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
                                <th>Created</th>
                                <th>Modified</th>
                                <th>XP Reward</th>
                                <th>Status</th>
                                <th style={{ width: '40px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredContents.map(item => (
                                <tr key={`${item.type}-${item.id}`}>
                                    <td>
                                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', background: item.type === 'Lesson' ? '#4ade8022' : '#3b82f622', color: item.type === 'Lesson' ? '#4ade80' : '#3b82f6' }}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td>{item.title}</td>
                                    <td>{formatDate(item.createdat)}</td>
                                    <td>{formatDate(item.updatedat || item.lasteditdate)}</td>
                                    <td>{item.xpreward || 0} XP</td>
                                    <td>
                                        <span className={`${styles.status} ${item.ispublished ? styles.active : styles.pending}`}>
                                            {item.ispublished ? 'Published' : 'Unpublished'}
                                        </span>
                                    </td>
                                    <td style={{ position: 'relative', textAlign: 'center' }}>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === item.id ? null : item.id); }}
                                            style={{ background: 'none', border: 'none', color: '#a0a0a0', cursor: 'pointer', fontSize: '18px', padding: '5px' }}
                                        >
                                            ⋮
                                        </button>
                                        {activeDropdown === item.id && (
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

            {previewItem && (
                <ContentPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
            )}

            {isLessonModalOpen && (
                <NewLessonModal editingItem={editingItem} onClose={() => { setIsLessonModalOpen(false); setEditingItem(null); }} />
            )}

            {isQuizModalOpen && (
                <NewQuizModal editingItem={editingItem} onClose={() => { setIsQuizModalOpen(false); setEditingItem(null); }} />
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
        </div>
    );
}
