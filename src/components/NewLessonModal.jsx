import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import styles from './NewModal.module.css';
import CustomSelect from './CustomSelect';

const GRADE_OPTIONS = [
    { value: 'Grade 6', label: 'Grade 6' },
    { value: 'Grade 7', label: 'Grade 7' },
    { value: 'Grade 8', label: 'Grade 8' },
    { value: 'Grade 9', label: 'Grade 9' },
    { value: 'Grade 10', label: 'Grade 10' },
    { value: 'Grade 11', label: 'Grade 11' },
    { value: 'Grade 12 - Science', label: 'Grade 12 - Science' },
    { value: 'Grade 12 - Social Science', label: 'Grade 12 - Social Science' },
    { value: 'Casual', label: 'Casual' },
];

export default function NewLessonModal({ editingItem, onClose }) {
    const queryClient = useQueryClient();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [form, setForm] = useState({
        title: '',
        subjectName: '',
        grade: '',
        xpReward: 0,
        youtubeURL: '',
        summarize: '',
        description: ''
    });

    useEffect(() => {
        if (editingItem) {
            setForm({
                title: editingItem.title || '',
                subjectName: editingItem.subjectname || '', // Note: we need subjectname joined in the list API, or just default it
                grade: editingItem.grade || '',
                xpReward: editingItem.xpreward || 0,
                youtubeURL: editingItem.youtubeurl || '',
                summarize: editingItem.summarize || '',
                description: editingItem.description || ''
            });
        }
    }, [editingItem]);

    const getOrCreateSubjectId = async (subjectName) => {
        if (!subjectName) return null;
        const token = localStorage.getItem('studyapp_token');
        
        // 1. Fetch all subjects
        const res = await fetch(import.meta.env.VITE_API_URL + '/subjects', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const subjects = await res.json();
        
        // 2. Find case-insensitive match
        const existing = subjects.find(s => s.subjectname.toLowerCase() === subjectName.toLowerCase());
        if (existing) return existing.subjectid;
        
        // 3. Create new if not found
        const createRes = await fetch(import.meta.env.VITE_API_URL + '/subjects', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ subjectName })
        });
        const newSubject = await createRes.json();
        return newSubject.subjectid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        
        try {
            const token = localStorage.getItem('studyapp_token');
            const subjectId = await getOrCreateSubjectId(form.subjectName);
            
            const payload = {
                title: form.title,
                subjectId,
                grade: form.grade,
                xpReward: form.xpReward,
                youtubeURL: form.youtubeURL,
                summarize: form.summarize,
                description: form.description
            };

            const method = editingItem ? 'PUT' : 'POST';
            const endpoint = editingItem ? `/lessons/${editingItem.id}` : '/lessons';
            
            // Optimistic UI update
            if (editingItem) {
                queryClient.setQueryData(['contentData'], (old) => {
                    if (!old) return [];
                    return old.map(c => c.id === editingItem.id && c.type === 'Lesson' ? { ...c, ...payload, subjectname: form.subjectName, updatedat: new Date().toISOString() } : c);
                });
            }
            onClose(); // Close modal immediately for snappy UX
            
            fetch(import.meta.env.VITE_API_URL + endpoint, {
                method,
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(res => {
                if (!res.ok) throw new Error('Failed to save lesson');
                queryClient.invalidateQueries({ queryKey: ['contentData'] });
            }).catch(err => {
                console.error('Failed to save lesson', err);
                queryClient.invalidateQueries({ queryKey: ['contentData'] }); // rollback
            });

        } catch (err) {
            console.error('Failed to save lesson', err);
            setError('Failed to save lesson. Please check all fields.');
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modalFrame} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <button type="button" className={styles.backBtn} onClick={onClose}>
                        <svg viewBox="0 0 24 24" width="24" height="24" stroke="#8b5cf6" strokeWidth="2" fill="none"><polyline points="15 18 9 12 15 6"></polyline></svg>
                        <span style={{ color: '#8b5cf6', fontWeight: '500' }}>Back</span>
                    </button>
                    <h2 className={styles.headerTitle}>{editingItem ? 'Edit Lesson' : 'New Lesson'}</h2>
                    <div style={{width: 60}}></div>
                </div>
                
                <form className={styles.scrollArea} onSubmit={handleSubmit}>
                    {error && <div className={styles.errorBox}>{error}</div>}

                    <div className={styles.inputGroup}>
                        <label>Title</label>
                        <input type="text" placeholder="e.g. Introduction to React" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required />
                    </div>

                    <div className={styles.rowGroup}>
                        <div className={styles.inputGroup} style={{flex: 2}}>
                            <label>Subject / Category</label>
                            <input type="text" placeholder="e.g. Web Developr" value={form.subjectName} onChange={e => setForm({...form, subjectName: e.target.value})} required />
                        </div>
                        <div className={styles.inputGroup} style={{flex: 1}}>
                            <label>Grade</label>
                            <CustomSelect 
                                options={GRADE_OPTIONS} 
                                value={form.grade} 
                                onChange={val => setForm({...form, grade: val})} 
                                placeholder="Select"
                            />
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>XP Reward</label>
                        <input type="number" placeholder="50" value={form.xpReward} onChange={e => setForm({...form, xpReward: parseInt(e.target.value) || 0})} />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>YouTube URL</label>
                        <input type="text" placeholder="https://youtube.com/..." value={form.youtubeURL} onChange={e => setForm({...form, youtubeURL: e.target.value})} />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Summary</label>
                        <textarea placeholder="Brief summary of the lesson" value={form.summarize} onChange={e => setForm({...form, summarize: e.target.value})} rows={2} />
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Lesson Content</label>
                        <textarea placeholder="Write the core ideas here..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={5} />
                    </div>

                    <button type="submit" className={styles.submitBtn} disabled={loading}>
                        {loading ? 'Saving...' : 'Publish'}
                    </button>
                </form>
            </div>
        </div>
    );
}
