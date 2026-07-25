import React from 'react';
import styles from './Skeleton.module.css';

export default function Skeleton({ width = '100%', height = '20px', borderRadius = '8px', style = {}, circle = false }) {
  return (
    <div
      className={styles.skeleton}
      style={{
        width,
        height,
        borderRadius: circle ? '50%' : borderRadius,
        ...style
      }}
    />
  );
}
