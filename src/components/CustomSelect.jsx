import React, { useState, useRef, useEffect } from 'react';
import styles from './CustomSelect.module.css';

export default function CustomSelect({ options, value, onChange, placeholder = "Select", style }) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className={styles.selectContainer} ref={containerRef} style={style}>
            <div 
                className={`${styles.selectHeader} ${isOpen ? styles.open : ''}`} 
                onClick={() => setIsOpen(!isOpen)}
            >
                <span>{selectedOption ? selectedOption.label : placeholder}</span>
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg" className={isOpen ? styles.rotated : ''}>
                    <path d="M1 1.5L6 6.5L11 1.5" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </div>
            
            {isOpen && (
                <div className={styles.dropdownList}>
                    <div 
                        className={`${styles.dropdownItem} ${!value ? styles.selected : ''}`}
                        onClick={() => { onChange(''); setIsOpen(false); }}
                    >
                        {placeholder}
                    </div>
                    {options.map((opt) => (
                        <div 
                            key={opt.value}
                            className={`${styles.dropdownItem} ${value === opt.value ? styles.selected : ''}`}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
